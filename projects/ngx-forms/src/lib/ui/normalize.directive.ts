import {DestroyRef, Directive, ElementRef, inject, input} from '@angular/core';
import {FormField} from '@angular/forms/signals';

export type NormalizeFn = ($value: string) => string;

/**
 * Corrects text while it is typed (`on: 'input'`, e.g. uppercase, digits only, masks) or when the field loses focus
 * (`on: 'blur'`, e.g. trim). Use next to `[formField]` on native text inputs. The caret is kept after the same
 * characters, assuming the function maps the text before the caret independently of the text after it.
 */
@Directive({
    selector: 'input[formField][ngxNormalize],textarea[formField][ngxNormalize]',
    host: {
        '(blur)': 'handleBlur()',
    },
})
export class NgxNormalizeDirective {
    public readonly normalize = input.required<NormalizeFn>({alias: 'ngxNormalize'});
    public readonly on = input<'input' | 'blur'>('input', {alias: 'ngxNormalizeOn'});

    protected readonly formField = inject(FormField);
    protected readonly element: HTMLInputElement | HTMLTextAreaElement = inject(ElementRef).nativeElement;

    public constructor() {
        // Capture listener on the element runs before the form field's own `input` listener, so the field only
        // ever sees normalized text.
        const listener = () => this.handleInput();
        this.element.addEventListener('input', listener, true);
        inject(DestroyRef).onDestroy(() => this.element.removeEventListener('input', listener, true));
    }

    protected handleInput(): void {
        if (this.on() !== 'input') {
            return;
        }
        const element = this.element;
        const raw = element.value;
        const normalized = this.normalize()(raw);
        if (normalized === raw) {
            return;
        }
        const caret = element.selectionStart;
        element.value = normalized;
        if (caret !== null && document.activeElement === element) {
            const position = Math.min(this.normalize()(raw.slice(0, caret)).length, normalized.length);
            element.setSelectionRange(position, position);
        }
    }

    protected handleBlur(): void {
        if (this.on() !== 'blur') {
            return;
        }
        const state = this.formField.state();
        const value = state.value();
        if (typeof value === 'string') {
            const normalized = this.normalize()(value);
            if (normalized !== value) {
                state.value.set(normalized);
            }
        }
    }
}

/** Common normalizers. */
export const normalizers = {
    trim: (($: string) => $.trim()) as NormalizeFn,
    upper: (($: string) => $.toUpperCase()) as NormalizeFn,
    lower: (($: string) => $.toLowerCase()) as NormalizeFn,
    digits: (($: string) => $.replace(/\D+/g, '')) as NormalizeFn,
    collapseSpaces: (($: string) => $.replace(/\s+/g, ' ')) as NormalizeFn,
    /** Groups characters, e.g. `group(4)` turns `LV80BANK` into `LV80 BANK`. Strips spaces first. */
    group: ($size: number, $separator: string = ' '): NormalizeFn => ($: string) => $
        .replace(/\s+/g, '')
        .replace(new RegExp(`(.{${$size}})(?=.)`, 'g'), `$1${$separator}`),
};
