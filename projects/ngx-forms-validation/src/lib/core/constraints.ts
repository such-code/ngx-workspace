import {ValidationType} from './validation-type';
import {
    AgeRule,
    AllowedValueRule,
    BooleanRule,
    DigitsRule,
    EmailRule,
    IncorrectValueRule,
    MaxLengthRule,
    MaxOrEqualRule,
    MaxRule,
    MinLengthRule,
    MinOrEqualRule,
    MinRule,
    NotEmptyRule,
    PatternRule,
    PhoneRule,
    RequiredRule,
    RuleConstraint,
    SameValueRule,
    SizeRule,
    ValidationRule,
} from './rules';

export type RuleFactory = ($constraint: RuleConstraint) => ValidationRule;

function optionalMessage($constraint: RuleConstraint): string | undefined {
    return typeof $constraint.message === 'string' && $constraint.message.length > 0 ? $constraint.message : undefined;
}

const factories = new Map<string, RuleFactory>([
    [ValidationType.SIZE, $ => {
        const [minMessage, maxMessage] = ($.message || '').split('|');
        return new SizeRule($['min'] ?? 0, $['max'] ?? Number.POSITIVE_INFINITY, minMessage || undefined, maxMessage || undefined);
    }],
    [ValidationType.MIN_LENGTH, $ => new MinLengthRule($['length'], optionalMessage($))],
    [ValidationType.MAX_LENGTH, $ => new MaxLengthRule($['length'], optionalMessage($))],
    [ValidationType.MIN, $ => new MinRule($['limit'], optionalMessage($))],
    [ValidationType.MIN_OR_EQUAL, $ => new MinOrEqualRule($['limit'], optionalMessage($))],
    [ValidationType.MAX, $ => new MaxRule($['limit'], optionalMessage($))],
    [ValidationType.MAX_OR_EQUAL, $ => new MaxOrEqualRule($['limit'], optionalMessage($))],
    [ValidationType.REQUIRED, $ => new RequiredRule(optionalMessage($))],
    [ValidationType.NOT_EMPTY, $ => new NotEmptyRule(optionalMessage($))],
    [ValidationType.DIGITS, $ => new DigitsRule(optionalMessage($))],
    [ValidationType.PATTERN, $ => {
        const settings: { source: string, flags: string } = typeof $['pattern'] === 'string'
            ? JSON.parse($['pattern'])
            : $['pattern'];
        return new PatternRule(new RegExp(settings.source, settings.flags), $['match'] ?? true, optionalMessage($));
    }],
    [ValidationType.EMAIL, $ => new EmailRule($['strict'] ?? true, optionalMessage($))],
    [ValidationType.ALLOWED, $ => new AllowedValueRule($['values'], optionalMessage($))],
    [ValidationType.INCORRECT, $ => new IncorrectValueRule($['value'], optionalMessage($))],
    [ValidationType.PHONE, $ => new PhoneRule(optionalMessage($))],
    [ValidationType.AGE, $ => new AgeRule($['age'], optionalMessage($))],
    [ValidationType.BOOLEAN, $ => new BooleanRule(optionalMessage($))],
    [ValidationType.SAME_VALUE, $ => new SameValueRule($['path'], optionalMessage($))],
]);

/** Registers (or replaces) a factory for a constraint type, so custom rules can be sent by the server. */
export function registerRuleFactory($type: string, $factory: RuleFactory): void {
    factories.set($type, $factory);
}

export function hasRuleFactory($type: string): boolean {
    return factories.has($type);
}

/** Returns `null` for unknown constraint types. */
export function ruleFromConstraint($constraint: RuleConstraint): ValidationRule | null {
    const factory = factories.get($constraint.type);
    return factory ? factory($constraint) : null;
}
