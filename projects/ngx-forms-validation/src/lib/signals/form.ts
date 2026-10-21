import {
    assertInInjectionContext,
    computed,
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
    SchemaFn,
    SchemaPath,
    submit as submitField,
    SubmitErrors,
} from '@such-code/ngx-forms';
import {isObservable, lastValueFrom, Observable} from 'rxjs';
import {mergeRules, RuleRegistry, RuleTemplate} from '../core/registry';
import {ParsedServerError, parseServerError, ParseServerErrorOptions} from '../core/server-error';
import {ruleError, RuleMetadata, ValidationRule} from '../core/rules';
import {normalizePath, splitPath, valueAt} from '../core/path';
import {bindTemplate} from './rules';
import {FieldErrorStore} from './error-store';
import {runInSchemaContext} from './schema-context';
import {AnyField} from './field-tree';
import {constraintsOf, hasRule, rulesOf} from './rule-lookup';

/** Default rule kinds skipped by every `ngxForm()` below this provider (was `VALIDATION_SKIP_DEFAULT_RULES`). */
export const NGX_FORMS_SKIP_RULES = new InjectionToken<ReadonlyArray<string>>('NGX_FORMS_SKIP_RULES');

export type NgxSubmitAction<T> = ($value: T) => Promise<unknown> | Observable<unknown> | unknown;

export interface NgxSubmitOptions<T> {
    /** Field to submit (wizard step, sub form); defaults to the whole form. */
    readonly field?: AnyField;
    /** Wait for pending async validation before deciding. Default `true`. */
    readonly awaitPending?: boolean;
    /** Run the action even when the field is invalid. Default `false`. */
    readonly ignoreValidators?: boolean;
    /** Called instead of the action when the submitted field is invalid. Default focuses the first invalid control. */
    readonly onInvalid?: () => void;
}

export interface NgxFormOptions<T> {
    /** Form name: used for the rule template lookup and as base of field names (`name` attributes). */
    readonly name?: string;
    /** Template to bind; defaults to `name`. `false` disables template lookup. */
    readonly template?: string | false;
    /** Rule kinds skipped for every field. Merged with `NGX_FORMS_SKIP_RULES`. */
    readonly skipRules?: ReadonlyArray<string>;
    /**
     * Lock bound controls while the submit action runs. Default `true`. Unlike v22.0 this no longer disables the
     * fields, so validation keeps running and server errors show up right away.
     */
    readonly lockWhileSubmitting?: boolean;
    /** @deprecated Use `lockWhileSubmitting`. `true` now really disables fields (and their validation) while submitting. */
    readonly disableWhileSubmitting?: boolean;
    /** Default submit action used by `submit()` and the `[ngxForm]` directive. */
    readonly action?: NgxSubmitAction<T>;
    /** Options for `parseServerError()`, e.g. `{pathPrefixes: ['body.']}`. */
    readonly serverErrors?: ParseServerErrorOptions;
    readonly injector?: Injector;
}

export interface NgxForm<T> {
    /** Field tree; bind with `[ngxField]="form.fields.x"`. */
    readonly fields: FieldTree<T>;
    readonly model: WritableSignal<T>;
    readonly name: string;
    /** Pushed field errors (by path) and form-level errors. */
    readonly errors: FieldErrorStore;
    /** Rules added by server constraints without a template context; apply to this form only. */
    readonly localTemplate: Signal<RuleTemplate>;
    /** `true` while a submit runs. */
    readonly submitting: Signal<boolean>;

    /** Validates `field` (default: whole form), runs the action when valid, applies server errors when it fails. */
    submit($action?: NgxSubmitAction<any>, $options?: NgxSubmitOptions<T>): Promise<boolean>;

    /** Applies an error thrown outside `submit()` (was `ErrorObservingService.observeOn`). */
    applyServerError($error: unknown): ParsedServerError;

    /** Adds form-local rules (as server constraints without context do). */
    addRules($path: string, $rules: RuleTemplate[string]): void;

    /** Dotted path of a field relative to the form root. */
    pathOf($field: AnyField): string;

    /** Library rules that currently apply to a field, including ones added after the form was created. Reactive. */
    rules($field: AnyField): ReadonlyArray<ValidationRule>;

    /** Whether a rule of `$kind` (rule name, e.g. `'required'`) currently applies to a field. Reactive. */
    hasRule($field: AnyField, $kind: string): boolean;

    /** Combined `required` / length / limit / pattern constraints of `rules($field)`. Reactive. */
    constraints($field: AnyField): RuleMetadata;

    /**
     * @deprecated Rules added later now set metadata too: use `field().required()`.
     */
    isRequired($field: AnyField): boolean;

