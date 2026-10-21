import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {AnyField} from '../signals/field-tree';
import {ValidationIntl} from '../core/intl';

export type ErrorVisibility = 'touched' | 'dirty' | 'touched-or-dirty' | 'always';

/** Shows translated errors of a field once it is touched or dirty (submit marks fields touched). */
@Component({
    selector: 'ngx-field-errors',
    template: `
        @if (visible()) {
            @for (message of messages(); track $index) {
                <div class="ngx-field-error">{{ message }}</div>
            }
        }
    `,
    host: {
        'aria-live': 'polite',
        'aria-atomic': 'true',
        '[attr.data-state-visible]': 'visible() ? "" : null',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgxFieldErrorsComponent {
    public readonly field = input.required<AnyField>();
    public readonly showWhen = input<ErrorVisibility>('touched-or-dirty');
    /** Show only the first error. */
    public readonly first = input<boolean>(false);

    protected readonly intl = inject(ValidationIntl);

    protected readonly visible = computed(() => {
        const state = this.field()();
        if (!state.invalid()) {
            return false;
        }
        switch (this.showWhen()) {
            case 'always':
                return true;
            case 'touched':
                return state.touched();
            case 'dirty':
                return state.dirty();
            case 'touched-or-dirty':
                return state.touched() || state.dirty();
        }
    });

    protected readonly messages = computed(() => {
        const errors = this.field()().errors();
        const list = this.first() ? errors.slice(0, 1) : errors;
        return list.map($ => this.intl.translateError($));
    });
}
