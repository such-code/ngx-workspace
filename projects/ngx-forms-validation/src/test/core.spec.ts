import {Injector} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
    AgeRule,
    AllowedValueRule,
    deserializeRuleTemplate,
    DigitsRule,
    expandPath,
    MinLengthRule,
    normalizePath,
    parseServerError,
    PatternRule,
    provideRuleTemplates,
    RequiredRule,
    RuleRegistry,
    serializeRuleTemplate,
    SizeRule,
    stripPathPrefix,
    ValidationIntl,
} from '@such-code/ngx-forms-validation';

describe('core/path', () => {
    it('normalizes bracket paths and strips prefixes', () => {
        expect(normalizePath('items[0].name')).toBe('items.0.name');
        expect(stripPathPrefix('body.user[1].name', ['body'])).toBe('user.1.name');
        expect(stripPathPrefix('user.name', ['body.'])).toBe('user.name');
    });

    it('expands globs against a value', () => {
        const value = {items: [{name: 'a'}, {name: 'b'}], map: {x: 1, y: 2}};
        expect(expandPath(value, ['items', '*', 'name'])).toEqual([['items', '0', 'name'], ['items', '1', 'name']]);
        expect(expandPath(value, ['map', '*'])).toEqual([['map', 'x'], ['map', 'y']]);
        expect(expandPath(value, ['missing', '*'])).toEqual([]);
    });
});

describe('core/rules', () => {
    it('required accepts 0 and false, rejects empty values', () => {
        const rule = new RequiredRule();
        expect(rule.check(0, null as any)).toBeNull();
        expect(rule.check(false, null as any)).toBeNull();
        expect(rule.check('', null as any)?.kind).toBe('required');
        expect(rule.check([], null as any)?.kind).toBe('required');
        expect(rule.check(null, null as any)?.message).toBe('This field is required.');
    });

    it('interpolates messages and keeps raw message for translation', () => {
        const error = new MinLengthRule(3).check('ab', null as any)!;
        expect(error.message).toBe('Length should be greater then 3.');
        expect(error.rawMessage).toBe('Length should be greater then {{ length }}.');
        expect(error.params).toEqual({length: 3});
    });

    it('allowed value lets empty values pass', () => {
        const rule = new AllowedValueRule(['a', 'b']);
        expect(rule.check(null, null as any)).toBeNull();
        expect(rule.check('c', null as any)?.message).toBe('Value "c" is not allowed here.');
    });

    it('digits and age', () => {
        expect(new DigitsRule().check('0123', null as any)).toBeNull();
        expect(new DigitsRule().check('1.5', null as any)).not.toBeNull();
        const adult = new Date();
        adult.setFullYear(adult.getFullYear() - 20);
        const child = new Date();
        child.setFullYear(child.getFullYear() - 10);
        expect(new AgeRule(18).check(adult, null as any)).toBeNull();
        expect(new AgeRule(18).check(child, null as any)).not.toBeNull();
    });

    it('round-trips templates through constraints', () => {
        const template = {
            name: [new RequiredRule('Name!'), new SizeRule(2, 10)],
            code: [new PatternRule(/^[A-Z]+$/i)],
        };
        const restored = deserializeRuleTemplate(JSON.parse(JSON.stringify(serializeRuleTemplate(template))));
        expect(restored['name'].map($ => $.name)).toEqual(['required', 'size']);
        expect(restored['name'][0].check('', null as any)?.message).toBe('Name!');
        expect(restored['name'][1].check('a', null as any)).not.toBeNull();
        expect(restored['code'][0].check('abc', null as any)).toBeNull();
        expect(restored['code'][0].check('ab1', null as any)).not.toBeNull();
    });
});

