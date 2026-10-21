import {assertInInjectionContext, computed, effect, inject, Injector, Signal, signal, untracked, WritableSignal} from '@angular/core';
import {isObservable, lastValueFrom, Observable} from 'rxjs';
import {FormContext, FieldNode, nodeOf} from './node';
import {buildSchema, LogicEntry, LogicItem, SchemaFn} from './schema';
import type {FieldTree, TargetedValidationError} from './types';
import {PathSegment, toSegments} from './util';

/** Errors an action returns (or `onError` maps a failure to): targeted by `field` or by `path` (relative). */
export type SubmitErrors = ReadonlyArray<TargetedValidationError> | null | undefined | void;

export type SubmitAction<T> = ($value: T, $field: FieldTree<T>) => SubmitErrors | Promise<SubmitErrors> | Observable<unknown>;

export interface SubmitOptions<T> {
    readonly action?: SubmitAction<T>;
    /** Wait for pending async validation before deciding. Default `true`. */
    readonly awaitPending?: boolean;
    /** Run the action even when the field is invalid. Default `false`. */
    readonly ignoreValidators?: boolean;
    /** Mark the field and its descendants touched first. Default `true`. */
    readonly markAsTouched?: boolean;
    /** Called instead of the action when invalid. Default: focus the first invalid control. */
    readonly onInvalid?: ($field: FieldTree<T>) => void;
    /**
     * Handles a thrown error (or Observable error): returned errors are attached like the action's own, and the
     * submit reports `false` either way. Without it the error is rethrown.
     */
    readonly onError?: ($error: unknown, $field: FieldTree<T>) => SubmitErrors;
}

export interface FormOptions<T> {
    /** Base of field names (`name` attributes). Default `form-<n>`. */
    readonly name?: string;
    readonly injector?: Injector;
    /** Defaults for `submit()` of this form. */
    readonly submission?: SubmitOptions<T>;
    /** Bound controls refuse input while a submit of their field (or an ancestor) runs. Default `true`. */
    readonly lockWhileSubmitting?: boolean;
}

let formCounter = 0;

class Form implements FormContext {
    public readonly root: FieldNode;
    protected readonly items = signal<ReadonlyArray<ReadonlyArray<LogicItem>>>([]);
    protected readonly byDepth: Signal<ReadonlyMap<number, ReadonlyArray<LogicEntry>>>;

    public constructor(
        public readonly model: WritableSignal<any>,
        public readonly injector: Injector,
        public readonly name: string,
        public readonly lockWhileSubmitting: boolean,
        public readonly submission: SubmitOptions<any> | undefined,
    ) {
        this.root = new FieldNode(this, null, null);
        this.byDepth = computed(() => {
            const result = new Map<number, Array<LogicEntry>>();
            const collect = ($items: ReadonlyArray<LogicItem>) => {
                for (const item of $items) {
                    if (item.kind === 'dynamic') {
                        collect(item.built());
                        continue;
                    }
                    const depth = (item.anchor?.depth ?? 0) + item.pattern.length;
                    let list = result.get(depth);
                    if (!list) {
                        result.set(depth, list = []);
                    }
                    list.push(item);
                }
            };
            for (const group of this.items()) {
                collect(group);
            }
            return result;
        });
    }

    public entriesAt($depth: number): ReadonlyArray<LogicEntry> {
        return this.byDepth().get($depth) ?? [];
    }

    public add($items: ReadonlyArray<LogicItem>): () => void {
        if ($items.length === 0) {
            return () => undefined;
        }
        this.items.update($ => [...$, $items]);
        return () => this.items.update($ => $.filter($group => $group !== $items));
    }
}

const forms = new WeakMap<FieldNode, Form>();

function formOf($node: FieldNode): Form {
    return forms.get($node.root)!;
}

/**
 * Creates a form over a model signal. The model is the single source of truth; fields are created when accessed
 * and follow the model when it changes.
 *
 * @example
 * const model = signal({email: '', lines: [] as Line[]});
 * const f = form(model, p => {
 *     required(p.email);
 *     applyEach(p.lines, line => required(line.sku));
 * });
 */
export function form<T>($model: WritableSignal<T>, $schema?: SchemaFn<T> | null, $options: FormOptions<T> = {}): FieldTree<T> {
    if (!$options.injector) {
        assertInInjectionContext(form);
    }
    const injector = $options.injector ?? inject(Injector);
    const instance = new Form(
        $model,
        injector,
        $options.name ?? `form-${++formCounter}`,
        $options.lockWhileSubmitting ?? true,
        $options.submission as SubmitOptions<any> | undefined,
    );
    forms.set(instance.root, instance);
    if ($schema) {
        instance.add(buildSchema(null, [], [], $schema as SchemaFn<any>));
    }
    return instance.root.fieldTree as unknown as FieldTree<T>;
}

