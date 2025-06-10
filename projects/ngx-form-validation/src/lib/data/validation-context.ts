import {InjectionToken} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {distinctUntilChanged, map} from 'rxjs/operators';
import {ValidationRule} from '../rules/rules';

export const VALIDATION_CONTEXTS = new InjectionToken<Array<ValidationContext>>('VALIDATION_CONTEXTS');

export class ValidationContextField {

    public readonly rules$: Observable<ReadonlyArray<ValidationRule>>;

    protected readonly internalRules$;

    public constructor(
        public readonly name: string | null = null,
        $rules: ReadonlyArray<ValidationRule> = [],
    ) {
        this.internalRules$ = new BehaviorSubject($rules);
        this.rules$ = this.internalRules$.asObservable();
    }

    public swapRules($value: ReadonlyArray<ValidationRule>): void {
        this.internalRules$.next($value);
    }

    public addRule($rule: ValidationRule): void {
        this.internalRules$.next([...this.internalRules$.value, $rule]);
    }

    public removeRule($rule: ValidationRule): void {
        const index = this.internalRules$.value.indexOf($rule);
        if (index > -1) {
            this.internalRules$.next(
                [...this.internalRules$.value.slice(0, index), ...this.internalRules$.value.slice(index + 1)],
            );
        }
    }

    public clean(): void {
        this.internalRules$.next([]);
    }

    public get rulesSnapshot(): ReadonlyArray<ValidationRule> {
        return this.internalRules$.value;
    }
}

export class ValidationContext {

    public readonly fields$: Observable<Record<string, ValidationContextField>>;

    protected readonly internalFields$: BehaviorSubject<Record<string, ValidationContextField>>;

    constructor(
        public readonly name: string | null = null,
        $fields: Record<string, ValidationContextField> = {},
    ) {
        this.internalFields$ = new BehaviorSubject($fields);
        this.fields$ = this.internalFields$.asObservable();
    }

    public swapFields($value: Record<string, ValidationContextField>): void {
        this.internalFields$.next($value);
    }

    public changeField($name: string, $value: ValidationContextField): void {
        this.internalFields$.next({
            ...this.internalFields$.value,
            [$name]: $value,
        });
    }

    public removeField($name: string): void {
        if ($name in this.internalFields$.value) {
            const newFields = {...this.internalFields$.value};
            delete newFields[$name];
            this.internalFields$.next(newFields);
        }
    }

    public clean(): void {
        this.internalFields$.next({});
    }

    public getFieldSnapshot($name: string): ValidationContextField | null {
        return this.internalFields$.value[$name] || null;
    }

    public getField$($name: string): Observable<ValidationContextField> {
        return this.fields$.pipe(
            map($ => $[$name]),
            distinctUntilChanged(),
        );
    }
}

export class ValidationContextWithMetadata<T extends Record<string, any>> extends ValidationContext {
    protected readonly internalMetadata$: BehaviorSubject<T>;

    public readonly metadata$: Observable<T>;

    constructor(
        $name: string | null = null,
        $metadata: T,
        $fields?: Record<string, ValidationContextField>,
    ) {
        super($name, $fields);
        this.internalMetadata$ = new BehaviorSubject($metadata);
        this.metadata$ = this.internalMetadata$.asObservable();
    }

    public getMetadataSnapshot(): T {
        return this.internalMetadata$.value;
    }

    public setMetadata($metadata: T): void {
        this.internalMetadata$.next($metadata);
    }
}
