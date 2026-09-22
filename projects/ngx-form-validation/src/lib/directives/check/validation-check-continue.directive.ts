import {Directive, EventEmitter, output} from '@angular/core';
import {ValidationCheckPointerBaseDirective} from './validation-check-pointer-base.directive';
import {ValidationSubmitEvent} from './validation-submit-event';
import {markDirtyRecursively} from '../../util/ng-utils';

/**
 * This directive is similar to ValidationCheckSubmitDirective, but it does not dispatch submit event.
 */
@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[onValidContinue],[onInvalidContinue],[onValidatedContinue]',
})
export class ValidationCheckContinueDirective extends ValidationCheckPointerBaseDirective {
    protected static ngSubmitStub = new EventEmitter();

    public override readonly onValid = output<ValidationSubmitEvent>({alias: 'onValidContinue'});
    public override readonly onInvalid = output<ValidationSubmitEvent>({alias: 'onInvalidContinue'});
    public override readonly onValidated = output<ValidationSubmitEvent>({alias: 'onValidatedContinue'});

    protected performSubmit(): void {
        const previousSubmitState = this.form!.submitted;
        const originalSubmitEmitter = this.form!.ngSubmit;

        // Prevent form from dispatching submit event
        this.form!.ngSubmit = ValidationCheckContinueDirective.ngSubmitStub;
        // This submit-event is required to update all ngModels and validate the form.
        this.form!.onSubmit(new CustomEvent('submit'));
        // Restore original event dispatcher.
        this.form!.ngSubmit = originalSubmitEmitter;

        // Restore previous submitted state if required
        if (previousSubmitState !== this.form!.submitted) {
            (this.form as { submitted: boolean }).submitted = previousSubmitState;
        }

        // This is required to mark all fields as dirty (errors will be displayed in that case).
        markDirtyRecursively(this.controlContainer.control!);
    }
}
