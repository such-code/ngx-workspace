import {isValidationType, ValidationType} from '../enum/validation-type';

/**
 * Types defined here are meant to be primarily used in client-server communication.
 */

export type SerializedValidationError = {
    message?: string,
    details: Array<SerializedValidationErrorDetails>,
};

export function isSerializedValidationError($: any): $ is SerializedValidationError {
    return typeof $ === 'object'
        && $ !== null
        && Array.isArray($.details)
        && $.details.every(isSerializedValidationErrorDetails);
}

export type PrimitiveParamErrorDetails = {
    // Param name or index
    param: string,
    message: string,
}

export function isPrimitiveParamErrorDetail($: any): $ is PrimitiveParamErrorDetails {
    return typeof $ === 'object'
        && $ !== null
        && typeof $.param === 'string'
        && typeof $.message === 'string';
}

export type RuleConstraint = {
    type: ValidationType,
    // This is a raw message. Rule could apply interpolation for this message.
    message: string;
    [key: string]: any,
}

export function isRuleConstraint($: any): $ is RuleConstraint {
    return typeof $ === 'object'
        && $ !== null
        && isValidationType($.type)
        && typeof $.message === 'string';
}

export type RuleContextConstraint = RuleConstraint & {
    context: string,
}

export function isRuleContextConstraint($: any): $ is RuleContextConstraint {
    return isRuleConstraint($)
        && typeof $['context'] === 'string';
}

export type ModelValidParamErrorDetails = {
    // Path to param | example - body.deviceInfo.browser
    param: string,
    constraint: RuleConstraint | RuleContextConstraint,
}

export function isModelValidParamErrorDetails($: any): $ is ModelValidParamErrorDetails {
    return typeof $ === 'object'
        && $ !== null
        && typeof $.param === 'string'
        && isRuleConstraint($.constraint)
        && !$.hasOwnProperty('message');
}

export type ModelInvalidParamErrorDetails = ModelValidParamErrorDetails & {
    message: string,
}

export function isModelInvalidParamErrorDetails($: any): $ is ModelInvalidParamErrorDetails {
    return typeof $ === 'object'
        && $ !== null
        && typeof $.param === 'string'
        && typeof $.message === 'string'
        && isRuleConstraint($.constraint);
}

export type ExistingConstraintErrorDetails = {
    param: string,
    existingConstraint: true,
}

export function isExistingConstraintErrorDetails($: any): $ is ExistingConstraintErrorDetails {
    return typeof $ === 'object'
        && $ !== null
        && typeof $.param === 'string'
        && typeof $.existingConstraint === 'boolean';
}

export type SerializedValidationErrorDetails =
    PrimitiveParamErrorDetails
    | ModelInvalidParamErrorDetails
    | ModelValidParamErrorDetails
    | ExistingConstraintErrorDetails;

export function isSerializedValidationErrorDetails($: any): $ is SerializedValidationErrorDetails {
    return isPrimitiveParamErrorDetail($)
        || isModelInvalidParamErrorDetails($)
        || isModelValidParamErrorDetails($)
        || isExistingConstraintErrorDetails($);
}
