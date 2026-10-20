import {Signal} from '@angular/core';
import {createMetadataKey, MetadataReducer} from '@angular/forms/signals';
import {RuleMetadata, ValidationRule} from '../core/rules';
import {RuleTemplate} from '../core/registry';
import {matchPath, PathSegments, splitPath} from '../core/path';
import {SKIP_RULES} from './metadata';
import {AnyReadonlyField, childField} from './field-tree';

/** Active rules compiled into the schema of a field (by `applyRules()` and the static part of `bindTemplate()`). */
export const RULES = createMetadataKey(MetadataReducer.list<ValidationRule>());

/** @internal Template bound with `bindTemplate()` at a field; read to find rules added after the form was created. */
export interface TemplateBinding {
    readonly template: Signal<RuleTemplate | undefined>;
    /** Rules per template key that are already compiled (and reported through `RULES`). */
    readonly compiled: ReadonlyMap<string, ReadonlySet<ValidationRule>>;
    readonly skipRules: ReadonlyArray<string>;
}

/** @internal */
export const TEMPLATE_BINDINGS = createMetadataKey(MetadataReducer.list<TemplateBinding>());

function relativeSegments($root: AnyReadonlyField, $field: AnyReadonlyField): PathSegments | null {
    const rootName = $root().name();
    const fieldName = $field().name();
    if (fieldName === rootName) {
        return [];
    }
    return fieldName.startsWith(rootName + '.') ? splitPath(fieldName.substring(rootName.length + 1)) : null;
}

/**
 * Rules that currently apply to `$field`: schema rules, template rules known when the form was created and rules
 * added later (server constraints, `registry.merge()`, `form.addRules()`). Skipped rules are left out. Reactive.
 */
export function rulesOf($root: AnyReadonlyField, $field: AnyReadonlyField): ReadonlyArray<ValidationRule> {
    const result = new Set<ValidationRule>($field().metadata(RULES)?.() ?? []);
    const segments = relativeSegments($root, $field);
    if (segments === null) {
        return [...result];
    }
    const skipped = $field().metadata(SKIP_RULES)?.() ?? [];

    // Templates bound at the field or any ancestor; keys are relative to the bound field.
    for (let depth = 0; depth <= segments.length; depth++) {
        const holder = childField($root, segments.slice(0, depth));
        const bindings = holder?.().metadata(TEMPLATE_BINDINGS)?.() ?? [];
        if (bindings.length === 0) {
            continue;
        }
        const relative = segments.slice(depth);
        for (const binding of bindings) {
            for (const [key, rules] of Object.entries(binding.template() ?? {})) {
                if (!matchPath(splitPath(key), relative)) {
                    continue;
                }
                const compiled = binding.compiled.get(key);
                for (const rule of rules) {
                    if (compiled?.has(rule) || binding.skipRules.includes(rule.name) || skipped.includes(rule.name)) {
                        continue;
                    }
                    result.add(rule);
                }
            }
        }
    }
    return [...result];
}

/** Whether a rule of `$kind` (rule name, e.g. `'required'`) currently applies to `$field`. Reactive. */
export function hasRule($root: AnyReadonlyField, $field: AnyReadonlyField, $kind: string): boolean {
    return rulesOf($root, $field).some($ => $.name === $kind);
}

/**
 * Constraints of all rules that apply to `$field`, combined the way Signal Forms combines metadata: required if any
 * rule requires, the strictest limits win. Unlike field metadata it includes rules added after the form was created.
 */
export function constraintsOf($root: AnyReadonlyField, $field: AnyReadonlyField): RuleMetadata {
    const result: {-readonly [K in keyof RuleMetadata]: RuleMetadata[K]} = {};
    for (const rule of rulesOf($root, $field)) {
        const meta = rule.metadata();
        if (!meta) {
            continue;
        }
        if (meta.required) {
            result.required = true;
        }
        if (meta.minLength !== undefined) {
            result.minLength = Math.max(result.minLength ?? meta.minLength, meta.minLength);
        }
        if (meta.maxLength !== undefined) {
            result.maxLength = Math.min(result.maxLength ?? meta.maxLength, meta.maxLength);
        }
        if (meta.min !== undefined) {
            result.min = Math.max(result.min ?? meta.min, meta.min);
        }
        if (meta.max !== undefined) {
            result.max = Math.min(result.max ?? meta.max, meta.max);
        }
        if (meta.pattern !== undefined && result.pattern === undefined) {
            result.pattern = meta.pattern;
        }
    }
    return result;
}
