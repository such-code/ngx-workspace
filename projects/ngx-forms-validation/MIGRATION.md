# Migrating to @such-code/ngx-forms-validation (v22)

- [From 22.0.0-next on Angular Signal Forms](#from-2200-next-on-angular-signal-forms) (the first v22 preview)
- [From @such-code/ngx-form-validation (v21)](#from-such-codengx-form-validation-v21)

## From 22.0.0-next on Angular Signal Forms

The first preview was a layer over Angular Signal Forms (`@angular/forms/signals`). It now runs on
`@such-code/ngx-forms`, a forms engine with the same API shape that removes the Signal Forms limitations the
layer had to work around. Everything from the engine is re-exported by `@such-code/ngx-forms-validation`.

Dependencies: `@angular/forms` is no longer needed; add `@such-code/ngx-forms`.

| 22.0.0-next | Now |
|---|---|
| `import {...} from '@angular/forms/signals'` | `import {...} from '@such-code/ngx-forms-validation'` (or `@such-code/ngx-forms`) |
| `[ngxField]="form.fields.x"`, `FormField` | `[ngxField]="form.fields.x"`, `NgxField` (included in `NgxForms`) |
| `ngxConstraints` next to `[ngxField]` | not needed: rules added later set metadata, `[ngxField]` writes the attributes. Remove it |
| `form.isRequired(field)` for the asterisk | `field().required()` (`isRequired` still works, deprecated) |
| `RULES` metadata key from `rule-lookup` | `RULES` from `metadata` (same name, export moved); `form.rules()` / `hasRule()` / `constraints()` unchanged |
| `bindTemplate(path, t, {mode: 'dynamic'})` | `bindTemplate(path, t)`: there is one mode, every rule is a real field rule |
| `disableWhileSubmitting` (default `true`) disabled fields, which switched validation off | `lockWhileSubmitting` (default `true`) only locks the controls; validation keeps running. `disableWhileSubmitting: true` keeps the old behaviour |
| `NgxSubmitOptions.ignoreValidators: 'none' \| 'pending' \| 'all'` | `awaitPending` (default `true`) and `ignoreValidators: boolean` |
| `SubmitAction` type | `NgxSubmitAction` (the engine's `submit()` has its own `SubmitAction`) |
| `focusFirstInvalid` from the layer | `focusFirstInvalid` from the engine (same behaviour) |
| `FieldErrorStore.active()`, `prune()`, `errorsAt()`, `clearStale()`, `bindErrorStore()` | gone: pushed errors live on the fields (`field().errors()` with `source`), staleness is handled there |
| Server field errors from a failed submit | source `'submit'`, dropped if the field changed while the request ran |
| `track item` required in `@for` over array fields | any track expression works, `track item().value().id` included |
| `AnyReadonlyField` | `AnyField` (`FieldTree<unknown>`); there is no readonly field variant |
| Custom control: `FormValueControl` with `value = model()`, `transformedValue(this.value, ...)` | `injectFieldControl()` and `transformedValue(control, ...)` |
| `hidden(p, {when: ctx => ...})`, `disabled(p, {when})` | `hidden(p, ctx => ...)`, `disabled(p, ctx => ...)` |
| `field().metadata(KEY)?.()` | `field().metadata(KEY)()` |

The engine's own changes compared to Angular Signal Forms are listed in its
[README](../ngx-forms/README.md#what-is-different-from-angular-signal-forms).

## From @such-code/ngx-form-validation (v21)

`@such-code/ngx-forms-validation` replaces `@such-code/ngx-form-validation`. Template-driven and reactive forms are no longer
supported: the new package is built on signal forms (`@such-code/ngx-forms`). The ideas stay the same
(rules are data, named templates, server constraints become rules, generic form errors), the plumbing changes.

### 1. Requirements

- Angular 22 (`@angular/core` `^22.0.0`), TypeScript 6.0, Node.js 22.22.3+ / 24.15+.
- Replace the dependency:

```bash
npm rm @such-code/ngx-form-validation
npm i @such-code/ngx-forms-validation @such-code/ngx-forms
```

### 2. Move the structure from the template to a model

v21 used the template (`ngModel`, `ngModelGroup`, `name`) as the source of truth. Now the model is:

```html
<!-- v21 -->
<form name="ContextForm" (onSubmitValid)="save($event)">
    <input name="first" ngModel>
    <ngx-validation-field-error for="first"/>
    <div ngModelGroup="group">
        <input name="forth" ngModel>
        <ngx-validation-field-error for="forth"/>
    </div>
    <button type="submit">Submit</button>
</form>
```

```ts
// v22
protected readonly model = signal({first: '', group: {forth: ''}});
protected readonly form = ngxForm(this.model, null, {name: 'ContextForm', action: $ => this.api.save($)});
```

```html
<form [ngxForm]="form">
    <input [ngxField]="form.fields.first" ngxFieldState>
    <ngx-field-errors [field]="form.fields.first"/>
    <input [ngxField]="form.fields.group.forth" ngxFieldState>
    <ngx-field-errors [field]="form.fields.group.forth"/>
    <button type="submit">Submit</button>
</form>
```

Component imports: `FormsModule` + `Validation*Directive`s → `NgxForms` (includes `NgxField`).

The race where a form exists before its controls registered (template-driven forms register in a microtask) is gone:
the field tree exists as soon as the model does.

### 3. API mapping

| v21 | v22 |
|---|---|
| `provideValidationService(config, skipRules?)` | `provideRuleTemplates(config)` (same object shape) + `{provide: NGX_FORMS_SKIP_RULES, useValue: skipRules}` |
| `VALIDATION_CONFIGURATION`, `ValidationConfiguration` | `RULE_TEMPLATES`, `RuleTemplates` |
| `VALIDATION_SKIP_DEFAULT_RULES` | `NGX_FORMS_SKIP_RULES` |
| `ValidationService` (`getContext$`, `changeContext`, ...) | `RuleRegistry` (`template()`, `snapshot()`, `set()`, `merge()`, `remove()`, `load()`, `export()`, `import()`) |
| Child `provideValidationService` replaced a parent context of the same name | child `provideRuleTemplates` **extends** the parent template; child paths replace parent rules for those paths |
| `ValidationContext`, `ValidationContextField` | plain `RuleTemplate` objects (`{path: rules[]}`) |
| `<form name="X">` (named context) | `ngxForm(model, schema, {name: 'X'})` |
| `[validationContext]="'X'"` on a group | `bindTemplate(p.group, 'X')` in the schema |
| `ValidationLocalContextDirective` (local context) | `form.localTemplate` / `form.addRules(path, rules)` |
| `[skipRules]`, `[skipValidation]` inputs | `skipRules(path, kinds)` in the schema; `hidden()` / `disabled()` to skip a field entirely |
| `[isRequired]`, `[min]`, `[max]`, `[allowedValue]`, `[externalValidator]` directives | `applyRules(path, [new RequiredRule(), ...])` or `required()`, `min()`, `max()`, `validate()` |
| `[semanticValidator]` on form / `ngModelGroup` / `formGroup` / `formGroupName` | `semantic(path, fn)` (same result shape) or `validateTree()` |
| `(onValid)`, `(onInvalid)`, `(onValidated)`, `(onSubmitValid)`, ... | `[ngxForm]` + `ngxForm({action})` / `[ngxFormAction]`; `(ngxSubmitted)` emits the result; or call `form.submit(action)` |
| `(onValidContinue)` (validate without submit) | `wizard(...).next()`, or `form.fields.step().markAsTouched()` + `.valid()` |
| `ValidationSubmitEvent` (`formData`, `getRawFormData()`, contexts) | the action receives the value; disabled fields keep their values in the model |
| `ErrorObservingService.observeOn(event)` / `.observe()` | automatic for errors thrown by the action; `form.applyServerError(error)` otherwise |
| `ErrorObservingService.observeTo(collection)` | `form.errors.pushForm(...)` |
| `ErrorCollection`, `ERROR_COLLECTOR_SOURCE` | `form.errors.formErrors()` |
| `FormDisabledDirective [source]`, `ModelGroupDisabledDirective` | automatic lock while submitting; `disabled(path, ctx => ...)` otherwise |
| `ValidationControlStateDirective` (on every control) | `ngxFieldState` attribute next to `[ngxField]` (opt-in), same `data-state-*` attributes |
| `<ngx-validation-field-error for="x">` / `[forControl]` | `<ngx-field-errors [field]="form.fields.x">` |
| `<ngx-validation-form-error>` | `<ngx-form-errors>` |
| `ngxFormValidationError` pipe (returned an Observable) | `ngxErrorMessage` pipe (returns a string) |
| `ValidationIntl.getTranslation()` / `getTranslation$()` | `ValidationIntl.translate()` / `translateError()` (signal based, use in templates or `computed`) |
| `scrollToFirstInvalidField(element, window)` | `focusFirstInvalid(form.fields)` (done automatically on invalid submit) |
| `ruleFromConstraintMap.get(type)` | `ruleFromConstraint(constraint)`, `registerRuleFactory(type, factory)` |
| `ValidationContextModule`, `ValidationDirectivesModule`, `ValidationSemanticDirectivesModule` | `NgxForms` |

### 4. Rules

- `ValidationRule.validator` (`ValidatorFn`) is gone. Rules implement `check(value, context): ValidationRuleError | null`;
  `ValidationRuleWithMessage` subclasses still implement `validate(value)` and `getRawMessageForValue(value)`.
  `validate` now also receives the `RuleContext` (`root`, `valueAt(path)`).
- `ValidationRuleError` gained `kind` and `message` (interpolated, so it is a valid `ValidationError`);
  `interpolationSource` is renamed to `params`.
- `getInterpolationSource` defaults to `null`; built-in rules return only their parameters (`{length}`, `{limit}`...)
  instead of the whole rule instance.
- New: `toConstraint()` (serialization), `metadata()` (constraints for controls), `SameValueRule`.
- `ExternalValidatorRule(fn)`: `fn(value, formData, context)`; the result may be a `ValidationRuleError` or
  `{rawMessage, params?}` (`interpolationSource` still accepted).

Behaviour changes, check forms that relied on the old behaviour:

| Rule | v21 | v22 |
|---|---|---|
| `RequiredRule` | `false` and `[]` counted as filled | `false` is a value (use `AllowedValueRule([true])` for "must be checked"), `[]` is empty |
| `AllowedValueRule` | `null`/`''` were errors (acted as required); strict `indexOf` | empty values pass (add `RequiredRule`); deep equality |
| `DigitsRule` | `!!Number(value)`: `"0"` invalid, `"1.5"` valid | digits only: `"0"` valid, `"1.5"` invalid |
| `AgeRule` | valid when the date was *less* than `age` years ago (inverted) | valid when the date is at least `age` years ago |
| `MinRule`/`MaxRule`/... | non-numbers valid only when falsy | `null`/`undefined`/`''`/`NaN` valid, other non-numbers invalid |
| `EmailRule(strict)` | `strict` ignored | `strict` (default `true`, same regex as before); `false` allows all RFC 5322 local-part characters |
| `PatternRule` | stateful with `g`/`y` flags | `lastIndex` reset before every test |

### 5. Server errors

The wire format is unchanged. Differences in how errors are applied:

- `{param, message}` used to create an `IncorrectValueRule` in the local context, so retyping the rejected value
  brought the error back. Now it is a pushed error that disappears when the field changes and does not come back.
- `param` paths are resolved with nested paths (`user.name`, `items[0].name`); prefixes like `body.` are removed with
  `ngxForm(..., {serverErrors: {pathPrefixes: ['body']}})`.
- Constraints with `context` still update the application-wide template (and warn when it is not this form's
  template); constraints without `context` apply to this form only, as before.
- Unknown constraint types are reported with a warning; register them with `registerRuleFactory()`.
- Form errors are cleared on the next submit, as before. Network errors (`status: 0`) get `kind: 'network'`.

### 6. Things that need a manual decision

- **Hidden and disabled fields** report no errors, server errors included (pass `whenSkipped: true` to
  `field().setErrors()` to show them anyway); errors reappear when the field is shown or enabled again.
- **Array items** keep their state (touched, errors) by `trackBy(p.items, $ => $.id)` key, or by object identity
  without it. Use `arrayOps()` (or immutable updates) instead of mutating arrays.
- **Submitting while async validators run**: `form.submit()` waits for them by default; pass
  `{awaitPending: false}` to submit right away.
