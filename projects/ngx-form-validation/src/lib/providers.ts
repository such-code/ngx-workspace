import {VALIDATION_CONFIGURATION, VALIDATION_SKIP_DEFAULT_RULES, ValidationConfiguration} from './types';
import {InjectionToken, Provider} from '@angular/core';
import {ValidationService} from './services/validation.service';
import {ErrorObservingService} from './services/error-observing.service';

export function provideValidationService(
    $config: ValidationConfiguration | InjectionToken<ValidationConfiguration>,
    $skipRules?: Array<string>,
): Array<Provider> {
    const validationConfiguration = {
        provide: VALIDATION_CONFIGURATION,
        multi: true,
        useValue: $config,
    };

    if ($skipRules) {
        return [
            validationConfiguration,
            {
                provide: VALIDATION_SKIP_DEFAULT_RULES,
                useValue: $skipRules,
            },
            ValidationService,
            // Since ErrorObservingService relies on the current injected ValidationService, it should be also
            // reprovided in case it will be used by child components.
            ErrorObservingService,
        ];
    }

    return [
        validationConfiguration,
        ValidationService,
        // Since ErrorObservingService relies on the current injected ValidationService, it should be also
        // reprovided in case it will be used by child components.
        ErrorObservingService,
    ];
}
