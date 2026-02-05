import {NgModule} from '@angular/core';
import {ValidationNamedFormContextDirective} from './directives/context/validation-named-form-context.directive';
import {ValidationLocalContextDirective} from './directives/context/validation-local-context.directive';
import {ValidationModelDirective} from './directives/item/validation-model.directive';
import {ValidationCheckSubmitDirective} from './directives/check/validation-check-submit.directive';
import {FormDisabledDirective} from './directives/utils/form-disabled.directive';
import {ValidationControlStateDirective} from './directives/validation/validation-control-state.directive';
import {ValidationFieldErrorComponent} from './components/field-error/validation-field-error.component';
import {ValidationFormErrorComponent} from './components/form-error/validation-form-error.component';
import {ValidationControlDirective} from './directives/item/validation-control.directive';
import {ValidationControlNameDirective} from './directives/item/validation-control-name.directive';
import {ValidationGroupDirective} from './directives/item/validation-group.directive';

@NgModule({
    imports: [
        ValidationNamedFormContextDirective,
        ValidationLocalContextDirective,

        ValidationControlDirective,
        ValidationControlNameDirective,
        ValidationGroupDirective,
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

        ValidationControlDirective,
        ValidationControlNameDirective,
        ValidationGroupDirective,
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
