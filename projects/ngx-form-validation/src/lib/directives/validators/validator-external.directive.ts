import {Directive, Input} from '@angular/core';
import {ExternalValidatorRule, ValidationRuleError} from '../../rules/rules';
import {ValidatorBaseDirective} from './validator-base.directive';
import {NG_VALIDATORS} from '@angular/forms';

export type ExternalValidator = ($value: any, $formData?: any) => (ValidationRuleError | null);

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModel][externalValidator]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidatorExternalDirective,
            multi: true,
        },
    ],
})
export class ValidatorExternalDirective extends ValidatorBaseDirective<ExternalValidatorRule> {

    @Input()
    public set externalValidator($value: ExternalValidator | null) {
        this.rule = $value !== null ? new ExternalValidatorRule($value) : null;
    }
}
