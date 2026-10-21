import {SchemaPath} from '@such-code/ngx-forms';
import {RuleRegistry} from '../core/registry';

/**
 * Information about the `ngxForm()` whose schema is being built. Schema functions run synchronously, so rule helpers
 * called from a schema can pick it up without extra arguments.
 */
export interface SchemaBuildContext {
    readonly rootPath: SchemaPath<any>;
    readonly registry: RuleRegistry;
    readonly skipRules: ReadonlyArray<string>;
}

let current: SchemaBuildContext | null = null;

export function currentSchemaContext(): SchemaBuildContext | null {
    return current;
}

export function runInSchemaContext<T>($context: SchemaBuildContext, $fn: () => T): T {
    const previous = current;
    current = $context;
    try {
        return $fn();
    } finally {
        current = previous;
    }
}
