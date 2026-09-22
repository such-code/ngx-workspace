import {Directive, ElementRef, inject, OutputEmitterRef} from '@angular/core';
import {ControlContainer} from '@angular/forms';
import {ERROR_COLLECTOR_SOURCE} from '../../data/error-collection';
import {VALIDATION_CONTEXT_REFLECTION} from '../context/validation-named-context-base.directive';
import {VALIDATION_CONTEXT_LOCAL} from '../context/validation-local-context.directive';
import {ValidationSubmitEvent, ValidationSubmitEventType} from './validation-submit-event';
import {extractErrorFromControl, FormLikeDirective, isFormLikeDirective} from '../../util/ng-utils';

@Directive({})
export abstract class ValidationCheckBaseDirective {

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
            this.form = this.controlContainer.formDirective;
        } else {
            this.form = null;
        }
    }

    protected performValidationAndEmit(): void {
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
                this.controlContainer.control?.getRawValue.bind(this.controlContainer.control),
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
                this.controlContainer.control?.getRawValue.bind(this.controlContainer.control),
                this.reflectedContext,
                this.localContext,
                this.errorCollection,
                extractErrorFromControl(this.form!.control),
            );
            this.onInvalid.emit(event);
        }
        // Submit any event if this is required.
        this.onValidated.emit(event);
    }
}
