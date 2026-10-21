import {Injector, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import {applyEach, arrayOps, form, required, SchemaFn, submit, validateAsync, validateTree} from '@such-code/ngx-forms';

function create<T>(value: T, schema?: SchemaFn<T>) {
    const model = signal(value);
    const f = form(model, schema, {injector: TestBed.inject(Injector)});
    return {model, f};
}

const kinds = (errors: ReadonlyArray<{ kind: string }>) => errors.map($ => $.kind);

async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise($ => setTimeout($));
    TestBed.tick();
}

function deferred<T>() {
    let resolve!: ($: T) => void;
    const promise = new Promise<T>($ => resolve = $);
    return {promise, resolve};
}

describe('async validation', () => {
    it('is pending until the result for the current value arrives; older answers are never shown', async () => {
        const calls: Array<{ value: string, done: ReturnType<typeof deferred<boolean>> }> = [];
        const {f} = create({login: 'abc'}, p => validateAsync(p.login, {
            params: ctx => ctx.value(),
            run: value => {
                const done = deferred<boolean>();
                calls.push({value, done});
                return done.promise;
            },
            onSuccess: taken => taken ? {kind: 'taken'} : null,
        }));
        expect(f.login().pending()).toBe(true);
        expect(f().pending()).toBe(true);
        await settle();
        f.login().value.set('abcd');
        await settle();
        expect(calls.map($ => $.value)).toEqual(['abc', 'abcd']);

        // The answer for "abc" arrives late: ignored.
        calls[0].done.resolve(true);
        await settle();
        expect(f.login().errors()).toEqual([]);
        expect(f.login().pending()).toBe(true);

        calls[1].done.resolve(true);
        await settle();
        expect(f.login().pending()).toBe(false);
        expect(kinds(f.login().errors())).toEqual(['taken']);
    });

    it('applies every emission of a stream, independently of other async validators', async () => {
        const stream = new Subject<number>();
        const once = deferred<string>();
        const {f} = create({file: 'x'}, p => {
            validateAsync(p.file, {
                params: ctx => ctx.value(),
                run: () => stream,
                onSuccess: progress => progress < 100 ? {kind: 'scanning', progress} : null,
            });
            validateAsync(p.file, {params: ctx => ctx.value(), run: () => once.promise, onSuccess: $ => ({kind: $})});
        });
        f.file().errors();
        await settle();
        stream.next(10);
        expect(kinds(f.file().errors())).toEqual(['scanning']);
        expect(f.file().pending()).toBe(true);
        once.resolve('virus');
        await settle();
        expect(kinds(f.file().errors())).toEqual(['scanning', 'virus']);
        stream.next(100);
        expect(kinds(f.file().errors())).toEqual(['virus']);
        expect(f.file().pending()).toBe(false);
    });

    it('waits for the field\'s own sync validity only (not the whole form)', async () => {
        const run = vi.fn(async () => false);
        const {f} = create({login: '', other: ''}, p => {
            required(p.login);
            required(p.other);
            validateAsync(p.login, {params: ctx => ctx.value(), run, onSuccess: () => null});
        });
        f.login().errors();
        await settle();
        expect(run).not.toHaveBeenCalled();
        f.login().value.set('me');
        f.login().errors();
        await settle();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('does not mark descendants pending for an ancestor check', async () => {
        const done = deferred<null>();
        const {f} = create({a: '', b: ''}, p => validateAsync(p, {params: ctx => ctx.value(), run: () => done.promise, onSuccess: () => null}));
        expect(f().pending()).toBe(true);
        expect(f.a().pending()).toBe(false);
        done.resolve(null);
        await settle();
        expect(f().pending()).toBe(false);
    });

    it('aborts and forgets the check of a removed array item', async () => {
        const signals: Array<AbortSignal> = [];
        const {f} = create({lines: [{sku: 'a'}, {sku: 'b'}]}, p => applyEach(p.lines, l => validateAsync(l.sku, {
            params: ctx => ctx.value(),
            run: (_, {signal: abort}) => {
                signals.push(abort);
                return new Promise(() => undefined);
            },
            onSuccess: () => null,
        })));
        expect(f().valid()).toBe(false);
        await settle();
        expect(signals.length).toBe(2);
        arrayOps(f.lines).remove(1);
        await settle();
        expect(signals[1].aborted).toBe(true);
        expect(signals[0].aborted).toBe(false);
        expect(f.lines.length).toBe(1);
    });

    it('debounces requests', async () => {
        const run = vi.fn(async ($q: string) => null);
        const {f} = create({q: ''}, p => validateAsync(p.q, {params: ctx => ctx.value(), run, onSuccess: () => null, debounce: 20}));
        f.q().errors();
        await settle();
        f.q().value.set('a');
        await settle();
        f.q().value.set('ab');
        await settle();
        expect(run).not.toHaveBeenCalled();
        await new Promise($ => setTimeout($, 40));
        expect(run).toHaveBeenCalledTimes(1);
        expect(run.mock.calls[0][0]).toBe('ab');
    });

    it('submit waits for pending validation by default', async () => {
        const done = deferred<boolean>();
        const action = vi.fn();
        const {f} = create({login: 'abc'}, p => validateAsync(p.login, {
            params: ctx => ctx.value(),
            run: () => done.promise,
            onSuccess: taken => taken ? {kind: 'taken'} : null,
        }));
        const result = submit(f, action);
        await settle();
        expect(action).not.toHaveBeenCalled();
        done.resolve(true);
        await settle();
        expect(await result).toBe(false);
        expect(action).not.toHaveBeenCalled();
    });

    it('cross-field tree validators do not run for unrelated fields', () => {
        let runs = 0;
        const {f} = create({a: '', b: {c: ''}}, p => validateTree(p.b, () => {
            runs++;
            return null;
        }));
        f.a().value.set('x');
        f().valid();
        f.a().value.set('y');
        f().valid();
        expect(runs).toBe(1);
    });
});

describe('async validation in dynamic schemas', () => {
    it('stops the runner of a rule that was removed', async () => {
        const {applySchema} = await import('@such-code/ngx-forms');
        const run = vi.fn(() => new Promise(() => undefined));
        const {f} = create({q: 'a'});
        const remove = applySchema(f, p => validateAsync(p.q, {params: ctx => ctx.value(), run, onSuccess: () => null}));
        expect(f.q().pending()).toBe(true);
        await settle();
        expect(run).toHaveBeenCalledTimes(1);
        remove();
        expect(f.q().pending()).toBe(false);
        f.q().errors();
        f.q().value.set('b');
        await settle();
        expect(run).toHaveBeenCalledTimes(1);
    });
});
