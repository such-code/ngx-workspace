import {FormGroupDirective, NgForm} from '@angular/forms';

export function isNgForm($: any): $ is NgForm {
    return $ instanceof NgForm;
}

export function isFormGroupDirective($: any): $ is FormGroupDirective {
    return $ instanceof FormGroupDirective;
}

export type FormLikeDirective = NgForm | FormGroupDirective;

export function isFormLikeDirective($: any): $ is FormLikeDirective {
    return isNgForm($) || isFormGroupDirective($);
}
