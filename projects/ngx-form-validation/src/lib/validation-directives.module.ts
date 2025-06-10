import {NgModule} from '@angular/core';
import {ValidatorAllowedValueDirective} from './directives/validators/validator-allowed-value.directive';
import {ValidatorExternalDirective} from './directives/validators/validator-external.directive';
import {ValidatorMinDirective} from './directives/validators/validator-min.directive';
import {ValidatorMaxDirective} from './directives/validators/validator-max.directive';
import {ValidatorRequiredDirective} from './directives/validators/validator-required.directive';
import {ValidationCheckSubmitDirective} from './directives/check/validation-check-submit.directive';
import {ValidationControlStateDirective} from './directives/validation/validation-control-state.directive';
import {ValidationFieldErrorComponent} from './components/field-error/validation-field-error.component';

@NgModule({
    imports: [
        ValidatorAllowedValueDirective,
        ValidatorExternalDirective,
        ValidatorMinDirective,
        ValidatorMaxDirective,
        ValidatorRequiredDirective,

        ValidationCheckSubmitDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,
    ],
    exports: [
        ValidatorAllowedValueDirective,
        ValidatorExternalDirective,
        ValidatorMinDirective,
        ValidatorMaxDirective,
        ValidatorRequiredDirective,

        ValidationCheckSubmitDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,
    ],
})
export class ValidationDirectivesModule {
}
