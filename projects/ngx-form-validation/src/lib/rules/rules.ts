import {AbstractControl, ValidatorFn} from '@angular/forms';
import {ValidationType} from '../enum/validation-type';
import {maybeEquals} from '../util/comparison-utils';

function normalizeValueWithLength($value: any): { length: number } | null {
    if ($value === null) {
        return $value;
    }

    switch (typeof $value) {
        case 'number':
            return $value.toString();
        case 'object':
            return typeof $value.length === 'number' ? $value : Object.keys($value);
    }

    return $value.toString ? $value.toString() : null;
}

function normalizeValueAsString($value: any): string | null {
    if ($value === null) {
        return $value;
    }
    return typeof $value.toString === 'function' ? $value.toString() : null;
}

export type ValidationRuleError = {
    value: any,
    rawMessage: string,
    interpolationSource: Record<string, any> | null,
    plural?: number | null,
};

export function isValidationRuleError($: any): $ is ValidationRuleError {
    return typeof $ === 'object'
        && $ !== null
        && 'value' in $
        && typeof $.rawMessage === 'string'
        && typeof $.interpolationSource === 'object';
}

export abstract class ValidationRule {
    protected constructor(
        public readonly name: string,
    ) {
    }

    public abstract get validator(): ValidatorFn;
}

export abstract class ValidationRuleWithMessage extends ValidationRule {

    public abstract validate($value: any): boolean;

    protected abstract getRawMessageForValue($value: any): string;

    protected getInterpolationSource($value: any): Record<string, any> | null {
        return this;
    }

    public get validator(): ValidatorFn {
        return ($control: AbstractControl): Record<string, ValidationRuleError> | null => {
            return this.validate($control.value)
                ? null
                : {
                    [this.name]: {
                        value: $control.value,
                        rawMessage: this.getRawMessageForValue($control.value),
                        interpolationSource: this.getInterpolationSource($control.value),
                        plural: null,
                    },
                };
        };
    }
}

export class SizeRule extends ValidationRuleWithMessage {
    constructor(
        public readonly min: number,
        public readonly max: number = Number.POSITIVE_INFINITY,
        protected readonly minMessage: string = 'Value must be equal or longer then {{ min }}.',
        protected readonly maxMessage: string = 'Value must not exceed {{ max }}.',
    ) {
        super(ValidationType.SIZE);
    }

    public validate($value: any): boolean {
        const valueToCheck = normalizeValueWithLength($value);
        return !valueToCheck || ((!this.min || valueToCheck.length >= this.min) && (!this.max || valueToCheck.length <= this.max));
    }

    protected getRawMessageForValue($value: any): string {
        const valueToCheck = normalizeValueWithLength($value)!;
        return this.min && valueToCheck.length < this.min ? this.minMessage : this.maxMessage;
    }
}

export class MinLengthRule extends ValidationRuleWithMessage {
    constructor(
        public readonly length: number,
        protected readonly message: string = 'Length should be greater then {{ length }}.',
    ) {
        super(ValidationType.MIN_LENGTH);
    }

    public validate($value: any): boolean {
        const valueToCheck = normalizeValueWithLength($value);
        return !valueToCheck || valueToCheck.length >= this.length;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }
}

export class MaxLengthRule extends ValidationRuleWithMessage {
    constructor(
        public readonly length: number,
        protected readonly message: string = 'Length must not exceed {{ length }}.',
    ) {
        super(ValidationType.MAX_LENGTH);
    }

    public validate($value: any): boolean {
        const valueToCheck = normalizeValueWithLength($value);
        return !valueToCheck || valueToCheck.length <= this.length;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }
}

export class MinOrEqualRule extends ValidationRuleWithMessage {
    constructor(
        public readonly limit: number,
        protected readonly message: string = 'Value must be greater than or equal to {{ limit }}.',
    ) {
        super(ValidationType.MIN_OR_EQUAL);
    }

    public validate($value: any): boolean {
        return typeof $value === 'number' ? $value >= this.limit : !$value;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }
}

export class MinRule extends ValidationRuleWithMessage {
    constructor(
        public readonly limit: number,
        protected readonly message: string = 'Value must be greater than {{ limit }}.',
    ) {
        super(ValidationType.MIN);
    }

    public validate($value: any): boolean {
        return typeof $value === 'number' ? $value > this.limit : !$value;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }
}

export class MaxOrEqualRule extends ValidationRuleWithMessage {
    constructor(
        public readonly limit: number,
        protected readonly message: string = 'Value must be lower than or equal to {{ limit }}.',
    ) {
        super(ValidationType.MAX_OR_EQUAL);
    }

    public validate($value: any): boolean {
        return typeof $value === 'number' ? $value <= this.limit : !$value;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }
}

export class MaxRule extends ValidationRuleWithMessage {
    constructor(
        public readonly limit: number,
        protected readonly message: string = 'Value must be lower than {{ limit }}.',
    ) {
        super(ValidationType.MAX);
    }

    public validate($value: any): boolean {
        return typeof $value === 'number' ? $value < this.limit : !$value;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }
}

