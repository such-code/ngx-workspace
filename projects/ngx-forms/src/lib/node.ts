import {computed, Injector, isDevMode, linkedSignal, Signal, signal, untracked, WritableSignal} from '@angular/core';
import type {
    ErrorStaleness,
    FieldError,
    FieldState,
    FieldTree,
    MarkAsTouchedOptions,
    SetErrorsOptions,
    TargetedValidationError,
    ValidationError,
    ValidationResult,
} from './types';
import {MAX, MAX_LENGTH, MetadataKey, MIN, MIN_LENGTH, PATTERN, REQUIRED} from './metadata';
import {ANY_SEGMENT, FieldContext, isValidationError, LogicEntry, SchemaPath, segmentsOf} from './schema';
import {AsyncRunner} from './async';
import {arrayIdentityEqual, deepEqual, errorListEqual, isContainer, isObject, PathSegment, toSegments} from './util';

/** @internal What a form shares with its fields. */
export interface FormContext {
    readonly name: string;
    readonly model: WritableSignal<any>;
    readonly injector: Injector;
    readonly lockWhileSubmitting: boolean;
    /** Logic entries whose pattern ends at this depth (absolute, root = 0). */
    entriesAt($depth: number): ReadonlyArray<LogicEntry>;
}

/** @internal A control bound to a field, registered by the binding directive. */
export interface FieldBindingRef {
    readonly element: HTMLElement | null;

    focus($options?: FocusOptions): void;
}

interface PushedEntry {
    readonly source: string;
    readonly errors: ReadonlyArray<FieldError>;
    readonly stale: ErrorStaleness;
    readonly whenSkipped: boolean;
}

interface Children {
    readonly kind: 'array' | 'object' | 'leaf';
    readonly nodes: ReadonlyArray<FieldNode>;
    /** Key (array index as string) -> node. */
    readonly byKey: ReadonlyMap<string, FieldNode>;
    readonly indexOf: ReadonlyMap<FieldNode, number>;
    /** `trackBy` keys of the items, when a `trackBy` rule applies. */
    readonly trackKeys: ReadonlyArray<unknown> | null;
}

const EMPTY_CHILDREN: Children = {kind: 'leaf', nodes: [], byKey: new Map(), indexOf: new Map(), trackKeys: null};
const EMPTY_ERRORS: ReadonlyArray<FieldError> = [];
const EMPTY_TARGETS: ReadonlyMap<FieldNode, ReadonlyArray<FieldError>> = new Map();
const NO_VALUE: unique symbol = Symbol('no value');

const NODE = Symbol('field-node');

/** @internal */
export function nodeOf($field: unknown): FieldNode {
    const node = typeof $field === 'function' ? ($field as any)[NODE] as FieldNode | undefined : undefined;
    if (!node) {
        throw new Error('Expected a field tree (a property of a form() result).');
    }
    return node;
}

export function isFieldTree($: unknown): $ is FieldTree<unknown> {
    return typeof $ === 'function' && !!($ as any)[NODE];
}

function sameValue($a: unknown, $b: unknown): boolean {
    return Object.is($a, $b) || ($a instanceof Date && $b instanceof Date && $a.getTime() === $b.getTime());
}

/** @internal Field implementation; the public face is `FieldState`. */
export class FieldNode implements FieldState<any> {
    public readonly depth: number;
    public readonly root: FieldNode;
    public readonly fieldTree: FieldTree<any>;

    /** Last value seen while attached; what a removed field keeps reporting. */
    protected lastValue: unknown = undefined;
    protected lastIndex = -1;
    /** Value the current children were built from. */
    protected reconciledValue: unknown = undefined;

    protected readonly selfTouched = signal(false);
    protected readonly selfDirty = signal(false);
    protected readonly selfSubmitting = signal(false);
    protected readonly pendingSources = signal<ReadonlySet<string>>(new Set());
    protected readonly hasPushed = signal(false);
    protected readonly pushed: WritableSignal<ReadonlyArray<PushedEntry>>;

