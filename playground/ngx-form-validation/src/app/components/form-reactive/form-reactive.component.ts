import {Component, inject} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {
    MaxLengthRule,
    MinLengthRule,
    provideValidationService,
    RequiredRule,
    ValidationCheckSubmitDirective,
    ValidationControlDirective,
    ValidationControlNameDirective,
    ValidationControlStateDirective,
    ValidationFieldErrorComponent,
    ValidationNamedFormContextDirective,
    ValidationSubmitEvent,
} from '@such-code/ngx-form-validation';

type FormType = {
    password: string,
    passwordConfirmation: string,
}

@Component({
    standalone: true,
    templateUrl: './form-reactive.component.html',
    imports: [
        FormsModule,

        ValidationNamedFormContextDirective,

        ValidationControlDirective,
        ValidationControlNameDirective,

        ValidationCheckSubmitDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,

        ReactiveFormsModule,
    ],
    providers: [
        provideValidationService({
            "ReactiveForm": {
                first: [new RequiredRule(), new MinLengthRule(8)],
                second: [new MaxLengthRule(3)],
                'third.thirdFirst': [new RequiredRule()],
            },
        }),
    ],
})
export class FormReactiveComponent {

    public readonly formBuilder = inject(FormBuilder);

    public readonly form = this.formBuilder.group({
        first: new FormControl(null),
        second: new FormControl(null),
        third: new FormGroup({
            thirdFirst: new FormControl(null),
        }),
    });

    public handleSubmit($event: ValidationSubmitEvent<FormType>): void {
        console.warn($event);
    }
}
