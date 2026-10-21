# @such-code/ngx-forms

Signal based forms for Angular 22+. The model is a `WritableSignal`, fields are derived from it, and everything a
form knows (values, errors, validity, metadata) is a signal. The API follows Angular Signal Forms
(`@angular/forms/signals`), so schemas read the same, but the engine is written from scratch to remove the issues
that Signal Forms has today. It does not depend on `@angular/forms`; classic forms (`FormGroup`, `ngModel`,
`ControlValueAccessor`) are not supported.

```bash
npm i @such-code/ngx-forms
```

## Quick start

```ts
import {Component, signal} from '@angular/core';
import {applyEach, email, form, NgxField, required, submit, trackBy} from '@such-code/ngx-forms';

type Line = { id: number, sku: string };

@Component({
    imports: [NgxField],
    template: `
        <form (submit)="$event.preventDefault(); save()">
            <input [ngxField]="f.email">
            @for (line of f.lines; track line().value().id) {
                <input [ngxField]="line.sku">
            }
            <button [disabled]="f().submitting()">Save</button>
        </form>
    `,
})
export class OrderComponent {
    protected readonly model = signal({email: '', lines: [] as Array<Line>});
    protected readonly f = form(this.model, p => {
        required(p.email);
        email(p.email);
        trackBy(p.lines, $ => $.id);
        applyEach(p.lines, line => required(line.sku));
    });

    protected save() {
        // Errors returned by the action land on their fields and clear when those fields change.
        return submit(this.f, async $value => {
            const response = await api.save($value);
            return response.errors; // [{kind: 'taken', path: 'email', message: '...'}]
        });
    }
}
```

## What is different from Angular Signal Forms