    protected readonly ruleCache = new WeakMap<LogicEntry, Signal<any>>();
    protected readonly asyncRunners = new Map<LogicEntry, AsyncRunner>();
    protected readonly metadataCache = new Map<MetadataKey<any, any>, Signal<any>>();
    protected readonly contexts = new Map<FieldNode | null, FieldContext<any>>();
    /** Identity of array items written through their fields (or seen before), so they keep their node. */
    protected readonly identity = new WeakMap<object, FieldNode>();
    public readonly bindings = new Set<FieldBindingRef>();

    protected readonly current: Signal<any>;
    public readonly value: WritableSignal<any>;
    public readonly children: Signal<Children>;
    public readonly attached: Signal<boolean>;
    public readonly key: Signal<string>;
    public readonly path: Signal<ReadonlyArray<PathSegment>>;
    public readonly pathKey: Signal<string>;
    public readonly name: Signal<string>;
    public readonly logic: Signal<ReadonlyArray<LogicEntry>>;

    public readonly disabledReasons: Signal<ReadonlyArray<string>>;
    public readonly disabled: Signal<boolean>;
    public readonly hidden: Signal<boolean>;
    public readonly readonly: Signal<boolean>;
    public readonly submitting: Signal<boolean>;
    public readonly locked: Signal<boolean>;
    /** @internal Hidden or disabled: validators do not run, errors are not reported. */
    public readonly skipped: Signal<boolean>;

    /** @internal Validators, tree errors targeting this field and parse errors. */
    public readonly syncErrors: Signal<ReadonlyArray<FieldError>>;
    /** @internal No sync errors here or below. */
    public readonly syncTreeValid: Signal<boolean>;
    protected readonly validatorErrors: Signal<ReadonlyArray<FieldError>>;
    protected readonly treeErrors: Signal<ReadonlyArray<FieldError>>;
    protected readonly asyncErrors: Signal<ReadonlyArray<FieldError>>;
    protected readonly pushedErrors: Signal<ReadonlyArray<FieldError>>;
    protected readonly ownPending: Signal<boolean>;

    public readonly errors: Signal<ReadonlyArray<FieldError>>;
    public readonly errorSummary: Signal<ReadonlyArray<FieldError>>;
    public readonly invalid: Signal<boolean>;
    public readonly pending: Signal<boolean>;
    public readonly valid: Signal<boolean>;
    public readonly touched: Signal<boolean>;
    public readonly dirty: Signal<boolean>;

    public readonly required: Signal<boolean>;
    public readonly min: Signal<number | undefined>;
    public readonly max: Signal<number | undefined>;
    public readonly minLength: Signal<number | undefined>;
    public readonly maxLength: Signal<number | undefined>;
    public readonly pattern: Signal<ReadonlyArray<RegExp>>;

