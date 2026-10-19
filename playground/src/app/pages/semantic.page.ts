import {Component, signal} from '@angular/core';
import {FormField} from '@angular/forms/signals';
import {applyRules, MinLengthRule, ngxForm, NgxForms, RequiredRule, semantic} from '@such-code/ngx-forms';

@Component({
    imports: [FormField, NgxForms],
    template: `
        <h2>Semantic (cross-field) validation</h2>
        <form [ngxForm]="form" [ngxFormAction]="save">
            <div class="mb-3">
                <label class="form-label" for="password">Password</label>
                <input class="form-control" id="password" type="password" [formField]="form.fields.password" ngxFieldState>
                <ngx-field-errors [field]="form.fields.password"/>
            </div>
            <div class="mb-3">
                <label class="form-label" for="confirm">Confirm password</label>
                <input class="form-control" id="confirm" type="password" [formField]="form.fields.passwordConfirmation" ngxFieldState>
                <ngx-field-errors [field]="form.fields.passwordConfirmation"/>
            </div>
            <fieldset class="mb-3">
                <legend>User</legend>
                <label class="form-label" for="name">Name (anything except "Wrong")</label>
                <input class="form-control" id="name" [formField]="form.fields.user.name" ngxFieldState>
                <ngx-field-errors [field]="form.fields.user.name"/>
            </fieldset>
            <button type="submit" class="btn btn-primary">Submit</button>
        </form>
    `,
})
export class SemanticPage {
    protected readonly model = signal({password: '', passwordConfirmation: '', user: {name: ''}});
    protected readonly form = ngxForm(this.model, p => {
        applyRules(p.password, [new RequiredRule(), new MinLengthRule(8)]);
        applyRules(p.passwordConfirmation, [new RequiredRule()]);
        semantic(p, $ => $.passwordConfirmation && $.passwordConfirmation !== $.password
            ? {passwordConfirmation: 'Password confirmation must be exactly same.'}
            : null);
        semantic(p.user, $ => $.name === 'Wrong' ? {name: 'User name can\'t be equal to "Wrong"'} : null);
    });
    protected readonly save = () => console.info('submitted', this.model());
}
