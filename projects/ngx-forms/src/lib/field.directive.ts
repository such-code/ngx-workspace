import {
    afterRenderEffect,
    computed,
    DestroyRef,
    Directive,
    effect,
    ElementRef,
    inject,
    InjectionToken,
    input,
    Renderer2,
    Signal,
    untracked,
} from '@angular/core';
import type {FieldState, FieldTree, ValidationError} from './types';
import {FieldBindingRef, FieldNode, nodeOf} from './node';
import {DEBOUNCE} from './metadata';

/** Rewrites typed text (uppercase, digits only, masks): see `[ngxNormalize]`. */
export type NormalizeFn = ($value: string) => string;

/** What a custom control needs from the field it is bound to. Get it with `injectFieldControl()`. */
export interface FieldControl<T> {
    readonly field: Signal<FieldTree<T>>;
    readonly state: Signal<FieldState<T>>;
    readonly value: Signal<T>;
    /** Input must not be accepted: disabled, readonly or locked by a running submit. */
    readonly locked: Signal<boolean>;

    /** Writes a value entered by the user (marks the field dirty). */
    setValue($value: T): void;

    /** The user left the control. */
    touch(): void;

    /** Reports text that could not be turned into a value; `[]` clears. The model keeps its last valid value. */
    setParseErrors($errors: ReadonlyArray<ValidationError>): void;
}

export const NGX_FIELD = new InjectionToken<FieldControl<any>>('NGX_FIELD');

/** For custom controls: the field bound with `[ngxField]` on the control's host element. */
export function injectFieldControl<T>(): FieldControl<T> {
    return inject(NGX_FIELD) as FieldControl<T>;
}

type NativeKind = 'text' | 'number' | 'date' | 'checkbox' | 'radio' | 'select' | 'select-multiple' | 'file';

const DATE_TYPES = new Set(['date', 'datetime-local', 'month', 'week', 'time']);
const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password']);

function nativeKind($element: HTMLElement): NativeKind | null {
    if ($element instanceof HTMLTextAreaElement) {
        return 'text';
    }
    if ($element instanceof HTMLSelectElement) {
        return $element.multiple ? 'select-multiple' : 'select';
    }
    if ($element instanceof HTMLInputElement) {
        const type = $element.type;
        if (type === 'checkbox' || type === 'radio' || type === 'file') {
            return type;
        }
        if (type === 'number' || type === 'range') {
            return 'number';
        }
        return DATE_TYPES.has(type) ? 'date' : 'text';
    }
    return null;
}

const NOT_COMMITTED: unique symbol = Symbol('not committed');

/**
 * Binds a field to a native control (`input`, `textarea`, `select`) or to a custom control that calls
 * `injectFieldControl()`.
 *
 * Native controls get their value, `name`, `disabled`, `readonly`, `required`, `min`/`max` and
 * `minlength`/`maxlength` from the field, all reactive (rules added later included). Text that can not be parsed
 * (e.g. a bad number) becomes a `parse` error and leaves the model unchanged. `debounce()` rules delay commits.
 *
 * @example
 * <input [ngxField]="f.email">
 * @for (line of f.lines; track line) { <input [ngxField]="line.sku"> }
 */
@Directive({
    selector: '[ngxField]',
    exportAs: 'ngxField',
    providers: [{provide: NGX_FIELD, useExisting: NgxField}],
    host: {
        '(focusout)': 'handleBlur()',
    },
})
export class NgxField<T = unknown> implements FieldControl<T>, FieldBindingRef {
    public readonly field = input.required<FieldTree<T>>({alias: 'ngxField'});

    public readonly element: HTMLElement = inject(ElementRef).nativeElement;
    public readonly state: Signal<FieldState<T>> = computed(() => this.field()());
    public readonly value: Signal<T> = computed(() => this.state().value());
    public readonly locked = computed(() => this.state().locked());

    protected readonly renderer = inject(Renderer2);
    protected readonly kind = nativeKind(this.element);
    protected readonly normalizers: Array<{ readonly fn: () => NormalizeFn, readonly on: () => 'input' | 'blur' }> = [];
    /** Last value this control wrote, so the model echo does not rewrite what the user is typing. */
    protected committed: unknown = NOT_COMMITTED;
    protected debounceTimer: ReturnType<typeof setTimeout> | null = null;
    protected pendingCommit: (() => void) | null = null;