    public constructor(
        public readonly form: FormContext,
        public readonly parent: FieldNode | null,
        /** Object key; `null` for the root and for array items (their key is their current index). */
        protected readonly ownKey: string | null,
    ) {
        this.depth = parent ? parent.depth + 1 : 0;
        this.root = parent ? parent.root : this;
        this.fieldTree = createFieldTree(this);

        this.attached = parent
            ? computed(() => parent.attached() && parent.children().indexOf.has(this))
            : signal(true).asReadonly();

        this.key = computed(() => {
            if (!parent) {
                return '';
            }
            if (this.ownKey !== null) {
                return this.ownKey;
            }
            const index = parent.children().indexOf.get(this);
            if (index !== undefined) {
                this.lastIndex = index;
            }
            return String(this.lastIndex);
        });

        this.current = computed(() => {
            if (!parent) {
                return form.model();
            }
            // Not attached through the parent's (possibly frozen) value: removed, keep the last value.
            const index = parent.children().indexOf.get(this);
            if (index === undefined) {
                return this.lastValue;
            }
            const parentValue = parent.current() as any;
            const value = parentValue?.[this.ownKey ?? index];
            this.lastValue = value;
            return value;
        });

        const value = (() => this.current()) as WritableSignal<any>;
        value.set = ($value: any) => this.write($value);
        value.update = ($fn: ($value: any) => any) => this.write($fn(untracked(this.current)));
        value.asReadonly = () => this.current;
        this.value = value;

        this.children = linkedSignal<unknown, Children>({
            source: this.current,
            computation: ($value, $previous) => this.reconcile($value, $previous?.value ?? EMPTY_CHILDREN),
        });

        this.path = computed(() => {
            if (!parent) {
                return [];
            }
            const key = this.key();
            return [...parent.path(), this.ownKey === null ? Number(key) : key];
        }, {equal: arrayIdentityEqual});
        this.pathKey = computed(() => this.path().join('.'));
        this.name = computed(() => this.pathKey() ? `${form.name}.${this.pathKey()}` : form.name);

        this.logic = computed(() => form.entriesAt(this.depth).filter($ => this.matches($)), {equal: arrayIdentityEqual});

        this.disabledReasons = computed(() => {
            const own: Array<string> = [];
            for (const entry of this.logic()) {
                if (entry.kind === 'disabled' && this.isActive(entry)) {
                    const result = entry.fn(this.contextFor(entry.anchor));
                    if (result) {
                        own.push(typeof result === 'string' ? result : 'disabled');
                    }
                }
            }
            const inherited = parent?.disabledReasons() ?? [];
            return own.length === 0 ? inherited : [...inherited, ...own];
        }, {equal: arrayIdentityEqual});
        this.disabled = computed(() => this.disabledReasons().length > 0);
        this.hidden = computed(() => (parent?.hidden() ?? false) || this.anyFlag('hidden'));
        this.readonly = computed(() => (parent?.readonly() ?? false) || this.anyFlag('readonly'));
        this.submitting = computed(() => this.selfSubmitting() || (parent?.submitting() ?? false));
        this.locked = computed(() => this.disabled() || this.readonly() || (form.lockWhileSubmitting && this.submitting()));
        this.skipped = computed(() => this.hidden() || this.disabled());

        this.pushed = linkedSignal<unknown, ReadonlyArray<PushedEntry>>({
            // Only fields that ever received pushed errors follow their value.
            source: computed(() => this.hasPushed() ? this.current() : NO_VALUE, {equal: sameValue}),
            computation: (_, $previous) => $previous
                ? $previous.value.filter($ => $.stale !== 'on-change')
                : [],
        });

        this.validatorErrors = computed(() => {
            if (this.skipped()) {
                return EMPTY_ERRORS;
            }
            let result: Array<FieldError> | null = null;
            for (const entry of this.logic()) {
                if (entry.kind === 'validate') {
                    const errors = this.ruleErrors(entry)();
                    if (errors.length > 0) {
                        (result ??= []).push(...errors);
                    }
                }
            }
            return result ?? EMPTY_ERRORS;
        }, {equal: errorListEqual});

        this.treeErrors = computed(() => {
            if (this.skipped()) {
                return EMPTY_ERRORS;
            }
            let result: Array<FieldError> | null = null;
            for (let node: FieldNode | null = this; node; node = node.parent) {
                for (const entry of node.logic()) {
                    if (entry.kind === 'tree') {
                        const errors = node.treeTargets(entry)().get(this);
                        if (errors) {
                            (result ??= []).push(...errors);
                        }
                    }
                }
            }
            return result ?? EMPTY_ERRORS;
        }, {equal: errorListEqual});

        this.asyncErrors = computed(() => {
            const logic = this.logic();
            this.releaseRunners(logic);
            if (this.skipped()) {
                return EMPTY_ERRORS;
            }
            let result: Array<FieldError> | null = null;
            for (const entry of logic) {
                if (entry.kind === 'async') {
                    const errors = this.asyncRunner(entry).errors();
                    if (errors.length > 0) {
                        (result ??= []).push(...errors);
                    }
                }
            }
            return result ?? EMPTY_ERRORS;
        }, {equal: errorListEqual});

        this.pushedErrors = computed(() => {
            const entries = this.pushed();
            if (entries.length === 0) {
                return EMPTY_ERRORS;
            }
            const skipped = this.skipped();
            return entries.filter($ => !skipped || $.whenSkipped).flatMap($ => $.errors);
        }, {equal: errorListEqual});

        this.syncErrors = computed(() => {
            const parse = this.pushedErrors().filter($ => $.source === 'parse');
            return [...parse, ...this.validatorErrors(), ...this.treeErrors()];
        }, {equal: errorListEqual});
        this.syncTreeValid = computed(() => this.syncErrors().length === 0 && this.children().nodes.every($ => $.syncTreeValid()));

        this.errors = computed(() => {
            const pushed = this.pushedErrors();
            const errors = [...this.syncErrors(), ...this.asyncErrors(), ...pushed.filter($ => $.source !== 'parse')];
            return errors.length === 0 ? EMPTY_ERRORS : errors;
        }, {equal: errorListEqual});

        this.ownPending = computed(() => {
            if (this.skipped()) {
                return false;
            }
            if (this.pendingSources().size > 0) {
                return true;
            }
            for (const entry of this.logic()) {
                if (entry.kind === 'async' && this.asyncRunner(entry).pending()) {
                    return true;
                }
            }
            return false;
        });

        this.invalid = computed(() => this.errors().length > 0 || this.children().nodes.some($ => $.invalid()));
        this.pending = computed(() => this.ownPending() || this.children().nodes.some($ => $.pending()));
        this.valid = computed(() => !this.invalid() && !this.pending());
        this.errorSummary = computed(() => {
            const nodes = this.children().nodes;
            const own = this.errors();
            if (nodes.length === 0) {
                return own;
            }
            const result = [...own];
            for (const node of nodes) {
                result.push(...node.errorSummary());
            }
            return result;
        }, {equal: errorListEqual});
        this.touched = computed(() => this.selfTouched() || this.children().nodes.some($ => $.touched()));
        this.dirty = computed(() => this.selfDirty() || this.children().nodes.some($ => $.dirty()));

        this.required = this.metadata(REQUIRED);
        this.min = this.metadata(MIN);
        this.max = this.metadata(MAX);
        this.minLength = this.metadata(MIN_LENGTH);
        this.maxLength = this.metadata(MAX_LENGTH);
        this.pattern = this.metadata(PATTERN);
    }

