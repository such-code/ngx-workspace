import {Directive, inject, InjectionToken, input} from '@angular/core';
import {AbstractControl, ValidationErrors, Validator} from '@angular/forms';
import {ValidationContext, ValidationContextField} from '../../../data/validation-context';
import {IncorrectValueRule, ValidationRuleError} from '../../../rules/rules';
import {diff} from '../../../util/comparison-utils';

export const VALIDATION_CONTEXT_SEMANTIC = new InjectionToken<ValidationContext>('VALIDATION_CONTEXT_SEMANTIC');

export function validationContextSemanticFactory(): ValidationContext {
    return new ValidationContext('semantic');
}

export type SemanticValidator = ($data: any) => Record<string, ReadonlyArray<ValidationRuleError>> | null;

@Directive()
export abstract class ValidationSemanticBaseDirective implements Validator {

    public readonly semanticValidator = input<SemanticValidator | null>(null);

    protected readonly validationContextSemantic = inject(VALIDATION_CONTEXT_SEMANTIC, {self: true});
    protected previousValue: any;

    public validate($control: AbstractControl): ValidationErrors | null {
        const validator = this.semanticValidator();
        if (!!validator) {
            // This comparison is required, since angular generates a new object each time validity changes.
            // Using deep comparison ($deep = true) to properly compare nested objects (ngModelGroup)
            const difference = diff(this.previousValue, $control.value, true);
            if (difference && Object.keys(difference).length > 0) {
                this.previousValue = $control.value;
                const result = validator($control.value);
                if (typeof result === 'object' && result !== null) {
                    const fields: Record<string, ValidationContextField> = {};
                    const pathPrefix = this.getPathPrefix();

                    Object.keys(result)
                        .forEach($field => {
                            // Add path prefix to field name (e.g., "name" becomes "user.name")
                            const fullFieldPath = pathPrefix + $field;
                            const field = new ValidationContextField(fullFieldPath);
                            field.swapRules(
                                result[$field].map($error => new IncorrectValueRule($error.value, $error.rawMessage)),
                            );
                            fields[fullFieldPath] = field;
                        });
                    this.validationContextSemantic.swapFields(fields);
                } else {
                    this.validationContextSemantic.clean();
                }
            }
        }
        return null;
    }

    protected abstract getPathPrefix(): string;
}
