import {AbstractControl, ValidationErrors, Validator} from '@angular/forms';
import {ValidationRule} from '../../rules/rules';
import {Directive} from '@angular/core';

@Directive({})
export abstract class ValidatorBaseDirective<T extends ValidationRule> implements Validator {
    protected internalRule: T | null = null;
    protected validatorChangeFn: (() => void) | null = null;

    public registerOnValidatorChange($fn: () => void): void {
        this.validatorChangeFn = $fn;
    }

    public validate($c: AbstractControl): ValidationErrors | null {
        if (this.internalRule) {
            return this.internalRule.validator($c);
        }
        return null;
    }

    protected set rule($value: T | null) {
        this.internalRule = $value;
        if (this.validatorChangeFn) {
            this.validatorChangeFn();
        }
    }

    protected get rule(): T | null {
        return this.internalRule;
    }
}
