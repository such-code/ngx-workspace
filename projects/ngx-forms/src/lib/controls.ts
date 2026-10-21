import {linkedSignal, untracked, WritableSignal} from '@angular/core';
import type {FieldControl} from './field.directive';
import type {FieldTree, ValidationError} from './types';
import {nodeOf} from './node';

export type ParseResult<T> = { readonly value: T } | { readonly error: ValidationError };

export interface TransformedValueOptions<T, R> {
    readonly parse: ($raw: R) => ParseResult<T>;
    readonly format: ($value: T) => R;
}

/**
 * Raw (e.g. text) value for a custom control whose model value has another type. Writing it parses: valid input is
 * committed to the field, invalid input becomes a parse error and the model keeps its last valid value. While the
 * user types, their text is kept (no reformatting under the caret); a model change from elsewhere reformats.
 */
export function transformedValue<T, R = string>($control: FieldControl<T>, $options: TransformedValueOptions<T, R>): WritableSignal<R> {
    let lastCommitted: { value: T } | null = null;
    const raw = linkedSignal<T, R>({
        source: $control.value,
        computation: ($value, $previous) => $previous && lastCommitted && Object.is($value, lastCommitted.value)
            ? $previous.value
            : $options.format($value),
    });
    const set = raw.set.bind(raw);
    raw.set = ($raw: R) => {
        set($raw);
        const result = $options.parse($raw);
        if ('error' in result) {
            $control.setParseErrors([result.error]);
            return;
        }
        $control.setParseErrors([]);
        lastCommitted = {value: result.value};
        if (!Object.is(result.value, untracked($control.value))) {
            $control.setValue(result.value);
        }
    };
    raw.update = ($fn: ($raw: R) => R) => raw.set($fn(untracked(raw)));
    return raw;
}

export interface ArrayOps<T> {
    push(...$items: Array<T>): void;
    insert($index: number, ...$items: Array<T>): void;
    /** Removes by index or by predicate. */
    remove($indexOrPredicate: number | (($item: T, $index: number) => boolean)): void;
    move($from: number, $to: number): void;
    replace($index: number, $item: T): void;
    clear(): void;
}

/**
 * Immutable updates of an array field. Item fields follow their items (by `trackBy` key, else by object identity),
 * so touched/dirty state and pushed errors move with them. Removed item fields stay readable, so `@for` may track
 * by anything, `track line().value().id` included.
 */
export function arrayOps<T>($field: FieldTree<ReadonlyArray<T>> | FieldTree<Array<T>>): ArrayOps<T> {
    const node = nodeOf($field);
    const update = ($fn: ($items: Array<T>) => Array<T>): void => {
        untracked(() => node.value.update(($items: ReadonlyArray<T> | null | undefined) => $fn([...($items ?? [])])));
    };
    return {
        push: (...$items) => update($ => [...$, ...$items]),
        insert: ($index, ...$items) => update($ => {
            $.splice($index, 0, ...$items);
            return $;
        }),
        remove: ($indexOrPredicate) => update($ => typeof $indexOrPredicate === 'number'
            ? $.filter((_, $i) => $i !== $indexOrPredicate)
            : $.filter(($item, $i) => !$indexOrPredicate($item, $i))),
        move: ($from, $to) => update($ => {
            if ($from < 0 || $from >= $.length || $to < 0 || $to >= $.length || $from === $to) {
                return $;
            }
            const [item] = $.splice($from, 1);
            $.splice($to, 0, item);
            return $;
        }),
        replace: ($index, $item) => update($ => $.map(($current, $i) => $i === $index ? $item : $current)),
        clear: () => update(() => []),
    };
}
