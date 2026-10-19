import {createMetadataKey, metadata, MetadataReducer, SchemaPath} from '@angular/forms/signals';

/** Rule kinds (names) that must not run for a field. */
export const SKIP_RULES = createMetadataKey(MetadataReducer.list<string>());

/** Wizard step ids a field belongs to (inherited by descendants when walking steps). */
export const STEP = createMetadataKey(MetadataReducer.list<string>());

/** Skips rules of the given kinds for a path (was the `skipRules` input on v21 item directives). */
export function skipRules($path: SchemaPath<any>, $kinds: ReadonlyArray<string>): void {
    for (const kind of $kinds) {
        metadata($path, SKIP_RULES, () => kind);
    }
}

/** Tags a path as part of a wizard step; use when a step is not a single subtree. */
export function step($path: SchemaPath<any>, $id: string): void {
    metadata($path, STEP, () => $id);
}
