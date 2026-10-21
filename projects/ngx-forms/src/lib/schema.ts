import {computed, Signal, untracked} from '@angular/core';
import type {FieldState, FieldTree, TargetedValidationError, ValidationError, ValidationResult} from './types';
import type {MetadataKey} from './metadata';
import type {AsyncValidatorOptions} from './async';
import type {FieldNode} from './node';

/** Path segment matching every array index or object key (`applyEach`). */
export const ANY_SEGMENT = '*';

const SEGMENTS = Symbol('segments');

type IsAny<T> = 0 extends (1 & T) ? true : false;
type Leaf = Date | File | Blob | RegExp | Map<any, any> | Set<any> | ((...args: Array<any>) => any);

type SchemaChildren<T> =
    IsAny<T> extends true
        ? any
        : [T] extends [ReadonlyArray<any>]
            ? unknown
            : [T] extends [Leaf]
                ? unknown
                : [T] extends [Record<string, any>]
                    ? { readonly [K in keyof T]-?: SchemaPath<Exclude<T[K], undefined>> }
                    : unknown;

/**
 * Where rules apply. `p.address.street` addresses one field; inside `applyEach(p.lines, line => ...)` the path
 * addresses every item. Paths only exist while a schema function runs.
 */
export type SchemaPath<T> = { readonly '~value'?: T } & SchemaChildren<T>;

export type SchemaFn<T> = ($path: SchemaPath<T>) => void;

/** Defines a reusable schema; it is plain function, typed. */
export function schema<T>($fn: SchemaFn<T>): SchemaFn<T> {
    return $fn;
}

/** What rule functions receive. */
export interface FieldContext<T> {
    readonly value: Signal<T>;
    readonly state: FieldState<T>;
    readonly field: FieldTree<T>;
    /** Key in the parent (array index as string). */
    readonly key: Signal<string>;
    /** Index in the parent array, `-1` when the parent is not an array. */
    readonly index: Signal<number>;
    /** Value at another schema path; `*` segments resolve to this field's own position. */
    valueOf<V>($path: SchemaPath<V>): V;
    stateOf<V>($path: SchemaPath<V>): FieldState<V> | undefined;
    fieldOf<V>($path: SchemaPath<V>): FieldTree<V> | undefined;
}

export type LogicFn<T, R> = ($ctx: FieldContext<T>) => R;

/** @internal */
export interface Condition {
    /** Path length (relative to the anchor) of the field the condition is evaluated for. */
    readonly depth: number;
    readonly fn: LogicFn<any, boolean>;
}

/** @internal */
interface EntryBase {
    /** Field the pattern is relative to, `null` for the root. */
    readonly anchor: FieldNode | null;
    readonly pattern: ReadonlyArray<string>;
    readonly conditions: ReadonlyArray<Condition>;
}

/** @internal */
export type LogicEntry = EntryBase & (
    | { readonly kind: 'validate', readonly fn: LogicFn<any, ValidationResult> }
    | { readonly kind: 'tree', readonly fn: LogicFn<any, ValidationResult<TargetedValidationError>> }
    | { readonly kind: 'async', readonly options: AsyncValidatorOptions<any, any, any> }
    | { readonly kind: 'metadata', readonly key: MetadataKey<any, any>, readonly fn: LogicFn<any, any> }
    | { readonly kind: 'disabled', readonly fn: LogicFn<any, boolean | string> }
    | { readonly kind: 'hidden', readonly fn: LogicFn<any, boolean> }
    | { readonly kind: 'readonly', readonly fn: LogicFn<any, boolean> }
    | { readonly kind: 'trackBy', readonly fn: ($item: any, $index: number) => unknown }
    );

type DistributiveOmit<T, K extends PropertyKey> = T extends any ? Omit<T, K> : never;

/** @internal Rules computed from a signal; re-built whenever the signal changes. */
export interface DynamicLogic extends EntryBase {
    readonly kind: 'dynamic';
    readonly built: Signal<ReadonlyArray<LogicItem>>;
}

/** @internal */
export type LogicItem = LogicEntry | DynamicLogic;

interface Builder {
    readonly anchor: FieldNode | null;
    conditions: ReadonlyArray<Condition>;
    readonly items: Array<LogicItem>;
}

let builder: Builder | null = null;

/** @internal Runs a schema function and returns the rules it declared. */
export function buildSchema(
    $anchor: FieldNode | null,
    $conditions: ReadonlyArray<Condition>,
    $prefix: ReadonlyArray<string>,
    $fn: SchemaFn<any>,
): ReadonlyArray<LogicItem> {
    const previous = builder;
    builder = {anchor: $anchor, conditions: $conditions, items: []};
    try {
        untracked(() => $fn(createSchemaPath($prefix)));
        return builder.items;
    } finally {
        builder = previous;
    }
}

function currentBuilder($rule: string): Builder {
    if (!builder) {
        throw new Error(`${$rule}() can only be called while a schema function runs (form(), applySchema(), apply...).`);
    }
    return builder;
}

const pathCache = new Map<string, SchemaPath<any>>();

/** @internal */
export function createSchemaPath($segments: ReadonlyArray<string>): SchemaPath<any> {
    const cacheKey = $segments.join('\u0000');
    let path = pathCache.get(cacheKey);
    if (!path) {
        path = new Proxy({[SEGMENTS]: $segments} as object, {
            get: ($target: any, $prop) => {
                if ($prop === SEGMENTS) {
                    return $segments;
                }
                if (typeof $prop === 'symbol') {
                    return undefined;
                }
                return createSchemaPath([...$segments, $prop]);
            },
        }) as SchemaPath<any>;
        pathCache.set(cacheKey, path);
    }
    return path;
}