/**
 * Adds rules to an existing form, at any time and at any field (an array item included: the rules follow the item
 * when it moves). Metadata such as `required` updates too. Returns a function removing the rules again.
 */
export function applySchema<T>($field: FieldTree<T>, $schema: SchemaFn<T>): () => void {
    const node = nodeOf($field);
    return formOf(node).add(buildSchema(node.depth === 0 ? null : node, [], [], $schema as SchemaFn<any>));
}

/** Field at a relative path (`'lines.0.sku'`, `['lines', 0, 'sku']`), `undefined` when it does not exist. */
export function fieldAt<V = unknown>($field: FieldTree<any>, $path: string | ReadonlyArray<PathSegment>): FieldTree<V> | undefined {
    return nodeOf($field).walk(toSegments($path))?.fieldTree as FieldTree<V> | undefined;
}

/** Focuses (and scrolls to) the first invalid bound control of a field, in document order. */
export function focusFirstInvalid($field: FieldTree<any>): boolean {
    const node = nodeOf($field);
    return untracked(() => node.invalid()) && node.focus();
}

/** Resolves once `$condition` is `true`. */
export function whenTrue($condition: () => boolean, $injector: Injector): Promise<void> {
    if (untracked($condition)) {
        return Promise.resolve();
    }
    return new Promise($resolve => {
        const ref = effect(() => {
            if ($condition()) {
                ref.destroy();
                $resolve();
            }
        }, {injector: $injector, manualCleanup: true});
    });
}

/**
 * Submits a field (a whole form or a part of it, e.g. a wizard step): clears errors of the previous submit, marks
 * fields touched, waits for pending validation, runs the action when valid and attaches the errors it returns.
 * Returns `true` when the action ran and reported no errors. A second submit while one runs returns `false`.
 */
export async function submit<T>($field: FieldTree<T>, $options?: SubmitOptions<T> | SubmitAction<T>): Promise<boolean> {
    const node = nodeOf($field);
    const instance = formOf(node);
    const options: SubmitOptions<T> = {
        ...(instance.submission as SubmitOptions<T> | undefined ?? {}),
        ...(typeof $options === 'function' ? {action: $options} : $options ?? {}),
    };
    if (untracked(node.submitting)) {
        return false;
    }
    node.setSubmitting(true);
    try {
        node.clearForSubmit();
        if (options.markAsTouched !== false) {
            node.markAsTouched();
        }
        if (options.awaitPending !== false) {
            await whenTrue(() => !node.pending() || !node.attached(), instance.injector);
        }
        if (!options.ignoreValidators && untracked(node.invalid)) {
            if (options.onInvalid) {
                options.onInvalid($field);
            } else {
                node.focus();
            }
            return false;
        }
        if (!options.action) {
            return true;
        }
        const submitted = untracked(node.value) as T;
        let errors: SubmitErrors;
        let failed = false;
        try {
            const result = options.action(submitted, $field);
            if (isObservable(result)) {
                await lastValueFrom(result, {defaultValue: undefined});
            } else {
                errors = await result;
            }
        } catch (e) {
            if (!options.onError) {
                throw e;
            }
            failed = true;
            errors = options.onError(e, $field);
        }
        return !applySubmitErrors(node, submitted, errors) && !failed;
    } finally {
        node.setSubmitting(false);
    }
}

/** Attaches errors as source `'submit'`; errors for values that changed meanwhile are dropped. */
function applySubmitErrors($node: FieldNode, $submitted: unknown, $errors: SubmitErrors): boolean {
    if (!$errors || $errors.length === 0) {
        return false;
    }
    const byTarget = new Map<FieldNode, { value: unknown, errors: Array<TargetedValidationError> }>();
    for (const error of $errors) {
        const {field, path, ...rest} = error;
        let target: FieldNode | undefined;
        let value: unknown;
        if (field) {
            target = nodeOf(field);
            value = untracked(target.value);
        } else {
            const segments = path === undefined ? [] : toSegments(path);
            target = untracked(() => $node.walk(segments));
            value = valueAt($submitted, segments);
        }
        target ??= $node;
        const entry = byTarget.get(target) ?? {value, errors: []};
        entry.errors.push(rest as TargetedValidationError);
        byTarget.set(target, entry);
    }
    for (const [target, {value, errors}] of byTarget) {
        target.setErrors('submit', errors, {stale: 'on-change', forValue: value});
    }
    return true;
}

function valueAt($root: unknown, $segments: ReadonlyArray<string>): unknown {
    let current: any = $root;
    for (const segment of $segments) {
        if (current === null || typeof current !== 'object') {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
