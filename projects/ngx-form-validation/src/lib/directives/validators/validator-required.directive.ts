import {Directive} from '@angular/core';
import {RequiredRule} from '../../rules/rules';
import {ValidatorBaseDirective} from './validator-base.directive';
import {NG_VALIDATORS} from '@angular/forms';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModel][isRequired]',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidatorRequiredDirective,
            multi: true,
        },
    ],
})
export class ValidatorRequiredDirective extends ValidatorBaseDirective<RequiredRule> {

    public constructor() {
        super();
        this.rule = new RequiredRule();
    }
}