    public constructor() {
        const destroyRef = inject(DestroyRef);

        // Register with the field (focus, first invalid control); follows field changes.
        effect($onCleanup => {
            const node: FieldNode = nodeOf(this.field());
            node.bindings.add(this);
            $onCleanup(() => node.bindings.delete(this));
        });

        if (this.kind === null) {
            // Custom control: it reads and writes through `injectFieldControl()`; only accessibility here.
            afterRenderEffect({
                write: () => {
                    const state = this.state();
                    this.attribute('aria-required', state.required() ? 'true' : null);
                    this.attribute('aria-disabled', state.disabled() ? 'true' : null);
                    this.attribute('aria-readonly', state.readonly() ? 'true' : null);
                },
            });
            destroyRef.onDestroy(() => this.cancelCommit());
            return;
        }

        const listener = () => this.handleInput();
        const event = this.kind === 'text' || this.kind === 'number' || this.kind === 'date' ? 'input' : 'change';
        this.element.addEventListener(event, listener);

        let rendered = false;
        // Model -> view; after rendering, so `<option>`s from `@for` exist before a `<select>` value is set.
        afterRenderEffect({
            write: () => {
                const value = this.state().value();
                rendered = true;
                if (this.committed !== NOT_COMMITTED && Object.is(value, this.committed)) {
                    return;
                }
                untracked(() => {
                    this.cancelCommit();
                    this.committed = NOT_COMMITTED;
                    this.writeElement(value);
                });
            },
        });

        // Options rendered later (e.g. depending on another field) need the value again.
        let observer: MutationObserver | null = null;
        if (this.element instanceof HTMLSelectElement && typeof MutationObserver !== 'undefined') {
            // Only once the field input is set: options may be created before it is.
            observer = new MutationObserver(() => rendered && untracked(() => this.writeElement(this.state().value())));
            observer.observe(this.element, {childList: true, subtree: true});
        }

        const ownName = !this.element.hasAttribute('name');
        const supportsReadonly = this.kind === 'text' || this.kind === 'number' || this.kind === 'date';
        afterRenderEffect({
            write: () => {
                const state = this.state();
                const element = this.element as HTMLInputElement;
                if (ownName) {
                    this.attribute('name', state.name());
                }
                // Readonly select/checkbox/radio do not exist natively: they are disabled instead.
                this.property('disabled', state.disabled() || (state.locked() && !(supportsReadonly && state.readonly())));
                if (supportsReadonly) {
                    this.property('readOnly', state.readonly());
                }
                this.attribute('required', state.required() ? '' : null);
                this.attribute('aria-required', state.required() ? 'true' : null);
                const textual = element instanceof HTMLTextAreaElement || TEXT_TYPES.has(element.type);
                this.attribute('minlength', textual ? state.minLength()?.toString() ?? null : null);
                this.attribute('maxlength', textual ? state.maxLength()?.toString() ?? null : null);
                this.attribute('min', this.kind === 'number' ? state.min()?.toString() ?? null : null);
                this.attribute('max', this.kind === 'number' ? state.max()?.toString() ?? null : null);
            },
        });

        destroyRef.onDestroy(() => {
            this.element.removeEventListener(event, listener);
            observer?.disconnect();
            // Leaving the view commits what was typed; nothing writes to a removed field.
            this.flushCommit();
        });
    }

    // FieldControl

    public setValue($value: T): void {
        const state = untracked(this.state);
        if (untracked(state.locked)) {
            return;
        }
        this.committed = $value;
        state.value.set($value);
        state.markAsDirty();
    }

    public touch(): void {
        untracked(this.state).markAsTouched({skipDescendants: true});
    }

    public setParseErrors($errors: ReadonlyArray<ValidationError>): void {
        untracked(this.state).setErrors('parse', $errors, {stale: 'on-change'});
    }

    // FieldBindingRef