    // Structure

    protected reconcile($value: unknown, $previous: Children): Children {
        if (!isContainer($value)) {
            this.disposeRemoved($previous, []);
            this.reconciledValue = $value;
            return EMPTY_CHILDREN;
        }
        let next: Children;
        if (Array.isArray($value)) {
            next = this.reconcileArray($value, $previous.kind === 'array' ? $previous : EMPTY_CHILDREN);
        } else {
            const previous = $previous.kind === 'object' ? $previous.byKey : new Map<string, FieldNode>();
            const nodes: Array<FieldNode> = [];
            const byKey = new Map<string, FieldNode>();
            const indexOf = new Map<FieldNode, number>();
            for (const key of Object.keys($value)) {
                const node = previous.get(key) ?? new FieldNode(this.form, this, key);
                indexOf.set(node, nodes.length);
                nodes.push(node);
                byKey.set(key, node);
            }
            next = {kind: 'object', nodes, byKey, indexOf, trackKeys: null};
        }
        this.disposeRemoved($previous, next.nodes);
        this.reconciledValue = $value;
        return next;
    }

    protected reconcileArray($items: ReadonlyArray<unknown>, $previous: Children): Children {
        const trackBy = untracked(() => this.logic().find($ => $.kind === 'trackBy'));
        const trackFn = trackBy?.kind === 'trackBy' ? trackBy.fn : null;
        const unmatched = new Set($previous.nodes);
        const nodes: Array<FieldNode | undefined> = Array.from({length: $items.length}, () => undefined);
        let trackKeys: Array<unknown> | null = null;

        if (trackFn) {
            trackKeys = $items.map(($item, $index) => trackFn($item, $index));
            const previousByKey = new Map<unknown, FieldNode>();
            $previous.trackKeys?.forEach(($key, $index) => previousByKey.set($key, $previous.nodes[$index]));
            trackKeys.forEach(($key, $index) => {
                const node = previousByKey.get($key);
                if (node && unmatched.delete(node)) {
                    nodes[$index] = node;
                }
            });
        } else {
            // Same object instance: same field, wherever it moved.
            $items.forEach(($item, $index) => {
                const node = isObject($item) ? this.identity.get($item) : undefined;
                if (node && unmatched.delete(node)) {
                    nodes[$index] = node;
                }
            });
            // Replaced in place (e.g. `{...item}` written from outside) or primitives: same position, same field.
            $items.forEach(($item, $index) => {
                const node = $previous.nodes[$index];
                // An object already owned by another field (the same instance twice) gets a field of its own.
                if (!nodes[$index] && node && unmatched.has(node) && !(isObject($item) && this.identity.has($item))) {
                    unmatched.delete(node);
                    nodes[$index] = node;
                }
            });
        }

        const byKey = new Map<string, FieldNode>();
        const indexOf = new Map<FieldNode, number>();
        const result = nodes.map(($node, $index) => {
            const node = $node ?? new FieldNode(this.form, this, null);
            const item = $items[$index];
            if (isObject(item)) {
                this.identity.set(item, node);
            }
            byKey.set(String($index), node);
            indexOf.set(node, $index);
            return node;
        });
        return {kind: 'array', nodes: result, byKey, indexOf, trackKeys};
    }

