import {computed, Signal, untracked} from '@angular/core';
import {
    applyEach,
    FieldContext,
    MAX,
    MAX_LENGTH,
    MAX_NUMBER,
    metadata,
    MIN,
    MIN_LENGTH,
    MIN_NUMBER,
    PATTERN,
    REQUIRED,
    SchemaPath,
    validate,
    validateTree,
    ValidationError,
} from '@angular/forms/signals';
import {RuleContext, ValidationRule} from '../core/rules';
import {RuleRegistry, RuleTemplate} from '../core/registry';
import {expandPath, GLOB_SEGMENT, PathSegments, splitPath, valueAt} from '../core/path';
import {SKIP_RULES} from './metadata';
import {childField} from './field-tree';
import {currentSchemaContext, runInSchemaContext} from './schema-context';

export interface ApplyRulesOptions {
    /** Rule kinds to skip in addition to `skipRules()` metadata of the field. */
    readonly skipRules?: ReadonlyArray<string>;
    /** Reactive switch per rule; inactive rules produce no errors and no metadata. */
    readonly active?: ($rule: ValidationRule) => boolean;
}

function createRuleContext($rootPath: SchemaPath<any> | null, $ctx: FieldContext<any, any>): RuleContext {
    const root = (): unknown => $rootPath ? $ctx.valueOf($rootPath) : undefined;
    return {
        get root() {
            return root();
        },
        valueAt: ($path: string) => valueAt(root(), splitPath($path)),
    };
}

function isSkipped($ctx: FieldContext<any, any>, $rule: ValidationRule, $globalSkip: ReadonlyArray<string>): boolean {
    if ($globalSkip.includes($rule.name)) {
        return true;
    }
    const skipped = $ctx.state.metadata(SKIP_RULES)?.() ?? [];
    return skipped.includes($rule.name);
}

/**
 * Adds library rules to a Signal Forms path: one `validate()` per rule plus metadata (`required`, `minLength`, ...) so
 * bound controls receive the constraints. Must be called from a schema function.
 */
export function applyRules<T>($path: SchemaPath<T>, $rules: ReadonlyArray<ValidationRule<T>>, $options: ApplyRulesOptions = {}): void {
    // Capture now: the context is only available while the schema is compiled, but validators run later.
    const schemaContext = currentSchemaContext();
    const globalSkip = [...($options.skipRules ?? []), ...(schemaContext?.skipRules ?? [])];
    const active = $options.active ?? (() => true);
    const rootPath = schemaContext?.rootPath ?? null;

    for (const rule of $rules) {
        const enabled = (ctx: FieldContext<T, any>) => active(rule) && !isSkipped(ctx, rule, globalSkip);

        validate($path, ctx => {
            if (!enabled(ctx)) {
                return undefined;
            }
            return rule.check(ctx.value(), createRuleContext(rootPath, ctx)) ?? undefined;
        });

        const meta = rule.metadata();
        if (!meta) {
            continue;
        }
        const anyPath = $path as SchemaPath<any>;
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
            metadata(anyPath, MIN_NUMBER, ctx => enabled(ctx) ? meta.min : undefined);
            metadata(anyPath, MIN, (() => MIN_NUMBER) as any);
        }
        if (meta.max !== undefined) {
            metadata(anyPath, MAX_NUMBER, ctx => enabled(ctx) ? meta.max : undefined);
            metadata(anyPath, MAX, (() => MAX_NUMBER) as any);
        }
    }
}

export interface BindTemplateOptions {
    readonly skipRules?: ReadonlyArray<string>;
    /** Registry to resolve template names; defaults to the registry of the enclosing `ngxForm()`. */
    readonly registry?: RuleRegistry;
    /**
     * `static+dynamic` (default): rules known now become per-field validators (with metadata); rules added later are
     * evaluated by one tree validator. `dynamic`: everything goes through the tree validator.
     */
    readonly mode?: 'static+dynamic' | 'dynamic';
}

