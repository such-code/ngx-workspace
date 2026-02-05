import {
    AfterViewInit,
    DestroyRef,
    Directive,
    DoCheck,
    ElementRef,
    inject,
    Injector,
    Renderer2,
    signal,
} from '@angular/core';
import {combineLatest, distinctUntilChanged} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {ControlContainer, NgControl} from '@angular/forms';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {FormLikeDirective, isFormLikeDirective} from '../../util/ng-utils';

export enum ControlStatus {
    VALID = 'VALID',
    INVALID = 'INVALID',
    PENDING = 'PENDING',
    DISABLED = 'DISABLED'
}

@Directive({
    standalone: true,
    selector: '[ngModel][name],[formControlName],[formControl]',
})
export class ValidationControlStateDirective implements AfterViewInit, DoCheck {

    public static readonly ATTRIBUTE_VALIDATED = 'data-state-validated'

    public static readonly ATTRIBUTE_INVALID = 'data-state-invalid';
    public static readonly ATTRIBUTE_VALID = 'data-state-valid';

    protected readonly injector = inject(Injector);
    protected readonly destroyRef = inject(DestroyRef);
    protected readonly controlContainer = inject(ControlContainer, {host: true, optional: true});
    protected readonly ngControl = inject(NgControl, {self: true});
    protected readonly elementRef = inject(ElementRef);
    protected readonly renderer = inject(Renderer2);

    protected readonly form: FormLikeDirective | null;

    // Form control state
    protected readonly dirty = signal<boolean>(!!this.ngControl.dirty);
    protected readonly invalid = signal<boolean>(!!this.ngControl.invalid);
    protected readonly submitted = signal<boolean>(this.controlContainer && isFormLikeDirective(this.controlContainer.formDirective) ? this.controlContainer.formDirective.submitted : false);

    public constructor() {
        if (this.controlContainer && isFormLikeDirective(this.controlContainer.formDirective)) {
            this.form = this.controlContainer.formDirective;
        } else {
            this.form = null;
        }
    }

    public ngAfterViewInit() {
        const invalid$ = toObservable(this.invalid, {injector: this.injector});
        const visible$ = combineLatest([
            invalid$,
            toObservable(this.dirty, {injector: this.injector}),
            toObservable(this.submitted, {injector: this.injector}),
        ]).pipe(
            map(([$invalid, $dirty, $submitted]): boolean => {
                return $invalid && ($dirty || $submitted);
            }),
            startWith(false),
            distinctUntilChanged(),
        );

        visible$.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe($ => {
            if ($) {
                this.renderer.setAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALIDATED, '');
            } else {
                this.renderer.removeAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALIDATED);
            }
        });

        invalid$.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe($ => {
            if ($) {
                this.renderer.setAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_INVALID, '');
                this.renderer.removeAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALID, '');
            } else {
                this.renderer.setAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALID, '');
                this.renderer.removeAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_INVALID, '');
            }
        });
    }

    public ngDoCheck(): void {
        if (this.form) {
            this.submitted.set(this.form.submitted);
        }
        this.invalid.set(!!this.ngControl.invalid);
        this.dirty.set(!!this.ngControl.dirty);
    }
}
