import {Directive, forwardRef, inject, input} from '@angular/core';
import {ControlContainer, FormGroup, NG_VALIDATORS} from '@angular/forms';
import {VALIDATION_CONTEXTS} from '../../../data/validation-context';
import {
    VALIDATION_CONTEXT_SEMANTIC,
    validationContextSemanticFactory,
    ValidationSemanticBaseDirective,
} from './validation-semantic-base.directive';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[formGroup][semanticValidator]',
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
            useExisting: forwardRef(() => ValidationSemanticFormGroupDirective),
        },
    ],
})
export class ValidationSemanticFormGroupDirective extends ValidationSemanticBaseDirective {

    public readonly formGroup = input.required<FormGroup>();

    protected readonly controlContainer = inject(ControlContainer, {skipSelf: true, optional: true});

    protected override getPathPrefix(): string {
        const path = this.controlContainer && Array.isArray(this.controlContainer.path) && this.controlContainer.path.length > 0
                    ? this.controlContainer.path.join('.') + '.'
                    : '';
        return path + this.formGroup.name;
    }
}
