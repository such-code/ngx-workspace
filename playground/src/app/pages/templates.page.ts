import {Component, inject, signal} from '@angular/core';
import {JsonPipe} from '@angular/common';
import {FormField} from '@angular/forms/signals';
import {MinLengthRule, ngxForm, NgxForms, provideRuleTemplates, RequiredRule, RuleRegistry} from '@such-code/ngx-forms';

/**
 * Named templates: `Contact` comes from app config, `Contact` is extended here for this page only,
 * and a rule is added at runtime to show late templates.
 */
@Component({
    imports: [FormField, NgxForms, JsonPipe],
    providers: [
        provideRuleTemplates({
            Contact: {
                'name': [new RequiredRule()],
                'address.city': [new RequiredRule()],
            },
        }),
    ],
    template: `
        <h2>Named templates</h2>
        <p class="text-body-secondary">Rules come from the <code>Contact</code> template: e-mail from app config, the rest from this page's providers.</p>
        <form [ngxForm]="form" [ngxFormAction]="save" (ngxSubmitted)="result.set($event)">
            <div class="mb-3">
                <label class="form-label" for="name">Name @if (form.fields.name().required()) {*}</label>
                <input class="form-control" id="name" [formField]="form.fields.name" ngxFieldState>
                <ngx-field-errors [field]="form.fields.name"/>
            </div>
            <div class="mb-3">
                <label class="form-label" for="email">E-mail @if (form.fields.email().required()) {*}</label>
                <input class="form-control" id="email" [formField]="form.fields.email" ngxFieldState>
                <ngx-field-errors [field]="form.fields.email"/>
            </div>
            <div class="mb-3">
                <label class="form-label" for="city">City @if (form.fields.address.city().required()) {*}</label>
                <input class="form-control" id="city" [formField]="form.fields.address.city" ngxFieldState>
                <ngx-field-errors [field]="form.fields.address.city"/>
            </div>
            <div class="mb-3">
                <label class="form-label" for="zip">ZIP @if (form.fields.address.zip().required()) {*}</label>
                <input class="form-control" id="zip" [formField]="form.fields.address.zip" ngxFieldState>
                <ngx-field-errors [field]="form.fields.address.zip"/>
            </div>
            <button type="submit" class="btn btn-primary me-2">Submit</button>
            <button type="button" class="btn btn-outline-secondary" (click)="addZipRule()">Add ZIP rule at runtime</button>
            @if (result() !== null) {
                <span class="ms-3">Submitted: {{ result() }}</span>
            }
        </form>
        <h5 class="mt-4">Exported template</h5>
        <pre class="model">{{ exported() | json }}</pre>
    `,
})
export class TemplatesPage {
    protected readonly registry = inject(RuleRegistry);
    protected readonly model = signal({name: '', email: '', address: {city: '', zip: ''}});
    protected readonly form = ngxForm(this.model, null, {name: 'Contact'});
    protected readonly result = signal<boolean | null>(null);
    protected readonly exported = signal(this.registry.export('Contact'));

    protected readonly save = async () => new Promise($ => setTimeout($, 500));

    protected addZipRule(): void {
        this.registry.merge('Contact', 'address.zip', [new RequiredRule(), new MinLengthRule(4)]);
        this.exported.set(this.registry.export('Contact'));
    }
}
