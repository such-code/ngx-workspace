import {RuleConstraint, ValidationRule} from './rules';
import {ruleFromConstraint} from './constraints';
import {stripPathPrefix} from './path';

/*
 * Wire format, unchanged from @such-code/ngx-form-validation v21.
 */

export type SerializedValidationError = {
    message?: string,
    details: Array<SerializedValidationErrorDetails>,
};

/** `{param, message}`: the value of `param` is wrong, no reusable rule. */
export type PrimitiveParamErrorDetails = {
    param: string,
    message: string,
};

export type RuleContextConstraint = RuleConstraint & {
    /** Name of the application-wide template the rule belongs to. */
    context: string,
};

/** Constraint for a field that is currently valid (rule is added for future input). */
export type ModelValidParamErrorDetails = {
    param: string,
    constraint: RuleConstraint | RuleContextConstraint,
};

/** Constraint for a field that is currently invalid. */
export type ModelInvalidParamErrorDetails = ModelValidParamErrorDetails & {
    message: string,
};

/** Server confirms that an already known constraint failed; nothing to add. */
export type ExistingConstraintErrorDetails = {
    param: string,
    existingConstraint: true,
};

export type SerializedValidationErrorDetails =
    PrimitiveParamErrorDetails
    | ModelInvalidParamErrorDetails
    | ModelValidParamErrorDetails
    | ExistingConstraintErrorDetails;

function isObject($: any): $ is Record<string, any> {
    return typeof $ === 'object' && $ !== null;
}

export function isRuleConstraint($: any): $ is RuleConstraint {
    return isObject($) && typeof $['type'] === 'string' && (typeof $['message'] === 'string' || $['message'] === undefined);
}

export function isRuleContextConstraint($: any): $ is RuleContextConstraint {
    return isRuleConstraint($) && typeof $['context'] === 'string';
}

export function isPrimitiveParamErrorDetail($: any): $ is PrimitiveParamErrorDetails {
    return isObject($) && typeof $['param'] === 'string' && typeof $['message'] === 'string' && !('constraint' in $);
}

export function isModelValidParamErrorDetails($: any): $ is ModelValidParamErrorDetails {
    return isObject($) && typeof $['param'] === 'string' && isRuleConstraint($['constraint']) && !('message' in $);
}

export function isModelInvalidParamErrorDetails($: any): $ is ModelInvalidParamErrorDetails {
    return isObject($) && typeof $['param'] === 'string' && typeof $['message'] === 'string' && isRuleConstraint($['constraint']);
}

export function isExistingConstraintErrorDetails($: any): $ is ExistingConstraintErrorDetails {
    return isObject($) && typeof $['param'] === 'string' && $['existingConstraint'] === true;
}

export function isSerializedValidationErrorDetails($: any): $ is SerializedValidationErrorDetails {
    return isPrimitiveParamErrorDetail($)
        || isModelInvalidParamErrorDetails($)
        || isModelValidParamErrorDetails($)
        || isExistingConstraintErrorDetails($);
}

export function isSerializedValidationError($: any): $ is SerializedValidationError {
    return isObject($)
        && Array.isArray($['details'])
        && $['details'].every(isSerializedValidationErrorDetails);
}

/*
 * Parsed form.
 */

export type FormErrorKind = 'server' | 'network' | 'unknown';

/** Error that belongs to the form, not to a field (was `ErrorCollectionError`). */
export interface FormError {
    readonly kind: FormErrorKind;
    readonly message: string;
    readonly status: number | string | null;
    readonly cause?: unknown;
}

export interface ParsedFieldError {
    readonly path: string;
    readonly message: string;
}

export interface ParsedConstraint {
    readonly path: string;
    readonly rule: ValidationRule;
    readonly constraint: RuleConstraint;
    /** Template name for application-wide constraints, `null` for constraints local to the form. */
    readonly context: string | null;
    /** Message the server reported for the current value, `null` when the field is currently valid. */
    readonly message: string | null;
}

export interface ParsedServerError {
    readonly fieldErrors: ReadonlyArray<ParsedFieldError>;
    readonly constraints: ReadonlyArray<ParsedConstraint>;
    readonly formErrors: ReadonlyArray<FormError>;
    /** Constraint types without a registered rule factory. */
    readonly unknownConstraints: ReadonlyArray<RuleConstraint>;
}

