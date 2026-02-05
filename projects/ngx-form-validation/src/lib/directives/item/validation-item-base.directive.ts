import {DestroyRef, Directive, inject, Injector, input, OnInit, signal} from '@angular/core';
import {AbstractControl, ControlContainer, ValidationErrors, Validator} from '@angular/forms';
import {combineLatest, Observable, of} from 'rxjs';
import {distinctUntilChanged, map, switchMap} from 'rxjs/operators';
import {ValidationRule} from '../../rules/rules';
import {collectAllValidationContexts, ValidationContext} from '../../data/validation-context';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {VALIDATION_SKIP_DEFAULT_RULES} from '../../types';

@Directive({})
export abstract class ValidationItemBaseDirective implements Validator, OnInit {

    public readonly skipValidation = input<boolean>(false);
    public readonly skipRules = input<Array<string> | null>(null);

    protected readonly controlContainer: ControlContainer | null = inject(ControlContainer, {optional: true, skipSelf: true});
    protected readonly defaultSkipRules: Array<string> | null = inject(VALIDATION_SKIP_DEFAULT_RULES, {
        skipSelf: true,
        optional: true,
    });
    protected readonly destroyRef = inject(DestroyRef);
    protected readonly injector = inject(Injector);

    // Collect all validation contexts from the entire injector hierarchy
    protected readonly validationContexts: Array<ValidationContext> = collectAllValidationContexts(this.injector);

    protected readonly rules = signal<ReadonlyArray<ValidationRule> | null>(null);

    public ngOnInit(): void {
        const skipRules$ = toObservable(this.skipRules, {injector: this.injector}).pipe(
            map(($rules) => {
                return Array.isArray($rules)
                    ? $rules
                    : this.defaultSkipRules;
            }),
        );

        toObservable(this.skipValidation, {injector: this.injector}).pipe(
            distinctUntilChanged(),
            switchMap($ => {
                if (!$) {
                    return this.provideName$().pipe(
                        map($name => {
                            if ($name && this.controlContainer && Array.isArray(this.controlContainer.path)) {
                                return [...this.controlContainer.path, $name].join('.');
                            }
                            return null;
                        }),
                        switchMap($name => {
                            if (typeof $name === 'string') {
                                return combineLatest([
                                    skipRules$,
                                    ...this.validationContexts.map($context => {
                                        return $context.getField$($name).pipe(
                                            switchMap($contextField => {
                                                if ($contextField) {
                                                    return $contextField.rules$;
                                                }
                                                return of([]);
                                            }),
                                        );
                                    }),
                                ]).pipe(
                                    map(([$skipRules, ...$rulesCollection]: [Array<string> | null, ...Array<ReadonlyArray<ValidationRule>>]): Array<ValidationRule> => {
                                        return $rulesCollection.filter(
                                            ($rules: ReadonlyArray<ValidationRule>): boolean => {
                                                return Array.isArray($rules) && $rules.length > 0;
                                            },
                                        ).reduce<Array<ValidationRule>>(
                                            ($acc: Array<ValidationRule>, $value: ReadonlyArray<ValidationRule>) => {
                                                return $acc.concat($value);
                                            },
                                            [],
                                        ).filter(($rule): boolean => {
                                            if (Array.isArray($skipRules) && $skipRules.length > 0) {
                                                return $skipRules.indexOf($rule.name) < 0;
                                            }
                                            return true;
                                        });
                                    }),
                                    map(($rules: Array<ValidationRule>) => {
                                        if ($rules !== undefined && $rules.length > 0) {
                                            return $rules;
                                        }
                                        return null;
                                    }),
                                );
                            }
                            return of(null);
                        }),
                    );
                }
                return of(null);
            }),
            takeUntilDestroyed(this.destroyRef),
        ).subscribe($ => {
            this.rules.set($);
        });
    }

    public validate($control: AbstractControl): ValidationErrors | null {
        let errors: ValidationErrors | null = null;
        const rules: ReadonlyArray<ValidationRule> | null = this.rules();
        if (Array.isArray(rules)) {
            for (let rule of rules) {
                if (!rule) {
                    console.warn(this.constructUnexpectedWarn());
                } else {
                    const error: ValidationErrors | null = rule.validator($control);
                    if (error) {
                        errors = {
                            ...(errors || {}),
                            ...error,
                        };
                    }
                }
            }
        }
        return errors;
    }

    protected abstract provideName$(): Observable<string | null>;

    protected abstract constructUnexpectedWarn(): string;
}
