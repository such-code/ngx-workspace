import {ValidationType} from './validation-type';
import {maybeEquals} from './compare';
import {interpolate} from './text';

/**
 * Error produced by a rule. Structurally compatible with Signal Forms `ValidationError` (`kind` + `message`), so it can
 * be returned from any Signal Forms validator. `rawMessage` + `params` are kept to translate the message later.
 */
export interface ValidationRuleError {
    readonly kind: string;
    /** Interpolated, untranslated message. */
    readonly message: string;
    readonly rawMessage: string;
    readonly params: Readonly<Record<string, any>> | null;
    readonly value: unknown;
    readonly plural?: number | null;
}

export function isValidationRuleError($: any): $ is ValidationRuleError {
    return typeof $ === 'object'
        && $ !== null
        && typeof $.kind === 'string'
        && typeof $.rawMessage === 'string'
        && 'value' in $;
}

export function ruleError(
    $kind: string,
    $value: unknown,
    $rawMessage: string,
    $params: Readonly<Record<string, any>> | null = null,
    $plural: number | null = null,
): ValidationRuleError {
    return {
        kind: $kind,
        message: $params ? interpolate($rawMessage, $params) : $rawMessage,
        rawMessage: $rawMessage,
        params: $params,
        value: $value,
        plural: $plural,
    };
}

/** Gives rules access to the rest of the form (for rules like "same value as"). */
export interface RuleContext {
    /** Whole form value. */
    readonly root: unknown;

    /** Value at a dotted path relative to the form root. */
    valueAt($path: string): unknown;
}

export const EMPTY_RULE_CONTEXT: RuleContext = {
    root: undefined,
    valueAt: () => undefined,
};

/** Constraints a rule exposes to controls (`required`, `minLength`, ...), mapped to Signal Forms metadata. */
export type RuleMetadata = {
    readonly required?: boolean,
    readonly minLength?: number,
    readonly maxLength?: number,
    readonly min?: number,
    readonly max?: number,
    readonly pattern?: RegExp,
};

/** Serializable form of a rule; same shape the server sends. */
export type RuleConstraint = {
    type: string,
    message: string,
    [key: string]: any,
};

export abstract class ValidationRule<T = any> {
    protected constructor(
        public readonly name: string,
    ) {
    }

    public abstract check($value: T, $context: RuleContext): ValidationRuleError | null;

    public metadata(): RuleMetadata | null {
        return null;
    }

    /** Returns `null` when the rule can not be serialized (e.g. it wraps a function). */
    public toConstraint(): RuleConstraint | null {
        return null;
    }
}

export abstract class ValidationRuleWithMessage<T = any> extends ValidationRule<T> {

    public abstract validate($value: T, $context: RuleContext): boolean;

    protected abstract getRawMessageForValue($value: T): string;

    protected getInterpolationSource($value: T): Record<string, any> | null {
        return null;
    }

    public check($value: T, $context: RuleContext = EMPTY_RULE_CONTEXT): ValidationRuleError | null {
        return this.validate($value, $context)
            ? null
            : ruleError(this.name, $value, this.getRawMessageForValue($value), this.getInterpolationSource($value));
    }
}

function normalizeValueWithLength($value: any): { length: number } | null {
    if ($value === null || $value === undefined) {
        return null;
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
    if ($value === null || $value === undefined) {
        return null;
    }
    return typeof $value.toString === 'function' ? $value.toString() : null;
}

function isEmpty($value: unknown): boolean {
    return $value === null || $value === undefined || $value === '';
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

    protected override getInterpolationSource(): Record<string, any> {
        return {min: this.min, max: this.max};
    }

    public override metadata(): RuleMetadata {
        return {
            minLength: this.min || undefined,
            maxLength: Number.isFinite(this.max) ? this.max : undefined,
        };
    }

    public override toConstraint(): RuleConstraint {
        return {
            type: this.name,
            message: `${this.minMessage}|${this.maxMessage}`,
            min: this.min,
            max: Number.isFinite(this.max) ? this.max : null,
        };
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

    protected getRawMessageForValue(): string {
        return this.message;
    }

    protected override getInterpolationSource(): Record<string, any> {
        return {length: this.length};
    }

    public override metadata(): RuleMetadata {
        return {minLength: this.length};
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message, length: this.length};
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

    protected getRawMessageForValue(): string {
        return this.message;
    }

    protected override getInterpolationSource(): Record<string, any> {
        return {length: this.length};
    }

    public override metadata(): RuleMetadata {
        return {maxLength: this.length};
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message, length: this.length};
    }
}

abstract class LimitRule extends ValidationRuleWithMessage {
    protected constructor(
        $name: string,
        public readonly limit: number,
        protected readonly message: string,
    ) {
        super($name);
    }

    protected abstract compare($value: number): boolean;

    public validate($value: any): boolean {
        return typeof $value === 'number' ? Number.isNaN($value) || this.compare($value) : isEmpty($value);
    }

    protected getRawMessageForValue(): string {
        return this.message;
    }

    protected override getInterpolationSource(): Record<string, any> {
        return {limit: this.limit};
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message, limit: this.limit};
    }
}

