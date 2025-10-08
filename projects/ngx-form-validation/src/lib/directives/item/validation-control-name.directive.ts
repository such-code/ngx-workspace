import {Directive, input} from '@angular/core';
import {AbstractControl, NG_VALIDATORS, ValidationErrors, Validator} from '@angular/forms';
import {ValidationItemBaseDirective} from './validation-item-base.directive';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {Observable} from 'rxjs';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[formControlName]',
    exportAs: 'validationItem',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidationControlNameDirective,
            multi: true,
        },
    ],
})
export class ValidationControlNameDirective extends ValidationItemBaseDirective implements Validator {

    public readonly name = input<string | null>(null, {alias: 'formControlName'});

    // Since there is an issue for ngModelGroup with not calling registerOnValidatorChange to register changes.
    // Workaround should be used.
    protected lastValidatedControl: AbstractControl | null = null;

    private readonly _name$: Observable<string | null>;

    constructor() {
        super();
        this._name$ = toObservable(this.name);
    }

    public override ngOnInit() {
        super.ngOnInit();

        // Update value and validity each time validation rules are changed.
        toObservable(this.rules, {injector: this.injector}).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => {
            if (this.lastValidatedControl) {
                this.lastValidatedControl.updateValueAndValidity();
            }
        });
    }

    public override validate($control: AbstractControl): ValidationErrors | null {
        // Save the last validated control to update its validity when rules will be changed.
        this.lastValidatedControl = $control;
        return super.validate($control);
    }

    protected constructUnexpectedWarn(): string {
        return `Unexpected empty rule on field: ${this.name()}.`;
    }

    protected provideName$(): Observable<string | null> {
        return this._name$;
    }
}
