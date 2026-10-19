import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {NGX_FORM} from './form.directive';
import {NgxForm} from '../signals/form';
import {ValidationIntl} from '../core/intl';

/** Form-level errors (generic server or connection errors). Uses the enclosing `[ngxForm]` unless `form` is set. */
@Component({
    selector: 'ngx-form-errors',
    template: `
        @if (errors().length > 0) {
            @if (heading()) {
                <h4>{{ heading() }}</h4>
            }
            @for (error of errors(); track $index; let last = $last) {
                <p [attr.data-kind]="error.kind">{{ error.message }}</p>
                @if (!last) {
                    <hr>
                }
            }
        }
    `,
    host: {
        'role': 'alert',
        '[attr.data-state-visible]': 'errors().length > 0 ? "" : null',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgxFormErrorsComponent {
    public readonly heading = input<string | null>(null);
    public readonly form = input<NgxForm<any> | null>(null);

    protected readonly parent = inject(NGX_FORM, {optional: true});
    protected readonly intl = inject(ValidationIntl);

    protected readonly errors = computed(() => {
        const form = this.form() ?? this.parent?.form();
        return (form?.errors.formErrors() ?? []).map($ => ({kind: $.kind, message: this.intl.translate($.message)}));
    });
}
