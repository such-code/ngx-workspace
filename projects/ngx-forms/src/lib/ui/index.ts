import {FormField} from '@angular/forms/signals';
import {NgxFormDirective} from './form.directive';
import {NgxFieldErrorsComponent} from './field-errors.component';
import {NgxFormErrorsComponent} from './form-errors.component';
import {NgxFieldStateDirective} from './field-state.directive';
import {NgxNormalizeDirective} from './normalize.directive';
import {NgxErrorMessagePipe} from './error-message.pipe';

/** Everything for templates, including Signal Forms `FormField`: `imports: [NgxForms]`. */
export const NgxForms = [
    FormField,
    NgxFormDirective,
    NgxFieldErrorsComponent,
    NgxFormErrorsComponent,
    NgxFieldStateDirective,
    NgxNormalizeDirective,
    NgxErrorMessagePipe,
] as const;