describe('core/parseServerError', () => {
    it('splits details into field errors, constraints and unknown constraints', () => {
        const parsed = parseServerError({
            name: 'HttpErrorResponse',
            status: 400,
            message: 'Bad request',
            headers: {},
            error: {
                details: [
                    {param: 'body.user.name', message: 'Taken'},
                    {param: 'email', constraint: {type: 'required', message: 'Email!'}},
                    {param: 'age', constraint: {type: 'minOrEqual', message: 'Too young', limit: 18, context: 'Signup'}, message: 'Too young'},
                    {param: 'x', constraint: {type: 'custom-thing', message: 'x'}},
                    {param: 'y', existingConstraint: true},
                ],
            },
        }, {pathPrefixes: ['body']});

        expect(parsed.fieldErrors).toEqual([{path: 'user.name', message: 'Taken'}]);
        expect(parsed.constraints.map($ => [$.path, $.rule.name, $.context, $.message])).toEqual([
            ['email', 'required', null, null],
            ['age', 'minOrEqual', 'Signup', 'Too young'],
        ]);
        expect(parsed.unknownConstraints.map($ => $.type)).toEqual(['custom-thing']);
        expect(parsed.formErrors).toEqual([]);
    });

    it('turns transport and generic errors into form errors', () => {
        expect(parseServerError({name: 'HttpErrorResponse', status: 0, error: {}, headers: {}, message: 'Http failure'}).formErrors[0])
            .toMatchObject({kind: 'network', status: 0});
        expect(parseServerError({name: 'HttpErrorResponse', status: 500, error: 'Boom', headers: {}, message: 'x'}).formErrors[0])
            .toMatchObject({kind: 'server', message: 'Boom', status: 500});
        expect(parseServerError(new Error('Generic error occurred.')).formErrors[0])
            .toMatchObject({kind: 'unknown', message: 'Generic error occurred.'});
    });

    it('accepts Error subclasses carrying details', () => {
        const error = Object.assign(new Error('Validation'), {details: [{param: 'a', message: 'Bad'}]});
        expect(parseServerError(error).fieldErrors).toEqual([{path: 'a', message: 'Bad'}]);
    });
});

describe('core/RuleRegistry', () => {
    it('falls back to the parent registry and merges into the owner', () => {
        TestBed.configureTestingModule({providers: [provideRuleTemplates({Shared: {name: [new RequiredRule()]}})]});
        const root = TestBed.inject(RuleRegistry);
        expect(root.snapshot('Shared')!['name'].length).toBe(1);

        root.merge('Shared', 'name', [new RequiredRule('Other')], 'replace-kind');
        expect(root.snapshot('Shared')!['name'].length).toBe(1);
        expect(root.snapshot('Shared')!['name'][0].check('', null as any)?.message).toBe('Other');

        root.merge('Shared', 'name', [new MinLengthRule(2)], 'add');
        expect(root.snapshot('Shared')!['name'].map($ => $.name)).toEqual(['required', 'minLength']);
    });

    it('child templates extend parent templates per path', () => {
        TestBed.configureTestingModule({providers: [provideRuleTemplates({T: {a: [new RequiredRule()], b: [new RequiredRule()]}})]});
        const root = TestBed.inject(RuleRegistry);
        const child = Injector.create({
            providers: provideRuleTemplates({T: {b: [new MinLengthRule(2)], c: [new RequiredRule()]}}),
            parent: TestBed.inject(Injector),
        }).get(RuleRegistry);
        expect(child).not.toBe(root);
        const t = child.template('T')()!;
        expect(Object.keys(t).sort()).toEqual(['a', 'b', 'c']);
        expect(t['b'].map($ => $.name)).toEqual(['minLength']);

        root.merge('T', 'a', [new MinLengthRule(5)], 'add');
        expect(child.template('T')()!['a'].map($ => $.name)).toEqual(['required', 'minLength']);
    });

    it('loads a template once', async () => {
        const registry = TestBed.inject(RuleRegistry);
        let calls = 0;
        const loader = async () => {
            calls++;
            return {code: [{type: 'required', message: 'Code!'}]};
        };
        await Promise.all([registry.load('Remote', loader), registry.load('Remote', loader)]);
        expect(calls).toBe(1);
        expect(registry.snapshot('Remote')!['code'][0].name).toBe('required');
    });
});

describe('core/ValidationIntl', () => {
    it('translates raw messages with params and plural forms', () => {
        const intl = TestBed.inject(ValidationIntl);
        intl.update({'Length should be greater then {{ length }}.': 'Vismaz {{ length }} simboli.'});
        expect(intl.translateError(new MinLengthRule(3).check('a', null as any))).toBe('Vismaz 3 simboli.');
        expect(intl.translate('one item|{{ n }} items', {n: 5}, 5)).toBe('5 items');
        expect(intl.translateError({kind: 'required'})).toBe('This field is required.');
    });
});
