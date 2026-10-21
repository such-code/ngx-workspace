import {Injector, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
    applyDynamic,
    applyEach,
    applySchema,
    applyWhen,
    arrayOps,
    disabled,
    email,
    fieldAt,
    form,
    hidden,
    maxLength,
    min,
    minLength,
    readonly,
    required,
    SchemaFn,
    submit,
    trackBy,
    validate,
    validateTree,
} from '@such-code/ngx-forms';

function create<T>(value: T, schema?: SchemaFn<T>) {
    const model = signal(value);
    const f = form(model, schema, {injector: TestBed.inject(Injector), name: 'f'});
    return {model, f};
}

const kinds = (errors: ReadonlyArray<{ kind: string }>) => errors.map($ => $.kind);

describe('structure', () => {
    it('derives fields from the model and writes back immutably', () => {
        const {model, f} = create({user: {name: 'a'}, tags: ['x']});
        const before = model();
        f.user.name().value.set('b');
        expect(model()).toEqual({user: {name: 'b'}, tags: ['x']});
        expect(model()).not.toBe(before);
        expect(model().tags).toBe(before.tags);
        expect(f.user.name().pathKey()).toBe('user.name');
        expect(f.user.name().name()).toBe('f.user.name');
        expect(f.tags[0]().path()).toEqual(['tags', 0]);
    });

    it('returns the same field objects and hides children without a value', () => {
        const {model, f} = create<{ company?: { name: string } }>({});
        expect(f.company).toBeUndefined();
        model.set({company: {name: ''}});
        expect(f.company!.name).toBe(f.company!.name);
        expect(f.company!.name().value()).toBe('');
    });

    it('iterates array fields', () => {
        const {f} = create({lines: [{sku: 'a'}, {sku: 'b'}]});
        expect([...f.lines].map($ => $.sku().value())).toEqual(['a', 'b']);
        expect(f.lines.length).toBe(2);
        expect(f.lines.map($ => $().pathKey())).toEqual(['lines.0', 'lines.1']);
    });
});

