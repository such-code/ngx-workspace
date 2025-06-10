import {Directive, InjectionToken} from '@angular/core';
import {VALIDATION_CONTEXTS, ValidationContext} from '../../data/validation-context';
import {errorCollectionSourceProvider} from '../../data/error-collection';

export const VALIDATION_CONTEXT_LOCAL = new InjectionToken<ValidationContext>('VALIDATION_CONTEXT_LOCAL');

export function validationContextLocalFactory(): ValidationContext {
    return new ValidationContext('local');
}

/**
 * This directive only provides "local" validation context and error collection for every form.
 * "Local" context should be used to display validation errors for a specified form. This context
 * should not reflect global validation rules.
 * Error collection represents errors for the whole form without connecting them to the fields.
 */
@Directive({
    // Selector params are taken from angular source code.
    // This could be modified to create context without form?
    // tslint:disable-next-line:directive-selector
    selector: 'form:not([ngNoForm]):not([formGroup]),[ngForm]',
    providers: [
        // Provide access to "local" context.
        {
            provide: VALIDATION_CONTEXT_LOCAL,
            useFactory: validationContextLocalFactory,
        },
        // Replicate the provided context as a part of a validation contexts array.
        {
            multi: true,
            provide: VALIDATION_CONTEXTS,
            useExisting: VALIDATION_CONTEXT_LOCAL,
        },
        errorCollectionSourceProvider,
    ],
})
export class ValidationLocalContextDirective {
}