type CompiledRules = Map<string, Set<ValidationRule>>;

/** Compiles template keys into schema rules; returns what was compiled so the dynamic part can skip it. */
function compileTemplate(
    $path: SchemaPath<any>,
    $template: RuleTemplate,
    $current: () => RuleTemplate | undefined,
    $skipRules: ReadonlyArray<string>,
): CompiledRules {
    const compiled: CompiledRules = new Map();
    for (const [key, rules] of Object.entries($template)) {
        const segments = splitPath(key);
        // Numeric segments would address one array item; schemas apply to all items, so leave those dynamic.
        if (segments.some($ => /^\d+$/.test($))) {
            continue;
        }
        compilePath($path, segments, rules, {
            skipRules: $skipRules,
            // A rule removed or replaced in the registry stops running without recompiling the form.
            active: $rule => $current()?.[key]?.includes($rule) ?? false,
        });
        compiled.set(key, new Set(rules));
    }
    return compiled;
}

function compilePath($path: SchemaPath<any>, $segments: PathSegments, $rules: ReadonlyArray<ValidationRule>, $options: ApplyRulesOptions): void {
    if ($segments.length === 0) {
        applyRules($path, $rules, $options);
        return;
    }
    const [head, ...rest] = $segments;
    if (head === GLOB_SEGMENT) {
        // Item schemas may be compiled after the parent schema function returned; keep the form context.
        const schemaContext = currentSchemaContext();
        applyEach($path as SchemaPath<Record<string, any>>, (($item: SchemaPath<any>) => schemaContext
            ? runInSchemaContext(schemaContext, () => compilePath($item, rest, $rules, $options))
            : compilePath($item, rest, $rules, $options)) as any);
    } else {
        compilePath(($path as any)[head], rest, $rules, $options);
    }
}

/**
 * Binds a rule template to a path. `$source` is a template name (looked up in the registry, reactive) or a signal.
 * Template keys are relative to `$path`.
 */
export function bindTemplate($path: SchemaPath<any>, $source: string | Signal<RuleTemplate | undefined>, $options: BindTemplateOptions = {}): void {
    const schemaContext = currentSchemaContext();
    const skip = [...($options.skipRules ?? []), ...(schemaContext?.skipRules ?? [])];
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

    const snapshot = $options.mode === 'dynamic' ? undefined : untracked(template);
    const compiled = snapshot ? compileTemplate($path, snapshot, template, $options.skipRules ?? []) : new Map<string, Set<ValidationRule>>();

    const dynamic = computed(() => {
        const current = template() ?? {};
        const result: Array<[PathSegments, ReadonlyArray<ValidationRule>]> = [];
        for (const [key, rules] of Object.entries(current)) {
            const done = compiled.get(key);
            const remaining = done ? rules.filter($ => !done.has($)) : rules;
            if (remaining.length > 0) {
                result.push([splitPath(key), remaining]);
            }
        }
        return result;
    });

    validateTree($path, ctx => {
        const entries = dynamic();
        if (entries.length === 0) {
            return undefined;
        }
        const value = ctx.value();
        // Outside ngxForm() the bound path is the best known root.
        const ruleContext = createRuleContext(schemaContext?.rootPath ?? $path, ctx);
        const errors: Array<ValidationError.WithOptionalFieldTree> = [];
        for (const [segments, rules] of entries) {
            for (const concrete of expandPath(value, segments)) {
                const target = concrete.length === 0 ? ctx.fieldTree : childField(ctx.fieldTree, concrete);
                if (!target) {
                    continue;
                }
                const skipped = target().metadata(SKIP_RULES)?.() ?? [];
                const fieldValue = valueAt(value, concrete);
                for (const rule of rules) {
                    if (skip.includes(rule.name) || skipped.includes(rule.name)) {
                        continue;
                    }
                    const error = rule.check(fieldValue, ruleContext);
                    if (error) {
                        errors.push({...error, fieldTree: target});
                    }
                }
            }
        }
        return errors;
    });
}
