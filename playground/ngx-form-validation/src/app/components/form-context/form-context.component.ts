import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
    provideValidationService,
    RequiredRule,
    ValidationCheckEventDirective,
    ValidationCheckSubmitDirective,
    ValidationControlStateDirective,
    ValidationFieldErrorComponent,
    ValidationModelDirective,
    ValidationNamedFormContextDirective,
    ValidationSubmitEvent,
} from '@such-code/ngx-form-validation';

type FormType = {
    first: string | null,
    second: string | null,
    third: string | null,
    forth: string | null,
    fifth: string | null,
}

@Component({
    standalone: true,
    templateUrl: './form-context.component.html',
    imports: [
        FormsModule,

        ValidationModelDirective,
        ValidationNamedFormContextDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,
        ValidationCheckEventDirective,
    ],
    providers: [
        provideValidationService({
            'ContextForm': {
                first: [new RequiredRule()],
                second: [new RequiredRule()],
                third: [new RequiredRule()],
                'group.forth': [new RequiredRule()],
                'group.fifth': [new RequiredRule()],
            },
        }),
    ]
})
export class FormContextComponent {
    public handleSubmit($event: ValidationSubmitEvent<FormType>): void {
        console.warn($event);
    }
}