describe('arrays and identity', () => {
    it('keeps item state when objects are reordered (no symbols written into the data)', () => {
        const {model, f} = create({lines: [{sku: 'a'}, {sku: 'b'}]});
        const first = f.lines[0];
        first().markAsTouched();
        arrayOps(f.lines).move(0, 1);
        expect(f.lines[1]).toBe(first);
        expect(first().touched()).toBe(true);
        expect(first().pathKey()).toBe('lines.1');
        expect(Object.getOwnPropertySymbols(model().lines[0])).toEqual([]);
    });

    it('keeps item state when an item is written through its field', () => {
        const {f} = create({lines: [{sku: 'a'}, {sku: 'b'}]});
        const second = f.lines[1];
        second().markAsTouched();
        second.sku().value.set('changed');
        arrayOps(f.lines).remove(0);
        expect(f.lines[0]).toBe(second);
        expect(second().touched()).toBe(true);
    });

    it('follows trackBy keys across refetched objects', () => {
        const {model, f} = create({lines: [{id: 1, sku: 'a'}, {id: 2, sku: 'b'}]}, p => trackBy(p.lines, $ => $.id));
        const second = f.lines[1];
        second().setErrors('server', [{kind: 'taken'}], {stale: 'never'});
        model.set({lines: [{id: 2, sku: 'b'}, {id: 3, sku: 'c'}]});
        expect(f.lines[0]).toBe(second);
        expect(kinds(second().errors())).toEqual(['taken']);
    });

    it('detaches removed items: state stays readable, writes are ignored', () => {
        const {model, f} = create({lines: [{id: 1, sku: 'a'}, {id: 2, sku: 'b'}]});
        const removed = f.lines[1];
        arrayOps(f.lines).remove(1);
        expect(removed().attached()).toBe(false);
        // What `@for (...; track line().value().id)` reads for a removed row.
        expect(removed().value().id).toBe(2);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        removed.sku().value.set('x');
        removed().markAsTouched();
        expect(model().lines).toEqual([{id: 1, sku: 'a'}]);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('validation', () => {
    it('runs built-in validators and exposes their metadata', () => {
        const {f} = create({name: '', age: 10, mail: 'nope'}, p => {
            required(p.name);
            min(p.age, 18);
            email(p.mail);
            minLength(p.name, 2);
            maxLength(p.name, 5);
        });
        expect(kinds(f.name().errors())).toEqual(['required']);
        expect(kinds(f.age().errors())).toEqual(['min']);
        expect(kinds(f.mail().errors())).toEqual(['email']);
        expect(f.name().required()).toBe(true);
        expect(f.name().minLength()).toBe(2);
        expect(f.name().maxLength()).toBe(5);
        expect(f.age().min()).toBe(18);
        expect(f().valid()).toBe(false);
        expect(f().errorSummary().length).toBe(3);
    });

    it('re-runs only the rule whose dependency changed', () => {
        const a = signal(0);
        const b = signal(0);
        let runsA = 0;
        let runsB = 0;
        const {f} = create({x: ''}, p => {
            validate(p.x, () => {
                runsA++;
                a();
                return null;
            });
            validate(p.x, () => {
                runsB++;
                b();
                return null;
            });
        });
        f.x().errors();
        a.set(1);
        f.x().errors();
        expect(runsA).toBe(2);
        expect(runsB).toBe(1);
    });

    it('applies rules conditionally', () => {
        const {model, f} = create({type: 'person', vat: ''}, p => {
            applyWhen(p, ctx => ctx.value().type === 'business', b => required(b.vat));
        });
        expect(f.vat().required()).toBe(false);
        expect(f().valid()).toBe(true);
        model.update($ => ({...$, type: 'business'}));
        expect(f.vat().required()).toBe(true);
        expect(kinds(f.vat().errors())).toEqual(['required']);
    });

    it('targets tree errors without leaking them to other fields', () => {
        const {model, f} = create({password: 'a', confirm: 'b', other: ''}, p => {
            validateTree(p, ctx => ctx.value().password !== ctx.value().confirm
                ? {kind: 'mismatch', path: 'confirm'}
                : null);
        });
        expect(kinds(f.confirm().errors())).toEqual(['mismatch']);
        expect(f.other().errors()).toEqual([]);
        expect(f().errors()).toEqual([]);
        expect(f().invalid()).toBe(true);
        model.update($ => ({...$, password: 'b'}));
        expect(f.confirm().errors()).toEqual([]);
    });

    it('does not validate hidden or disabled fields, but validates readonly ones', () => {
        const {f} = create({a: '', b: '', c: ''}, p => {
            required(p.a);
            required(p.b);
            required(p.c);
            hidden(p.a);
            disabled(p.b, 'locked');
            readonly(p.c);
        });
        expect(f.a().errors()).toEqual([]);
        expect(f.b().disabledReasons()).toEqual(['locked']);
        expect(f.b().errors()).toEqual([]);
        expect(kinds(f.c().errors())).toEqual(['required']);
    });
});

describe('dynamic rules', () => {
    it('adds rules (with metadata) after the form was created and removes them again', () => {
        const {f} = create({age: 10});
        expect(f.age().required()).toBe(false);
        const remove = applySchema(f, p => {
            required(p.age);
            min(p.age, 18);
        });
        expect(f.age().required()).toBe(true);
        expect(f.age().min()).toBe(18);
        expect(kinds(f.age().errors())).toEqual(['min']);
        remove();
        expect(f.age().required()).toBe(false);
        expect(f().valid()).toBe(true);
    });

    it('applies a schema from a signal and follows its changes', () => {
        const source = signal<SchemaFn<{ name: string }> | null>(null);
        const {f} = create({name: ''}, p => applyDynamic(p, () => source()));
        expect(f().valid()).toBe(true);
        source.set(p => required(p.name));
        expect(f.name().required()).toBe(true);
        expect(f().valid()).toBe(false);
        source.set(null);
        expect(f().valid()).toBe(true);
    });

    it('applies rules to one array item and keeps them with the item', () => {
        const {f} = create({lines: [{sku: ''}, {sku: ''}]});
        const second = f.lines[1];
        applySchema(second, p => required(p.sku));
        expect(f.lines[0].sku().required()).toBe(false);
        arrayOps(f.lines).move(1, 0);
        expect(f.lines[0]).toBe(second);
        expect(second.sku().required()).toBe(true);
    });

    it('applies rules to array items added later', () => {
        const {f} = create({lines: [] as Array<{ sku: string }>}, p => applyEach(p.lines, l => required(l.sku)));
        arrayOps(f.lines).push({sku: ''});
        expect(kinds(f.lines[0].sku().errors())).toEqual(['required']);
    });
});

describe('pushed errors', () => {
    it('keeps sources apart: validators never remove pushed errors and vice versa', () => {
        const {f} = create({name: ''}, p => required(p.name));
        f.name().setErrors('server', [{kind: 'taken'}], {stale: 'never'});
        expect(kinds(f.name().errors())).toEqual(['required', 'taken']);
        f.name().value.set('x');
        expect(kinds(f.name().errors())).toEqual(['taken']);
        f.name().clearErrors('server');
        expect(f.name().errors()).toEqual([]);
    });

    it('drops on-change errors when their field changes, not when a sibling does, and never brings them back', () => {
        const {f} = create({login: 'admin', other: ''});
        f.login().setErrors('server', [{kind: 'taken'}]);
        f.other().value.set('x');
        expect(kinds(f.login().errors())).toEqual(['taken']);
        f.login().value.set('admin2');
        expect(f.login().errors()).toEqual([]);
        f.login().value.set('admin');
        expect(f.login().errors()).toEqual([]);
    });

    it('drops an answer for a value that changed already', () => {
        const {f} = create({login: 'abcd'});
        f.login().setErrors('server', [{kind: 'taken'}], {forValue: 'abc'});
        expect(f.login().errors()).toEqual([]);
    });

    it('hides errors of skipped fields unless asked, and keeps them', () => {
        const off = signal(true);
        const {f} = create({a: '', b: ''}, p => {
            disabled(p.a, () => off());
            disabled(p.b, () => off());
        });
        f.a().setErrors('server', [{kind: 'x'}]);
        f.b().setErrors('server', [{kind: 'y'}], {whenSkipped: true});
        expect(f.a().errors()).toEqual([]);
        expect(kinds(f.b().errors())).toEqual(['y']);
        off.set(false);
        expect(kinds(f.a().errors())).toEqual(['x']);
    });

    it('reset clears pushed errors, touched and dirty', () => {
        const {f} = create({a: 'x'});
        f.a().setErrors('server', [{kind: 'x'}], {stale: 'never'});
        f.a().markAsTouched();
        f.a().markAsDirty();
        f().reset({a: ''});
        expect(f.a().errors()).toEqual([]);
        expect(f().touched()).toBe(false);
        expect(f().dirty()).toBe(false);
        expect(f.a().value()).toBe('');
    });

    it('resolves fields by path', () => {
        const {f} = create({lines: [{sku: 'a'}]});
        expect(fieldAt(f, 'lines[0].sku')).toBe(f.lines[0].sku);
        expect(fieldAt(f, 'lines.3.sku')).toBeUndefined();
    });
});

describe('pending', () => {
    it('aggregates upwards only', () => {
        const {f} = create({group: {a: '', b: ''}});
        f.group().setPending('check', true);
        expect(f().pending()).toBe(true);
        expect(f().valid()).toBe(false);
        expect(f.group.a().pending()).toBe(false);
        f.group.a().setPending('x', true);
        f.group().setPending('check', false);
        expect(f.group().pending()).toBe(true);
    });
});

describe('submit', () => {
    it('touches fields and refuses invalid forms without running the action', async () => {
        const {f} = create({name: ''}, p => required(p.name));
        const action = vi.fn();
        expect(await submit(f, action)).toBe(false);
        expect(action).not.toHaveBeenCalled();
        expect(f.name().touched()).toBe(true);
    });

    it('attaches returned errors to their fields; they clear when the field changes', async () => {
        const {f} = create({login: 'admin', lines: [{sku: 'a'}]});
        const result = await submit(f, async () => [
            {kind: 'taken', path: 'login'},
            {kind: 'unknown', field: f.lines[0].sku},
            {kind: 'general', message: 'Try later'},
        ]);
        expect(result).toBe(false);
        expect(kinds(f.login().errors())).toEqual(['taken']);
        expect(kinds(f.lines[0].sku().errors())).toEqual(['unknown']);
        expect(kinds(f().errors())).toEqual(['general']);
        expect(f.login().errors()[0].source).toBe('submit');
        f.login().value.set('other');
        expect(f.login().errors()).toEqual([]);
    });

    it('marks the subtree submitting and locked, without disabling validation', async () => {
        const {f} = create({name: ''});
        let resolve!: () => void;
        const done = submit(f, () => new Promise<void>($ => resolve = $));
        await Promise.resolve();
        expect(f.name().submitting()).toBe(true);
        expect(f.name().locked()).toBe(true);
        expect(f.name().disabled()).toBe(false);
        expect(await submit(f, () => undefined)).toBe(false);
        resolve();
        expect(await done).toBe(true);
        expect(f.name().locked()).toBe(false);
    });

    it('maps thrown errors with onError, rethrows without it', async () => {
        const {f} = create({name: 'a'});
        const failing = () => Promise.reject(new Error('offline'));
        expect(await submit(f, {action: failing, onError: e => [{kind: 'network', message: (e as Error).message}]})).toBe(false);
        expect(f().errors()[0].message).toBe('offline');
        await expect(submit(f, failing)).rejects.toThrow('offline');
        expect(f().submitting()).toBe(false);
    });

    it('clears errors of the previous submit', async () => {
        const {f} = create({name: 'a'});
        f.name().setErrors('note', [{kind: 'n'}], {stale: 'on-submit'});
        await submit(f, () => [{kind: 'general'}]);
        expect(kinds(f().errorSummary())).toEqual(['general']);
        await submit(f, {action: () => undefined, ignoreValidators: true});
        expect(f().errorSummary()).toEqual([]);
    });
});
