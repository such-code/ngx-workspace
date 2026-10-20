# @such-code/ngx-forms

Validation templates, server errors, submit handling, wizards and input correction for
[Angular Signal Forms](https://angular.dev/guide/forms/signals) (`@angular/forms/signals`, Angular 22+).

Successor of `@such-code/ngx-form-validation` (template-driven / reactive forms). See [MIGRATION.md](MIGRATION.md).

```bash
npm i @such-code/ngx-forms
```

## Quick start

```ts
import {Component, inject, signal} from '@angular/core';

import {applyRules, EmailRule, ngxForm, NgxForms, RequiredRule} from '@such-code/ngx-forms';

@Component({
    imports: [NgxForms],
    template: `
        <form [ngxForm]="form">
            <ngx-form-errors heading="Could not save"/>
            <input [formField]="form.fields.email" ngxFieldState>
            <ngx-field-errors [field]="form.fields.email"/>
            <button type="submit" [disabled]="form.submitting()">Save</button>
        </form>
    `,
})
export class ContactComponent {
    private readonly api = inject(ContactApi);
    protected readonly model = signal({email: ''});
    protected readonly form = ngxForm(this.model, p => {
        applyRules(p.email, [new RequiredRule(), new EmailRule()]);
    }, {
        action: $value => this.api.save($value), // Promise or Observable
    });
}
```

`form.fields` is a regular Signal Forms `FieldTree`: everything from `@angular/forms/signals` (`required()`,
`validate()`, `hidden()`, `applyEach()`, `validateAsync()`, custom controls, ...) works in the schema function.

## What it adds to Signal Forms

| Need | API |
|---|---|
| Rules as data, reusable by name, application-wide | `provideRuleTemplates({Name: {'path': rules}})`, `ngxForm(model, schema, {name: 'Name'})`, `bindTemplate(path, 'Name')` |
| Templates prefetched or generated from server responses, cached | `RuleRegistry.load()`, `.merge()`, `.export()` / `.import()` |
| Server validation errors and constraints | thrown by the submit action, applied automatically; `form.applyServerError(error)` |
| Generic / connection errors | `form.errors.formErrors()`, `<ngx-form-errors>` |
| Disable form while submitting | automatic (`disableWhileSubmitting: false` to opt out) |
| Cross-field validation with the v21 result shape | `semantic(path, value => ({'relative.path': 'message'}))` |
| Dynamic arrays and groups | `arrayOps(form.fields.items)` with `@for (item of form.fields.items; track item)`; update the model for groups |
| Structure that follows input | `reaction(model, select, apply)`; Signal Forms `hidden()` / `applyWhen()` |
| Multistep wizard on one model | `wizard(form, steps)`, `step(path, id)` |
| Correct input while typing / on blur | `[ngxNormalize]`, `normalizers`; Signal Forms `transformedValue()` for parse/format |
| Translated messages | `ValidationIntl.update()`, `ngxErrorMessage` pipe |

## Rules

Rules are plain classes with `check(value, context)`; the error they return is a Signal Forms `ValidationError`
(`kind`, `message`) that also keeps `rawMessage` and `params` for translation.

`RequiredRule`, `NotEmptyRule`, `SizeRule`, `MinLengthRule`, `MaxLengthRule`, `MinRule`, `MinOrEqualRule`, `MaxRule`,
`MaxOrEqualRule`, `PatternRule`, `EmailRule`, `DigitsRule`, `PhoneRule`, `AgeRule`, `BooleanRule`, `AllowedValueRule`,
`IncorrectValueRule`, `SameValueRule`, `ExternalValidatorRule` (wraps a function).

- `applyRules(path, rules)` registers rules on a schema path. Rules that declare metadata (`required`, `minLength`,
  `maxLength`, `min`, `max`, `pattern`) also set it on the field, so `field().required()` and custom controls see it.
- `skipRules(path, ['required'])` turns rules off for one path; `ngxForm(..., {skipRules})` and the
  `NGX_FORMS_SKIP_RULES` token for a whole form or subtree.
- Custom rules: extend `ValidationRuleWithMessage`, implement `toConstraint()` and register a factory with
  `registerRuleFactory(type, factory)` so the server can send them and templates can be serialized.

## Templates

```ts
// app.config.ts, or providers of a route/component: a child template extends the parent one,
// paths defined in the child replace the parent's rules for those paths
provideRuleTemplates({
    Signup: {
        'email': [new RequiredRule(), new EmailRule()],
        'addresses.*.city': [new RequiredRule()],      // * = every array item / object key
    },
});

// component
form = ngxForm(model, null, {name: 'Signup'});         // binds the "Signup" template
// or for a part of a form:
form = ngxForm(model, p => bindTemplate(p.billing, 'Address'));
```

Rules known when the form is created become per-field validators with metadata. Rules added later (registry
updates, server constraints) are evaluated by one tree validator: they show errors immediately, but do not set
metadata such as `required()`.

To see every rule, including late ones, ask the form instead of the metadata:

```ts
form.rules(form.fields.email);               // ValidationRule[] that currently apply (skipped rules left out)
form.hasRule(form.fields.email, 'required'); // by rule name
form.constraints(form.fields.age);           // {required, minLength, maxLength, min, max, pattern}
form.isRequired(form.fields.email);          // metadata required() or a required rule
```

`ngxConstraints` applies the same to a control: `required`, `aria-required` and native `minlength` / `maxlength` /
`min` / `max` for constraints that are not in metadata (the rest stays with `[formField]`):

```html
<label for="email">Email @if (form.isRequired(form.fields.email)) { * }</label>
<input id="email" [formField]="form.fields.email" ngxConstraints>
```

It uses the closest `form[ngxForm]`, or `[ngxConstraints]="form"`. Custom `FormValueControl` components get their
`required` input from metadata only; prefetch templates (e.g. `RuleRegistry.load()` in a route resolver) when they
must see late rules.

## Server errors

The submit action may throw anything; `parseServerError()` understands the v21 payload
(`{message?, details: [{param, message} | {param, constraint, message?} | {param, existingConstraint}]}`), Angular
`HttpErrorResponse` (status `0` = network error) and plain `Error`s.

- `{param, message}` → error on that field, removed as soon as the field value changes;
- `{param, constraint}` → rule; with `constraint.context` it is merged into that application-wide template,
  otherwise it is added to this form only (`form.localTemplate`);
- anything else → `form.errors.formErrors()`.

Strip backend prefixes with `ngxForm(model, schema, {serverErrors: {pathPrefixes: ['body']}})`.

Push errors yourself (sockets, other forms):

```ts
form.errors.push('user.name', 'socket', ['Somebody took this name'], {stale: 'on-change'});
form.errors.clear('socket');
```

## Wizard

```ts
form = ngxForm(model, p => { /* rules for all steps */ });
steps = wizard(this.form, [
    {id: 'account', field: f => f.account},
    {id: 'billing', field: f => f.billing, when: () => this.model().plan === 'paid'},
    {id: 'confirm', tagged: true},                        // fields tagged with step(p.terms, 'confirm')
]);
// steps.current(), steps.next(), steps.previous(), steps.goTo(id), steps.isValid(id), steps.submit(action)
```

Steps that are not rendered are still validated (validity comes from the model). Hide fields of skipped steps
with Signal Forms `hidden()` so they do not block the final submit.

## Input correction

- `[ngxNormalize]="fn"` on a native input rewrites text while typing (caret preserved); `ngxNormalizeOn="blur"`
  applies it when the field loses focus. `normalizers.trim | upper | lower | digits | collapseSpaces | group(n)`.
- Parse/format (text ↔ number/date) belongs to the control: use Signal Forms `transformedValue()`.
- `reaction(model, m => m.country, (_, m) => ({...m, region: ''}))` updates other parts of the model.