export class RequiredRule extends ValidationRuleWithMessage {
    constructor(
        protected readonly message: string = 'This field is required.',
    ) {
        super(ValidationType.REQUIRED);
    }

    public validate($value: any): boolean {
        // Incorrectly handles `0`, exception is required.
        return typeof $value === 'number' || !!$value;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return null;
    }
}

export class NotEmptyRule extends ValidationRuleWithMessage {
    constructor(
        protected readonly message: string = 'This field must not be empty.',
    ) {
        super(ValidationType.NOT_EMPTY);
    }

    public validate($value: any): boolean {
        return $value !== null
            && $value !== undefined
            && !!('' + $value).trim().length;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return null;
    }
}

export class PatternRule extends ValidationRuleWithMessage {
    constructor(
        public readonly pattern: RegExp,
        public readonly match: boolean = true,
        protected readonly message: string = 'Pattern does not match.',
    ) {
        super(ValidationType.PATTERN);
    }

    public validate($value: any): boolean {
        const valueToCheck = normalizeValueAsString($value);
        return !valueToCheck || this.match === this.pattern.test(valueToCheck);
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return null;
    }
}

export class EmailRule extends ValidationRuleWithMessage {
    // https://github.com/angular/angular/blob/4.4.6/packages/forms/src/validators.ts#L109
    /* tslint:disable:max-line-length */
    // static RE = /^(?=.{1,254}$)(?=.{1,64}@)[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+(\.[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
    // see http://jira.uncomp.com:8989/browse/NS-1636
    static RE = /^(?=.{1,254}$)(?=.{1,64}@)[-'0-9=A-Z_a-z]+(\.[-'0-9=A-Z_a-z]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

    /* tslint:enable:max-line-length */

    constructor(
        public readonly strict: boolean = false,
        protected readonly message: string = 'Valid email address must be provided.',
    ) {
        super(ValidationType.EMAIL);
    }

    public validate($value: any): boolean {
        return !$value || EmailRule.RE.test($value);
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return null;
    }
}

export class IncorrectValueRule extends ValidationRuleWithMessage {
    constructor(
        public readonly value: any,
        protected readonly message: string = 'Value you have provided is incorrect.',
    ) {
        super(ValidationType.INCORRECT);
    }

    public validate($value: any): boolean {
        return $value === undefined
            || $value === null
            || (typeof $value !== 'object' && this.value !== $value)
            || (typeof $value === 'object' && !maybeEquals(this.value, $value));
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return null;
    }
}

export class DigitsRule extends ValidationRuleWithMessage {
    constructor(
        public readonly message: string = 'Value must be a digit.',
    ) {
        super(ValidationType.DIGITS);
    }

    public validate($value: any): boolean {
        return !$value || !!Number($value);
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return null;
    }
}

export class AllowedValueRule extends ValidationRuleWithMessage {
    constructor(
        public readonly values: ReadonlyArray<any>,
        protected readonly message: string = 'Value "{{ value }}" is not allowed here.',
    ) {
        super(ValidationType.ALLOWED);
    }

    public validate($value: any): boolean {
        return this.values.indexOf($value) > -1;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return {value: $value};
    }
}

export class ExternalValidatorRule extends ValidationRule {
    constructor(
        public readonly validatorFn: ($value: any, $formData?: any) => ValidationRuleError | null,
    ) {
        super(ValidationType.EXTERNAL);
    }

    public get validator(): ValidatorFn {
        return ($control: AbstractControl): { [key: string]: ValidationRuleError } | null => {
            const result = this.validatorFn($control.value, $control.root.value);
            if (result) {
                return {[this.name]: result};
            }
            return null;
        };
    }
}

export class PhoneRule extends ValidationRuleWithMessage {
    static RE = /^\+?\s?(?:\d\s?){7,13}\d$/;

    constructor(
        protected readonly message: string = 'Invalid phone number.',
    ) {
        super(ValidationType.PHONE);
    }

    public validate($value: any): boolean {
        return !$value || PhoneRule.RE.test($value);
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return null;
    }
}

export class AgeRule extends ValidationRuleWithMessage {
    constructor(
        public readonly age: number = 18,
        protected readonly message: string = 'Age must be more than {{ age }}.',
    ) {
        super(ValidationType.AGE);
    }

    public validate($value: any): boolean {
        if ($value !== null) {
            const currentDate = new Date();
            const date = typeof $value === 'string'
                ? new Date($value)
                : $value instanceof Date
                    ? $value
                    : null;

            if (date) {
                currentDate.setFullYear(currentDate.getFullYear() - this.age);
                return date.getTime() >= currentDate.getTime();
            }
        }
        return true;
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }
}

export class BooleanRule extends ValidationRuleWithMessage {
    public constructor(
        protected readonly message: string = 'This field must be "true" or "false".',
    ) {
        super(ValidationType.BOOLEAN);
    }

    public validate($value: any): boolean {
        return typeof $value === 'boolean';
    }

    public getRawMessageForValue($value: any): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> | null {
        return null;
    }
}
