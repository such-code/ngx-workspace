import {
    AfterViewInit,
    DestroyRef,
    Directive,
    DoCheck,
    ElementRef,
    inject, Injector,
    OnInit,
    Renderer2,
    signal,
} from '@angular/core';
import {BehaviorSubject, combineLatest, distinctUntilChanged, Observable, of, tap} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {ControlContainer, FormGroupDirective, NgControl, NgForm} from '@angular/forms';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';

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
    protected readonly controlContainer = inject(ControlContainer, {host: true, optional: true}) as NgForm | FormGroupDirective;
    protected readonly ngControl = inject(NgControl, {self: true});
    protected readonly elementRef = inject(ElementRef);
    protected readonly renderer = inject(Renderer2);

    // Form control state
    protected readonly dirty = signal<boolean>(!!this.ngControl.dirty);
    protected readonly invalid = signal<boolean>(!!this.ngControl.invalid);
    protected readonly submitted = signal<boolean>(this.controlContainer ? this.controlContainer!.submitted : false);

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
        if (this.controlContainer) {
            this.submitted.set(this.controlContainer.submitted);
        }
        this.invalid.set(!!this.ngControl.invalid);
        this.dirty.set(!!this.ngControl.dirty);
    }
}
