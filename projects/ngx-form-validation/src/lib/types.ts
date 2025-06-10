import {InjectionToken} from '@angular/core';
import {ValidationRule} from './rules/rules';

export const VALIDATION_CONFIGURATION = new InjectionToken<Array<ValidationConfiguration | InjectionToken<ValidationConfiguration>>>('VALIDATION_CONFIGURATION');
export const VALIDATION_SKIP_DEFAULT_RULES = new InjectionToken<Array<string>>('VALIDATION_SKIP_DEFAULT_RULES');


export type ValidationConfiguration = {
    [context: string]: {
        [field: string]: ValidationRule[],
    },
}
