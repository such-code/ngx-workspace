import {afterRenderEffect, Directive, ElementRef, inject, input, Renderer2} from '@angular/core';
import {FormField} from '@angular/forms/signals';
import {NgxForm} from '../signals/form';
import {AnyReadonlyField} from '../signals/field-tree';
import {NGX_FORM} from './form.directive';

const MIN_MAX_TYPES = new Set(['number', 'range', 'date', 'datetime-local', 'month', 'week', 'time']);
const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password']);

/**
 * Applies `required` / `aria-required` and native `minlength` / `maxlength` / `min` / `max` attributes for rules that
 * Signal Forms metadata does not know about: rules added after the form was created (server constraints,
 * `registry.merge()`, `form.addRules()`). Constraints already in metadata stay with `[formField]`.
 *
 * Uses the form of the closest `form[ngxForm]`, or the one passed: `[ngxConstraints]="form"`.
 *
 * For an asterisk use `form.isRequired(field)`; it works anywhere in the template, also before the control.
 *
 * @example
 * <label for="email">Email @if (form.isRequired(form.fields.email)) { * }</label>
 * <input id="email" [formField]="form.fields.email" ngxConstraints />
 */
@Directive({
    selector: '[formField][ngxConstraints]',
    exportAs: 'ngxConstraints',
})
export class NgxConstraintsDirective {
    public readonly form = input<NgxForm<any> | '' | null | undefined>(undefined, {alias: 'ngxConstraints'});

    private readonly formField = inject(FormField);
    private readonly host = inject(NGX_FORM, {optional: true});
    private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    private readonly renderer = inject(Renderer2);
    /** Attributes this directive set, so it only removes its own. */
    private readonly owned = new Set<string>();

    public constructor() {
        afterRenderEffect({
            write: () => this.update(),
        });
    }

    private resolveForm(): NgxForm<any> | null {
        const explicit = this.form();
        return explicit ? explicit : (this.host?.form() ?? null);
    }

    private update(): void {
        const form = this.resolveForm();
        if (!form) {
            throw new Error('ngxConstraints: no form. Place the control inside form[ngxForm] or pass [ngxConstraints]="form".');
        }
        const state = this.formField.state();
        const constraints = form.constraints(this.formField.field() as unknown as AnyReadonlyField);
        const required = state.required() || !!constraints.required;

        this.set('aria-required', required ? 'true' : null);

        const tag = this.element.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') {
            // Custom controls receive `required` from metadata only; `aria-required` covers assistive technology.
            return;
        }
        const type = tag === 'input' ? ((this.element as HTMLInputElement).type || 'text') : tag;
        const textual = tag === 'textarea' || TEXT_TYPES.has(type);
        const minMax = tag === 'input' && MIN_MAX_TYPES.has(type);

        // `[formField]` writes attributes from metadata; only fill in what metadata does not have.
        this.setNative('required', state.required(), constraints.required ? '' : null);
        if (textual) {
            this.setNative('minlength', state.minLength?.() !== undefined, constraints.minLength?.toString() ?? null);
            this.setNative('maxlength', state.maxLength?.() !== undefined, constraints.maxLength?.toString() ?? null);
        }
        if (minMax) {
            this.setNative('min', state.min?.() !== undefined, constraints.min?.toString() ?? null);
            this.setNative('max', state.max?.() !== undefined, constraints.max?.toString() ?? null);
        }
    }

    private setNative($name: string, $fromMetadata: boolean, $value: string | null): void {
        if ($fromMetadata) {
            // `[formField]` owns the attribute now.
            this.owned.delete($name);
            return;
        }
        this.set($name, $value);
    }

    private set($name: string, $value: string | null): void {
        if ($value !== null) {
            this.renderer.setAttribute(this.element, $name, $value);
            this.owned.add($name);
        } else if (this.owned.delete($name)) {
            this.renderer.removeAttribute(this.element, $name);
        }
    }
}