    protected disposeRemoved($previous: Children, $next: ReadonlyArray<FieldNode>): void {
        if ($previous.nodes.length === 0) {
            return;
        }
        const kept = new Set($next);
        const removed = $previous.nodes.filter($ => !kept.has($));
        if (removed.length === 0) {
            return;
        }
        // Removed fields keep reporting the value they had.
        const previousValue = this.reconciledValue as any;
        for (const node of removed) {
            const index = $previous.indexOf.get(node)!;
            node.lastIndex = index;
            node.lastValue = previousValue?.[node.ownKey ?? index];
        }
        // Runs inside a reactive computation; release resources right after it.
        queueMicrotask(() => removed.forEach($ => $.dispose()));
    }

    /** @internal Stops async work of this field and its descendants. */
    public dispose(): void {
        for (const runner of this.asyncRunners.values()) {
            runner.destroy();
        }
        this.asyncRunners.clear();
        for (const node of untracked(this.children).nodes) {
            node.dispose();
        }
        this.bindings.clear();
    }

    /** @internal Child by key, materialized from the current value. */
    public child($key: string): FieldNode | undefined {
        return this.children().byKey.get($key);
    }

    /** @internal Descendant by relative path. */
    public walk($segments: ReadonlyArray<string>): FieldNode | undefined {
        let node: FieldNode | undefined = this;
        for (const segment of $segments) {
            node = node?.child(segment);
        }
        return node;
    }

    /** @internal Ancestor (or self) at an absolute depth. */
    public ancestorAt($depth: number): FieldNode | null {
        let node: FieldNode | null = this;
        while (node && node.depth > $depth) {
            node = node.parent;
        }
        return node && node.depth === $depth ? node : null;
    }

    protected write($value: unknown): void {
        if (!untracked(this.attached)) {
            if (isDevMode()) {
                console.warn(`Ignored a write to the removed field "${untracked(this.name)}".`);
            }
            return;
        }
        if (!this.parent) {
            this.form.model.set($value);
        } else {
            this.parent.writeChild(this, $value);
        }
    }

    protected writeChild($child: FieldNode, $value: unknown): void {
        const current = untracked(this.current) as any;
        if (Array.isArray(current)) {
            const index = untracked(this.children).indexOf.get($child)!;
            const next = [...current];
            next[index] = $value;
            if (isObject($value)) {
                this.identity.set($value, $child);
            }
            this.write(next);
        } else {
            this.write({...current, [$child.ownKey!]: $value});
        }
    }

