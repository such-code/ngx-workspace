import {SchemaPath, TargetedValidationError, validateTree} from '@such-code/ngx-forms';
import {ExternalValidatorResult, isValidationRuleError, ruleError, ValidationRuleError} from '../core/rules';
import {splitPath, valueAt} from '../core/path';

export type SemanticError = string | ValidationRuleError | ExternalValidatorResult;

/** `relative path -> errors`, the v21 `SemanticValidator` result shape. Use `''` for the bound field itself. */
export type SemanticResult = Readonly<Record<string, SemanticError | ReadonlyArray<SemanticError>>> | null | undefined;

export type SemanticValidator<T> = ($value: T) => SemanticResult;

/**
 * Cross-field validation for a group: the function receives the group value and returns errors keyed by relative
 * path. Errors are recomputed whenever the group value changes, so they clear as soon as the condition is fixed.
 */
export function semantic<T>($path: SchemaPath<T>, $validator: SemanticValidator<T>, $kind: string = 'semantic'): void {
    validateTree($path, ctx => {
        const value = ctx.value();
        const result = $validator(value);
        if (!result) {
            return undefined;
        }
        const errors: Array<TargetedValidationError> = [];
        for (const [path, raw] of Object.entries(result)) {
            const fieldValue = valueAt(value, splitPath(path));
            const list: ReadonlyArray<SemanticError> = Array.isArray(raw) ? raw : [raw as SemanticError];
            for (const item of list) {
                errors.push({...toRuleError(item, $kind, fieldValue), path});
            }
        }
        return errors;
    });
}

function toRuleError($error: SemanticError, $kind: string, $value: unknown): ValidationRuleError {
    if (typeof $error === 'string') {
        return ruleError($kind, $value, $error);
    }
    if (isValidationRuleError($error)) {
        return $error;
    }
    return ruleError($kind, $value, $error.rawMessage, $error.params ?? $error.interpolationSource ?? null, $error.plural ?? null);
}
