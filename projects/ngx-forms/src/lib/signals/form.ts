import {
    assertInInjectionContext,
    computed,
    effect,
    inject,
    InjectionToken,
    Injector,
    Signal,
    signal,
    untracked,
    WritableSignal,
} from '@angular/core';
import {
    apply,
    disabled,
    FieldTree,
    form,
    SchemaOrSchemaFn,
    SchemaPath,
    submit,
} from '@angular/forms/signals';
import {isObservable, lastValueFrom, Observable} from 'rxjs';
import {RuleRegistry, RuleTemplate} from '../core/registry';
import {mergeRules} from '../core/registry';
import {ParsedServerError, parseServerError, ParseServerErrorOptions} from '../core/server-error';
import {RuleMetadata, ruleError, ValidationRule} from '../core/rules';
import {normalizePath, splitPath, valueAt} from '../core/path';
import {bindTemplate} from './rules';
import {bindErrorStore, FieldErrorStore} from './error-store';
import {runInSchemaContext} from './schema-context';
import {AnyField, AnyReadonlyField} from './field-tree';
import {constraintsOf, hasRule, rulesOf} from './rule-lookup';

/** Default rule kinds skipped by every `ngxForm()` below this provider (was `VALIDATION_SKIP_DEFAULT_RULES`). */
export const NGX_FORMS_SKIP_RULES = new InjectionToken<ReadonlyArray<string>>('NGX_FORMS_SKIP_RULES');

export type SubmitAction<T> = ($value: T) => Promise<unknown> | Observable<unknown> | unknown;

export interface NgxSubmitOptions<T> {
    /** Field to submit (wizard step, sub form); defaults to the whole form. */
    readonly field?: AnyField;
    /**
     * Signal Forms `ignoreValidators`. Default `'none'`: pending async validators block submission (Signal Forms
     * defaults to `'pending'`).
     */
    readonly ignoreValidators?: 'pending' | 'none' | 'all';
    /** Called instead of the action when the submitted field is invalid. Default focuses the first invalid control. */
    readonly onInvalid?: () => void;
}

export interface NgxFormOptions<T> {
    /** Form name: used for the rule template lookup and as Signal Forms root name (`name` attributes). */
    readonly name?: string;
    /** Template to bind; defaults to `name`. `false` disables template lookup. */
    readonly template?: string | false;
    /** Rule kinds skipped for every field. Merged with `NGX_FORMS_SKIP_RULES`. */
    readonly skipRules?: ReadonlyArray<string>;
    /** Disable every field while the submit action runs. Default `true`. */
    readonly disableWhileSubmitting?: boolean;
    /** Default submit action used by `submit()` and the `[ngxForm]` directive. */
    readonly action?: SubmitAction<T>;
    /** Options for `parseServerError()`, e.g. `{pathPrefixes: ['body.']}`. */
    readonly serverErrors?: ParseServerErrorOptions;
    readonly injector?: Injector;
}

export interface NgxForm<T> {
    /** Signal Forms field tree; bind with `[formField]="form.fields.x"`. */
    readonly fields: FieldTree<T>;
    readonly model: WritableSignal<T>;
    readonly name: string;
    /** Pushed field errors and form-level errors. */
    readonly errors: FieldErrorStore;
    /** Rules added by server constraints without a template context; apply to this form only. */
    readonly localTemplate: Signal<RuleTemplate>;
    /** `true` while a submit action runs. */
    readonly submitting: Signal<boolean>;

    /** Validates `field` (default: whole form), runs the action when valid, applies server errors when it fails. */
    submit($action?: SubmitAction<any>, $options?: NgxSubmitOptions<T>): Promise<boolean>;

    /** Applies an error thrown outside `submit()` (was `ErrorObservingService.observeOn`). */
    applyServerError($error: unknown): ParsedServerError;

    /** Adds form-local rules (as server constraints without context do). */
    addRules($path: string, $rules: RuleTemplate[string]): void;

    /** Dotted path of a field relative to the form root. */
    pathOf($field: AnyReadonlyField): string;

    /**
     * Rules that currently apply to a field, including ones added after the form was created (server constraints,
     * `registry.merge()`, `addRules()`), which Signal Forms metadata does not carry. Reactive.
     */
    rules($field: AnyReadonlyField): ReadonlyArray<ValidationRule>;

    /** Whether a rule of `$kind` (rule name, e.g. `'required'`) currently applies to a field. Reactive. */
    hasRule($field: AnyReadonlyField, $kind: string): boolean;

    /** Combined `required` / length / limit / pattern constraints of `rules($field)`. Reactive. */
    constraints($field: AnyReadonlyField): RuleMetadata;

    /**
     * Whether a field is required by metadata (any `required` validator) or by a rule added later. Use it for the
     * asterisk: `@if (form.isRequired(form.fields.email)) { * }`. Reactive.
     */
    isRequired($field: AnyReadonlyField): boolean;

    /** Resets values (optional), touched/dirty state and pushed errors. */
    reset($value?: T): void;
}

let formCounter = 0;

/**
 * Creates a Signal Forms form with rule templates, pushed (server) errors and submit handling.
 *
 * @example
 * const model = signal({email: '', password: ''});
 * const login = ngxForm(model, p => { applyRules(p.email, [new RequiredRule(), new EmailRule()]); }, {name: 'Login'});
 */
