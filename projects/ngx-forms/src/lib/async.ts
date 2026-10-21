import {computed, effect, EffectRef, signal, Signal, untracked} from '@angular/core';
import {isObservable, Observable, Subscription} from 'rxjs';
import type {FieldContext} from './schema';
import type {FieldError, ValidationResult} from './types';
import type {FieldNode} from './node';
import {deepEqual} from './util';

export interface AsyncValidatorOptions<T, P, R> {
    /**
     * Request parameters; `undefined` means "nothing to check" (no request, no errors). A new request starts when
     * the params change (deep compare); the previous one is aborted.
     */
    readonly params: ($ctx: FieldContext<T>) => P | undefined;
    /**
     * Performs the check. A Promise gives one result; an Observable may emit several (each replaces the previous
     * errors), e.g. a server pushing progress. Use `signal` to cancel your own work.
     */
    readonly run: ($params: P, $options: { readonly signal: AbortSignal }) => Promise<R> | Observable<R> | R;
    /** Turns a result into errors for the field. */
    readonly onSuccess: ($result: R, $ctx: FieldContext<T>) => ValidationResult;
    /** Turns a failure into errors. Default: one `{kind: 'asyncError'}` error. */
    readonly onError?: ($error: unknown, $ctx: FieldContext<T>) => ValidationResult;
    /** Waits this long after the last params change before running. */
    readonly debounce?: number;
    /**
     * When the check may run:
     * - `valid` (default): the field has no sync errors of its own (validators, tree errors, parse errors);
     * - `treeValid`: neither the field nor its descendants have sync errors;
     * - `always`.
     */
    readonly runWhen?: 'valid' | 'treeValid' | 'always';
}

interface Request {
    readonly params: unknown;
    readonly reload: number;
}

interface Result {
    readonly request: Request;
    readonly errors: ReadonlyArray<FieldError>;
}

const NONE: unique symbol = Symbol('none');

/** @internal One async validator on one field. */
export class AsyncRunner {
    protected readonly reload = signal(0);
    protected readonly result = signal<Result | null>(null);
    protected readonly request: Signal<Request | null>;
    protected readonly ref: EffectRef;

    public readonly pending: Signal<boolean>;
    public readonly errors: Signal<ReadonlyArray<FieldError>>;

    public constructor(
        protected readonly node: FieldNode,
        protected readonly options: AsyncValidatorOptions<any, any, any>,
        protected readonly ctx: FieldContext<any>,
        $active: () => boolean,
    ) {
        const params = computed(() => {
            if (!node.attached() || node.skipped() || !$active()) {
                return NONE;
            }
            const gate = options.runWhen ?? 'valid';
            if (gate === 'valid' && node.syncErrors().length > 0 || gate === 'treeValid' && !node.syncTreeValid()) {
                return NONE;
            }
            const value = options.params(ctx);
            return value === undefined ? NONE : value;
        }, {equal: deepEqual});

        this.request = computed(() => {
            const value = params();
            return value === NONE ? null : {params: value, reload: this.reload()};
        });

        const matches = ($result: Result | null, $request: Request | null): boolean => !!$result && !!$request
            && $result.request.reload === $request.reload
            && deepEqual($result.request.params, $request.params);

        this.pending = computed(() => {
            const request = this.request();
            return request !== null && !matches(this.result(), request);
        });
        // Results for older params are never shown: they are either replaced or dropped.
        this.errors = computed(() => {
            const result = this.result();
            return matches(result, this.request()) ? result!.errors : [];
        });

        this.ref = untracked(() => effect($onCleanup => {
            const request = this.request();
            if (!request) {
                return;
            }
            const controller = new AbortController();
            $onCleanup(() => controller.abort());
            untracked(() => this.start(request, controller.signal));
        }, {injector: node.form.injector}));
    }

    public reloadValidation(): void {
        this.reload.update($ => $ + 1);
    }

    public destroy(): void {
        this.ref.destroy();
    }

    protected async start($request: Request, $signal: AbortSignal): Promise<void> {
        const delay = this.options.debounce ?? 0;
        if (delay > 0) {
            const waited = await new Promise<boolean>($resolve => {
                const timer = setTimeout(() => $resolve(true), delay);
                $signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    $resolve(false);
                }, {once: true});
            });
            if (!waited) {
                return;
            }
        }
        let subscription: Subscription | null = null;
        try {
            const output = this.options.run($request.params, {signal: $signal});
            if (isObservable(output)) {
                let emitted = false;
                subscription = output.subscribe({
                    next: $value => {
                        emitted = true;
                        this.apply($request, $signal, () => this.options.onSuccess($value, this.ctx));
                    },
                    error: $error => this.fail($request, $signal, $error),
                    complete: () => {
                        if (!emitted) {
                            this.apply($request, $signal, () => null);
                        }
                    },
                });
                $signal.addEventListener('abort', () => subscription?.unsubscribe(), {once: true});
                return;
            }
            const value = await output;
            this.apply($request, $signal, () => this.options.onSuccess(value, this.ctx));
        } catch (e) {
            this.fail($request, $signal, e);
        }
    }

    protected fail($request: Request, $signal: AbortSignal, $error: unknown): void {
        this.apply($request, $signal, () => this.options.onError
            ? this.options.onError($error, this.ctx)
            : {kind: 'asyncError', message: $error instanceof Error ? $error.message : String($error)});
    }

    protected apply($request: Request, $signal: AbortSignal, $errors: () => ValidationResult): void {
        if ($signal.aborted) {
            return;
        }
        const errors = untracked(() => this.node.toFieldErrors($errors(), 'async'));
        this.result.set({request: $request, errors});
    }
}
