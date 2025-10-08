import {ValidationItemBaseDirective} from './validation-item-base.directive';
import {Observable} from 'rxjs';
import {Directive, input} from '@angular/core';
import {FormArray, FormControl, FormGroup, NG_VALIDATORS} from '@angular/forms';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {map} from 'rxjs/operators';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[formControl]',
    exportAs: 'validationItem',
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: ValidationControlDirective,
            multi: true,
        },
    ],
})
export class ValidationControlDirective extends ValidationItemBaseDirective {

    public readonly formControl = input<FormControl | null>();

    private readonly _name$: Observable<string | null>;

    public constructor() {
        super();

        this._name$ = toObservable(this.formControl).pipe(
            map($ => {
                if ($) {
                    if ($.parent instanceof FormGroup) {
                        for (const name in $.parent.controls) {
                            if ($.parent.controls[name] === $) {
                                return name;
                            }
                        }
                    } else if ($.parent instanceof FormArray) {
                        const index = $.parent.controls.indexOf($);
                        if (index > -1) {
                            return '' + index;
                        }
                    }
                }
                return null;
            }),
            takeUntilDestroyed(),
        );
    }

    public override ngOnInit() {
        super.ngOnInit();

        // Update value and validity each time validation rules are changed.
        toObservable(this.rules, {injector: this.injector}).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => {
            const formControl = this.formControl();
            if (formControl) {
                formControl.updateValueAndValidity();
            }
        });
    }

    protected provideName$(): Observable<string | null> {
        return this._name$;
    }

    protected constructUnexpectedWarn(): string {
        return '';
    }
}
