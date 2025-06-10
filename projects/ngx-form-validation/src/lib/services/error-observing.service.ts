import {inject, Injectable} from '@angular/core';
import {ErrorObserver, Observable} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
import {tap} from 'rxjs/operators';
import {IncorrectValueRule, ValidationRuleWithMessage} from '../rules/rules';
import {ErrorCollection, ErrorCollectionError} from '../data/error-collection';
import {ValidationContext, ValidationContextField, ValidationContextWithMetadata} from '../data/validation-context';
import {
    isExistingConstraintErrorDetails,
    isModelInvalidParamErrorDetails,
    isModelValidParamErrorDetails,
    isPrimitiveParamErrorDetail,
    isRuleContextConstraint,
    isSerializedValidationError,
    SerializedValidationError,
} from '../api/error-api.type';
import {ValidationSubmitEvent} from '../directives/check/validation-submit-event';
import {ruleFromConstraintMap} from '../rules/rules-utils';
import {ValidationService} from './validation.service';
import {isValidationContextReflectionMetadata} from '../directives/context/validation-named-context-base.directive';

export interface IValueProvider {
    for($key: string): any;
}

export type ErrorTransformFilter = <T = any>($e: T) => T | null;
export type ErrorHandler = <T = any>($e: T) => T;

/**
 * This service is aimed at monitoring Observables for errors and adding them to ValidationContext.
 */
@Injectable({providedIn: 'root'})
export class ErrorObservingService {

    protected readonly validationService = inject(ValidationService);

    protected addOrUpdateFieldRule($context: ValidationContext, $fieldName: string, $rule: ValidationRuleWithMessage): void {
        const fieldData = $context.getFieldSnapshot($fieldName);

        if (fieldData) {
            const rulesSnapshot = fieldData.rulesSnapshot;
            const existingRuleIndex = rulesSnapshot.findIndex($ => $.name === $rule.name);
            if (existingRuleIndex > -1) {
                fieldData.swapRules(
                    rulesSnapshot
                        .slice(0, existingRuleIndex)
                        .concat(
                            [$rule, ...rulesSnapshot.slice(existingRuleIndex + 1)],
                        ),
                );
            } else {
                fieldData.addRule($rule);
            }
        } else {
            const newFieldContext = new ValidationContextField($fieldName);
            newFieldContext.addRule($rule);
            $context.changeField($fieldName, newFieldContext);
        }
    }

    protected serializedValidationErrorHandler(
        $context: ValidationContext | null,
        $localContext: ValidationContext | null,
        $valueProvider: IValueProvider | null,
        $error: SerializedValidationError,
    ): void {
        for (const detail of $error.details) {
            if (isExistingConstraintErrorDetails(detail)) {
                continue;
            }

            // Sometimes there is a necessity to add a constraint for a valid field, so both types are processed.
            if (isModelInvalidParamErrorDetails(detail) || isModelValidParamErrorDetails(detail)) {
                const validationRuleFactory = ruleFromConstraintMap.get(detail.constraint.type);
                if (validationRuleFactory) {
                    const rule = validationRuleFactory(detail.constraint);
                    // Check if the rule is intended to be used for a named context.
                    if (isRuleContextConstraint(detail.constraint)) {
                        const metadata = $context instanceof ValidationContextWithMetadata
                            ? $context.getMetadataSnapshot()
                            : null;

                        if (isValidationContextReflectionMetadata(metadata) && metadata.reflectedName !== detail.constraint.context) {
                            console.warn(`Received constraint for "${detail.constraint.context}" context that is outside of the current "${metadata.reflectedName}" context. Might be an error!`);
                        }

                        const validationServiceContext = this.validationService.getContextSnapshot(detail.constraint.context);
                        if (validationServiceContext) {
                            this.addOrUpdateFieldRule(validationServiceContext, detail.param, rule);
                        } else {
                            const newValidationContext = new ValidationContext(detail.constraint.context);
                            this.addOrUpdateFieldRule(newValidationContext, detail.param, rule);
                            this.validationService.changeContext(detail.constraint.context, newValidationContext);
                        }
                    } else {
                        if (!!$localContext) {
                            this.addOrUpdateFieldRule($localContext, detail.param, rule);
                        } else {
                            console.warn(`Could not add constraint for "${detail.param}" field since no local validation context is provided.`);
                        }
                    }
                } else {
                    console.warn(`Unknown "${detail.constraint.type}" constraint type, please add it to the supported list.`);
                }
            } else if (isPrimitiveParamErrorDetail(detail)) {
                if (!!$localContext) {
                    // There is no rule for this error, it should be displayed without creating a constraint.
                    if (!!$valueProvider) {
                        const rule = new IncorrectValueRule($valueProvider.for(detail.param), detail.message);
                        this.addOrUpdateFieldRule($localContext, detail.param, rule);
                    } else {
                        console.warn(`Could not create IncorrectValueRule since no value provider for "${detail.param}" param is provided.`);
                    }
                } else {
                    console.warn(`Could not add value validation for "${detail.param}" field since no validation local context is provided.`);
                }
            } else {
                console.warn(`Unknown validation error data, please add it to the list.`);
            }
        }
    }

