import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {applyEach, hidden, MIN_LENGTH, REQUIRED} from '@angular/forms/signals';
import {
    AllowedValueRule,
    applyRules,
    arrayOps,
    bindTemplate,
    MinLengthRule,
    ngxForm,
    NgxFormOptions,
    provideRuleTemplates,
    reaction,
    RequiredRule,
    RuleRegistry,
    SameValueRule,
    semantic,
    skipRules,
    step,
    wizard,
} from '@such-code/ngx-forms';
import {SchemaOrSchemaFn} from '@angular/forms/signals';

function create<T>(model: T, schema?: SchemaOrSchemaFn<T> | null, options?: NgxFormOptions<T>) {
    const value = signal(model);
    const form = TestBed.runInInjectionContext(() => ngxForm(value, schema, options));
    return {value, form};
}

const kinds = (errors: ReadonlyArray<{ kind: string }>) => errors.map($ => $.kind);

describe('ngxForm: templates', () => {
    it('compiles a known template into field rules with metadata', () => {
        TestBed.configureTestingModule({
            providers: [provideRuleTemplates({Login: {email: [new RequiredRule()], password: [new MinLengthRule(8)]}})],
        });
        const {form} = create({email: '', password: 'short'}, null, {name: 'Login'});

        expect(kinds(form.fields.email().errors())).toEqual(['required']);
        expect(form.fields.email().metadata(REQUIRED)?.()).toBe(true);
        expect(form.fields.password().metadata(MIN_LENGTH)?.()).toBe(8);
        expect(kinds(form.fields.password().errors())).toEqual(['minLength']);
        expect(form.fields().valid()).toBe(false);
    });

    it('applies rules added to the template after the form was created', () => {
        const {form} = create({email: '', password: ''}, null, {name: 'Late'});
        expect(form.fields().valid()).toBe(true);

        TestBed.inject(RuleRegistry).set('Late', {email: [new RequiredRule()]});
        expect(kinds(form.fields.email().errors())).toEqual(['required']);

        TestBed.inject(RuleRegistry).remove('Late');
        expect(form.fields.email().errors()).toEqual([]);
    });

    it('stops a compiled rule when it is replaced in the registry', () => {
        TestBed.configureTestingModule({providers: [provideRuleTemplates({F: {name: [new MinLengthRule(2)]}})]});
        const {form} = create({name: 'abc'}, null, {name: 'F'});
        expect(form.fields.name().valid()).toBe(true);

        TestBed.inject(RuleRegistry).merge('F', 'name', [new MinLengthRule(5)]);
        expect(form.fields.name().errors().map($ => $.message)).toEqual(['Length should be greater then 5.']);
    });

    it('supports globs over arrays, including items added later', () => {
        TestBed.configureTestingModule({providers: [provideRuleTemplates({Order: {'lines.*.sku': [new RequiredRule()]}})]});
        const {form} = create({lines: [{id: 1, sku: 'a'}]}, null, {name: 'Order'});
        expect(form.fields().valid()).toBe(true);

        arrayOps(form.fields.lines).push({id: 2, sku: ''});
        expect(kinds(form.fields.lines[1].sku().errors())).toEqual(['required']);
        expect(form.fields().valid()).toBe(false);

        arrayOps(form.fields.lines).remove(1);
        expect(form.fields().valid()).toBe(true);
    });

    it('binds a named template to a sub path', () => {
        TestBed.configureTestingModule({providers: [provideRuleTemplates({Address: {street: [new RequiredRule()]}})]});
        const {form} = create({home: {street: ''}, work: {street: 'x'}}, p => {
            bindTemplate(p.home, 'Address');
            bindTemplate(p.work, 'Address');
        });
        expect(kinds(form.fields.home.street().errors())).toEqual(['required']);
        expect(form.fields.work.street().valid()).toBe(true);
    });

    it('honours skipRules metadata and form level skips', () => {
        TestBed.configureTestingModule({providers: [provideRuleTemplates({S: {a: [new RequiredRule()], b: [new RequiredRule(), new MinLengthRule(3)]}})]});
        const {form} = create({a: '', b: 'x'}, p => skipRules(p.a, ['required']), {name: 'S', skipRules: ['minLength']});
        expect(form.fields.a().errors()).toEqual([]);
        expect(form.fields.a().metadata(REQUIRED)?.()).toBe(false);
        expect(form.fields.b().errors()).toEqual([]);
    });
});

