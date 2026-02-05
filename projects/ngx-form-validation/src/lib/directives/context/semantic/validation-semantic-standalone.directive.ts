import {Directive, forwardRef} from '@angular/core';
import {NG_VALIDATORS} from '@angular/forms';
import {VALIDATION_CONTEXTS} from '../../../data/validation-context';
import {
    VALIDATION_CONTEXT_SEMANTIC,
    validationContextSemanticFactory,
    ValidationSemanticBaseDirective,
} from './validation-semantic-base.directive';

/**
 * Semantic validator for standalone usage (not on a group).
 * Use with: <form [semanticValidator]="myValidator">
 * The validator receives the entire form/control data.
 * Field paths should be absolute (e.g., "user.name" not just "name").
 */
@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[semanticValidator]:not([ngModelGroup]):not([formGroup]):not([formGroupName])',
    providers: [
        {
            provide: VALIDATION_CONTEXT_SEMANTIC,
            useFactory: validationContextSemanticFactory,
        },
        {
            multi: true,
            provide: VALIDATION_CONTEXTS,
            useExisting: VALIDATION_CONTEXT_SEMANTIC,
        },
        {
            multi: true,
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => ValidationSemanticStandaloneDirective),
        },
    ],
})
export class ValidationSemanticStandaloneDirective extends ValidationSemanticBaseDirective {

    // No group name, so no path prefix
    protected override getPathPrefix(): string {
        return '';
    }
}
