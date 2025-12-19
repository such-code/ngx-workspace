import {NgModule} from '@angular/core';
import {
    ValidationSemanticNgModelGroupDirective,
} from './directives/context/semantic/validation-semantic-ng-model-group.directive';
import {
    ValidationSemanticFormGroupDirective,
} from './directives/context/semantic/validation-semantic-form-group.directive';
import {
    ValidationSemanticFormGroupNameDirective,
} from './directives/context/semantic/validation-semantic-form-group-name.directive';
import {
    ValidationSemanticStandaloneDirective,
} from './directives/context/semantic/validation-semantic-standalone.directive';

@NgModule({
    imports: [
        ValidationSemanticNgModelGroupDirective,
        ValidationSemanticFormGroupDirective,
        ValidationSemanticFormGroupNameDirective,
        ValidationSemanticStandaloneDirective,
    ],
    exports: [
        ValidationSemanticNgModelGroupDirective,
        ValidationSemanticFormGroupDirective,
        ValidationSemanticFormGroupNameDirective,
        ValidationSemanticStandaloneDirective,
    ],
})
export class ValidationSemanticDirectivesModule {}