describe('ngxForm: rules with form context', () => {
    it('gives rules access to the form root, also inside applyEach', () => {
        const {form, value} = create(
            {password: 'secret', confirm: 'nope', people: [{a: 'x', b: 'y'}]},
            p => {
                applyRules(p.confirm, [new SameValueRule('password')]);
                applyEach(p.people, item => applyRules(item.b, [new SameValueRule('password')]));
            },
        );
        expect(kinds(form.fields.confirm().errors())).toEqual(['sameValue']);
        expect(kinds(form.fields.people[0].b().errors())).toEqual(['sameValue']);

        value.update($ => ({...$, confirm: 'secret', people: [{a: 'x', b: 'secret'}]}));
        expect(form.fields().valid()).toBe(true);
    });

    it('semantic validators clear as soon as the condition is fixed', () => {
        const {form, value} = create({password: 'a', passwordConfirmation: 'b', user: {name: 'Wrong'}}, p => {
            semantic(p, v => v.password !== v.passwordConfirmation ? {passwordConfirmation: 'Password confirmation must be exactly same.'} : null);
            semantic(p.user, v => v.name === 'Wrong' ? {name: ['User name can\'t be equal to "Wrong"']} : null);
        });
        expect(form.fields.passwordConfirmation().errors()[0].message).toBe('Password confirmation must be exactly same.');
        expect(kinds(form.fields.user.name().errors())).toEqual(['semantic']);

        value.update($ => ({...$, password: 'b'}));
        expect(form.fields.passwordConfirmation().errors()).toEqual([]);
    });
});

describe('ngxForm: server errors and submit', () => {
    const validationError = (details: any[]) => ({name: 'HttpErrorResponse', status: 400, headers: {}, message: 'Bad Request', error: {details}});

    it('field errors persist on sibling changes, clear on change and do not come back', async () => {
        const {form, value} = create({name: 'taken', other: ''});
        const ok = await form.submit(async () => {
            throw validationError([{param: 'name', message: 'Name is taken'}]);
        });
        expect(ok).toBe(false);
        expect(form.fields.name().errors().map($ => $.message)).toEqual(['Name is taken']);

        value.update($ => ({...$, other: 'x'}));
        expect(form.fields.name().errors().length).toBe(1);

        value.update($ => ({...$, name: 'taken2'}));
        expect(form.fields.name().errors()).toEqual([]);
        TestBed.tick();
        value.update($ => ({...$, name: 'taken'}));
        expect(form.fields.name().errors()).toEqual([]);
    });

    it('constraints with context update the shared template, without context only this form', async () => {
        const first = create({email: '', age: 10}, null, {name: 'Signup'});
        const second = create({email: '', age: 10}, null, {name: 'Signup'});

        first.form.applyServerError(validationError([
            {param: 'age', constraint: {type: 'minOrEqual', message: 'At least {{ limit }}', limit: 18, context: 'Signup'}, message: 'x'},
            {param: 'email', constraint: {type: 'required', message: 'Email please'}},
        ]));

        expect(first.form.fields.age().errors().map($ => $.message)).toEqual(['At least 18']);
        expect(second.form.fields.age().errors().map($ => $.message)).toEqual(['At least 18']);
        expect(first.form.fields.email().errors().map($ => $.message)).toEqual(['Email please']);
        expect(second.form.fields.email().errors()).toEqual([]);
    });

    it('generic errors go to form errors, fields are disabled only while the action runs', async () => {
        const {form} = create({name: 'x'});
        let disabledDuringAction: boolean | undefined;
        const ok = await form.submit(async () => {
            disabledDuringAction = form.fields.name().disabled();
            throw {name: 'HttpErrorResponse', status: 0, headers: {}, error: {}, message: 'Http failure response: 0 Unknown Error'};
        });
        expect(ok).toBe(false);
        expect(disabledDuringAction).toBe(true);
        expect(form.fields.name().disabled()).toBe(false);
        expect(form.submitting()).toBe(false);
        expect(form.errors.formErrors().map($ => $.kind)).toEqual(['network']);

        expect(await form.submit(async () => undefined)).toBe(true);
        expect(form.errors.formErrors()).toEqual([]);
    });

    it('does not run the action for an invalid form and marks fields touched', async () => {
        const {form} = create({name: ''}, p => applyRules(p.name, [new RequiredRule()]));
        const action = vi.fn();
        expect(await form.submit(action)).toBe(false);
        expect(action).not.toHaveBeenCalled();
        expect(form.fields.name().touched()).toBe(true);
    });

    it('accepts observables as actions', async () => {
        const {of} = await import('rxjs');
        const {form} = create({name: 'x'});
        expect(await form.submit(() => of(1, 2))).toBe(true);
    });

    it('pathOf returns the dotted path', () => {
        const {form} = create({a: {b: [{c: 1}]}}, null, {name: 'P'});
        expect(form.pathOf(form.fields.a.b[0].c)).toBe('a.b.0.c');
    });
});

