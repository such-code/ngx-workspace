import {Component, signal} from '@angular/core';
import {JsonPipe} from '@angular/common';
import {hidden} from '@angular/forms/signals';
import {
    AllowedValueRule,
    applyRules,
    EmailRule,
    MinLengthRule,
    ngxForm,
    NgxForms,
    RequiredRule,
    step,
    wizard,
} from '@such-code/ngx-forms';

type Signup = {
    account: { email: string, password: string },
    profile: { name: string, plan: 'free' | 'paid' },
    billing: { card: string },
    terms: boolean,
};

@Component({
    imports: [NgxForms, JsonPipe],
    template: `
        <h2>Wizard: one model, steps validated on their own</h2>
        <ol class="nav nav-pills mb-3">
            @for (s of steps.steps(); track s.id; let i = $index) {
                <li class="nav-item">
                    <a class="nav-link" href="" [class.active]="steps.current().id === s.id"
                       (click)="$event.preventDefault(); steps.goTo(s.id)">{{ i + 1 }}. {{ s.id }}
                        @if (!steps.isValid(s.id)) { <span class="text-danger">•</span> }</a>
                </li>
            }
        </ol>
        <form [ngxForm]="form" (submit)="$event.preventDefault()">
            @switch (steps.current().id) {
                @case ('account') {
                    <input class="form-control mb-1" placeholder="E-mail" [formField]="form.fields.account.email" ngxFieldState>
                    <ngx-field-errors [field]="form.fields.account.email"/>
                    <input class="form-control mb-1" type="password" placeholder="Password" [formField]="form.fields.account.password" ngxFieldState>
                    <ngx-field-errors [field]="form.fields.account.password"/>
                }
                @case ('profile') {
                    <input class="form-control mb-1" placeholder="Name" [formField]="form.fields.profile.name" ngxFieldState>
                    <ngx-field-errors [field]="form.fields.profile.name"/>
                    <select class="form-select mb-3" [formField]="form.fields.profile.plan">
                        <option value="free">Free</option>
                        <option value="paid">Paid (adds billing step)</option>
                    </select>
                }
                @case ('billing') {
                    <input class="form-control mb-1" placeholder="Card" [formField]="form.fields.billing.card" ngxFieldState>
                    <ngx-field-errors [field]="form.fields.billing.card"/>
                }
                @case ('confirm') {
                    <div class="form-check mb-1">
                        <input class="form-check-input" type="checkbox" id="terms" [formField]="form.fields.terms">
                        <label class="form-check-label" for="terms">I accept the terms</label>
                    </div>
                    <ngx-field-errors [field]="form.fields.terms"/>
                }
            }
            <ngx-form-errors/>
            <div class="mt-3">
                <button type="button" class="btn btn-outline-secondary me-2" (click)="steps.previous()" [disabled]="steps.isFirst()">Back</button>
                @if (steps.isLast()) {
                    <button type="button" class="btn btn-primary" (click)="finish()">Finish</button>
                } @else {
                    <button type="button" class="btn btn-primary" (click)="steps.next()">Next</button>
                }
            </div>
        </form>
        <pre class="model mt-3">{{ model() | json }}</pre>
    `,
})
export class WizardPage {
    protected readonly model = signal<Signup>({
        account: {email: '', password: ''},
        profile: {name: '', plan: 'free'},
        billing: {card: ''},
        terms: false,
    });
    protected readonly form = ngxForm(this.model, p => {
        applyRules(p.account.email, [new RequiredRule(), new EmailRule()]);
        applyRules(p.account.password, [new RequiredRule(), new MinLengthRule(8)]);
        applyRules(p.profile.name, [new RequiredRule()]);
        applyRules(p.billing.card, [new RequiredRule()]);
        hidden(p.billing, {when: ctx => ctx.valueOf(p.profile.plan) !== 'paid'});
        applyRules(p.terms, [new AllowedValueRule([true], 'You have to accept the terms.')]);
        step(p.terms, 'confirm');
    });
    protected readonly steps = wizard(this.form, [
        {id: 'account', field: $ => $.account},
        {id: 'profile', field: $ => $.profile},
        {id: 'billing', field: $ => $.billing, when: () => this.model().profile.plan === 'paid'},
        {id: 'confirm', tagged: true},
    ]);

    protected async finish(): Promise<void> {
        const ok = await this.steps.submit(() => new Promise($ => setTimeout($, 500)));
        console.info('wizard submitted', ok);
    }
}
