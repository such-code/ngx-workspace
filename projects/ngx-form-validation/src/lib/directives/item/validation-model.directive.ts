import {Directive, input} from '@angular/core';
import {NG_VALIDATORS, Validator} from '@angular/forms';
import {ValidationItemBaseDirective} from './validation-item-base.directive';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {Observable} from 'rxjs';

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

    public readonly name = input<string | null>(null);

    protected validatorChangeFn: (() => void) | null = null;

    private readonly _name$: Observable<string | null>;

    public constructor() {
        super();

        this._name$ = toObservable(this.name);
    }

    public override ngOnInit() {
        super.ngOnInit();

        // Update value and validity each time validation rules are changed.
        toObservable(this.rules, {injector: this.injector}).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => {
            if (this.validatorChangeFn) {
                this.validatorChangeFn();
            }
        });
    }

    public registerOnValidatorChange($fn: () => void): void {
        this.validatorChangeFn = $fn;
    }

    protected constructUnexpectedWarn(): string {
        return `Unexpected empty rule for field: "${this.name()}".`;
    }

    protected provideName$(): Observable<string | null> {
        return this._name$;
    }
}
