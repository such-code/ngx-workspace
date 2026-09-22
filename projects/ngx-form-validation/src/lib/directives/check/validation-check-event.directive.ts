import {ValidationCheckBaseDirective} from './validation-check-base.directive';
import {Directive, output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ValidationSubmitEvent} from './validation-submit-event';

@Directive({
    selector: '[onSubmitValid],[onSubmitInvalid],[onSubmitValidated]',
})
export class ValidationCheckEventDirective extends ValidationCheckBaseDirective {

    public override readonly onValid = output<ValidationSubmitEvent>({alias: 'onSubmitValid'});
    public override readonly onInvalid = output<ValidationSubmitEvent>({alias: 'onSubmitInvalid'});
    public override readonly onValidated = output<ValidationSubmitEvent>({alias: 'onSubmitValidated'});

    public constructor() {
        super();

        if (this.form) {
            this.handleSubmit = this.handleSubmit.bind(this);
            this.form.ngSubmit.pipe(
                takeUntilDestroyed(),
            ).subscribe(this.handleSubmit);
        }
    }

    public handleSubmit($event: Event): void {
        if (this.controlContainer.enabled) {
            this.performValidationAndEmit();

            $event.preventDefault();
            $event.stopPropagation();
        }
    }
}
