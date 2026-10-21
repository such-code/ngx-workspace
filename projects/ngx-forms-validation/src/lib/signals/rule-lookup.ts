import {RuleMetadata, ValidationRule} from '../core/rules';
import {RULES} from './metadata';
import {AnyField} from './field-tree';

/**
 * Rules that currently apply to `$field`: schema rules, template rules and rules added later (server constraints,
 * `registry.merge()`, `form.addRules()`). Skipped rules are left out. Reactive.
 */
export function rulesOf($field: AnyField): ReadonlyArray<ValidationRule> {
    return $field().metadata(RULES)();
}

/** Whether a rule of `$kind` (rule name, e.g. `'required'`) currently applies to `$field`. Reactive. */
export function hasRule($field: AnyField, $kind: string): boolean {
    return rulesOf($field).some($ => $.name === $kind);
}

/** Constraints of all library rules that apply to `$field`, combined: required if any, the strictest limits win. */
export function constraintsOf($field: AnyField): RuleMetadata {
    const result: {-readonly [K in keyof RuleMetadata]: RuleMetadata[K]} = {};
    for (const rule of rulesOf($field)) {
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
