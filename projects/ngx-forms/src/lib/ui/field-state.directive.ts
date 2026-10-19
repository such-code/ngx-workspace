import {Directive, inject} from '@angular/core';
import {FormField} from '@angular/forms/signals';

/**
 * Same data attributes as v21 `ValidationControlStateDirective`, on every `[formField]`:
 * `data-state-valid` / `data-state-invalid` and `data-state-validated` (invalid and touched or dirty).
 */
@Directive({
    selector: '[formField][ngxFieldState]',
    exportAs: 'ngxFieldState',
    host: {
        '[attr.data-state-invalid]': 'formField.state().invalid() ? "" : null',
        '[attr.data-state-valid]': 'formField.state().valid() ? "" : null',
        '[attr.data-state-pending]': 'formField.state().pending() ? "" : null',
        '[attr.data-state-validated]': 'validated() ? "" : null',
        '[attr.aria-invalid]': 'validated() ? "true" : null',
    },
})
export class NgxFieldStateDirective {
    protected readonly formField = inject(FormField);

    public validated(): boolean {
        const state = this.formField.state();
        return state.invalid() && (state.touched() || state.dirty());
    }
}