    /** Resets values (optional), touched/dirty state, pushed errors and form errors. */
    reset($value?: T): void;
}

let formCounter = 0;

/**
 * Creates a form with rule templates, pushed (server) errors and submit handling.
 *
 * @example
 * const model = signal({email: '', password: ''});
 * const login = ngxForm(model, p => { applyRules(p.email, [new RequiredRule(), new EmailRule()]); }, {name: 'Login'});
 */
export function ngxForm<T>(
    $model: WritableSignal<T>,
    $schema?: SchemaFn<T> | null,
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

    const localTemplate = signal<RuleTemplate>({});

    const fields = form($model, ((p: SchemaPath<T>) => {
        runInSchemaContext({rootPath: p, registry, skipRules}, () => {
            if ($schema) {
                apply(p, $schema);
            }
            if (templateName) {
                bindTemplate(p, templateName);
            }
            bindTemplate(p, localTemplate);
            if ($options.disableWhileSubmitting === true) {
                disabled(p, ctx => ctx.state.submitting() ? 'Submitting' : false);
            }
        });
    }) as SchemaFn<T>, {
        name,
        injector,
        lockWhileSubmitting: $options.lockWhileSubmitting ?? $options.disableWhileSubmitting ?? true,
    });
    const anyFields = fields as unknown as FieldTree<unknown>;
    const store = new FieldErrorStore(anyFields);

    const addRules = ($path: string, $rules: RuleTemplate[string]): void => {
        const path = normalizePath($path);
        localTemplate.update($ => ({...$, [path]: mergeRules($[path] ?? [], $rules, 'replace-kind')}));
    };

    /** Constraints and form errors go where they belong; field errors are returned for the caller to attach. */
    const distribute = ($error: unknown): ParsedServerError => {
        const parsed = parseServerError($error, $options.serverErrors);
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

    const applyServerError = ($error: unknown): ParsedServerError => {
        const parsed = distribute($error);
        const byPath = new Map<string, Array<string>>();
        for (const fieldError of parsed.fieldErrors) {
            byPath.set(fieldError.path, [...(byPath.get(fieldError.path) ?? []), fieldError.message]);
        }
        for (const [path, messages] of byPath) {
            store.push(path, 'server', messages, {stale: 'on-change'});
        }
        return parsed;
    };

    return {
        fields,
        model: $model,
        name,
        errors: store,
        localTemplate: localTemplate.asReadonly(),
        submitting: computed(() => anyFields().submitting()),

        async submit($action?: NgxSubmitAction<any>, $submitOptions: NgxSubmitOptions<T> = {}): Promise<boolean> {
            const action: NgxSubmitAction<any> | undefined = $action ?? $options.action;
            if (!action) {
                throw new Error(`ngxForm "${name}": no submit action. Pass one to submit() or to ngxForm({action}).`);
            }
            const target = ($submitOptions.field ?? anyFields) as FieldTree<unknown>;
            if (untracked(() => target().submitting())) {
                return false;
            }
            store.clearForm();
            return submitField(target, {
                awaitPending: $submitOptions.awaitPending,
                ignoreValidators: $submitOptions.ignoreValidators,
                onInvalid: $submitOptions.onInvalid ? () => $submitOptions.onInvalid!() : undefined,
                action: async ($value: unknown) => {
                    const result = action($value);
                    if (isObservable(result)) {
                        await lastValueFrom(result, {defaultValue: undefined});
                    } else {
                        await result;
                    }
                },
                // Server field errors come back as submit errors: dropped for fields edited while the request ran,
                // cleared when the field changes or on the next submit.
                onError: ($error: unknown): SubmitErrors => {
                    const parsed = distribute($error);
                    const prefix = untracked(() => target().pathKey());
                    return parsed.fieldErrors.map($ => {
                        const path = prefix && $.path.startsWith(prefix + '.') ? $.path.substring(prefix.length + 1) : $.path;
                        const value = valueAt(untracked(() => target().value()), splitPath(path));
                        return {...ruleError('server', value, $.message), path};
                    });
                },
            });
        },

        applyServerError,
        addRules,

        pathOf: $field => untracked(() => $field().pathKey()),
        rules: $field => rulesOf($field),
        hasRule: ($field, $kind) => hasRule($field, $kind),
        constraints: $field => constraintsOf($field),
        isRequired: $field => $field().required() || !!constraintsOf($field).required,

        reset($value?: T): void {
            untracked(() => anyFields().reset($value));
            store.clearForm();
        },
    };
}

/** Disables a path (and its children) while a condition holds; disabled fields are not validated. */
export function disableWhile($path: SchemaPath<any>, $condition: () => boolean, $reason: string = 'Submitting'): void {
    disabled($path, () => $condition() ? $reason : false);
}
