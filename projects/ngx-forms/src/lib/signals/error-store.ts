import {computed, Signal, signal, untracked} from '@angular/core';
import {SchemaPath, validateTree, ValidationError} from '@angular/forms/signals';
import {FormError} from '../core/server-error';
import {normalizePath, PathSegments, splitPath, valueAt} from '../core/path';
import {ruleError, ValidationRuleError} from '../core/rules';
import {maybeEquals} from '../core/compare';
import {childField} from './field-tree';

/**
 * When pushed errors stop applying:
 * - `on-change`: as soon as the field value differs from the value the error was pushed for (default for server errors);
 * - `on-submit`: on the next submit (or `clearStale('on-submit')`);
 * - `never`: only when cleared explicitly.
 */
export type ErrorStaleness = 'on-change' | 'on-submit' | 'never';

export interface PushErrorOptions {
    readonly stale?: ErrorStaleness;
}

export interface PushedFieldErrors {
    readonly path: string;
    readonly segments: PathSegments;
    readonly source: string;
    readonly errors: ReadonlyArray<ValidationRuleError>;
    readonly stale: ErrorStaleness;
    /** Field value at push time. */
    readonly snapshot: unknown;
}

export type PushedError = ValidationRuleError | string | { message: string, kind?: string };

/**
 * Errors pushed into a form from outside (server responses, sockets, other forms). Errors are kept per path and per
 * source, so pushing server errors never removes validator errors and validation never removes pushed errors.
 */
export class FieldErrorStore {

    protected readonly entries = signal<ReadonlyArray<PushedFieldErrors>>([]);
    protected readonly formErrorsState = signal<ReadonlyArray<FormError>>([]);

    /** Entries that still apply to the current model value. */
    public readonly active: Signal<ReadonlyArray<PushedFieldErrors>>;

    /** Errors that belong to the whole form (was `ErrorCollection`). */
    public readonly formErrors: Signal<ReadonlyArray<FormError>> = this.formErrorsState.asReadonly();

    public constructor(
        protected readonly model: Signal<unknown>,
    ) {
        this.active = computed(() => {
            const root = this.model();
            return this.entries().filter($ => !this.isStale($, root));
        });
    }

    public push($path: string, $source: string, $errors: ReadonlyArray<PushedError>, $options: PushErrorOptions = {}): void {
        const path = normalizePath($path);
        const segments = splitPath(path);
        const snapshot = valueAt(untracked(this.model), segments);
        const errors = $errors.map($ => toRuleError($, $source, snapshot));
        this.entries.update($entries => {
            const rest = $entries.filter($ => !($.path === path && $.source === $source));
            return errors.length > 0
                ? [...rest, {path, segments, source: $source, errors, stale: $options.stale ?? 'on-change', snapshot}]
                : rest;
        });
    }

    /** Clears by source and/or path; no arguments clears all field errors. */
    public clear($source?: string, $path?: string): void {
        const path = $path === undefined ? undefined : normalizePath($path);
        this.entries.update($entries => $entries.filter($ =>
            !(($source === undefined || $.source === $source) && (path === undefined || $.path === path)),
        ));
    }

    public clearStale($policy: ErrorStaleness): void {
        this.entries.update($entries => $entries.filter($ => $.stale !== $policy));
    }

    /** Removes `on-change` entries whose field changed, so typing the old value back does not restore the error. */
    public prune(): void {
        const root = untracked(this.model);
        const current = untracked(this.entries);
        const next = current.filter($ => !this.isStale($, root));
        if (next.length !== current.length) {
            this.entries.set(next);
        }
    }

    public errorsAt($path: string): ReadonlyArray<ValidationRuleError> {
        const path = normalizePath($path);
        return this.active().filter($ => $.path === path).flatMap($ => $.errors);
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
        this.entries.set([]);
        this.formErrorsState.set([]);
    }

    protected isStale($entry: PushedFieldErrors, $root: unknown): boolean {
        return $entry.stale === 'on-change' && !maybeEquals($entry.snapshot, valueAt($root, $entry.segments));
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

/** Connects a store to a form: pushed errors show up on their target fields. Call from a schema function. */
export function bindErrorStore($path: SchemaPath<any>, $store: FieldErrorStore): void {
    validateTree($path, ctx => {
        const entries = $store.active();
        if (entries.length === 0) {
            return undefined;
        }
        const errors: Array<ValidationError.WithOptionalFieldTree> = [];
        for (const entry of entries) {
            const target = entry.segments.length === 0 ? ctx.fieldTree : childField(ctx.fieldTree, entry.segments);
            if (target) {
                for (const error of entry.errors) {
                    errors.push({...error, fieldTree: target});
                }
            }
        }
        return errors;
    });
}