export function ngxForm<T>(
    $model: WritableSignal<T>,
    $schema?: SchemaOrSchemaFn<T> | null,
    $options: NgxFormOptions<T> = {},
): NgxForm<T> {
    if (!$options.injector) {
        assertInInjectionContext(ngxForm);
    }
    const injector = $options.injector ?? inject(Injector);
    const registry = injector.get(RuleRegistry);
    const skipRules = [...(injector.get(NGX_FORMS_SKIP_RULES, null, {optional: true}) ?? []), ...($options.skipRules ?? [])];
    const name = $options.name ?? `ngx-form-${++formCounter}`;
    const templateName = $options.template === false ? null : ($options.template ?? $options.name ?? null);

    const busy = signal(false);
    const localTemplate = signal<RuleTemplate>({});
    const store = new FieldErrorStore($model);

    const fields = form($model, ((p: SchemaPath<T>) => {
        runInSchemaContext({rootPath: p, registry, skipRules}, () => {
            if ($schema) {
                apply(p, $schema as any);
            }
            if (templateName) {
                bindTemplate(p, templateName);
            }
            bindTemplate(p, localTemplate, {mode: 'dynamic'});
            bindErrorStore(p, store);
            if ($options.disableWhileSubmitting !== false) {
                disabled(p, {when: () => busy() ? 'Submitting' : false});
            }
        });
    }) as SchemaOrSchemaFn<T>, {name, injector});
    const anyFields = fields as unknown as FieldTree<any>;

    // Drop changed `on-change` errors for good (validation already hides them; this keeps them from coming back).
    effect(() => {
        $model();
        store.active();
        untracked(() => store.prune());
    }, {injector});

    const applyServerError = ($error: unknown): ParsedServerError => {
        const parsed = parseServerError($error, $options.serverErrors);
        const root = untracked($model);

        const byPath = new Map<string, Array<string>>();
        for (const fieldError of parsed.fieldErrors) {
            byPath.set(fieldError.path, [...(byPath.get(fieldError.path) ?? []), fieldError.message]);
        }
        for (const [path, messages] of byPath) {
            const value = valueAt(root, splitPath(path));
            store.push(path, 'server', messages.map($ => ruleError('server', value, $)), {stale: 'on-change'});
        }

        for (const constraint of parsed.constraints) {
            if (constraint.context) {
                if (templateName && constraint.context !== templateName) {
                    console.warn(`Received constraint for "${constraint.context}" template inside "${templateName}" form. Might be an error!`);
                }
                registry.merge(constraint.context, constraint.path, [constraint.rule], 'replace-kind');
            } else {
                addRules(constraint.path, [constraint.rule]);
            }
        }

        for (const unknown of parsed.unknownConstraints) {
            console.warn(`Unknown "${unknown.type}" constraint type, register it with registerRuleFactory().`);
        }

        if (parsed.formErrors.length > 0) {
            store.pushForm(...parsed.formErrors);
        }
        return parsed;
    };

    const addRules = ($path: string, $rules: RuleTemplate[string]): void => {
        const path = normalizePath($path);
        localTemplate.update($ => ({...$, [path]: mergeRules($[path] ?? [], $rules, 'replace-kind')}));
    };

    const ngx: NgxForm<T> = {
        fields,
        model: $model,
        name,
        errors: store,
        localTemplate: localTemplate.asReadonly(),
        submitting: computed(() => busy() || anyFields().submitting()),

        async submit($action?: SubmitAction<any>, $submitOptions: NgxSubmitOptions<T> = {}): Promise<boolean> {
            const action: SubmitAction<any> | undefined = $action ?? $options.action;
            if (!action) {
                throw new Error(`ngxForm "${name}": no submit action. Pass one to submit() or to ngxForm({action}).`);
            }
            if (untracked(busy)) {
                return false;
            }
            const target = ($submitOptions.field ?? anyFields) as FieldTree<any>;
            store.clearStale('on-submit');
            store.clearForm();

            let failed = false;
            const submitted = await submit(target, {
                ignoreValidators: $submitOptions.ignoreValidators ?? 'none',
                action: async () => {
                    busy.set(true);
                    try {
                        const result = action(untracked(() => target().value()));
                        if (isObservable(result)) {
                            await lastValueFrom(result, {defaultValue: undefined});
                        } else {
                            await result;
                        }
                    } catch (e) {
                        failed = true;
                        applyServerError(e);
                    } finally {
                        busy.set(false);
                    }
                    return null;
                },
                onInvalid: () => {
                    if ($submitOptions.onInvalid) {
                        $submitOptions.onInvalid();
                    } else {
                        focusFirstInvalid(target);
                    }
                },
            });
            return submitted && !failed;
        },

        applyServerError,
        addRules,

        pathOf($field: AnyReadonlyField): string {
            const fieldName = untracked(() => $field().name());
            return fieldName === name ? '' : fieldName.startsWith(name + '.') ? fieldName.substring(name.length + 1) : fieldName;
        },

        rules: $field => rulesOf(anyFields, $field),
        hasRule: ($field, $kind) => hasRule(anyFields, $field, $kind),
        constraints: $field => constraintsOf(anyFields, $field),
        isRequired: $field => $field().required() || !!constraintsOf(anyFields, $field).required,

        reset($value?: T): void {
            untracked(() => anyFields().reset($value));
            store.reset();
        },
    };
    return ngx;
}

/** Focuses (and scrolls to) the first invalid bound control in DOM order. */
export function focusFirstInvalid($field: AnyReadonlyField): boolean {
    const first = untracked(() => $field().errorSummary())[0];
    if (!first) {
        return false;
    }
    untracked(() => first.fieldTree().focusBoundControl({preventScroll: false}));
    return true;
}

/** Disables a path (and its children) while `ngxForm` submit runs; included by default in `ngxForm()`. */
export function disableWhile($path: SchemaPath<any>, $condition: () => boolean, $reason: string = 'Submitting'): void {
    disabled($path, {when: () => $condition() ? $reason : false});
}
