export enum ValidationType {
    SIZE = 'size',
    MIN_LENGTH = 'minLength',
    MAX_LENGTH = 'maxLength',
    MIN = 'min',
    MIN_OR_EQUAL = 'minOrEqual',
    MAX = 'max',
    MAX_OR_EQUAL = 'maxOrEqual',
    REQUIRED = 'required',
    NOT_EMPTY = 'notEmpty',
    PATTERN = 'pattern',
    EMAIL = 'email',
    DIGITS = 'digits',
    URL = 'url',
    FUTURE = 'future',
    PAST = 'past',
    ALLOWED = 'allowed',
    EXTERNAL = 'external',
    INCORRECT = 'incorrect',
    PHONE = 'phone',
    AGE = 'age',
    BOOLEAN = 'boolean',
    SAME_VALUE = 'sameValue'
}

export function isValidationType($: any): $ is ValidationType {
    return Object.values(ValidationType).indexOf($) > -1;
}
