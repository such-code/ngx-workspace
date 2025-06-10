import {Directive, input} from '@angular/core';
import {
    VALIDATION_CONTEXT_REFLECTION,
    validationContextReflectionProvider,
    ValidationNamedContextBaseDirective,
} from './validation-named-context-base.directive';
import {VALIDATION_CONTEXTS} from '../../data/validation-context';

@Directive({
    // Selector params are taken from angular source code.
    // This could be modified to create context without form?
    // tslint:disable-next-line:directive-selector
    selector: '[validationContext]',
    providers: [
        {
            provide: VALIDATION_CONTEXT_REFLECTION,
            useFactory: validationContextReflectionProvider,
        },
        {
            multi: true,
            provide: VALIDATION_CONTEXTS,
            useExisting: VALIDATION_CONTEXT_REFLECTION,
        },
    ],
})
export class ValidationNamedContextDirective extends ValidationNamedContextBaseDirective {

    public override readonly name = input<string | null>(null, {alias: 'validationContext'});

}