    // Logic

    protected matches($entry: LogicEntry): boolean {
        const anchor = $entry.anchor ?? this.root;
        if (anchor.depth + $entry.pattern.length !== this.depth || this.ancestorAt(anchor.depth) !== anchor) {
            return false;
        }
        for (let i = 0; i < $entry.pattern.length; i++) {
            const segment = $entry.pattern[i];
            if (segment !== ANY_SEGMENT && segment !== this.ancestorAt(anchor.depth + i + 1)!.key()) {
                return false;
            }
        }
        return true;
    }

    /** @internal Conditions of `applyWhen` around the entry hold. */
    public isActive($entry: LogicEntry): boolean {
        if ($entry.conditions.length === 0) {
            return true;
        }
        const anchorDepth = ($entry.anchor ?? this.root).depth;
        for (const condition of $entry.conditions) {
            const target = this.ancestorAt(anchorDepth + condition.depth);
            if (!target || !condition.fn(target.contextFor($entry.anchor))) {
                return false;
            }
        }
        return true;
    }

    protected anyFlag($kind: 'hidden' | 'readonly'): boolean {
        for (const entry of this.logic()) {
            if (entry.kind === $kind && this.isActive(entry) && entry.fn(this.contextFor(entry.anchor))) {
                return true;
            }
        }
        return false;
    }

    protected ruleErrors($entry: LogicEntry & { kind: 'validate' }): Signal<ReadonlyArray<FieldError>> {
        let rule = this.ruleCache.get($entry);
        if (!rule) {
            rule = computed(() => this.isActive($entry)
                ? this.toFieldErrors($entry.fn(this.contextFor($entry.anchor)), 'validator')
                : EMPTY_ERRORS, {equal: errorListEqual});
            this.ruleCache.set($entry, rule);
        }
        return rule;
    }

    /** @internal Errors of one tree validator on this field, grouped by the field they target. */
    public treeTargets($entry: LogicEntry & { kind: 'tree' }): Signal<ReadonlyMap<FieldNode, ReadonlyArray<FieldError>>> {
        let rule = this.ruleCache.get($entry);
        if (!rule) {
            rule = computed(() => {
                if (this.skipped() || !this.isActive($entry)) {
                    return EMPTY_TARGETS;
                }
                const result = toList($entry.fn(this.contextFor($entry.anchor)));
                if (result.length === 0) {
                    return EMPTY_TARGETS;
                }
                const targets = new Map<FieldNode, Array<FieldError>>();
                for (const error of result) {
                    const {field, path, ...rest} = error as TargetedValidationError;
                    const target = (field ? nodeOf(field) : path !== undefined ? this.walk(toSegments(path)) : this) ?? this;
                    let list = targets.get(target);
                    if (!list) {
                        targets.set(target, list = []);
                    }
                    list.push({...rest, field: target.fieldTree, source: 'tree'});
                }
                return targets;
            });
            this.ruleCache.set($entry, rule);
        }
        return rule;
    }

    protected asyncRunner($entry: LogicEntry): AsyncRunner {
        let runner = this.asyncRunners.get($entry);
        if (!runner && $entry.kind === 'async') {
            // Rules of a dynamic schema are replaced when it changes: a runner only works while its rule applies.
            runner = new AsyncRunner(this, $entry.options, this.contextFor($entry.anchor),
                () => this.logic().includes($entry) && this.isActive($entry));
            this.asyncRunners.set($entry, runner);
        }
        return runner!;
    }

    /** Stops runners of rules that no longer apply to this field. */
    protected releaseRunners($logic: ReadonlyArray<LogicEntry>): void {
        for (const [entry, runner] of this.asyncRunners) {
            if (!$logic.includes(entry)) {
                this.asyncRunners.delete(entry);
                queueMicrotask(() => runner.destroy());
            }
        }
    }

