import {Directive, inject, InjectionToken, input} from '@angular/core';
import {of} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';
import {ValidationService} from '../../services/validation.service';
import {ValidationContextWithMetadata} from '../../data/validation-context';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';

export const VALIDATION_CONTEXT_REFLECTION = new InjectionToken<ValidationContextWithMetadata<ValidationContextReflectionMetadata>>('VALIDATION_CONTEXT_REFLECTION');

export type ValidationContextReflectionMetadata = {
    reflectedName: string | null,
}

export function isValidationContextReflectionMetadata($: any): $ is ValidationContextReflectionMetadata {
    return typeof $ === 'object'
        && $ !== null
        && ($.reflectedName === null || typeof $.reflectedName === 'string');
}

export function validationContextReflectionProvider(): ValidationContextWithMetadata<ValidationContextReflectionMetadata> {
    return new ValidationContextWithMetadata<ValidationContextReflectionMetadata>(
        'reflection',
        {reflectedName: null},
    );
}

@Directive({})
export abstract class ValidationNamedContextBaseDirective {

    public readonly name = input<string | null>(null);

    protected readonly validationContextReflection = inject(VALIDATION_CONTEXT_REFLECTION, {self: true});
    protected readonly validationService = inject(ValidationService);

    public constructor() {
        toObservable(this.name).pipe(
            switchMap(($name) => {
                const emptyState = {
                    name: $name,
                    fields: null,
                };
                if (typeof $name === 'string') {
                    return this.validationService.getContext$($name).pipe(
                        switchMap($context => {
                            if ($context) {
                                return $context.fields$.pipe(
                                    map($fields => {
                                        return {...emptyState, fields: $fields};
                                    }),
                                );
                            }
                            return of(emptyState)
                        }),
                    );
                }
                return of(emptyState);
            }),
            takeUntilDestroyed(),
        ).subscribe($state => {
            this.validationContextReflection.setMetadata({reflectedName: $state.name});
            this.validationContextReflection.swapFields($state.fields || {});
        });
    }
}
