import {AfterViewInit, DestroyRef, Directive, DoCheck, ElementRef, inject, Renderer2, signal} from '@angular/core';
import {combineLatest, distinctUntilChanged, Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {NgControl, NgForm} from '@angular/forms';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';

export enum ControlStatus {
    VALID = 'VALID',
    INVALID = 'INVALID',
    PENDING = 'PENDING',
    DISABLED = 'DISABLED'
}

@Directive({
    standalone: true,
    selector: '[ngModel][name]:not([formControlName]):not([formControl])',
})
export class ValidationControlStateDirective implements AfterViewInit, DoCheck {

    public static readonly ATTRIBUTE_VALIDATED = 'data-state-validated'

    public static readonly ATTRIBUTE_INVALID = 'data-state-invalid';
    public static readonly ATTRIBUTE_VALID = 'data-state-valid';

    protected readonly destroyRef = inject(DestroyRef);
    protected readonly ngForm = inject(NgForm, {host: true, optional: true});
    protected readonly ngControl = inject(NgControl, {self: true});
    protected readonly elementRef = inject(ElementRef);
    protected readonly renderer = inject(Renderer2);

    // Form control state
    protected readonly submitted = signal<boolean>(this.ngForm ? this.ngForm!.submitted : false);
    protected readonly dirty = signal<boolean>(!!this.ngControl.dirty);

    // Computed hidden state!
    protected readonly invalid$: Observable<boolean>;
    protected readonly visible$: Observable<boolean>;

    public constructor() {
        this.invalid$ = this.ngControl.statusChanges!.pipe(
            map($ => $ === ControlStatus.INVALID),
            startWith(this.ngControl.status === ControlStatus.INVALID),
            distinctUntilChanged(),
        );

        this.visible$ = combineLatest([
            this.invalid$,
            toObservable(this.dirty),
            toObservable(this.submitted),
        ]).pipe(
            map(([$invalid, $dirty, $submitted]): boolean => {
                return $invalid && ($dirty || $submitted);
            }),
            startWith(false),
            distinctUntilChanged(),
        )
        ;
    }

    public ngAfterViewInit() {
        this.visible$.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe($ => {
            if ($) {
                this.renderer.setAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALIDATED, '');
            } else {
                this.renderer.removeAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALIDATED);
            }
        });

        this.invalid$.pipe(
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
        if (this.ngForm) {
            this.submitted.set(this.ngForm.submitted);
        }
        this.dirty.set(!!this.ngControl.dirty);
    }
}
