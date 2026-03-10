import {InjectionToken, Injector} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {distinctUntilChanged, map} from 'rxjs/operators';
import {ValidationRule} from '../rules/rules';
import {escapeRegExp} from '../util/text-utils';

export const VALIDATION_CONTEXTS = new InjectionToken<Array<ValidationContext>>('VALIDATION_CONTEXTS');

/**
 * Helper function that collects ALL validation contexts from the entire injector hierarchy.
 * Starts from the provided injector and walks up the parent chain.
 * Stops when no more contexts are found to optimize performance.
 *
 * @param injector - The injector to start collecting contexts from (usually the component's injector)
 * @returns Array of all validation contexts from the hierarchy
 */
export function collectAllValidationContexts(injector: Injector): Array<ValidationContext> {
    const allContexts: Array<ValidationContext> = [];

    // Collect contexts from current level and all parent levels
    let currentInjector: Injector | null = injector;

    while (currentInjector) {
        const contexts = currentInjector.get(VALIDATION_CONTEXTS, null, {optional: true});

        if (contexts && Array.isArray(contexts)) {
            // Add all contexts from this level
            allContexts.push(...contexts);
        } else {
            // No contexts found at this level, stop to save resources
            break;
        }

        // Move to parent injector
        const parentInjector: Injector | null = currentInjector.get(Injector, null, {skipSelf: true, optional: true});

        // Check if we reached the root or if parent is the same (avoid infinite loop)
        if (!parentInjector || parentInjector === currentInjector) {
            break;
        }

        currentInjector = parentInjector;
    }

    return allContexts;
}

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
const globNameRegExp = /(^|\.)\*($|\.)/g;

function nameToGlobRegExp($name: string): RegExp {
    return new RegExp(`^${escapeRegExp($name).replace('\\*', '[^\\.]+')}$`);
}

type ContextsFieldsState = {
    hasGlobs: boolean,
    fields: Record<string, ValidationContextField>,
    globsMap: Map<RegExp, string>,
}

function createContextsFieldsState($fields: Record<string, ValidationContextField>): ContextsFieldsState {
    const globsMap = new Map<RegExp, string>(Object.keys($fields).reduce((acc, fieldName) => {
        if (globNameRegExp.test(fieldName)) {
            return [...acc, [nameToGlobRegExp(fieldName), fieldName]];
        }
        return acc;
    }, <Array<[RegExp, string]>>[]));
    const hasGlobs = globsMap.size > 0;
    return {
        hasGlobs,
        fields: $fields,
        globsMap,
    };
}

function wrapContextsFieldsState($fields: Record<string, ValidationContextField>): ContextsFieldsState {
    return {
        hasGlobs: false,
        fields: $fields,
        globsMap: new Map<RegExp, string>(),
    }
}

export class ValidationContext {

    public readonly fields$: Observable<Record<string, ValidationContextField>>;

    protected readonly internalFields$: BehaviorSubject<ContextsFieldsState>;

    constructor(
        public readonly name: string | null = null,
        $fields: Record<string, ValidationContextField> = {},
        protected readonly skipGlobs: boolean = true,
    ) {
        this.internalFields$ = new BehaviorSubject(
            skipGlobs ? wrapContextsFieldsState($fields) : createContextsFieldsState($fields)
        );
        this.fields$ = this.internalFields$.pipe(
            map($ => $.fields)
        );
    }

    public swapFields($value: Record<string, ValidationContextField>): void {
        this.internalFields$.next(
            this.skipGlobs ? wrapContextsFieldsState($value) : createContextsFieldsState($value)
        );
    }

    public changeField($name: string, $value: ValidationContextField): void {
        const glob = $name.match(globNameRegExp)
            ? nameToGlobRegExp($name)
            : null;
        if (!!glob) {
            this.internalFields$.next({
                hasGlobs: true,
                fields: {
                    ...this.internalFields$.value.fields,
                    [$name]: $value,
                },
                globsMap: new Map([...this.internalFields$.value.globsMap.entries(), [glob, $name]]),
            });
        } else {
            this.internalFields$.next({
                ...this.internalFields$.value,
                fields: {
                    ...this.internalFields$.value.fields,
                    [$name]: $value,
                },
            });
        }
    }

    public removeField($name: string): void {
        if ($name in this.internalFields$.value.fields) {
            const newFields = {...this.internalFields$.value.fields};
            delete newFields[$name];
            const glob = $name.match(globNameRegExp)
                ? nameToGlobRegExp($name)
                : null;
            if (!!glob) {
                const globsMap = new Map(Array.from(this.internalFields$.value.globsMap.entries()).filter(([_, $]) => $ !== $name));
                this.internalFields$.next({
                    hasGlobs: globsMap.size > 0,
                    fields: newFields,
                    globsMap,
                });
            } else {
                this.internalFields$.next({
                    ...this.internalFields$.value,
                    fields: newFields,
                });
            }
        }
    }

    public clean(): void {
        this.internalFields$.next(wrapContextsFieldsState({}));
    }

    public getFieldSnapshot($name: string): ValidationContextField | null {
        return this.internalFields$.value.fields[$name] || null;
    }

    public getField$($name: string): Observable<ValidationContextField | null> {
        return this.internalFields$.pipe(
            map($contextFields => {
                if (!($name in $contextFields.fields) && $contextFields.hasGlobs) {
                    for (const [regExp, fieldName] of $contextFields.globsMap) {
                        if (regExp.test($name)) {
                            return $contextFields.fields[fieldName];
                        }
                    }
                }
                return $contextFields.fields[$name] || null;
            }),
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
        super($name, $fields, false);
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
