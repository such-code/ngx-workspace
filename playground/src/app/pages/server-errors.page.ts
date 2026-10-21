import {Component, inject, signal} from '@angular/core';

import {applyRules, ngxForm, NgxForms, RequiredRule} from '@such-code/ngx-forms-validation';
import {FakeApi} from '../fake-api';

type Scenario = 'ok' | 'field' | 'constraint' | 'network' | 'generic';

@Component({
    imports: [NgxForms],
    template: `
        <h2>Server errors</h2>
        <p class="text-body-secondary">The controls are locked while the request runs (validation keeps running). Field errors clear
            when you change that field. The constraint scenario makes age required with a minimum after the form exists: the
            asterisk (<code>field().required()</code>) and the <code>required</code> / <code>min</code> attributes follow it.</p>
        <form [ngxForm]="form" [ngxFormAction]="save">
            <ngx-form-errors heading="Could not save"/>
            <div class="mb-3">
                <label class="form-label" for="login">Login @if (form.fields.login().required()) {<span class="text-danger">*</span>}</label>
                <input class="form-control" id="login" [ngxField]="form.fields.login" ngxFieldState>
                <ngx-field-errors [field]="form.fields.login"/>
            </div>
            <div class="mb-3">
                <label class="form-label" for="age">Age @if (form.fields.age().required()) {<span class="text-danger">*</span>}</label>
                <input class="form-control" id="age" type="number" [ngxField]="form.fields.age" ngxFieldState>
                <ngx-field-errors [field]="form.fields.age"/>
            </div>
            <div class="mb-3">
                @for (option of scenarios; track option.id) {
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="scenario" [id]="option.id"
                               [checked]="scenario() === option.id" (change)="scenario.set(option.id)">
                        <label class="form-check-label" [for]="option.id">{{ option.label }}</label>
                    </div>
                }
            </div>
            <button type="submit" class="btn btn-primary">
                @if (form.submitting()) { Saving… } @else { Submit }
            </button>
        </form>
    `,
})
export class ServerErrorsPage {
    protected readonly api = inject(FakeApi);
    protected readonly model = signal({login: 'admin', age: 16 as number | null});
    protected readonly form = ngxForm(this.model, p => applyRules(p.login, [new RequiredRule()]), {
        serverErrors: {pathPrefixes: ['body']},
    });
    protected readonly scenario = signal<Scenario>('field');
    protected readonly scenarios: ReadonlyArray<{ id: Scenario, label: string }> = [
        {id: 'ok', label: 'Success'},
        {id: 'field', label: 'Field error'},
        {id: 'constraint', label: 'Constraint'},
        {id: 'network', label: 'Network error'},
        {id: 'generic', label: 'Generic error'},
    ];

    protected readonly save = () => {
        switch (this.scenario()) {
            case 'ok':
                return this.api.ok();
            case 'field':
                return this.api.validationError([{param: 'body.login', message: 'This login is already taken.'}]);
            case 'constraint':
                return this.api.validationError([{
                    param: 'age',
                    message: 'You must be at least 18.',
                    constraint: {type: 'minOrEqual', limit: 18, message: 'You must be at least {{ limit }}.'},
                }, {
                    param: 'age',
                    message: 'Age is required.',
                    constraint: {type: 'required', message: 'Age is required.'},
                }]);
            case 'network':
                return this.api.networkError();
            case 'generic':
                return this.api.genericError();
        }
    };
}
