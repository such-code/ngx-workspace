import {Directive, Input} from '@angular/core';
import {NG_VALIDATORS} from '@angular/forms';
import {ValidatorBaseDirective} from './validator-base.directive';
import {MaxOrEqualRule} from '../../rules/rules';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModel][max]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidatorMaxDirective,
            multi: true,
        },
    ],
})
export class ValidatorMaxDirective extends ValidatorBaseDirective<MaxOrEqualRule> {

    @Input()
    public set max($value: any) {
        if (typeof $value === 'number') {
            this.rule = new MaxOrEqualRule($value);
        } else if (typeof $value === 'string' && /^[+-]?\d+$/.test($value)) {
            this.rule = new MaxOrEqualRule(parseInt($value, 10));
        } else {
            this.rule = null;
        }
    }
}
