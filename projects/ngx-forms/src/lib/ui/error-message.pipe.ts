import {inject, Pipe, PipeTransform} from '@angular/core';
import {ValidationIntl} from '../core/intl';

/** Translates any validation error (library, Signal Forms or string). Impure, follows `ValidationIntl` updates. */
@Pipe({
    name: 'ngxErrorMessage',
    pure: false,
})
export class NgxErrorMessagePipe implements PipeTransform {
    protected readonly intl = inject(ValidationIntl);

    public transform($error: unknown): string {
        return this.intl.translateError($error);
    }
}
