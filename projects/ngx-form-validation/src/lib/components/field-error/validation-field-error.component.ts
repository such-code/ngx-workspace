import {
    Attribute,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    DestroyRef,
    DoCheck,
    ElementRef,
    inject,
    input,
    OnDestroy,
    OnInit,
    Renderer2,
} from '@angular/core';
import {ControlContainer, FormGroup, NgForm, ValidationErrors} from '@angular/forms';
import {combineLatest, distinctUntilChanged, merge, Observable, of, Subject, switchMap} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {AsyncPipe, KeyValuePipe} from '@angular/common';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {ValidationErrorPipe} from '../../pipes/validation-error.pipe';

@Component({
    standalone: true,
    selector: 'ngx-validation-field-error',
    templateUrl: './validation-field-error.component.html',
    host: {
        'aria-atomic': 'true',
    },
    styleUrl: 'validation-field-error.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AsyncPipe, KeyValuePipe, ValidationErrorPipe],
})
export class ValidationFieldErrorComponent implements DoCheck, OnInit, OnDestroy {
    public static STATE_VISIBLE = 'data-state-visible';

    public readonly for = input<string | null>(null);

    public readonly errors$: Observable<ValidationErrors | null>;

    protected readonly changeDetectorRef = inject(ChangeDetectorRef);
    protected readonly destroyRef = inject(DestroyRef);
    protected readonly elementRef = inject(ElementRef);
    protected readonly ngForm = inject(NgForm, {host: true, optional: true});
    protected readonly parentControlContainer = inject(ControlContainer, {host: true, skipSelf: true});
    protected readonly renderer = inject(Renderer2);

    protected readonly doCheck$ = new Subject<void>();

    // Form control state
    protected readonly submitted$: Observable<boolean>;
    protected readonly invalid$: Observable<boolean>;
    protected readonly dirty$: Observable<boolean>;

    // Computed hidden state!
    protected readonly visible$: Observable<boolean>;

    public constructor(
        @Attribute('aria-live')
        ariaLive: string,
    ) {
        if (!ariaLive) {
            this.elementRef.nativeElement.setAttribute('aria-live', 'polite');
        }

        // Since the form does not emit anything when is reset, this is the only way how to implement submitted state.
        this.submitted$ = this.ngForm
            ? this.ngForm.ngSubmit.pipe(
                map(() => this.ngForm!.submitted),
                startWith(this.ngForm!.submitted),
            )
            : of(false);

        const control$ = toObservable(this.for).pipe(
            distinctUntilChanged(),
            switchMap(($: string | null) => {
                if (typeof $ === 'string') {
                    // This is a workaround, since there are no correct ways to track controls changes.
                    return this.doCheck$.pipe(
                        startWith(),
                        map(() => {
                            return (this.parentControlContainer.control as FormGroup)!.controls[$];
                        }),
                    );
                }
                return of(null);
            }),
            distinctUntilChanged(),
        );

        this.invalid$ = control$.pipe(
            switchMap($control => {
                if ($control) {
                    return $control.statusChanges.pipe(
                        map($ => $ === 'INVALID'),
                        startWith($control.status === 'INVALID'),
                    );
                }
                return of(false);
            }),
            distinctUntilChanged(),
        );

        this.dirty$ = control$.pipe(
            switchMap($control => {
                if ($control) {
                    return $control.statusChanges.pipe(
                        map(() => $control.dirty),
                        startWith($control.dirty),
                    );
                }
                return of(false);
            }),
            distinctUntilChanged(),
        );

        this.errors$ = control$.pipe(
            switchMap($control => {
                if ($control) {
                    // This is a workaround, since for now there is no correct way to subscribe to errors.
                    return merge(
                        this.doCheck$,
                        $control.statusChanges,
                    ).pipe(
                        map(() => $control.errors),
                        startWith($control.errors),
                    );
                }
                return of(null);
            }),
            distinctUntilChanged(),
        );

        this.visible$ = combineLatest([
            this.invalid$,
            this.dirty$,
            this.submitted$,
        ]).pipe(
            map(([$invalid, $dirty, $submitted]: [boolean, boolean, boolean]): boolean => {
                return $invalid && ($dirty || $submitted);
            }),
            distinctUntilChanged(),
        );
    }

    public ngDoCheck(): void {
        this.doCheck$.next();
    }

    public ngOnInit(): void {
        // Render hidden state.
        this.visible$.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe($ => {
            if ($) {
                this.renderer.setAttribute(this.elementRef.nativeElement, ValidationFieldErrorComponent.STATE_VISIBLE, ValidationFieldErrorComponent.STATE_VISIBLE);
            } else {
                this.renderer.removeAttribute(this.elementRef.nativeElement, ValidationFieldErrorComponent.STATE_VISIBLE);
            }
        });
    }

    public ngOnDestroy(): void {
        this.doCheck$.complete();
    }
}