export class MinOrEqualRule extends LimitRule {
    constructor($limit: number, $message: string = 'Value must be greater than or equal to {{ limit }}.') {
        super(ValidationType.MIN_OR_EQUAL, $limit, $message);
    }

    protected compare($value: number): boolean {
        return $value >= this.limit;
    }

    public override metadata(): RuleMetadata {
        return {min: this.limit};
    }
}

export class MinRule extends LimitRule {
    constructor($limit: number, $message: string = 'Value must be greater than {{ limit }}.') {
        super(ValidationType.MIN, $limit, $message);
    }

    protected compare($value: number): boolean {
        return $value > this.limit;
    }
}

export class MaxOrEqualRule extends LimitRule {
    constructor($limit: number, $message: string = 'Value must be lower than or equal to {{ limit }}.') {
        super(ValidationType.MAX_OR_EQUAL, $limit, $message);
    }

    protected compare($value: number): boolean {
        return $value <= this.limit;
    }

    public override metadata(): RuleMetadata {
        return {max: this.limit};
    }
}

export class MaxRule extends LimitRule {
    constructor($limit: number, $message: string = 'Value must be lower than {{ limit }}.') {
        super(ValidationType.MAX, $limit, $message);
    }

    protected compare($value: number): boolean {
        return $value < this.limit;
    }
}

export class RequiredRule extends ValidationRuleWithMessage {
    constructor(
        protected readonly message: string = 'This field is required.',
    ) {
        super(ValidationType.REQUIRED);
    }

    /** Any number (including `0`) and `false` are values; empty strings, empty arrays, `null`, `undefined` are not. */
    public validate($value: any): boolean {
        if (typeof $value === 'number' || typeof $value === 'boolean') {
            return true;
        }
        if (Array.isArray($value)) {
            return $value.length > 0;
        }
        return !!$value;
    }

    protected getRawMessageForValue(): string {
        return this.message;
    }

    public override metadata(): RuleMetadata {
        return {required: true};
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message};
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

    protected getRawMessageForValue(): string {
        return this.message;
    }

    public override metadata(): RuleMetadata {
        return {required: true};
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message};
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
        if (!valueToCheck) {
            return true;
        }
        // Global/sticky regular expressions keep state between calls.
        this.pattern.lastIndex = 0;
        return this.match === this.pattern.test(valueToCheck);
    }

    protected getRawMessageForValue(): string {
        return this.message;
    }

    public override metadata(): RuleMetadata | null {
        return this.match ? {pattern: this.pattern} : null;
    }

    public override toConstraint(): RuleConstraint {
        return {
            type: this.name,
            message: this.message,
            pattern: JSON.stringify({source: this.pattern.source, flags: this.pattern.flags}),
            match: this.match,
        };
    }
}

