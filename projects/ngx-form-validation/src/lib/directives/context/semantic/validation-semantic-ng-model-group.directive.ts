import {Directive, forwardRef, inject, input} from '@angular/core';
import {ControlContainer, NG_VALIDATORS} from '@angular/forms';
import {VALIDATION_CONTEXTS} from '../../../data/validation-context';
import {
    VALIDATION_CONTEXT_SEMANTIC,
    validationContextSemanticFactory,
    ValidationSemanticBaseDirective,
} from './validation-semantic-base.directive';

/**
 * Semantic validator for ngModelGroup.
 * Use with: <fieldset ngModelGroup="user" [semanticValidator]="myValidator">
 * The validator receives only the data of this group.
 */
@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModelGroup][semanticValidator]',
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
            useExisting: forwardRef(() => ValidationSemanticNgModelGroupDirective),
        },
    ],
})
export class ValidationSemanticNgModelGroupDirective extends ValidationSemanticBaseDirective {

    public readonly ngModelGroup = input<string>('');

    protected readonly controlContainer = inject(ControlContainer, {skipSelf: true, optional: true});

    protected override getPathPrefix(): string {
        const groupName = this.ngModelGroup();
        const controlContainerPath = this.controlContainer && Array.isArray(this.controlContainer.path) && this.controlContainer.path.length > 0
            ? this.controlContainer.path.join('.') + '.'
            : '';

        return groupName ? controlContainerPath + groupName + '.' : '';
    }
}
