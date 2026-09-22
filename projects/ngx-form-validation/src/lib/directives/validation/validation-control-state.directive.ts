import {
    AfterViewInit,
    computed,
    Directive,
    DoCheck,
    effect,
    ElementRef,
    inject,
    Injector,
    Renderer2,
    Signal,
    signal,
} from '@angular/core';
import {ControlContainer, NgControl} from '@angular/forms';
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
    protected readonly controlContainer = inject(ControlContainer, {host: true, optional: true});
    protected readonly ngControl = inject(NgControl, {self: true});
    protected readonly elementRef = inject(ElementRef);
    protected readonly renderer = inject(Renderer2);

    protected readonly form: FormLikeDirective | null;

    // Form control state
    protected readonly _dirty = signal<boolean>(!!this.ngControl.dirty);
    protected readonly _invalid = signal<boolean>(!!this.ngControl.invalid);
    protected readonly _submitted = signal<boolean>(this.controlContainer && isFormLikeDirective(this.controlContainer.formDirective) ? this.controlContainer.formDirective.submitted : false);

    public readonly visible = computed(() => {
        const invalid = this._invalid();
        const dirty = this._dirty();
        const submitted = this._submitted();

        return invalid && (dirty || submitted);
    });

    public constructor() {
        if (this.controlContainer && isFormLikeDirective(this.controlContainer.formDirective)) {
            this.form = this.controlContainer.formDirective;
        } else {
            this.form = null;
        }
    }

    public ngAfterViewInit() {
        effect(() => {
            if (this.visible()) {
                this.renderer.setAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALIDATED, '');
            } else {
                this.renderer.removeAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALIDATED);
            }
        }, {injector: this.injector});

        effect(() => {
            if (this._invalid()) {
                this.renderer.setAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_INVALID, '');
                this.renderer.removeAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALID, '');
            } else {
                this.renderer.setAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_VALID, '');
                this.renderer.removeAttribute(this.elementRef.nativeElement, ValidationControlStateDirective.ATTRIBUTE_INVALID, '');
            }
        }, {injector: this.injector});
    }

    public ngDoCheck(): void {
        if (this.form) {
            this._submitted.set(this.form.submitted);
        }
        this._invalid.set(!!this.ngControl.invalid);
        this._dirty.set(!!this.ngControl.dirty);
    }

    public get dirty(): Signal<boolean> {
        return this._dirty.asReadonly();
    }

    public get invalid(): Signal<boolean> {
        return this._invalid.asReadonly();
    }

    public get submitted(): Signal<boolean> {
        return this._submitted.asReadonly();
    }
}
