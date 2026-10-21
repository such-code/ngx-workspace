import {Directive, inject} from '@angular/core';
import {NgxField} from '@such-code/ngx-forms';

/**
 * Same data attributes as v21 `ValidationControlStateDirective`, on every `[ngxField]`:
 * `data-state-valid` / `data-state-invalid` and `data-state-validated` (invalid and touched or dirty).
 */
@Directive({
    selector: '[ngxField][ngxFieldState]',
    exportAs: 'ngxFieldState',
    host: {
        '[attr.data-state-invalid]': 'field.state().invalid() ? "" : null',
        '[attr.data-state-valid]': 'field.state().valid() ? "" : null',
        '[attr.data-state-pending]': 'field.state().pending() ? "" : null',
        '[attr.data-state-validated]': 'validated() ? "" : null',
        '[attr.aria-invalid]': 'validated() ? "true" : null',
    },
})
export class NgxFieldStateDirective {
    protected readonly field = inject(NgxField);

    public validated(): boolean {
        const state = this.field.state();
        return state.invalid() && (state.touched() || state.dirty());
    }
}
