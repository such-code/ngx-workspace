import {NgxField, NgxNormalize} from '@such-code/ngx-forms';
import {NgxFormDirective} from './form.directive';
import {NgxFieldErrorsComponent} from './field-errors.component';
import {NgxFormErrorsComponent} from './form-errors.component';
import {NgxFieldStateDirective} from './field-state.directive';
import {NgxErrorMessagePipe} from './error-message.pipe';

/** Everything for templates, including `NgxField` and `NgxNormalize`: `imports: [NgxForms]`. */
export const NgxForms = [
    NgxField,
    NgxNormalize,
    NgxFormDirective,
    NgxFieldErrorsComponent,
    NgxFormErrorsComponent,
    NgxFieldStateDirective,
    NgxErrorMessagePipe,
] as const;
