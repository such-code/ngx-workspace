import {inject, Injectable, InjectionToken, Injector, signal} from '@angular/core';
import {Observable, of} from 'rxjs';
import {distinctUntilChanged, map, switchMap} from 'rxjs/operators';
import {ValidationContext, ValidationContextField} from '../data/validation-context';
import {VALIDATION_CONFIGURATION} from '../types';
import {toObservable} from '@angular/core/rxjs-interop';

/**
 * The only thing this service does - it stores a list of all global validation contexts.
 */
@Injectable({providedIn: 'root'})
export class ValidationService {

    public readonly contexts$: Observable<Record<string, ValidationContext>>;

    protected readonly configurations = inject(VALIDATION_CONFIGURATION, {optional: true});
    protected readonly existingValidationService = inject(ValidationService, {optional: true, skipSelf: true});
    protected readonly injector = inject(Injector);

    protected readonly contexts = signal<Record<string, ValidationContext>>({});

    public constructor() {
        this.contexts$ = toObservable(this.contexts).pipe(
            distinctUntilChanged(),
        );

        if (Array.isArray(this.configurations)) {
            for (const configRecord of this.configurations) {
                const config = configRecord instanceof InjectionToken ? this.injector.get(configRecord) : configRecord;
                for (const contextName of Object.keys(config)) {
                    const context = this.getContextSnapshot(contextName) || new ValidationContext(contextName);
                    for (const fieldName of Object.keys(config[contextName])) {
                        const field = context.getFieldSnapshot(fieldName) || new ValidationContextField(fieldName);
                        for (const rule of config[contextName][fieldName]) {
                            field.addRule(rule);
                        }
                        context.changeField(fieldName, field);
                    }
                    this.changeContext(contextName, context);
                }
            }
        }
    }

    public getContext$($name: string, $inheritContext: boolean = true): Observable<ValidationContext | null> {
        const context$ = this.contexts$.pipe(
            map($ => $[$name] || null),
            distinctUntilChanged(),
        );

        // In case the local context is not present, then try to return the parent context if there are multiple
        // instances of ValidationService.
        if ($inheritContext && !!this.existingValidationService) {
            return context$.pipe(
                switchMap($context => {
                    if (!$context) {
                        return this.existingValidationService!.getContext$($name, true);
                    }
                    return of($context);
                }),
            );
        }

        return context$;
    }

    public getContextSnapshot($name: string): ValidationContext | null {
        return this.contexts()[$name] || null;
    }

    public changeContext($name: string, $context: ValidationContext): void {
        this.contexts.update($contexts => {
            return {
                ...$contexts,
                [$name]: $context,
            };
        });
    }

    public removeContext($name: string): void {
        this.contexts.update($contexts => {
            if ($name in $contexts) {
                const newContexts = {...$contexts};
                delete newContexts[$name];
                return newContexts;
            }
            return $contexts;
        });
    }

    public get rootValidationService(): ValidationService {
        return this.existingValidationService
            ? this.existingValidationService.rootValidationService
            : this;
    }
}