    public focus($options?: FocusOptions): void {
        this.element.focus($options);
        if (!$options?.preventScroll) {
            this.element.scrollIntoView?.({block: 'center'});
        }
    }

    /** @internal Used by `[ngxNormalize]`. */
    public addNormalizer($fn: () => NormalizeFn, $on: () => 'input' | 'blur'): () => void {
        const entry = {fn: $fn, on: $on};
        this.normalizers.push(entry);
        return () => this.normalizers.splice(this.normalizers.indexOf(entry), 1);
    }

    protected handleInput(): void {
        this.normalize('input');
        const commit = () => this.commitElement();
        const config = this.kind === 'text' || this.kind === 'number' || this.kind === 'date'
            ? untracked(() => this.state().metadata(DEBOUNCE)())
            : undefined;
        this.cancelCommit();
        if (config === undefined || config === 0) {
            commit();
            return;
        }
        this.pendingCommit = commit;
        if (typeof config === 'number') {
            this.debounceTimer = setTimeout(() => this.flushCommit(), config);
        }
    }

    protected handleBlur(): void {
        if (this.kind !== null && this.normalize('blur')) {
            this.cancelCommit();
            this.pendingCommit = () => this.commitElement();
        }
        this.flushCommit();
        this.touch();
    }

    /** Applies normalizers for `$on`; keeps the caret after the same characters. */
    protected normalize($on: 'input' | 'blur'): boolean {
        const element = this.element as HTMLInputElement | HTMLTextAreaElement;
        if (this.kind !== 'text' || this.normalizers.length === 0) {
            return false;
        }
        const active = this.normalizers.filter($ => $.on() === $on).map($ => $.fn());
        if (active.length === 0) {
            return false;
        }
        const apply = ($text: string) => active.reduce(($value, $fn) => $fn($value), $text);
        const raw = element.value;
        const normalized = apply(raw);
        if (normalized === raw) {
            return false;
        }
        const caret = element.selectionStart;
        element.value = normalized;
        if ($on === 'input' && caret !== null && document.activeElement === element) {
            const position = Math.min(apply(raw.slice(0, caret)).length, normalized.length);
            element.setSelectionRange(position, position);
        }
        return true;
    }

    protected cancelCommit(): void {
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingCommit = null;
    }

    protected flushCommit(): void {
        const commit = this.pendingCommit;
        this.cancelCommit();
        commit?.();
    }

    protected commitElement(): void {
        const result = this.readElement();
        if ('error' in result) {
            this.setParseErrors([result.error]);
            return;
        }
        this.setParseErrors([]);
        if (!Object.is(result.value, untracked(this.value))) {
            this.setValue(result.value as T);
        } else {
            this.committed = result.value;
        }
    }

    protected readElement(): { value: unknown } | { error: ValidationError } {
        const current = untracked(this.value) as unknown;
        switch (this.kind) {
            case 'checkbox':
                return {value: (this.element as HTMLInputElement).checked};
            case 'radio': {
                const element = this.element as HTMLInputElement;
                return element.checked ? {value: element.value} : {value: current};
            }
            case 'select-multiple':
                return {value: Array.from((this.element as HTMLSelectElement).selectedOptions, $ => $.value)};
            case 'file':
                return {value: Array.from((this.element as HTMLInputElement).files ?? [])};
            case 'number': {
                const element = this.element as HTMLInputElement;
                if (element.validity?.badInput) {
                    return {error: {kind: 'parse', message: 'Enter a valid number.'}};
                }
                if (element.value === '') {
                    return {value: null};
                }
                const value = element.valueAsNumber;
                return Number.isNaN(value) ? {error: {kind: 'parse', message: 'Enter a valid number.'}} : {value};
            }
            case 'date': {
                const element = this.element as HTMLInputElement;
                if (element.validity?.badInput) {
                    return {error: {kind: 'parse', message: 'Enter a valid date.'}};
                }
                if (current instanceof Date || (current === null && this.dateAsObject)) {
                    return {value: element.value === '' ? null : new Date(element.valueAsNumber)};
                }
                if (typeof current === 'number') {
                    return {value: element.value === '' ? null : element.valueAsNumber};
                }
                return {value: element.value};
            }
            default:
                return {value: (this.element as HTMLInputElement).value};
        }
    }