    protected nonValidationErrorHandler($errorCollection: ErrorCollection | null, $error: any): void {
        if ($errorCollection) {
            if (typeof $error.error === 'string') {
                $errorCollection.addError(new ErrorCollectionError($error.error));
            } else if (typeof $error.message === 'string') {
                $errorCollection.addError(new ErrorCollectionError($error.message));
            } else {
                // TODO: Find better way for serialization.
                $errorCollection.addError(new ErrorCollectionError('' + $error));
            }
        }
    }

    protected errorTransformFilter<T = any>($cb: ErrorTransformFilter | null, $error: T): T | null {
        if ($cb) {
            return $cb($error);
        }
        return $error;
    }

    protected definedHttpErrorHandler(
        $context: ValidationContext | null,
        $localContext: ValidationContext | null,
        $errorCollection: ErrorCollection | null,
        $valueProvider: IValueProvider | null,
        $error: HttpErrorResponse,
    ): void {
        if (isSerializedValidationError($error.error)) {
            this.serializedValidationErrorHandler(
                $context, $localContext, $valueProvider, $error.error,
            );
        } else {
            this.nonValidationErrorHandler(
                $errorCollection, $error,
            )
        }
    }

    protected undefinedHttpErrorHandler($errorCollection: ErrorCollection | null, $error: HttpErrorResponse): void {
        if (!!$error.message && $errorCollection) {
            $errorCollection.addError(new ErrorCollectionError($error.message));
        }
    }

    protected httpErrorHandler(
        $context: ValidationContext | null,
        $localContext: ValidationContext | null,
        $errorCollection: ErrorCollection | null,
        $valueProvider: IValueProvider | null,
        $error: HttpErrorResponse,
    ): void {
        if (!!$error.error) {
            this.definedHttpErrorHandler($context, $localContext, $errorCollection, $valueProvider, $error);
        } else {
            this.undefinedHttpErrorHandler(
                $errorCollection, $error,
            );
        }
    }

    protected nonHttpErrorHandler(
        $context: ValidationContext | null,
        $localContext: ValidationContext | null,
        $errorCollection: ErrorCollection | null,
        $valueProvider: IValueProvider | null,
        $error: any,
    ): void {
        if (isSerializedValidationError($error)) {
            this.serializedValidationErrorHandler(
                $context, $localContext, $valueProvider, $error,
            );
        } else if (typeof $error.message === 'string' && $errorCollection) {
            this.nonValidationErrorHandler($errorCollection, $error);
        }
    }

    protected createObserver<T>(
        $context: ValidationContext | null,
        $localContext: ValidationContext | null,
        $errorCollection: ErrorCollection | null,
        $valueProvider: IValueProvider | null,
        $filterOut: ErrorTransformFilter | null = null,
    ): ErrorObserver<T> {
        if ($errorCollection) {
            $errorCollection.clear();
        }

        return {
            error: ($error: any) => {
                const modifiedError = this.errorTransformFilter($filterOut, $error);
                if (modifiedError) {
                    if (modifiedError instanceof HttpErrorResponse) {
                        return this.httpErrorHandler(
                            $context, $localContext, $errorCollection, $valueProvider, modifiedError,
                        );
                    } else {
                        this.nonHttpErrorHandler(
                            $context, $localContext, $errorCollection, $valueProvider, modifiedError,
                        )
                    }
                }
            },
        };

    }

    public observeOn<T>($event: ValidationSubmitEvent, $filterOut: ErrorTransformFilter | null = null): ErrorObserver<T> {
        return this.createObserver<T>(
            $event.context,
            $event.localContext,
            $event.errorCollection,
            {for: ($key) => $event.formData[$key]},
            $filterOut,
        );
    }

    public observeTo<T>($errorCollection: ErrorCollection, $filterOut: ErrorTransformFilter | null = null): ErrorObserver<T> {
        return this.createObserver<T>(
            null,
            null,
            $errorCollection,
            null,
            $filterOut,
        );
    }

    public observe<T = any>(
        $target: Observable<T>,
        $context: ValidationContext,
        $localContext: ValidationContext,
        $errorCollection: ErrorCollection,
        $valueProvider: IValueProvider | null = null,
    ): Observable<T> {
        return $target.pipe(
            tap(this.createObserver<T>($context, $localContext, $errorCollection, $valueProvider)),
        );
    }
}
