import {Directive, Input} from '@angular/core';
import {AllowedValueRule} from '../../rules/rules';
import {ValidatorBaseDirective} from './validator-base.directive';
import {NG_VALIDATORS} from '@angular/forms';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModel][allowedValue]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidatorAllowedValueDirective,
            multi: true,
        },
    ],
})
export class ValidatorAllowedValueDirective extends ValidatorBaseDirective<AllowedValueRule> {

    @Input()
    public set allowedValue($values: any[] | null) {
        this.rule = Array.isArray($values) ? new AllowedValueRule($values) : null;
    }
}