    public metadata<V>($key: MetadataKey<V, any>): Signal<V> {
        let value = this.metadataCache.get($key);
        if (!value) {
            value = computed(() => {
                let result = $key.reducer.initial();
                for (const entry of this.logic()) {
                    if (entry.kind === 'metadata' && entry.key === $key && this.isActive(entry)) {
                        result = $key.reducer.reduce(result, entry.fn(this.contextFor(entry.anchor)));
                    }
                }
                return result;
            }, {equal: Array.isArray($key.reducer.initial()) ? arrayIdentityEqual as any : undefined});
            this.metadataCache.set($key, value);
        }
        return value;
    }

    /** @internal */
    public toFieldErrors($result: ValidationResult, $source: string): ReadonlyArray<FieldError> {
        const list = toList($result);
        return list.length === 0
            ? EMPTY_ERRORS
            : list.map($ => ({...$, field: this.fieldTree, source: $source}));
    }

    /** @internal Rule context; schema paths are resolved relative to `$anchor`. */
    public contextFor($anchor: FieldNode | null): FieldContext<any> {
        let context: FieldContext<any> | undefined = this.contexts.get($anchor);
        if (!context) {
            const node = this;
            const resolve = ($path: SchemaPath<any>): FieldNode | undefined => {
                const anchor = $anchor ?? node.root;
                const segments = segmentsOf($path);
                const own = node.depth - anchor.depth;
                const concrete: Array<string> = [];
                for (let i = 0; i < segments.length; i++) {
                    if (segments[i] === ANY_SEGMENT) {
                        if (i >= own) {
                            return undefined;
                        }
                        concrete.push(node.ancestorAt(anchor.depth + i + 1)!.key());
                    } else {
                        concrete.push(segments[i]);
                    }
                }
                return anchor.walk(concrete);
            };
            context = {
                value: this.current,
                state: this,
                field: this.fieldTree,
                key: this.key,
                index: computed(() => this.ownKey === null && this.parent ? Number(this.key()) : -1),
                valueOf: $path => resolve($path)?.current(),
                stateOf: $path => resolve($path),
                fieldOf: $path => resolve($path)?.fieldTree,
            };
            this.contexts.set($anchor, context);
        }
        return context!;
    }

    // State

    public getError($kind: string): FieldError | undefined {
        return this.errors().find($ => $.kind === $kind);
    }

    public markAsTouched($options: MarkAsTouchedOptions = {}): void {
        untracked(() => {
            if (!this.attached()) {
                return;
            }
            this.selfTouched.set(true);
            if (!$options.skipDescendants) {
                for (const node of this.children().nodes) {
                    node.markAsTouched($options);
                }
            }
        });
    }

    public markAsDirty(): void {
        untracked(() => {
            if (this.attached()) {
                this.selfDirty.set(true);
            }
        });
    }

    public reset($value?: any): void {
        untracked(() => {
            if ($value !== undefined) {
                this.write($value);
            }
            this.resetState();
        });
    }

    protected resetState(): void {
        this.selfTouched.set(false);
        this.selfDirty.set(false);
        this.pushed.set([]);
        this.pendingSources.set(new Set());
        for (const runner of this.asyncRunners.values()) {
            runner.reloadValidation();
        }
        for (const node of this.children().nodes) {
            node.resetState();
        }
    }

    public setErrors($source: string, $errors: ReadonlyArray<ValidationError>, $options: SetErrorsOptions = {}): void {
        untracked(() => {
            if (!this.attached()) {
                return;
            }
            if ('forValue' in $options && !deepEqual($options.forValue, this.current())) {
                return;
            }
            this.hasPushed.set(true);
            const errors = this.toFieldErrors($errors.filter(isValidationError), $source);
            this.pushed.update($entries => {
                const rest = $entries.filter($ => $.source !== $source);
                return errors.length === 0 ? rest : [...rest, {
                    source: $source,
                    errors,
                    stale: $options.stale ?? 'on-change',
                    whenSkipped: $options.whenSkipped ?? false,
                }];
            });
        });
    }

