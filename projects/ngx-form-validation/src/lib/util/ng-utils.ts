import {AbstractControl, FormGroup, FormGroupDirective, NgForm} from '@angular/forms';
import {ValidationRuleError} from '../rules/rules';

export function isNgForm($: any): $ is NgForm {
    return $ instanceof NgForm;
}

export function isFormGroupDirective($: any): $ is FormGroupDirective {
    return $ instanceof FormGroupDirective;
}

export type FormLikeDirective = NgForm | FormGroupDirective;

export function isFormLikeDirective($: any): $ is FormLikeDirective {
    return isNgForm($) || isFormGroupDirective($);
}

export type ValidationCheckFieldErrors = Record<string, ValidationRuleError>;
export type ValidationCheckGroupErrors = {
    [key: string]: ValidationCheckFieldErrors | ValidationCheckGroupErrors
};

export function markDirtyRecursively($control: AbstractControl | FormGroup): void {
    $control.markAsDirty({onlySelf: true});
    if ($control instanceof FormGroup) {
        Object.keys($control.controls).forEach(($controlName: string): void => {
            markDirtyRecursively($control.controls[$controlName]);
        });
    }
}

export function extractErrorFromControl($control: AbstractControl): ValidationCheckFieldErrors | ValidationCheckGroupErrors | null {
    if ($control instanceof FormGroup) {
        return Object.keys($control.controls).reduce<ValidationCheckGroupErrors | null>(
            ($acc, $controlName) => {
                const control = $control.controls[$controlName];
                const errors = extractErrorFromControl(control);
                if (errors) {
                    return {
                        ...$acc,
                        [$controlName]: errors,
                    };
                }
                return $acc;
            },
            null,
        );
    }
    return $control.errors;
}
