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
    ValidationSemanticContextDirective,
    ValidationSubmitEvent,
} from '@such-code/ngx-form-validation';

type FormType = {
    password: string,
    passwordConfirmation: string,
}

@Component({
    standalone: true,
    templateUrl: './form-semantic.component.html',
    imports: [
        FormsModule,

        ValidationModelDirective,
        ValidationNamedFormContextDirective,
        ValidationSemanticContextDirective,

        ValidationCheckSubmitDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,
    ],
    providers: [
        provideValidationService({
            "SemanticForm": {
                password: [new RequiredRule(), new MinLengthRule(8)],
                passwordConfirmation: [new RequiredRule()],
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

    public handleSubmit($event: ValidationSubmitEvent<FormType>): void {
        console.warn($event);
    }
}