export class EmailRule extends ValidationRuleWithMessage {
    static RE = /^(?=.{1,254}$)(?=.{1,64}@)[-'0-9=A-Z_a-z]+(\.[-'0-9=A-Z_a-z]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
    /** Same as `RE`, but also allows the rest of RFC 5322 "atext" characters in the local part. */
    static RE_LOOSE = /^(?=.{1,254}$)(?=.{1,64}@)[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+(\.[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

    constructor(
        /** `true` (default, same as v21) restricts the local part to `-'0-9=A-Z_a-z`; `false` allows all RFC 5322 atext. */
        public readonly strict: boolean = true,
        protected readonly message: string = 'Valid email address must be provided.',
    ) {
        super(ValidationType.EMAIL);
    }

    public validate($value: any): boolean {
        return !$value || (this.strict ? EmailRule.RE : EmailRule.RE_LOOSE).test($value);
    }

    protected getRawMessageForValue(): string {
        return this.message;
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message, strict: this.strict};
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

    protected getRawMessageForValue(): string {
        return this.message;
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message, value: this.value};
    }
}

export class DigitsRule extends ValidationRuleWithMessage {
    constructor(
        protected readonly message: string = 'Value must be a digit.',
    ) {
        super(ValidationType.DIGITS);
    }

    public validate($value: any): boolean {
        return isEmpty($value) || /^\d+$/.test(String($value));
    }

    protected getRawMessageForValue(): string {
        return this.message;
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message};
    }
}

export class AllowedValueRule extends ValidationRuleWithMessage {
    constructor(
        public readonly values: ReadonlyArray<any>,
        protected readonly message: string = 'Value "{{ value }}" is not allowed here.',
    ) {
        super(ValidationType.ALLOWED);
    }

    /** Empty values pass; combine with `RequiredRule` to forbid them. */
    public validate($value: any): boolean {
        return isEmpty($value) || this.values.some($ => maybeEquals($, $value));
    }

    protected getRawMessageForValue(): string {
        return this.message;
    }

    protected override getInterpolationSource($value: any): Record<string, any> {
        return {value: $value};
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message, values: [...this.values]};
    }
}

export type ExternalValidatorResult = ValidationRuleError | {
    rawMessage: string,
    params?: Record<string, any> | null,
    /** @deprecated v21 name of `params`. */
    interpolationSource?: Record<string, any> | null,
    plural?: number | null,
};

export type ExternalValidatorFn<T = any> = ($value: T, $formData: any, $context: RuleContext) => ExternalValidatorResult | null;

/** Wraps a function. Not serializable. */
export class ExternalValidatorRule<T = any> extends ValidationRule<T> {
    constructor(
        public readonly validatorFn: ExternalValidatorFn<T>,
        $name: string = ValidationType.EXTERNAL,
    ) {
        super($name);
    }

    public check($value: T, $context: RuleContext): ValidationRuleError | null {
        const result = this.validatorFn($value, $context.root, $context);
        if (!result) {
            return null;
        }
        if (isValidationRuleError(result)) {
            return result;
        }
        return ruleError(
            this.name,
            $value,
            result.rawMessage,
            result.params ?? result.interpolationSource ?? null,
            result.plural ?? null,
        );
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

    protected getRawMessageForValue(): string {
        return this.message;
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message};
    }
}

export class AgeRule extends ValidationRuleWithMessage {
    constructor(
        public readonly age: number = 18,
        protected readonly message: string = 'Age must be more than {{ age }}.',
    ) {
        super(ValidationType.AGE);
    }

    /** Valid when the date of birth is at least `age` years ago. */
    public validate($value: any): boolean {
        if (isEmpty($value)) {
            return true;
        }
        const date = typeof $value === 'string' || typeof $value === 'number'
            ? new Date($value)
            : $value instanceof Date
                ? $value
                : null;

        if (!date || Number.isNaN(date.getTime())) {
            return true;
        }
        const limit = new Date();
        limit.setFullYear(limit.getFullYear() - this.age);
        return date.getTime() <= limit.getTime();
    }

    protected getRawMessageForValue(): string {
        return this.message;
    }

    protected override getInterpolationSource(): Record<string, any> {
        return {age: this.age};
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message, age: this.age};
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

    protected getRawMessageForValue(): string {
        return this.message;
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message};
    }
}

/** Value must be equal to the value of another field (password confirmation). */
export class SameValueRule extends ValidationRuleWithMessage {
    public constructor(
        public readonly path: string,
        protected readonly message: string = 'Values do not match.',
    ) {
        super(ValidationType.SAME_VALUE);
    }

    public validate($value: any, $context: RuleContext): boolean {
        return isEmpty($value) || maybeEquals($value, $context.valueAt(this.path));
    }

    protected getRawMessageForValue(): string {
        return this.message;
    }

    protected override getInterpolationSource(): Record<string, any> {
        return {path: this.path};
    }

    public override toConstraint(): RuleConstraint {
        return {type: this.name, message: this.message, path: this.path};
    }
}
