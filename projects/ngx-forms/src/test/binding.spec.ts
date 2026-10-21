import {Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
    applyEach,
    applySchema,
    arrayOps,
    debounce,
    FieldTree,
    form,
    injectFieldControl,
    min,
    NgxField,
    NgxNormalize,
    normalizers,
    required,
    submit,
    transformedValue,
} from '@such-code/ngx-forms';

@Component({
    selector: 'test-amount',
    template: `<input class="amount" [value]="raw()" (input)="raw.set($any($event.target).value)">`,
})
class AmountControl {
    protected readonly control = injectFieldControl<number | null>();
    protected readonly raw = transformedValue(this.control, {
        parse: ($: string) => {
            const text = $.replace(/\s/g, '').replace(',', '.');
            if (!text) {
                return {value: null};
            }
            const value = Number(text);
            return Number.isNaN(value) ? {error: {kind: 'parse', message: 'Not an amount'}} : {value};
        },
        format: ($: number | null) => $ === null ? '' : $.toFixed(2),
    });
}

type Line = { id: number, sku: string };

@Component({
    imports: [NgxField, NgxNormalize, AmountControl],
    template: `
        <input id="name" [ngxField]="f.name">
        <input id="age" type="number" [ngxField]="f.age">
        <input id="code" [ngxField]="f.code" [ngxNormalize]="upper">
        <input id="nick" [ngxField]="f.nick" [ngxNormalize]="trim" ngxNormalizeOn="blur">
        <input id="slow" [ngxField]="f.slow">
        <input id="agree" type="checkbox" [ngxField]="f.agree">
        <input type="radio" class="color" value="red" [ngxField]="f.color">
        <input type="radio" class="color" value="blue" [ngxField]="f.color">
        <select id="region" [ngxField]="f.region">
            @for (r of regions(); track r) {
                <option [value]="r">{{ r }}</option>
            }
        </select>
        <test-amount id="amount" [ngxField]="f.amount"/>
        @for (line of f.lines; track line().value().id) {
            <input class="sku" [ngxField]="line.sku">
        }
    `,
})
class TestComponent {
    public readonly model = signal({
        name: 'a', age: 20 as number | null, code: '', nick: '', slow: '', agree: false, color: 'red', region: 'x',
        amount: 5 as number | null, lines: [{id: 1, sku: 'a'}, {id: 2, sku: ''}] as Array<Line>,
    });
    public readonly regions = signal<Array<string>>([]);
    public readonly upper = normalizers.upper;
    public readonly trim = normalizers.trim;
    public readonly f = form(this.model, p => {
        min(p.age, 18);
        debounce(p.slow, 'blur');
        applyEach(p.lines, l => required(l.sku));
    }, {name: 'test'});
}

function type($input: HTMLInputElement, $value: string, $event = 'input'): void {
    $input.value = $value;
    $input.dispatchEvent(new Event($event));
}

async function render() {
    const fixture = TestBed.createComponent(TestComponent);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const q = <E extends HTMLElement = HTMLInputElement>(s: string) => el.querySelector(s) as E;
    return {fixture, cmp: fixture.componentInstance, el, q, stable: () => fixture.whenStable()};
}

