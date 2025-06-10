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
        const previousSubmitState = this.ngForm.submitted;
        const originalSubmitEmitter = this.ngForm.ngSubmit;

        // Prevent form from dispatching submit event
        this.ngForm.ngSubmit = ValidationCheckContinueDirective.ngSubmitStub;
        // This submit-event is required to update all ngModels and validate the form.
        this.ngForm.onSubmit(new CustomEvent('submit'));
        // Restore original event dispatcher.
        this.ngForm.ngSubmit = originalSubmitEmitter;

        // Restore previous submitted state if required
        if (previousSubmitState !== this.ngForm.submitted) {
            (this.ngForm as { submitted: boolean }).submitted = previousSubmitState;
        }

        // This is required to mark all fields as dirty (errors will be displayed in that case).
        ValidationCheckBaseDirective.markDirtyRecursively(this.ngForm.control);
    }
}
