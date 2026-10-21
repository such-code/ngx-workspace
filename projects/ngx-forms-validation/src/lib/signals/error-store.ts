import {Signal, signal, untracked} from '@angular/core';
import {ErrorStaleness, fieldAt, FieldTree, ValidationError} from '@such-code/ngx-forms';
import {FormError} from '../core/server-error';
import {normalizePath, splitPath} from '../core/path';
import {ruleError, ValidationRuleError} from '../core/rules';

export type {ErrorStaleness} from '@such-code/ngx-forms';

export interface PushErrorOptions {
    readonly stale?: ErrorStaleness;
    /** The value the errors were produced for; when the field holds another value already, they are dropped. */
    readonly forValue?: unknown;
}

export type PushedError = ValidationRuleError | string | { message: string, kind?: string };

/**
 * Errors pushed into a form from outside (server responses, sockets, other forms), addressed by path, plus
 * form-level errors. Field errors are stored on the fields themselves (`field().setErrors()`), per source, so
 * pushing never removes validator errors and validation never removes pushed errors. Staleness is handled by the
 * fields: `on-change` errors go away when their field changes and do not come back.
 */
export class FieldErrorStore {

    protected readonly formErrorsState = signal<ReadonlyArray<FormError>>([]);

    /** Errors that belong to the whole form (was `ErrorCollection`). */
    public readonly formErrors: Signal<ReadonlyArray<FormError>> = this.formErrorsState.asReadonly();

    public constructor(
        protected readonly root: FieldTree<unknown>,
    ) {
    }

    /**
     * Replaces the errors of `$source` at `$path`. Returns `false` when there is no such field in the model (the
     * errors are then reported as form errors, so they are not lost).
     */
    public push($path: string, $source: string, $errors: ReadonlyArray<PushedError>, $options: PushErrorOptions = {}): boolean {
        const field = fieldAt(this.root, splitPath(normalizePath($path)));
        if (!field) {
            this.pushForm(...$errors.map($ => typeof $ === 'string' ? $ : $.message));
            return false;
        }
        const value = untracked(() => field().value());
        const errors: Array<ValidationError> = $errors.map($ => toRuleError($, $source, value));
        field().setErrors($source, errors, {
            stale: $options.stale ?? 'on-change',
            ...('forValue' in $options ? {forValue: $options.forValue} : {}),
        });
        return true;
    }

    /** Clears pushed errors of a source (all sources when omitted), at a path or in the whole form. */
    public clear($source?: string, $path?: string): void {
        const field = $path === undefined ? this.root : fieldAt(this.root, splitPath(normalizePath($path)));
        field?.().clearErrors($source, {deep: $path === undefined});
    }

    public pushForm(...$errors: ReadonlyArray<FormError | string>): void {
        const errors = $errors.map(($): FormError => typeof $ === 'string' ? {kind: 'unknown', message: $, status: null} : $);
        this.formErrorsState.update($ => [...$, ...errors.filter($error => !$.includes($error))]);
    }

    public removeForm($error: FormError): void {
        this.formErrorsState.update($ => $.filter($item => $item !== $error));
    }

    public clearForm(): void {
        this.formErrorsState.set([]);
    }

    public reset(): void {
        this.clear();
        this.clearForm();
    }
}

function toRuleError($error: PushedError, $source: string, $value: unknown): ValidationRuleError {
    if (typeof $error === 'string') {
        return ruleError($source, $value, $error);
    }
    if ('rawMessage' in $error) {
        return $error;
    }
    return ruleError($error.kind ?? $source, $value, $error.message);
}
