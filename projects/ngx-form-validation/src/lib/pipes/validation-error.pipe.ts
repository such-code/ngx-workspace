import {inject, Pipe, PipeTransform} from '@angular/core';
import {isValidationRuleError} from '../rules/rules';
import {ValidationIntl} from '../i18n/validation-intl';

@Pipe({
    name: 'ngxFormValidationError',
})
export class ValidationErrorPipe implements PipeTransform {

    protected readonly validationIntl = inject(ValidationIntl);

    public transform($value: any): any {
        if (isValidationRuleError($value)) {
            return this.validationIntl.getTranslation$($value.rawMessage, $value.interpolationSource);
        }

        return $value;
    }

}
