import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
    MinLengthRule,
    provideValidationService,
    RequiredRule,
    SemanticValidator,
    ValidationCheckSubmitDirective,
    ValidationControlStateDirective,
    ValidationFieldErrorComponent,
    ValidationModelDirective,
    ValidationNamedFormContextDirective,
    ValidationRuleError,
    ValidationSemanticDirectivesModule,
    ValidationSubmitEvent,
} from '@such-code/ngx-form-validation';

type FormType = {
    password: string,
    passwordConfirmation: string,
    user: {
        name: string,
        surname: string
    }
}

@Component({
    standalone: true,
    templateUrl: './form-semantic.component.html',
    imports: [
        FormsModule,

        ValidationModelDirective,
        ValidationNamedFormContextDirective,

        ValidationCheckSubmitDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,
        ValidationSemanticDirectivesModule
    ],
    providers: [
        provideValidationService({
            "SemanticForm": {
                'password': [new RequiredRule(), new MinLengthRule(8)],
                'passwordConfirmation': [new RequiredRule()],
                'user.name': [new RequiredRule()],
                'user.surname': [new RequiredRule()],
            },
        }),
    ]
})
export class FormSemanticComponent {
    public readonly semanticValidator: SemanticValidator = ($data: FormType): Record<string, ReadonlyArray<ValidationRuleError>> | null => {

        if ($data.passwordConfirmation !== $data.password) {
            return {
                passwordConfirmation: [{
                    value: $data.passwordConfirmation,
                    rawMessage: `Password confirmation must be exactly same.`,
                    interpolationSource: null,
                }],
            };
        }
        return null;
    }

    public userSemanticValidator: SemanticValidator = ($data: FormType['user']): Record<string, ReadonlyArray<ValidationRuleError>> | null => {
        if ($data?.name === 'Wrong') {
            return {
                'name': [{
                    value: $data.name,
                    rawMessage: `User name can't be equal to "Wrong"`,
                    interpolationSource: null,
                }]
            }
        }
        return null;
    }

    public handleSubmit($event: ValidationSubmitEvent<FormType>): void {
        console.warn($event, $event.getRawFormData());
    }
}
