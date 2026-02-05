import {DestroyRef, Directive, inject, InjectionToken, Injector, input, OnInit} from '@angular/core';
import {ValidationService} from '../../services/validation.service';
import {ValidationContextWithMetadata} from '../../data/validation-context';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {map, switchMap} from 'rxjs/operators';
import {of} from 'rxjs';

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
export abstract class ValidationNamedContextBaseDirective implements OnInit {

    public readonly name = input<string | null>(null);

    protected readonly destroyRef = inject(DestroyRef);
    protected readonly injector = inject(Injector);
    protected readonly validationContextReflection = inject(VALIDATION_CONTEXT_REFLECTION, {self: true});
    protected readonly validationService = inject(ValidationService);

    public ngOnInit(): void {
        toObservable(this.name, {injector: this.injector}).pipe(
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
            takeUntilDestroyed(this.destroyRef),
        ).subscribe($state => {
            this.validationContextReflection.setMetadata({reflectedName: $state.name});
            this.validationContextReflection.swapFields($state.fields || {});
        });
    }
}
