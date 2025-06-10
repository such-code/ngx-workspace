import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
    ValidationCheckSubmitDirective,
    ValidationFormErrorComponent,
    ValidationLocalContextDirective,
    ValidationSubmitEvent,
} from '@such-code/ngx-form-validation';

type FormType = {
    first: string | null,
    second: string | null,
}

@Component({
    standalone: true,
    templateUrl: 'form-error.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,

        ValidationLocalContextDirective,
        ValidationCheckSubmitDirective,

        ValidationFormErrorComponent,
    ],
})
export class FormErrorComponent {
    public handleSubmit($event: ValidationSubmitEvent<FormType>): void {
        if ($event.errorCollection) {
            $event.errorCollection.clear();
            $event.errorCollection.addError({
                message: 'Server is busy right now, please retry later.',
                status: null,
            });
        }
    }
}
