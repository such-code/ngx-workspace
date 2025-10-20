import {Directive, inject, Inject, InjectionToken, input, Optional, Provider} from '@angular/core';
import {ControlContainer} from '@angular/forms';
import {Observable, of, Subject} from 'rxjs';
import {catchError, distinctUntilChanged, map, skip, startWith, switchMap} from 'rxjs/operators';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {FormLikeDirective} from '../../util/ng-utils';

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
    selector: 'form:not([ngNoForm]),ngForm,[ngForm],[formGroup]',
})
export class FormDisabledDirective {

    protected readonly controlContainer = inject(ControlContainer, {self: true}) as FormLikeDirective;

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
                this.controlContainer.form.disable();
            } else {
                this.controlContainer.form.enable();
            }
        });
    }
}
