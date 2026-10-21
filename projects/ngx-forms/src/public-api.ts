/*
 * Public API Surface of @such-code/ngx-forms
 */

export type {
    ValidationError,
    FieldError,
    TargetedValidationError,
    ValidationResult,
    ErrorStaleness,
    SetErrorsOptions,
    MarkAsTouchedOptions,
    FieldState,
    FieldTree,
    FieldChildren,
} from './lib/types';
export {
    createMetadataKey,
    MetadataReducers,
    REQUIRED,
    MIN,
    MAX,
    MIN_LENGTH,
    MAX_LENGTH,
    PATTERN,
    DEBOUNCE,
} from './lib/metadata';
export type {MetadataKey, MetadataReducer, DebounceConfig} from './lib/metadata';
export {
    ANY_SEGMENT,
    schema,
    apply,
    applyEach,
    applyWhen,
    applyWhenValue,
    applyDynamic,
    validate,
    validateTree,
    validateAsync,
    metadata,
    disabled,
    hidden,
    readonly,
    trackBy,
} from './lib/schema';
export type {SchemaPath, SchemaFn, FieldContext, LogicFn} from './lib/schema';
export type {AsyncValidatorOptions} from './lib/async';
export {required, min, max, minLength, maxLength, pattern, email, debounce, isEmpty} from './lib/validators';
export type {ValidatorConfig} from './lib/validators';
export {form, applySchema, fieldAt, focusFirstInvalid, submit, whenTrue} from './lib/form';
export type {FormOptions, SubmitOptions, SubmitAction, SubmitErrors} from './lib/form';
export {isFieldTree} from './lib/node';
export {NgxField, NgxNormalize, NGX_FIELD, injectFieldControl, normalizers} from './lib/field.directive';
export type {FieldControl, NormalizeFn} from './lib/field.directive';
export {transformedValue, arrayOps} from './lib/controls';
export type {ParseResult, TransformedValueOptions, ArrayOps} from './lib/controls';
export {deepEqual} from './lib/util';