    /** Remembers the model type of date inputs once it was a `Date`. */
    protected dateAsObject = false;

    protected writeElement($value: unknown): void {
        switch (this.kind) {
            case 'checkbox':
                (this.element as HTMLInputElement).checked = !!$value;
                return;
            case 'radio': {
                const element = this.element as HTMLInputElement;
                element.checked = $value !== null && $value !== undefined && String($value) === element.value;
                return;
            }
            case 'select-multiple': {
                const selected = new Set((Array.isArray($value) ? $value : []).map(String));
                for (const option of Array.from((this.element as HTMLSelectElement).options)) {
                    option.selected = selected.has(option.value);
                }
                return;
            }
            case 'file':
                if ($value === null || $value === undefined || (Array.isArray($value) && $value.length === 0)) {
                    (this.element as HTMLInputElement).value = '';
                }
                return;
            case 'number': {
                const element = this.element as HTMLInputElement;
                const text = typeof $value === 'number' && !Number.isNaN($value) ? String($value) : '';
                if (element.value !== text) {
                    element.value = text;
                }
                return;
            }
            case 'date': {
                const element = this.element as HTMLInputElement;
                if ($value instanceof Date) {
                    this.dateAsObject = true;
                    element.valueAsNumber = $value.getTime();
                } else if (typeof $value === 'number') {
                    element.valueAsNumber = $value;
                } else {
                    element.value = typeof $value === 'string' ? $value : '';
                }
                return;
            }
            default: {
                const element = this.element as HTMLInputElement;
                const text = $value === null || $value === undefined ? '' : String($value);
                if (element.value !== text) {
                    element.value = text;
                }
            }
        }
    }

    protected property($name: 'disabled' | 'readOnly', $value: boolean): void {
        if ((this.element as any)[$name] !== $value) {
            this.renderer.setProperty(this.element, $name, $value);
        }
    }

    protected attribute($name: string, $value: string | null): void {
        if ($value === null) {
            if (this.element.hasAttribute($name)) {
                this.renderer.removeAttribute(this.element, $name);
            }
        } else if (this.element.getAttribute($name) !== $value) {
            this.renderer.setAttribute(this.element, $name, $value);
        }
    }
}
/**
 * Corrects text while it is typed (`on: 'input'`: uppercase, digits only, masks) or when the control loses focus
 * (`on: 'blur'`: trim). The model only ever receives normalized text, and the caret stays after the same
 * characters (assuming the function maps the text before the caret independently of what follows).
 *
 * @example
 * <input [ngxField]="f.iban" [ngxNormalize]="toIban">
 * <input [ngxField]="f.nick" [ngxNormalize]="normalizers.trim" ngxNormalizeOn="blur">
 */
@Directive({
    selector: '[ngxField][ngxNormalize]',
})
export class NgxNormalize {
    public readonly normalize = input.required<NormalizeFn>({alias: 'ngxNormalize'});
    public readonly on = input<'input' | 'blur'>('input', {alias: 'ngxNormalizeOn'});

    public constructor() {
        const remove = inject(NgxField).addNormalizer(() => this.normalize(), () => this.on());
        inject(DestroyRef).onDestroy(remove);
    }
}

/** Common normalizers for `[ngxNormalize]`. */
export const normalizers = {
    trim: (($: string) => $.trim()) as NormalizeFn,
    upper: (($: string) => $.toUpperCase()) as NormalizeFn,
    lower: (($: string) => $.toLowerCase()) as NormalizeFn,
    digits: (($: string) => $.replace(/\D+/g, '')) as NormalizeFn,
    collapseSpaces: (($: string) => $.replace(/\s+/g, ' ')) as NormalizeFn,
    /** Groups characters, e.g. `group(4)` turns `LV80BANK` into `LV80 BANK`. Strips spaces first. */
    group: ($size: number, $separator: string = ' '): NormalizeFn => ($: string) => $
        .replace(/\s+/g, '')
        .replace(new RegExp(`(.{${$size}})(?=.)`, 'g'), `$1${$separator}`),
};
