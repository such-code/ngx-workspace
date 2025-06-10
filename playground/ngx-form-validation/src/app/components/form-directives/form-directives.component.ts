import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
    ExternalValidator,
    ValidationDirectivesModule,
    ValidationRuleError,
    ValidationSubmitEvent,
} from '@such-code/ngx-form-validation';

type FormType = {
    allowed: 'one' | 'two' | 'three',
    external: string,
    min: number | null,
    max: number | null,
    required: string,
}

@Component({
    standalone: true,
    templateUrl: './form-directives.component.html',
    imports: [
        FormsModule,
        ValidationDirectivesModule,
    ],
})
export class FormDirectivesComponent {
    public readonly externalValidator: ExternalValidator = ($value: any, $formData: Partial<FormType>): ValidationRuleError | null => {
        const firstValueReversed = !!$formData['allowed']
            ? $formData['allowed'].split('').reverse().join('')
            : null;
        if ($value !== firstValueReversed) {
            return {
                value: $value,
                rawMessage: 'Value must be "{{ value }}".',
                interpolationSource: {value: firstValueReversed},
            };
        }
        return null;
    }

    public handleSubmit($event: ValidationSubmitEvent<FormType>): void {
        console.warn($event);
    }
}
