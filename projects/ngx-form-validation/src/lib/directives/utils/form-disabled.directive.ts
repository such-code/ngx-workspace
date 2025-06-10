import {Directive, inject, Inject, InjectionToken, input, Optional, Provider} from '@angular/core';
import {NgForm} from '@angular/forms';
import {Observable, of, Subject} from 'rxjs';
import {catchError, distinctUntilChanged, map, skip, startWith, switchMap} from 'rxjs/operators';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';

export const FORM_DISABLED_SOURCE = new InjectionToken<Subject<Observable<any>>>('FORM_DISABLED_SOURCE');
export const formDisabledSourceFactory = function (): Subject<Observable<any>> {
    return new Subject<Observable<any>>();
};

export const formDisabledSourceProvider: Provider = {
    provide: FORM_DISABLED_SOURCE,
    useFactory: formDisabledSourceFactory,
};

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: 'form:not([ngNoForm]):not([formGroup]),ngForm,[ngForm]',
})
export class FormDisabledDirective {

    protected readonly ngForm = inject(NgForm, {self: true});

    public readonly source = input<Observable<Observable<any>> | null>(null);

    public constructor(
        @Inject(FORM_DISABLED_SOURCE) @Optional()
        $disabledSource: Observable<Observable<any>>,
    ) {
        const source$ = $disabledSource
            ? toObservable(this.source).pipe(skip(1), startWith($disabledSource))
            : toObservable(this.source);

        const disabled$ = source$.pipe(
            switchMap(($source) => {
                if ($source) {
                    return $source.pipe(
                        switchMap(($: Observable<any>) => {
                            if ($) {
                                return $.pipe(
                                    map(() => false),
                                    catchError(() => of(false)),
                                    startWith(true),
                                );
                            }
                            return of(false);
                        }),
                        catchError(() => of(false)),
                    );
                }
                return of(false);
            }),
        );

        disabled$.pipe(
            distinctUntilChanged(),
            takeUntilDestroyed(),
        ).subscribe($ => {
            if ($) {
                this.ngForm.form.disable();
            } else {
                this.ngForm.form.enable();
            }
        });
    }
}
