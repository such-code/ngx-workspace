import {FieldState, FieldTree, ReadonlyFieldState, ReadonlyFieldTree} from '@angular/forms/signals';
import {PathSegments} from '../core/path';

/** Any writable field, whatever its value type (`FieldTree<any>` would resolve to the forms-compat variant). */
export type AnyField = () => FieldState<any, string | number>;

/** Any field, writable or readonly. */
export type AnyReadonlyField = () => ReadonlyFieldState<any, string | number>;

type AnyFieldTree = ReadonlyFieldTree<unknown> | FieldTree<unknown> | AnyReadonlyField;

/** Resolves a descendant field by path segments, `undefined` when it does not exist in the current model. */
export function childField<T extends AnyFieldTree>($tree: T, $segments: PathSegments): T | undefined {
    let current: any = $tree;
    for (const segment of $segments) {
        if (current === undefined || current === null) {
            return undefined;
        }
        const value = current().value();
        if (value === null || typeof value !== 'object' || !(segment in value)) {
            return undefined;
        }
        current = current[segment];
    }
    return current ?? undefined;
}

/** Visits a field and all of its existing descendants, depth first. Returning `false` skips the subtree. */
export function walkFields(
    $tree: AnyFieldTree,
    $visitor: ($field: AnyFieldTree, $segments: PathSegments) => boolean | void,
    $segments: PathSegments = [],
): void {
    if ($visitor($tree, $segments) === false) {
        return;
    }
    const value = $tree().value();
    if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            const child = ($tree as any)[key] as AnyFieldTree | undefined;
            if (child) {
                walkFields(child, $visitor, [...$segments, key]);
            }
        }
    }
}
