import {Directive} from '@angular/core';
import {NG_VALIDATORS, Validator} from '@angular/forms';
import {ValidationItemBaseDirective} from './validation-item-base.directive';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModel][name]:not([formControlName]):not([formControl])',
    exportAs: 'validationItem',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidationModelDirective,
            multi: true,
        },
    ],
})
export class ValidationModelDirective extends ValidationItemBaseDirective implements Validator {

    protected validatorChangeFn: (() => void) | null = null;

    public constructor() {
        super();

        // Update value and validity each time validation rules are changed.
        toObservable(this.rules).pipe(
            takeUntilDestroyed(),
        ).subscribe(() => {
            if (this.validatorChangeFn) {
                this.validatorChangeFn();
            }
        });
    }

    protected constructUnexpectedWarn(): string {
        return `Unexpected empty rule for field: "${this.name}".`;
    }

    public registerOnValidatorChange($fn: () => void): void {
        this.validatorChangeFn = $fn;
    }
}
