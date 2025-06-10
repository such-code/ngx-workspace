import {Directive, forwardRef, inject, InjectionToken, input} from '@angular/core';
import {AbstractControl, NG_VALIDATORS, ValidationErrors, Validator} from '@angular/forms';
import {VALIDATION_CONTEXTS, ValidationContext, ValidationContextField} from '../../data/validation-context';
import {IncorrectValueRule, ValidationRuleError} from '../../rules/rules';
import {diff} from '../../util/comparison-utils';

export const VALIDATION_CONTEXT_SEMANTIC = new InjectionToken<ValidationContext>('VALIDATION_CONTEXT_SEMANTIC');

export function validationContextSemanticFactory(): ValidationContext {
    return new ValidationContext('semantic');
}

export type SemanticValidator = ($data: any) => Record<string, ReadonlyArray<ValidationRuleError>> | null;

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[semanticValidator]',
    providers: [
        {
            provide: VALIDATION_CONTEXT_SEMANTIC,
            useFactory: validationContextSemanticFactory,
        },
        {
            multi: true,
            provide: VALIDATION_CONTEXTS,
            useExisting: VALIDATION_CONTEXT_SEMANTIC,
        },
        {
            multi: true,
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => ValidationSemanticContextDirective),
        },
    ],
})
export class ValidationSemanticContextDirective implements Validator {

    public readonly semanticValidator = input<SemanticValidator | null>(null);

    protected readonly validationContextSemantic = inject(VALIDATION_CONTEXT_SEMANTIC, {self: true});

    protected previousValue: any;

    public validate($control: AbstractControl): ValidationErrors | null {
        const validator = this.semanticValidator();
        if (!!validator) {
            // This comparison is required, since angular generates a new object each time validity changes.
            const difference = diff(this.previousValue, $control.value);
            if (difference && Object.keys(difference).length > 0) {
                this.previousValue = $control.value;
                const result = validator($control.value);
                if (typeof result === 'object' && result !== null) {
                    const fields: Record<string, ValidationContextField> = {};
                    Object.keys(result)
                        .forEach($field => {
                            const field = new ValidationContextField($field);
                            field.swapRules(
                                result[$field].map($error => new IncorrectValueRule($error.value, $error.rawMessage)),
                            );
                            fields[$field] = field;
                        });
                    this.validationContextSemantic.swapFields(fields);
                } else {
                    this.validationContextSemantic.clean();
                }
            }
        }
        return null;
    }
}
