import {Directive, Input} from '@angular/core';
import {MinOrEqualRule} from '../../rules/rules';
import {ValidatorBaseDirective} from './validator-base.directive';
import {NG_VALIDATORS} from '@angular/forms';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModel][min]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidatorMinDirective,
            multi: true,
        },
    ],
})
export class ValidatorMinDirective extends ValidatorBaseDirective<MinOrEqualRule> {

    @Input()
    public set min($value: any) {
        if (typeof $value === 'number') {
            this.rule = new MinOrEqualRule($value);
        } else if (typeof $value === 'string' && /^[+-]?\d+$/.test($value)) {
            this.rule = new MinOrEqualRule(parseInt($value, 10));
        } else {
            this.rule = null;
        }
    }
}