/** @internal */
export function segmentsOf($path: SchemaPath<any>): ReadonlyArray<string> {
    const segments = ($path as any)?.[SEGMENTS];
    if (!Array.isArray(segments)) {
        throw new Error('Expected a schema path (the argument of a schema function or one of its properties).');
    }
    return segments;
}

/** @internal */
export function addEntry($rule: string, $path: SchemaPath<any>, $entry: DistributiveOmit<LogicItem, keyof EntryBase>): void {
    const target = currentBuilder($rule);
    target.items.push({
        ...$entry,
        anchor: target.anchor,
        pattern: segmentsOf($path),
        conditions: target.conditions,
    } as LogicItem);
}

/** Applies a schema to a path. */
export function apply<T>($path: SchemaPath<T>, $schema: SchemaFn<T>): void {
    currentBuilder('apply');
    $schema($path);
}

/** Applies a schema to every item of an array (or every value of a record). */
export function applyEach<T>($path: SchemaPath<ReadonlyArray<T>> | SchemaPath<Array<T>> | SchemaPath<Record<string, T>>, $schema: SchemaFn<T>): void {
    currentBuilder('applyEach');
    $schema(createSchemaPath([...segmentsOf($path), ANY_SEGMENT]) as SchemaPath<T>);
}

/** Applies a schema while `$condition` (evaluated for `$path`) holds. */
export function applyWhen<T>($path: SchemaPath<T>, $condition: LogicFn<T, boolean>, $schema: SchemaFn<T>): void {
    const target = currentBuilder('applyWhen');
    const previous = target.conditions;
    target.conditions = [...previous, {depth: segmentsOf($path).length, fn: $condition}];
    try {
        $schema($path);
    } finally {
        target.conditions = previous;
    }
}

/** Applies a schema while the value of `$path` matches. */
export function applyWhenValue<T>($path: SchemaPath<T>, $predicate: ($value: T) => boolean, $schema: SchemaFn<T>): void {
    applyWhen($path, $ctx => $predicate($ctx.value()), $schema);
}

/**
 * Applies whatever schema `$source` returns, and re-applies it when it changes. Rules (including metadata such as
 * `required`) can therefore arrive after the form was created, e.g. from a server or a template registry.
 */
export function applyDynamic<T>($path: SchemaPath<T>, $source: () => SchemaFn<T> | null | undefined): void {
    const target = currentBuilder('applyDynamic');
    const anchor = target.anchor;
    const conditions = target.conditions;
    const prefix = segmentsOf($path);
    const built = computed(() => {
        const fn = $source();
        return fn ? buildSchema(anchor, conditions, prefix, fn as SchemaFn<any>) : [];
    });
    addEntry('applyDynamic', $path, {kind: 'dynamic', built});
}

/** Plain validator: return an error, a list of errors or nothing. */
export function validate<T>($path: SchemaPath<T>, $fn: LogicFn<T, ValidationResult>): void {
    addEntry('validate', $path, {kind: 'validate', fn: $fn});
}

/**
 * Validator that may report errors on other fields: set `field` (a field tree) or `path` (relative to `$path`) on an
 * error to target it. Targets are resolved once, not broadcast to every descendant.
 */
export function validateTree<T>($path: SchemaPath<T>, $fn: LogicFn<T, ValidationResult<TargetedValidationError>>): void {
    addEntry('validateTree', $path, {kind: 'tree', fn: $fn});
}

/** Async validator; see `AsyncValidatorOptions`. */
export function validateAsync<T, P, R>($path: SchemaPath<T>, $options: AsyncValidatorOptions<T, P, R>): void {
    addEntry('validateAsync', $path, {kind: 'async', options: $options});
}

export function metadata<T, V, C>($path: SchemaPath<T>, $key: MetadataKey<V, C>, $fn: LogicFn<T, C>): void {
    addEntry('metadata', $path, {kind: 'metadata', key: $key, fn: $fn});
}

/**
 * Disables a field (and its descendants). Disabled fields are not validated. Pass a reason string, or a function
 * returning `true`, `false` or a reason.
 */
export function disabled<T>($path: SchemaPath<T>, $when: string | LogicFn<T, boolean | string> = () => true): void {
    const fn: LogicFn<T, boolean | string> = typeof $when === 'string' ? () => $when : $when;
    addEntry('disabled', $path, {kind: 'disabled', fn});
}

/** Hides a field (and its descendants): not validated, not counted for validity. Its value stays in the model. */
export function hidden<T>($path: SchemaPath<T>, $when: LogicFn<T, boolean> = () => true): void {
    addEntry('hidden', $path, {kind: 'hidden', fn: $when});
}

/** Marks a field (and its descendants) readonly. Readonly fields are still validated. */
export function readonly<T>($path: SchemaPath<T>, $when: LogicFn<T, boolean> = () => true): void {
    addEntry('readonly', $path, {kind: 'readonly', fn: $when});
}

/**
 * Identity of array items, like `track` in `@for`. Item state (touched, dirty, pushed errors, async results)
 * follows the key, so it survives reordering and refetching new objects. Without it objects are tracked by
 * reference (and by position when replaced in place); primitives by position.
 */
export function trackBy<T>($path: SchemaPath<ReadonlyArray<T>> | SchemaPath<Array<T>>, $fn: ($item: T, $index: number) => unknown): void {
    addEntry('trackBy', $path, {kind: 'trackBy', fn: $fn});
}

/** @internal */
export function isValidationError($: unknown): $ is ValidationError {
    return typeof $ === 'object' && $ !== null && typeof ($ as ValidationError).kind === 'string';
}
