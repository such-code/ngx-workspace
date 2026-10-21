import {Signal, WritableSignal} from '@angular/core';
import type {MetadataKey} from './metadata';
import type {PathSegment} from './util';

/** An error produced by a validator or pushed from outside. Any extra properties are kept. */
export interface ValidationError {
    readonly kind: string;
    readonly message?: string;
}

/** Error as reported by a field: it knows which field it belongs to and which source produced it. */
export type FieldError = ValidationError & {
    /** The field the error belongs to. */
    readonly field: FieldTree<unknown>;
    /**
     * What produced the error: `'validator'`, `'tree'`, `'async'`, `'parse'`, `'submit'` or the name given to
     * `setErrors()`.
     */
    readonly source: string;
};

/** Error that may target another field: a `FieldTree` or a path relative to the field that produced it. */
export type TargetedValidationError = ValidationError & {
    readonly field?: FieldTree<any>;
    readonly path?: string | ReadonlyArray<PathSegment>;
};

export type ValidationResult<E extends ValidationError = ValidationError> =
    | E
    | ReadonlyArray<E>
    | null
    | undefined
    | false;

/**
 * When pushed errors stop applying:
 * - `on-change`: when the value of the field they belong to changes (default);
 * - `on-submit`: when the field (or an ancestor) is submitted again;
 * - `never`: only when cleared or on reset.
 */
export type ErrorStaleness = 'on-change' | 'on-submit' | 'never';

export interface SetErrorsOptions {
    readonly stale?: ErrorStaleness;
    /**
     * The value the errors were produced for. When the field value differs already, nothing is stored: an answer
     * for `"abc"` arriving after the user typed `"abcd"` is dropped instead of being shown as current.
     */
    readonly forValue?: unknown;
    /** Show the errors while the field is hidden or disabled. Default `false`: they are kept, but not reported. */
    readonly whenSkipped?: boolean;
}

export interface MarkAsTouchedOptions {
    /** Only mark this field, not its descendants. Default `false`. */
    readonly skipDescendants?: boolean;
}

/** Read side of a field. */
export interface FieldState<T> {
    readonly fieldTree: FieldTree<T>;

    /** Model value of this field. Writing it updates the model immutably. Writing a removed field is a no-op. */
    readonly value: WritableSignal<T>;

    /** Key of this field inside its parent (array index for items, `''` for the root). */
    readonly key: Signal<string>;
    /** Path from the root, array indexes are numbers. */
    readonly path: Signal<ReadonlyArray<PathSegment>>;
    /** Dotted path from the root (`lines.0.sku`), `''` for the root. */
    readonly pathKey: Signal<string>;
    /** Unique name, usable as the `name` attribute: `<form name>.<pathKey>`. */
    readonly name: Signal<string>;
    /** `false` once the field was removed from the model (array item removed, key deleted). State stays readable. */
    readonly attached: Signal<boolean>;

    /** Errors of this field (all sources). Hidden and disabled fields report none. */
    readonly errors: Signal<ReadonlyArray<FieldError>>;
    /** Errors of this field and all descendants. */
    readonly errorSummary: Signal<ReadonlyArray<FieldError>>;
    readonly valid: Signal<boolean>;
    readonly invalid: Signal<boolean>;
    /** Async validation or a pushed pending marker in this field or below. Never inherited from ancestors. */
    readonly pending: Signal<boolean>;

    readonly touched: Signal<boolean>;
    readonly dirty: Signal<boolean>;

    readonly disabled: Signal<boolean>;
    readonly disabledReasons: Signal<ReadonlyArray<string>>;
    readonly hidden: Signal<boolean>;
    readonly readonly: Signal<boolean>;
    /** A submit of this field or an ancestor is running. */
    readonly submitting: Signal<boolean>;
    /**
     * Controls should not accept input: disabled, readonly or locked by a running submit. Unlike `disabled`, a
     * submit lock does not switch validation off.
     */
    readonly locked: Signal<boolean>;

    readonly required: Signal<boolean>;
    readonly min: Signal<number | undefined>;
    readonly max: Signal<number | undefined>;
    readonly minLength: Signal<number | undefined>;
    readonly maxLength: Signal<number | undefined>;
    readonly pattern: Signal<ReadonlyArray<RegExp>>;

    metadata<V>($key: MetadataKey<V, any>): Signal<V>;

    /** Errors of one kind, `undefined` when there is none. */
    getError($kind: string): FieldError | undefined;

    markAsTouched($options?: MarkAsTouchedOptions): void;
    markAsDirty(): void;

    /** Sets the value (optional) and clears touched, dirty and pushed errors of this field and its descendants. */
    reset($value?: T): void;

    /**
     * Replaces the errors of `$source` on this field. Errors of other sources (validators included) are kept, and
     * validation never removes them. An empty list clears the source.
     */
    setErrors($source: string, $errors: ReadonlyArray<ValidationError>, $options?: SetErrorsOptions): void;
    /** Clears pushed errors of one source (or all pushed errors) on this field and, with `deep`, below it. */
    clearErrors($source?: string, $options?: { readonly deep?: boolean }): void;
    /** Marks this field pending on behalf of `$source` (e.g. a check running elsewhere). */
    setPending($source: string, $pending: boolean): void;

    /** Re-runs async validators of this field. */
    reloadValidation(): void;

    /** Focuses the first control bound to this field (or, for a group, to the first invalid descendant). */
    focus($options?: FocusOptions): boolean;
}

type IsAny<T> = 0 extends (1 & T) ? true : false;

type Leaf = Date | File | Blob | RegExp | Map<any, any> | Set<any> | ((...args: Array<any>) => any);

/** Child fields of a field with value `T`. */
export type FieldChildren<T> =
    IsAny<T> extends true
        ? any
        : [T] extends [ReadonlyArray<infer U>]
            ? ReadonlyArray<FieldTree<U>>
            : [T] extends [Leaf]
                ? unknown
                : [T] extends [Record<string, any>]
                    ? {
                        readonly [K in keyof T]: undefined extends T[K]
                            ? FieldTree<Exclude<T[K], undefined>> | undefined
                            : FieldTree<T[K]>
                    }
                    : unknown;

/**
 * A field: call it for its state (`f.email()`), access properties for children (`f.address.street`), iterate it
 * when it holds an array (`@for (line of f.lines; track line)`). The same field always returns the same object.
 */
export type FieldTree<T> = (() => FieldState<T>) & FieldChildren<T>;