    public clearErrors($source?: string, $options: { readonly deep?: boolean } = {}): void {
        untracked(() => {
            this.pushed.update($entries => $source === undefined ? [] : $entries.filter($ => $.source !== $source));
            if ($options.deep) {
                for (const node of this.children().nodes) {
                    node.clearErrors($source, $options);
                }
            }
        });
    }

    /** @internal Drops errors that end with a new submit. */
    public clearForSubmit(): void {
        untracked(() => {
            this.pushed.update($entries => $entries.filter($ => $.stale !== 'on-submit' && $.source !== 'submit'));
            for (const node of this.children().nodes) {
                node.clearForSubmit();
            }
        });
    }

    public setPending($source: string, $pending: boolean): void {
        untracked(() => {
            const current = this.pendingSources();
            if (current.has($source) === $pending) {
                return;
            }
            const next = new Set(current);
            if ($pending) {
                next.add($source);
            } else {
                next.delete($source);
            }
            this.pendingSources.set(next);
        });
    }

    /** @internal */
    public setSubmitting($submitting: boolean): void {
        this.selfSubmitting.set($submitting);
    }

    public reloadValidation(): void {
        untracked(() => {
            for (const entry of this.logic()) {
                if (entry.kind === 'async') {
                    this.asyncRunner(entry).reloadValidation();
                }
            }
        });
    }

    public focus($options?: FocusOptions): boolean {
        return untracked(() => {
            const own = this.firstBinding();
            if (own) {
                own.focus($options);
                return true;
            }
            const candidates = this.errorSummary().length > 0
                ? this.errorSummary().map($ => nodeOf($.field))
                : this.descendants();
            const bound = candidates
                .flatMap($ => [...$.bindings])
                .sort(compareBindings)[0];
            if (bound) {
                bound.focus($options);
                return true;
            }
            return false;
        });
    }

    protected firstBinding(): FieldBindingRef | undefined {
        return [...this.bindings].sort(compareBindings)[0];
    }

    protected descendants(): Array<FieldNode> {
        const result: Array<FieldNode> = [];
        for (const node of this.children().nodes) {
            result.push(node, ...node.descendants());
        }
        return result;
    }
}

function compareBindings($a: FieldBindingRef, $b: FieldBindingRef): number {
    if (!$a.element || !$b.element || $a.element === $b.element) {
        return 0;
    }
    return $a.element.compareDocumentPosition($b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function toList<E extends ValidationError>($result: ValidationResult<E>): ReadonlyArray<E> {
    if (!$result) {
        return [];
    }
    if (Array.isArray($result)) {
        return $result.filter(isValidationError) as Array<E>;
    }
    return isValidationError($result) ? [$result as E] : [];
}

const ARRAY_PROTOTYPE = Array.prototype as unknown as Record<PropertyKey, unknown>;

function createFieldTree($node: FieldNode): FieldTree<any> {
    const target = function fieldTree() {
        return $node;
    };
    const childTrees = () => $node.children().nodes.map($ => $.fieldTree);
    return new Proxy(target, {
        get: ($target, $prop) => {
            if ($prop === NODE) {
                return $node;
            }
            const children = $node.children();
            if (typeof $prop === 'string') {
                const child = children.byKey.get($prop);
                if (child) {
                    // Like optional properties: a child without a value is not there yet.
                    return child.value() === undefined && children.kind === 'object' ? undefined : child.fieldTree;
                }
                if (children.kind === 'array') {
                    if ($prop === 'length') {
                        return children.nodes.length;
                    }
                    if ($prop in ARRAY_PROTOTYPE) {
                        const trees = childTrees();
                        const member = (trees as any)[$prop];
                        return typeof member === 'function' ? member.bind(trees) : member;
                    }
                }
                return undefined;
            }
            if ($prop === Symbol.iterator && children.kind === 'array') {
                const trees = childTrees();
                return () => trees[Symbol.iterator]();
            }
            return undefined;
        },
        has: ($target, $prop) => typeof $prop === 'string' && $node.children().byKey.has($prop),
    }) as unknown as FieldTree<any>;
}
