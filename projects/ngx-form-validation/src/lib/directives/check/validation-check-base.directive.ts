import {Directive, ElementRef, inject, OnDestroy, OutputEmitterRef} from '@angular/core';
import {AbstractControl, ControlContainer, FormGroup} from '@angular/forms';
import {ERROR_COLLECTOR_SOURCE} from '../../data/error-collection';
import {ValidationRuleError} from '../../rules/rules';
import {VALIDATION_CONTEXT_REFLECTION} from '../context/validation-named-context-base.directive';
import {VALIDATION_CONTEXT_LOCAL} from '../context/validation-local-context.directive';
import {ValidationSubmitEvent, ValidationSubmitEventType} from './validation-submit-event';
import {FormLikeDirective, isFormLikeDirective} from '../../util/ng-utils';

export type ValidationCheckFieldErrors = Record<string, ValidationRuleError>;
export type ValidationCheckGroupErrors = {
    [key: string]: ValidationCheckFieldErrors | ValidationCheckGroupErrors
};

@Directive({})
export abstract class ValidationCheckBaseDirective implements OnDestroy {

    protected static markDirtyRecursively($control: AbstractControl | FormGroup): void {
        $control.markAsDirty({onlySelf: true});
        if ($control instanceof FormGroup) {
            Object.keys($control.controls).forEach(($controlName: string): void => {
                ValidationCheckBaseDirective.markDirtyRecursively($control.controls[$controlName]);
            });
        }
    }

    protected static extractErrorFromControl($control: AbstractControl): ValidationCheckFieldErrors | ValidationCheckGroupErrors | null {
        if ($control instanceof FormGroup) {
            return Object.keys($control.controls).reduce<ValidationCheckGroupErrors | null>(
                ($acc, $controlName) => {
                    const control = $control.controls[$controlName];
                    const errors = ValidationCheckBaseDirective.extractErrorFromControl(control);
                    if (errors) {
                        return {
                            ...$acc,
                            [$controlName]: errors,
                        };
                    }
                    return $acc;
                },
                null,
            );
        }
        return $control.errors;
    }

    protected readonly element = inject(ElementRef);
    protected readonly errorCollection = inject(ERROR_COLLECTOR_SOURCE, {skipSelf: true, optional: true});
    protected readonly reflectedContext = inject(VALIDATION_CONTEXT_REFLECTION, {skipSelf: true, optional: true});
    protected readonly localContext = inject(VALIDATION_CONTEXT_LOCAL, {skipSelf: true, optional: true});

    protected readonly controlContainer = inject(ControlContainer);

    protected readonly form: FormLikeDirective | null;

    public abstract readonly onValid: OutputEmitterRef<ValidationSubmitEvent>;
    public abstract readonly onInvalid: OutputEmitterRef<ValidationSubmitEvent>;
    public abstract readonly onValidated: OutputEmitterRef<ValidationSubmitEvent>;

    public constructor() {
        if (this.controlContainer && isFormLikeDirective(this.controlContainer.formDirective)) {
            this.handleClick = this.handleClick.bind(this);
            this.element.nativeElement.addEventListener('click', this.handleClick);
            this.form = this.controlContainer.formDirective;
        } else {
            this.form = null;
        }
    }

    protected abstract performSubmit(): void;

    protected handleClick($event: PointerEvent): void {
        if (this.controlContainer.enabled) {
            // Trigger form validation.
            this.performSubmit();

            // Just in case this will be required someday, saving this here.
            // this.ngForm.onReset();

            // Clean previous errors if they existed.
            if (this.errorCollection) {
                this.errorCollection.clear();
            }

            let event: ValidationSubmitEvent;
            if (this.controlContainer.valid) {
                event = new ValidationSubmitEvent(
                    ValidationSubmitEventType.VALID,
                    this.element.nativeElement,
                    this.controlContainer.value,
                    this.reflectedContext,
                    this.localContext,
                    this.errorCollection,
                );
                this.onValid.emit(event);
            } else {
                event = new ValidationSubmitEvent(
                    ValidationSubmitEventType.INVALID,
                    this.element.nativeElement,
                    this.controlContainer.value,
                    this.reflectedContext,
                    this.localContext,
                    this.errorCollection,
                    ValidationCheckBaseDirective.extractErrorFromControl(this.form!.control),
                );
                this.onInvalid.emit(event);
            }
            // Submit any event if this is required.
            this.onValidated.emit(event);

            // Not sure if this is required;
            $event.preventDefault();
            $event.stopPropagation();
        }
    }

    public ngOnDestroy(): void {
        this.element.nativeElement.removeEventListener('click', this.handleClick);
    }
}