describe('ngxForm: rule lookup', () => {
    it('sees schema, template and late rules, which metadata does not', () => {
        TestBed.configureTestingModule({providers: [provideRuleTemplates({Lookup: {name: [new MinLengthRule(2)]}})]});
        const {form} = create({name: '', email: '', lines: [{sku: ''}]}, p => applyRules(p.email, [new RequiredRule()]), {name: 'Lookup'});

        expect(form.hasRule(form.fields.email, 'required')).toBe(true);
        expect(form.rules(form.fields.name).map($ => $.name)).toEqual(['minLength']);
        expect(form.hasRule(form.fields.name, 'required')).toBe(false);

        // Late rules: errors and lookup, but no metadata.
        TestBed.inject(RuleRegistry).merge('Lookup', 'name', [new RequiredRule()]);
        form.addRules('lines.*.sku', [new RequiredRule()]);
        expect(form.fields.name().metadata(REQUIRED)?.()).toBeFalsy();
        expect(form.fields.name().required()).toBe(false);
        expect(form.hasRule(form.fields.name, 'required')).toBe(true);
        expect(form.hasRule(form.fields.lines[0].sku, 'required')).toBe(true);
        expect(form.constraints(form.fields.name)).toEqual({required: true, minLength: 2});
        expect(form.isRequired(form.fields.name)).toBe(true);
        expect(form.isRequired(form.fields.email)).toBe(true);
    });

    it('leaves out skipped and removed rules', () => {
        const {form} = create({name: '', nick: ''}, p => skipRules(p.nick, ['required']), {name: 'LookupSkip'});
        form.addRules('name', [new RequiredRule()]);
        form.addRules('nick', [new RequiredRule()]);
        expect(form.hasRule(form.fields.name, 'required')).toBe(true);
        expect(form.hasRule(form.fields.nick, 'required')).toBe(false);

        TestBed.inject(RuleRegistry).set('LookupSkip', {name: [new MinLengthRule(3)]});
        expect(form.rules(form.fields.name).map($ => $.name).sort()).toEqual(['minLength', 'required']);
        TestBed.inject(RuleRegistry).remove('LookupSkip');
        expect(form.rules(form.fields.name).map($ => $.name)).toEqual(['required']);
    });

    it('resolves templates bound to a sub path', () => {
        TestBed.configureTestingModule({providers: [provideRuleTemplates({Company: {}})]});
        const {form} = create({company: {title: ''}}, p => bindTemplate(p.company, 'Company'), {template: false});
        expect(form.hasRule(form.fields.company.title, 'required')).toBe(false);
        TestBed.inject(RuleRegistry).merge('Company', 'title', [new RequiredRule()]);
        expect(form.hasRule(form.fields.company.title, 'required')).toBe(true);
    });
});

describe('wizard', () => {
    type Signup = { account: { email: string }, profile: { name: string, paid: boolean }, billing: { card: string }, terms: boolean };

    function setup() {
        return create<Signup>(
            {account: {email: ''}, profile: {name: '', paid: false}, billing: {card: ''}, terms: false},
            p => {
                applyRules(p.account.email, [new RequiredRule()]);
                applyRules(p.profile.name, [new RequiredRule()]);
                applyRules(p.billing.card, [new RequiredRule()]);
                hidden(p.billing, {when: ctx => !ctx.valueOf(p.profile.paid)});
                applyRules(p.terms, [new AllowedValueRule([true], 'Accept the terms')]);
                step(p.terms, 'terms');
            },
        );
    }

    it('validates one step at a time and skips conditional steps', async () => {
        const {form, value} = setup();
        const w = TestBed.runInInjectionContext(() => wizard(form, [
            {id: 'account', field: f => f.account},
            {id: 'profile', field: f => f.profile},
            {id: 'terms', tagged: true},
            {id: 'billing', field: f => f.billing, when: () => value().profile.paid},
        ]));

        expect(w.next()).toBe(false);
        expect(form.fields.account.email().touched()).toBe(true);
        expect(form.fields.profile.name().touched()).toBe(false);

        value.update($ => ({...$, account: {email: 'a@b.c'}}));
        expect(w.next()).toBe(true);
        expect(w.current().id).toBe('profile');
        expect(w.steps().map($ => $.id)).toEqual(['account', 'profile', 'terms']);

        value.update($ => ({...$, profile: {name: 'N', paid: true}}));
        expect(w.steps().map($ => $.id)).toEqual(['account', 'profile', 'terms', 'billing']);
        expect(w.isValid('terms')).toBe(false);

        const action = vi.fn();
        expect(await w.submit(action)).toBe(false);
        expect(w.current().id).toBe('terms');
        expect(action).not.toHaveBeenCalled();

        value.update($ => ({...$, terms: true, profile: {...$.profile, paid: false}}));
        expect(await w.submit(action)).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
    });
});

describe('reaction', () => {
    it('updates the model when the selected value changes', () => {
        const value = signal({country: 'LV', state: 'Riga'});
        TestBed.runInInjectionContext(() => reaction(value, $ => $.country, (_, m) => ({...m, state: ''})));
        TestBed.tick();
        expect(value().state).toBe('Riga');

        value.update($ => ({...$, country: 'EE'}));
        TestBed.tick();
        expect(value().state).toBe('');
    });
});