describe('[ngxField]', () => {
    it('binds text both ways and marks dirty and touched', async () => {
        const {cmp, q, stable} = await render();
        expect(q('#name').value).toBe('a');
        type(q('#name'), 'ab');
        expect(cmp.model().name).toBe('ab');
        expect(cmp.f.name().dirty()).toBe(true);
        q('#name').dispatchEvent(new Event('focusout'));
        expect(cmp.f.name().touched()).toBe(true);
        cmp.f.name().value.set('zz');
        await stable();
        expect(q('#name').value).toBe('zz');
        expect(q('#name').getAttribute('name')).toBe('test.name');
    });

    it('turns bad numbers into parse errors and keeps the model', async () => {
        const {cmp, q, stable} = await render();
        expect(q('#age').getAttribute('min')).toBe('18');
        type(q('#age'), '17');
        expect(cmp.model().age).toBe(17);
        expect(cmp.f.age().errors().map($ => $.kind)).toEqual(['min']);
        type(q('#age'), '');
        expect(cmp.model().age).toBeNull();
        Object.defineProperty(q('#age'), 'validity', {value: {badInput: true}, configurable: true});
        type(q('#age'), '');
        expect(cmp.f.age().errors().map($ => $.kind)).toEqual(['parse']);
        expect(cmp.model().age).toBeNull();
        cmp.f.age().value.set(30);
        await stable();
        expect(cmp.f.age().errors()).toEqual([]);
    });

    it('reflects rules added later as attributes', async () => {
        const {cmp, q, stable} = await render();
        expect(q('#name').hasAttribute('required')).toBe(false);
        applySchema(cmp.f, p => required(p.name));
        await stable();
        expect(q('#name').hasAttribute('required')).toBe(true);
        expect(q('#name').getAttribute('aria-required')).toBe('true');
    });

    it('normalizes while typing and on blur', async () => {
        const {cmp, q} = await render();
        type(q('#code'), 'lv80');
        expect(q('#code').value).toBe('LV80');
        expect(cmp.model().code).toBe('LV80');
        type(q('#nick'), '  me ');
        expect(cmp.model().nick).toBe('  me ');
        q('#nick').dispatchEvent(new Event('focusout'));
        expect(cmp.model().nick).toBe('me');
        expect(q('#nick').value).toBe('me');
    });

    it('commits debounced input on blur only', async () => {
        const {cmp, q} = await render();
        type(q('#slow'), 'abc');
        expect(cmp.model().slow).toBe('');
        q('#slow').dispatchEvent(new Event('focusout'));
        expect(cmp.model().slow).toBe('abc');
    });

    it('binds checkboxes, radios and late select options', async () => {
        const {cmp, q, el, stable} = await render();
        const agree = q('#agree');
        agree.checked = true;
        agree.dispatchEvent(new Event('change'));
        expect(cmp.model().agree).toBe(true);

        const radios = el.querySelectorAll<HTMLInputElement>('.color');
        expect(radios[0].checked).toBe(true);
        expect(radios[0].name).toBe(radios[1].name);
        radios[1].checked = true;
        radios[1].dispatchEvent(new Event('change'));
        expect(cmp.model().color).toBe('blue');

        cmp.regions.set(['w', 'x']);
        await stable();
        await new Promise($ => setTimeout($));
        expect(q<HTMLSelectElement>('#region').value).toBe('x');
    });

    it('supports custom controls with parse errors', async () => {
        const {cmp, q, stable} = await render();
        const input = q('.amount');
        expect(input.value).toBe('5.00');
        type(input, '12,5');
        expect(cmp.model().amount).toBe(12.5);
        expect(input.value).toBe('12,5');
        type(input, 'abc');
        expect(cmp.model().amount).toBe(12.5);
        expect(cmp.f.amount().errors().map($ => $.kind)).toEqual(['parse']);
        cmp.f.amount().value.set(1);
        await stable();
        expect(input.value).toBe('1.00');
        expect(cmp.f.amount().errors()).toEqual([]);
    });

    it('locks controls during submit, without disabling validation', async () => {
        const {cmp, q, stable} = await render();
        let finish!: () => void;
        const done = submit(cmp.f.name as FieldTree<string>, () => new Promise<void>($ => finish = $));
        await stable();
        expect(q('#name').disabled).toBe(true);
        expect(q('#age').disabled).toBe(false);
        finish();
        await done;
        await stable();
        expect(q('#name').disabled).toBe(false);
    });

    it('removes a row after a failed submit even when tracking by value', async () => {
        const {cmp, el, stable} = await render();
        expect(await submit(cmp.f.lines, () => undefined)).toBe(false);
        await stable();
        arrayOps(cmp.f.lines).remove(1);
        await stable();
        expect(el.querySelectorAll('.sku').length).toBe(1);
        expect(cmp.f().valid()).toBe(true);
    });

    it('focuses the first invalid control', async () => {
        const {cmp, el, stable} = await render();
        expect(await submit(cmp.f.lines, () => undefined)).toBe(false);
        await stable();
        expect(document.activeElement).toBe(el.querySelectorAll('.sku')[1]);
    });
});
