import {Directive, EventEmitter, output} from '@angular/core';
import {ValidationCheckBaseDirective} from './validation-check-base.directive';
import {ValidationSubmitEvent} from './validation-submit-event';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[onValidContinue],[onInvalidContinue],[onValidatedContinue]',
})
export class ValidationCheckContinueDirective extends ValidationCheckBaseDirective {
    protected static ngSubmitStub = new EventEmitter();

    public override readonly onValid = output<ValidationSubmitEvent>({alias: 'onValidContinue'});
    public override readonly onInvalid = output<ValidationSubmitEvent>({alias: 'onInvalidContinue'});
    public override readonly onValidated = output<ValidationSubmitEvent>({alias: 'onValidatedContinue'});

    protected performSubmit(): void {
        const previousSubmitState = this.controlContainer.submitted;
        const originalSubmitEmitter = this.controlContainer.ngSubmit;

        // Prevent form from dispatching submit event
        this.controlContainer.ngSubmit = ValidationCheckContinueDirective.ngSubmitStub;
        // This submit-event is required to update all ngModels and validate the form.
        this.controlContainer.onSubmit(new CustomEvent('submit'));
        // Restore original event dispatcher.
        this.controlContainer.ngSubmit = originalSubmitEmitter;

        // Restore previous submitted state if required
        if (previousSubmitState !== this.controlContainer.submitted) {
            (this.controlContainer as { submitted: boolean }).submitted = previousSubmitState;
        }

        // This is required to mark all fields as dirty (errors will be displayed in that case).
        ValidationCheckBaseDirective.markDirtyRecursively(this.controlContainer.control);
    }
}
