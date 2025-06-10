import {Directive, input} from '@angular/core';
import {AbstractControl, NG_VALIDATORS, ValidationErrors, Validator} from '@angular/forms';
import {ValidationItemBaseDirective} from './validation-item-base.directive';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModelGroup]',
    exportAs: 'validationItem',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidationGroupDirective,
            multi: true,
        },
    ],
})
export class ValidationGroupDirective extends ValidationItemBaseDirective implements Validator {

    public override readonly name = input<string | null>(null, {alias: 'ngModelGroup'});

    // Since there is an issue for ngModelGroup with not calling registerOnValidatorChange to register changes.
    // Workaround should be used.
    protected lastValidatedControl: AbstractControl | null = null;

    constructor() {
        super();

        // Update value and validity each time validation rules are changed.
        toObservable(this.rules).pipe(
            takeUntilDestroyed(),
        ).subscribe(() => {
            if (this.lastValidatedControl) {
                this.lastValidatedControl.updateValueAndValidity();
            }
        });
    }

    protected constructUnexpectedWarn(): string {
        return `Unexpected empty rule on field: ${this.name}.`;
    }

    public override validate($control: AbstractControl): ValidationErrors | null {
        // Save the last validated control to update its validity when rules will be changed.
        this.lastValidatedControl = $control;
        return super.validate($control);
    }
}
