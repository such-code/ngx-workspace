import {DestroyRef, Directive, DoCheck, inject, InjectionToken, Injector, input, OnInit, signal} from '@angular/core';
import {ValidationService} from '../../services/validation.service';
import {ValidationContextWithMetadata} from '../../data/validation-context';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {map} from 'rxjs/operators';
import {of, switchMap} from 'rxjs';
import {ControlContainer} from '@angular/forms';

export const VALIDATION_CONTEXT_REFLECTION = new InjectionToken<ValidationContextWithMetadata<ValidationContextReflectionMetadata>>('VALIDATION_CONTEXT_REFLECTION');

export type ValidationContextReflectionMetadata = {
    reflectedName: string | null,
    path: string | null,
}

export function isValidationContextReflectionMetadata($: any): $ is ValidationContextReflectionMetadata {
    return typeof $ === 'object'
        && $ !== null
        && ($.reflectedName === null || typeof $.reflectedName === 'string');
}

export function validationContextReflectionProvider(): ValidationContextWithMetadata<ValidationContextReflectionMetadata> {
    return new ValidationContextWithMetadata<ValidationContextReflectionMetadata>(
        'reflection',
        {reflectedName: null, path: null},
    );
}

@Directive({})
export abstract class ValidationNamedContextBaseDirective implements OnInit, DoCheck {

    public readonly name = input<string | null>(null);

    protected readonly destroyRef = inject(DestroyRef);
    protected readonly injector = inject(Injector);
    protected readonly validationContextReflection = inject(VALIDATION_CONTEXT_REFLECTION, {self: true});
    protected readonly validationService = inject(ValidationService);

    protected readonly controlContainer = inject(ControlContainer, {optional: true});

    protected readonly path = signal<string | null>(null);

    public ngOnInit(): void {
        const path$ = toObservable(this.path, {injector: this.injector});

        toObservable(this.name, {injector: this.injector}).pipe(
            switchMap(($name) => {
                const emptyState = {
                    name: $name,
                    fields: null,
                    // While fields are not set, doesn't matter if path is set or not.
                    path: null,
                };
                if (typeof $name === 'string') {
                    return this.validationService.getContext$($name).pipe(
                        switchMap($context => {
                            if ($context) {
                                return $context.fields$.pipe(
                                    switchMap($fields => {
                                        return path$.pipe(
                                            map($path => {
                                                return {...emptyState, fields: $fields, path: $path};
                                            })
                                        );
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
            this.validationContextReflection.setMetadata({reflectedName: $state.name, path: $state.path});
            this.validationContextReflection.swapFields($state.fields || {});
        });
    }

    public ngDoCheck(): void {
        if (this.controlContainer) {
            this.path.set(this.controlContainer.path?.join('.') || null);
        } else {
            this.path.set(null);
        }
    }
}
