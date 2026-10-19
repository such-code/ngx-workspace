import {untracked} from '@angular/core';
import {FieldTree} from '@angular/forms/signals';

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
 * Immutable array updates for an array field. Signal Forms keeps item state (touched, dirty, async) by object
 * identity, so prefer objects over primitives. Track `@for` by the field itself (`track item`), never by field
 * state such as `item().value().id`: removed items are orphaned and reading their state throws.
 */
export function arrayOps<T>($field: FieldTree<Array<T>> | FieldTree<ReadonlyArray<T>>): ArrayOps<T> {
    const update = ($fn: ($items: Array<T>) => Array<T>): void => {
        const state = untracked($field as FieldTree<Array<T>>);
        state.value.update($items => $fn([...($items ?? [])]));
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
