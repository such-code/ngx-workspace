/** Combines the values contributed by all metadata rules of a field. */
export interface MetadataReducer<V, C = V> {
    readonly initial: () => V;
    readonly reduce: ($accumulator: V, $value: C) => V;
}

export interface MetadataKey<V, C = V> {
    readonly description: string;
    readonly reducer: MetadataReducer<V, C>;
}

export function createMetadataKey<V, C = V>($description: string, $reducer: MetadataReducer<V, C>): MetadataKey<V, C> {
    return {description: $description, reducer: $reducer};
}

export const MetadataReducers = {
    /** `true` when any rule says so. */
    or: (): MetadataReducer<boolean> => ({initial: () => false, reduce: ($a, $v) => $a || $v}),
    /** Largest value; `undefined` contributions are ignored. */
    max: (): MetadataReducer<number | undefined> => ({
        initial: () => undefined,
        reduce: ($a, $v) => $v === undefined ? $a : $a === undefined ? $v : Math.max($a, $v),
    }),
    /** Smallest value; `undefined` contributions are ignored. */
    min: (): MetadataReducer<number | undefined> => ({
        initial: () => undefined,
        reduce: ($a, $v) => $v === undefined ? $a : $a === undefined ? $v : Math.min($a, $v),
    }),
    /** All values; `undefined` contributions are ignored. */
    list: <T>(): MetadataReducer<ReadonlyArray<T>, T | undefined> => ({
        initial: () => [],
        reduce: ($a, $v) => $v === undefined ? $a : [...$a, $v],
    }),
    /** The last contributed value. */
    override: <T>(): MetadataReducer<T | undefined> => ({
        initial: () => undefined,
        reduce: ($a, $v) => $v === undefined ? $a : $v,
    }),
};

export const REQUIRED = createMetadataKey('required', MetadataReducers.or());
/** Lower bound: the strictest (largest) one wins. */
export const MIN = createMetadataKey('min', MetadataReducers.max());
/** Upper bound: the strictest (smallest) one wins. */
export const MAX = createMetadataKey('max', MetadataReducers.min());
export const MIN_LENGTH = createMetadataKey('minLength', MetadataReducers.max());
export const MAX_LENGTH = createMetadataKey('maxLength', MetadataReducers.min());
export const PATTERN = createMetadataKey('pattern', MetadataReducers.list<RegExp>());

/** How bound controls commit typed values: immediately, after a delay or on blur. */
export type DebounceConfig = number | 'blur';
export const DEBOUNCE = createMetadataKey('debounce', MetadataReducers.override<DebounceConfig>());
