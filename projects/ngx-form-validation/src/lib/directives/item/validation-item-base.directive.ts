import {Directive, inject, input, signal} from '@angular/core';
import {AbstractControl, ControlContainer, ValidationErrors, Validator} from '@angular/forms';
import {combineLatest, of} from 'rxjs';
import {distinctUntilChanged, map, switchMap} from 'rxjs/operators';
import {ValidationRule} from '../../rules/rules';
import {VALIDATION_CONTEXTS, ValidationContext} from '../../data/validation-context';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {VALIDATION_SKIP_DEFAULT_RULES} from '../../types';

@Directive({})
export abstract class ValidationItemBaseDirective implements Validator {

    public readonly name = input<string | null>(null);
    public readonly skipValidation = input<boolean>(false);
    public readonly skipRules = input<Array<string> | null>(null);

    protected readonly controlContainer: ControlContainer | null = inject(ControlContainer, {optional: true});
    protected readonly defaultSkipRules: Array<string> | null = inject(VALIDATION_SKIP_DEFAULT_RULES, {
        skipSelf: true,
        optional: true,
    });
    protected readonly validationContexts: Array<ValidationContext> = inject(VALIDATION_CONTEXTS, {skipSelf: true});

    protected readonly rules = signal<ReadonlyArray<ValidationRule> | null>(null);

    protected constructor() {
        const skipRules$ = toObservable(this.skipRules).pipe(
            map(($rules) => {
                return Array.isArray($rules)
                    ? $rules
                    : this.defaultSkipRules;
            }),
        );

        const name$ = toObservable(this.name).pipe(
            distinctUntilChanged(),
        );

        toObservable(this.skipValidation).pipe(
            distinctUntilChanged(),
            switchMap($ => {
                if (!$) {
                    return name$.pipe(
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
            takeUntilDestroyed(),
        ).subscribe($ => {
            this.rules.set($);
        });
    }

    protected abstract constructUnexpectedWarn(): string;

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
}
