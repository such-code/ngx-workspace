import {Directive, forwardRef, input} from '@angular/core';
import {NG_VALIDATORS} from '@angular/forms';
import {VALIDATION_CONTEXTS} from '../../../data/validation-context';
import {
    VALIDATION_CONTEXT_SEMANTIC,
    validationContextSemanticFactory,
    ValidationSemanticBaseDirective,
} from './validation-semantic-base.directive';

/**
 * Semantic validator for formGroupName (reactive forms nested groups).
 * Use with: <div formGroupName="user" [semanticValidator]="myValidator">
 * The validator receives only the data of this nested group.
 */
@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[formGroupName][semanticValidator]',
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
            useExisting: forwardRef(() => ValidationSemanticFormGroupNameDirective),
        },
    ],
})
export class ValidationSemanticFormGroupNameDirective extends ValidationSemanticBaseDirective {

    public readonly formGroupName = input<string>('');

    protected override getPathPrefix(): string {
        const groupName = this.formGroupName();
        return groupName ? groupName + '.' : '';
    }
}
