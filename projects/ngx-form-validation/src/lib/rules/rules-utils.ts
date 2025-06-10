import {ValidationType} from '../enum/validation-type';
import {RuleConstraint} from '../api/error-api.type';
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
    SizeRule,
    ValidationRuleWithMessage,
} from './rules';

export const ruleFromConstraintMap = new Map<ValidationType, ($constraint: RuleConstraint) => ValidationRuleWithMessage>([
    [ValidationType.SIZE, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        const minMaxMessage: Array<string> = $constraint.message.split('|');
        return new SizeRule($constraint['min'], $constraint['max'] ?? Number.POSITIVE_INFINITY, minMaxMessage[0], minMaxMessage[1]);
    }],
    [ValidationType.MIN_LENGTH, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new MinLengthRule($constraint['length'], $constraint.message);
    }],
    [ValidationType.MAX_LENGTH, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new MaxLengthRule($constraint['length'], $constraint.message);
    }],
    [ValidationType.MIN, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new MinRule($constraint['limit'], $constraint.message);
    }],
    [ValidationType.MIN_OR_EQUAL, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new MinOrEqualRule($constraint['limit'], $constraint.message);
    }],
    [ValidationType.MAX, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new MaxRule($constraint['limit'], $constraint.message);
    }],
    [ValidationType.MAX_OR_EQUAL, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new MaxOrEqualRule($constraint['limit'], $constraint.message);
    }],
    [ValidationType.REQUIRED, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new RequiredRule($constraint.message);
    }],
    [ValidationType.NOT_EMPTY, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new NotEmptyRule($constraint.message);
    }],
    [ValidationType.DIGITS, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new DigitsRule($constraint.message);
    }],
    [ValidationType.PATTERN, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        const regExpSettings: { source: string, flags: string } = JSON.parse($constraint['pattern']);
        return new PatternRule(new RegExp(regExpSettings.source, regExpSettings.flags), $constraint['match'], $constraint.message);
    }],
    [ValidationType.EMAIL, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new EmailRule($constraint['strict'], $constraint.message);
    }],
    [ValidationType.ALLOWED, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new AllowedValueRule($constraint['values']);
    }],
    [ValidationType.INCORRECT, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new IncorrectValueRule($constraint['value'], $constraint.message);
    }],
    [ValidationType.PHONE, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new PhoneRule($constraint.message);
    }],
    [ValidationType.AGE, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new AgeRule($constraint['age'], $constraint.message);
    }],
    [ValidationType.BOOLEAN, function ($constraint: RuleConstraint): ValidationRuleWithMessage {
        return new BooleanRule($constraint.message);
    }],
])
