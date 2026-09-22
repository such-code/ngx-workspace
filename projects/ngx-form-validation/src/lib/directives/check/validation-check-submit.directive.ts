import {Directive, output} from '@angular/core';
import {ValidationCheckPointerBaseDirective} from './validation-check-pointer-base.directive';
import {ValidationSubmitEvent} from './validation-submit-event';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[onValid],[onInvalid],[onValidated]',
})
export class ValidationCheckSubmitDirective extends ValidationCheckPointerBaseDirective {

    public override readonly onValid = output<ValidationSubmitEvent>();
    public override readonly onInvalid = output<ValidationSubmitEvent>();
    public override readonly onValidated = output<ValidationSubmitEvent>();

    protected performSubmit(): void {
        // This submit-event is required to update all ngModels and validate the form.
        this.form!.onSubmit(new CustomEvent('submit'));
        // In this scenario, fields are not marked as dirty since it is not required.
    }
}
