import {Directive, inject, InjectionToken, input, output} from '@angular/core';
import {NgxForm} from '../signals/form';

export const NGX_FORM = new InjectionToken<NgxFormDirective>('NGX_FORM');

/**
 * Binds an `ngxForm()` to a `<form>`: disables native validation, submits through `form.submit()` (with the action
 * from `ngxForm({action})` or `[ngxFormAction]`) and provides the form to `<ngx-form-errors>`.
 */
@Directive({
    selector: 'form[ngxForm]',
    exportAs: 'ngxForm',
    host: {
        'novalidate': '',
        '(submit)': 'handleSubmit($event)',
        '[attr.aria-busy]': 'form().submitting() || null',
        '[attr.data-state-submitting]': 'form().submitting() ? "" : null',
    },
    providers: [
        {provide: NGX_FORM, useExisting: NgxFormDirective},
    ],
})
export class NgxFormDirective {
    public readonly form = input.required<NgxForm<any>>({alias: 'ngxForm'});
    public readonly action = input<(($value: any) => unknown) | null>(null, {alias: 'ngxFormAction'});

    /** Emits the submit result: `true` when the action ran and did not fail. */
    public readonly submitted = output<boolean>({alias: 'ngxSubmitted'});


    protected async handleSubmit($event: Event): Promise<void> {
        $event.preventDefault();
        const result = await this.form().submit(this.action() ?? undefined);
        this.submitted.emit(result);
    }
}

/** Optional access to the closest `[ngxForm]`. */
export function injectNgxForm(): NgxFormDirective | null {
    return inject(NGX_FORM, {optional: true});
}