| Signal Forms (22.2) | Here |
|---|---|
| A schema is compiled once; rules (and metadata such as `required`) can not be added after `form()` | `applySchema(field, schema)` adds rules at any time and returns a function removing them; `applyDynamic(path, () => schema)` follows a signal. Metadata updates too, so late rules set `required`/`min`/... on fields and controls |
| Pushed errors only through `submit()` (`submissionErrors` is private, one policy) | Every field has error sources: `field().setErrors(source, errors, {stale, forValue, whenSkipped})`, `clearErrors(source)`, `setPending(source)`. Validators never remove pushed errors, pushing never removes validator errors |
| No staleness rules for pushed errors | `stale: 'on-change'` (default: dropped when the field changes and never brought back), `'on-submit'`, `'never'`; `forValue` drops answers for values the user already changed |
| Hidden / disabled fields swallow pushed errors | `whenSkipped: true` keeps them visible; otherwise they are kept and reappear when the field is shown or enabled |
| Tree validator errors are broadcast to every descendant and filtered (O(depth × errors)) | Errors are grouped by target once; a field reads only the entries addressed to it |
| All validators of a field re-run when any dependency changes | One computed per rule; a changed dependency re-runs only that rule |
| An ancestor's pending async check marks every descendant pending | `pending` aggregates upwards only |
| Async validators wait until the whole subtree is sync-valid | `runWhen: 'valid'` (default: the field's own sync errors), `'treeValid'` or `'always'` |
| Async validators are `Resource` based and tied to `params` | `run(params, {signal})` returns a Promise or an Observable; streams apply every emission; built-in `debounce`; results for old params are never shown |
| Submit runs while async validation is pending (default `'pending'`) | `submit()` waits for pending validation by default (`awaitPending: false` to opt out) |
| An exception from the submit action propagates | `onError(error, field)` maps it to field errors; the submit reports `false` |
| Disabling the form during submit also switches validation off | Submit *locks* bound controls (`locked()`), validation keeps running; `lockWhileSubmitting: false` to opt out |
| Array identity: a hidden `Symbol` is written into your objects; primitives by index | Nothing is written into the data. `trackBy(path, fn)` keys items (survives refetching); otherwise objects by reference and items written through their field keep their field |
| Reading state of a removed array item throws (`NG01904`), so `@for (...; track item().value().id)` breaks after removals | Removed fields are detached: state stays readable, writes and touches are ignored with a dev warning, async work is aborted |
| Two values per field (`controlValue` vs `value`) to support debounce | One value. Debounce lives in the binding: typed text is committed after a delay or on blur |
| No hook to correct typed text | `[ngxNormalize]` rewrites text while typing or on blur, caret preserved |
| Custom controls receive state through inputs set by the compiler | Custom controls call `injectFieldControl()`: value, state, `setValue()`, `touch()`, `setParseErrors()` |
| Field paths only through `name()` | `field().path()`, `pathKey()`, `fieldAt(root, 'lines.0.sku')` |

## API

### Form

- `form(model, schema?, {name?, injector?, submission?, lockWhileSubmitting?})` returns the root `FieldTree`.
  `f.address.street` is a child field, `f.address.street()` its state. Array fields are iterable and indexable.
- `applySchema(field, schema)` adds rules later (also to one array item; they follow the item). Returns a remover.
- `fieldAt(field, path)`, `isFieldTree(value)`, `focusFirstInvalid(field)`.

### Schema rules

`validate`, `validateTree` (errors target other fields with `field` or a relative `path`), `validateAsync`,
`required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `email`, `disabled`, `hidden`, `readonly`,
`metadata` / `createMetadataKey`, `debounce`, `trackBy`, `apply`, `applyEach`, `applyWhen`, `applyWhenValue`,
`applyDynamic`, `schema`.

Rule functions receive a context: `value`, `state`, `field`, `key`, `index`, `valueOf(path)`, `stateOf(path)`,
`fieldOf(path)` (`*` segments resolve to the current item).

Built-in errors use Signal Forms kinds: `required`, `min` (`{min}`), `max`, `minLength`, `maxLength`, `pattern`,
`email`, plus `parse` from controls and `asyncError` for failed async checks without `onError`.

### Field state

`value` (writable), `key`, `path`, `pathKey`, `name`, `attached`, `errors`, `errorSummary`, `valid`, `invalid`,
`pending`, `touched`, `dirty`, `disabled`, `disabledReasons`, `hidden`, `readonly`, `submitting`, `locked`,
`required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `metadata(key)`, `getError(kind)`,
`markAsTouched({skipDescendants})`, `markAsDirty()`, `reset(value?)`, `setErrors(source, errors, options)`,
`clearErrors(source?, {deep})`, `setPending(source, pending)`, `reloadValidation()`, `focus()`.

Every error carries `field` (the field it belongs to) and `source` (`validator`, `tree`, `async`, `parse`,
`submit` or the name passed to `setErrors()`).

### Submit

```ts
submit(field, {
    action: (value, field) => errors | Promise<errors> | Observable<unknown>,
    awaitPending: true,      // wait for async validation
    ignoreValidators: false, // run even when invalid
    markAsTouched: true,
    onInvalid: field => ..., // default: focus the first invalid control
    onError: (error, field) => errors, // default: rethrow
});
```

Returns `true` when the action ran and reported no errors. A second submit of the same field (or a descendant)
while one runs returns `false`. Errors of the previous submit are cleared first.

### Binding

`[ngxField]` binds native `input` (text-like, number, range, date-like, checkbox, radio, file), `textarea` and
`select` (single and multiple). It writes the value and `name`, `disabled`, `readonly`, `required`,
`aria-required`, `min`/`max` and `minlength`/`maxlength`, all reactive. Bad numbers and dates become `parse` errors
and leave the model untouched. Leaving the control marks the field touched.

Custom controls:

```ts
@Component({
    selector: 'app-amount',
    template: `<input [value]="text()" (input)="text.set($any($event.target).value)" (blur)="control.touch()"
                      [disabled]="control.locked()">`,
})
export class AmountControl {
    protected readonly control = injectFieldControl<number | null>();
    protected readonly text = transformedValue(this.control, {
        parse: $ => $ === '' ? {value: null} : isNaN(+$) ? {error: {kind: 'parse'}} : {value: +$},
        format: $ => $ === null ? '' : String($),
    });
}
// <app-amount [ngxField]="f.amount"/>
```

`arrayOps(field)` gives `push`, `insert`, `remove`, `move`, `replace` and `clear` as immutable model updates.

## Moving from `@angular/forms/signals`

| Signal Forms | Here |
|---|---|
| `[formField]="f.x"`, `FormField` | `[ngxField]="f.x"`, `NgxField` |
| `FormValueControl` with `value = model()` | `injectFieldControl()` in the control |
| `transformedValue(this.value, ...)` | `transformedValue(injectFieldControl(), ...)` |
| `disabled(p, {when})`, `hidden(p, {when})` | `disabled(p, ctx => ...)`, `hidden(p, ctx => ...)` |
| `validateAsync(p, {params, factory, onSuccess})` | `validateAsync(p, {params, run, onSuccess})` |
| `submit(f, {action, ignoreValidators: 'pending'})` | `submit(f, {action, awaitPending: false})` |
| `createMetadataKey(MetadataReducer.list())` | `createMetadataKey(name, MetadataReducers.list())` |
| `field().metadata(KEY)?.()` | `field().metadata(KEY)()` |
| `MIN_NUMBER` / `MIN` | `MIN` (numbers) |
| `track item` required for arrays | any track expression works |