export interface ParseServerErrorOptions {
    /** Prefixes removed from `param` (e.g. `body.` added by some backends). */
    readonly pathPrefixes?: ReadonlyArray<string>;
    /** Extracts the payload from a transport error. Default handles Angular `HttpErrorResponse` and plain errors. */
    readonly unwrap?: ($error: unknown) => { payload: unknown, status: number | string | null, message: string | null };
}

export const EMPTY_PARSED_SERVER_ERROR: ParsedServerError = {
    fieldErrors: [],
    constraints: [],
    formErrors: [],
    unknownConstraints: [],
};

/** Duck-typed `HttpErrorResponse` check, so core does not depend on `@angular/common/http`. */
export function isHttpErrorLike($: any): $ is { status: number, error: unknown, message: string, statusText?: string } {
    return isObject($)
        && typeof $['status'] === 'number'
        && 'error' in $
        && ($['name'] === 'HttpErrorResponse' || 'headers' in $);
}

function defaultUnwrap($error: unknown): { payload: unknown, status: number | string | null, message: string | null } {
    if (isHttpErrorLike($error)) {
        return {
            payload: $error.error,
            status: $error.status,
            message: typeof $error.message === 'string' ? $error.message : null,
        };
    }
    return {
        payload: $error,
        status: null,
        message: $error instanceof Error ? $error.message : null,
    };
}

function toFormError($error: unknown, $payload: unknown, $status: number | string | null, $message: string | null): FormError {
    if ($payload === $error && $status === null) {
        // Not a transport error: something thrown by application code.
        const message = $message ?? (isObject($error) && typeof $error['message'] === 'string' ? $error['message'] : String($error));
        return {kind: 'unknown', message, status: null, cause: $error};
    }
    if ($status === 0) {
        return {kind: 'network', message: $message || 'Connection error.', status: 0, cause: $error};
    }
    if (typeof $payload === 'string' && $payload.length > 0) {
        return {kind: 'server', message: $payload, status: $status, cause: $error};
    }
    if (isObject($payload) && typeof $payload['message'] === 'string') {
        return {kind: 'server', message: $payload['message'], status: $status, cause: $error};
    }
    if ($message) {
        return {kind: $status === null ? 'unknown' : 'server', message: $message, status: $status, cause: $error};
    }
    return {kind: 'unknown', message: String($error), status: $status, cause: $error};
}

/**
 * Splits any error thrown by a submit action into field errors, constraints (become rules) and form-level errors.
 * Pure function, nothing is applied.
 */
export function parseServerError($error: unknown, $options: ParseServerErrorOptions = {}): ParsedServerError {
    const {payload, status, message} = ($options.unwrap ?? defaultUnwrap)($error);
    const prefixes = $options.pathPrefixes ?? [];

    // Plain `Error` subclasses carrying `details` (e.g. thrown by a service) are validation errors too.
    const validation = isSerializedValidationError(payload)
        ? payload
        : isSerializedValidationError($error)
            ? $error
            : null;

    if (!validation) {
        return {...EMPTY_PARSED_SERVER_ERROR, formErrors: [toFormError($error, payload, status, message)]};
    }

    const fieldErrors: Array<ParsedFieldError> = [];
    const constraints: Array<ParsedConstraint> = [];
    const unknownConstraints: Array<RuleConstraint> = [];

    for (const detail of validation.details) {
        if (isExistingConstraintErrorDetails(detail)) {
            continue;
        }
        const path = stripPathPrefix(detail.param, prefixes);
        if (isModelInvalidParamErrorDetails(detail) || isModelValidParamErrorDetails(detail)) {
            const rule = ruleFromConstraint(detail.constraint);
            if (!rule) {
                unknownConstraints.push(detail.constraint);
                continue;
            }
            constraints.push({
                path,
                rule,
                constraint: detail.constraint,
                context: isRuleContextConstraint(detail.constraint) ? detail.constraint.context : null,
                message: isModelInvalidParamErrorDetails(detail) ? detail.message : null,
            });
        } else if (isPrimitiveParamErrorDetail(detail)) {
            fieldErrors.push({path, message: detail.message});
        }
    }

    const formErrors: Array<FormError> = fieldErrors.length === 0 && constraints.length === 0 && typeof validation.message === 'string'
        ? [{kind: 'server', message: validation.message, status, cause: $error}]
        : [];

    return {fieldErrors, constraints, formErrors, unknownConstraints};
}
