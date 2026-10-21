import {Signal} from '@angular/core';
import {
    applyDynamic,
    FieldContext,
    MAX,
    MAX_LENGTH,
    metadata,
    MIN,
    MIN_LENGTH,
    PATTERN,
    REQUIRED,
    SchemaFn,
    SchemaPath,
    validate,
} from '@such-code/ngx-forms';
import {RuleContext, ValidationRule} from '../core/rules';
import {RuleRegistry, RuleTemplate} from '../core/registry';
import {splitPath, valueAt} from '../core/path';
import {RULES, SKIP_RULES} from './metadata';
import {currentSchemaContext, runInSchemaContext, SchemaBuildContext} from './schema-context';

export interface ApplyRulesOptions {
    /** Rule kinds to skip in addition to `skipRules()` metadata of the field. */
    readonly skipRules?: ReadonlyArray<string>;
}

function createRuleContext($rootPath: SchemaPath<any> | null, $ctx: FieldContext<any>): RuleContext {
    const root = (): unknown => $rootPath ? $ctx.valueOf($rootPath) : undefined;
    return {
        get root() {
            return root();
        },
        valueAt: ($path: string) => valueAt(root(), splitPath($path)),
    };
}

/**
 * Adds library rules to a path: one validator per rule plus metadata (`required`, `minLength`, ...) so bound
 * controls receive the constraints. Must be called from a schema function; works the same for rules known upfront
 * and for rules that arrive later (templates and server constraints go through here as well).
 */
export function applyRules<T>($path: SchemaPath<T>, $rules: ReadonlyArray<ValidationRule<T>>, $options: ApplyRulesOptions = {}): void {
    // Captured now: the context only exists while the schema is built, validators run later.
    const schemaContext = currentSchemaContext();
    const globalSkip = [...($options.skipRules ?? []), ...(schemaContext?.skipRules ?? [])];
    const rootPath = schemaContext?.rootPath ?? null;
    const anyPath = $path as SchemaPath<any>;

    for (const rule of $rules) {
        const enabled = (ctx: FieldContext<any>) => !globalSkip.includes(rule.name)
            && !ctx.state.metadata(SKIP_RULES)().includes(rule.name);

        validate($path, ctx => enabled(ctx) ? rule.check(ctx.value(), createRuleContext(rootPath, ctx)) : null);
        // `form.rules()` / `form.hasRule()` see every rule, whether or not it has constraint metadata.
        metadata(anyPath, RULES, ctx => enabled(ctx) ? rule : undefined);

        const meta = rule.metadata();
        if (!meta) {
            continue;
        }
        if (meta.required) {
            metadata(anyPath, REQUIRED, ctx => enabled(ctx));
        }
        if (meta.minLength !== undefined) {
            metadata(anyPath, MIN_LENGTH, ctx => enabled(ctx) ? meta.minLength : undefined);
        }
        if (meta.maxLength !== undefined) {
            metadata(anyPath, MAX_LENGTH, ctx => enabled(ctx) ? meta.maxLength : undefined);
        }
        if (meta.pattern !== undefined) {
            metadata(anyPath, PATTERN, ctx => enabled(ctx) ? meta.pattern : undefined);
        }
        if (meta.min !== undefined) {
            metadata(anyPath, MIN, ctx => enabled(ctx) ? meta.min : undefined);
        }
        if (meta.max !== undefined) {
            metadata(anyPath, MAX, ctx => enabled(ctx) ? meta.max : undefined);
        }
    }
}

export interface BindTemplateOptions {
    readonly skipRules?: ReadonlyArray<string>;
    /** Registry to resolve template names; defaults to the registry of the enclosing `ngxForm()`. */
    readonly registry?: RuleRegistry;
}

/** Path below `$path` for template keys: `a.b` -> `p.a.b`, `items.*.name` -> every item, `items.0.name` -> item 0. */
function pathFor($path: SchemaPath<any>, $key: string): SchemaPath<any> {
    let path: any = $path;
    for (const segment of splitPath($key)) {
        path = path[segment];
    }
    return path;
}

/** Schema applying every rule of a template (keys are relative to the path it is applied to). */
export function templateSchema($template: RuleTemplate, $options: ApplyRulesOptions = {}): SchemaFn<any> {
    return p => {
        for (const [key, rules] of Object.entries($template)) {
            applyRules(pathFor(p, key), rules, $options);
        }
    };
}

/**
 * Binds a rule template to a path. `$source` is a template name (looked up in the registry) or a signal. The
 * template is followed: rules added, replaced or removed later (server constraints, `registry.merge()`) apply
 * right away, metadata such as `required` included.
 */
export function bindTemplate($path: SchemaPath<any>, $source: string | Signal<RuleTemplate | undefined>, $options: BindTemplateOptions = {}): void {
    const schemaContext = currentSchemaContext();
    let template: Signal<RuleTemplate | undefined>;
    if (typeof $source === 'string') {
        const registry = $options.registry ?? schemaContext?.registry;
        if (!registry) {
            throw new Error(`bindTemplate('${$source}') needs a registry: call it inside ngxForm() or pass {registry}.`);
        }
        template = registry.template($source);
    } else {
        template = $source;
    }
    const options = {skipRules: $options.skipRules};
    applyDynamic($path, () => {
        const current = template();
        if (!current || Object.keys(current).length === 0) {
            return null;
        }
        const schema = templateSchema(current, options);
        // The schema is built again whenever the template changes; keep the form context for `applyRules()`.
        return schemaContext ? (p => runInSchemaContext(schemaContext as SchemaBuildContext, () => schema(p))) : schema;
    });
}
