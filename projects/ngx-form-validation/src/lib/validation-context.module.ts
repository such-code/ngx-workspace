import {NgModule} from '@angular/core';
import {ValidationNamedFormContextDirective} from './directives/context/validation-named-form-context.directive';
import {ValidationLocalContextDirective} from './directives/context/validation-local-context.directive';
import {ValidationModelDirective} from './directives/item/validation-model.directive';
import {ValidationCheckSubmitDirective} from './directives/check/validation-check-submit.directive';
import {FormDisabledDirective} from './directives/utils/form-disabled.directive';
import {ValidationControlStateDirective} from './directives/validation/validation-control-state.directive';
import {ValidationFieldErrorComponent} from './components/field-error/validation-field-error.component';
import {ValidationFormErrorComponent} from './components/form-error/validation-form-error.component';

@NgModule({
    imports: [
        ValidationNamedFormContextDirective,
        ValidationLocalContextDirective,

        ValidationModelDirective,
        ValidationCheckSubmitDirective,
        FormDisabledDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,
        ValidationFormErrorComponent,
    ],
    exports: [
        ValidationNamedFormContextDirective,
        ValidationLocalContextDirective,

        ValidationModelDirective,
        ValidationCheckSubmitDirective,
        FormDisabledDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,
        ValidationFormErrorComponent,
    ],
})
export class ValidationContextModule {
}
