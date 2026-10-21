import {fieldAt, FieldTree} from '@such-code/ngx-forms';
import {PathSegments} from '../core/path';

/** Any field, whatever its value type. */
export type AnyField = FieldTree<unknown>;

/** @deprecated Fields are not split into readonly and writable variants any more; use `AnyField`. */
export type AnyReadonlyField = AnyField;

/** Visits a field and all of its existing descendants, depth first. Returning `false` skips the subtree. */
export function walkFields(
    $tree: AnyField,
    $visitor: ($field: AnyField, $segments: PathSegments) => boolean | void,
    $segments: PathSegments = [],
): void {
    if ($visitor($tree, $segments) === false) {
        return;
    }
    const value = $tree().value();
    if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            const child = ($tree as any)[key] as AnyField | undefined;
            if (child) {
                walkFields(child, $visitor, [...$segments, key]);
            }
        }
    }
}

/** Resolves a descendant field by path segments, `undefined` when it does not exist in the current model. */
export function childField<T extends AnyField>($tree: T, $segments: PathSegments): T | undefined {
    return fieldAt($tree, $segments) as T | undefined;
}
