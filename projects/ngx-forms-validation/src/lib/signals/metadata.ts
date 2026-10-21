import {createMetadataKey, metadata, MetadataReducers, SchemaPath} from '@such-code/ngx-forms';
import {ValidationRule} from '../core/rules';

/** Rule kinds (names) that must not run for a field. */
export const SKIP_RULES = createMetadataKey('ngxSkipRules', MetadataReducers.list<string>());

/** Wizard step ids a field belongs to (inherited by descendants when walking steps). */
export const STEP = createMetadataKey('ngxStep', MetadataReducers.list<string>());

/** Library rules that currently apply to a field (schema, templates and server constraints alike). */
export const RULES = createMetadataKey('ngxRules', MetadataReducers.list<ValidationRule>());

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
