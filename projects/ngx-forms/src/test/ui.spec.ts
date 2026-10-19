import {Component, ErrorHandler, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';

import {applyEach} from '@angular/forms/signals';
import {applyRules, arrayOps, FormField, ngxForm, NgxForms, normalizers, RequiredRule, ValidationIntl} from '@such-code/ngx-forms';

@Component({
    imports: [NgxForms],
    template: `
        <form [ngxForm]="form" (ngxSubmitted)="result = $event">
            <input id="name" [formField]="form.fields.name" ngxFieldState>
            <ngx-field-errors [field]="form.fields.name"/>
            <input id="iban" [formField]="form.fields.iban" [ngxNormalize]="iban">
            <input id="nick" [formField]="form.fields.nick" [ngxNormalize]="trim" ngxNormalizeOn="blur">
            <ngx-form-errors heading="Oops"/>
            <button type="submit">Save</button>
        </form>
    `,
})
class TestFormComponent {
    public readonly model = signal({name: '', iban: '', nick: ''});
    public readonly iban = ($: string) => normalizers.group(4)(normalizers.upper($));
    public readonly trim = normalizers.trim;
    public calls = 0;
    public fail: unknown = null;
    public result: boolean | null = null;
    public readonly form = ngxForm(this.model, p => applyRules(p.name, [new RequiredRule()]), {
        action: async () => {
            this.calls++;
            if (this.fail) {
                throw this.fail;
            }
        },
    });
}

function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
}

describe('UI', () => {
    async function render() {
        const fixture = TestBed.createComponent(TestFormComponent);
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        return {fixture, el, cmp: fixture.componentInstance, q: (s: string) => el.querySelector(s) as HTMLElement};
    }

    it('shows field errors after submit and translates them', async () => {
        const {fixture, cmp, q} = await render();
        expect(q('ngx-field-errors').textContent!.trim()).toBe('');
        expect(q('#name').hasAttribute('data-state-invalid')).toBe(true);
        expect(q('#name').hasAttribute('data-state-validated')).toBe(false);

        q('button').click();
        await fixture.whenStable();
        expect(cmp.calls).toBe(0);
        expect(cmp.result).toBe(false);
        expect(q('ngx-field-errors').textContent!.trim()).toBe('This field is required.');
        expect(q('#name').hasAttribute('data-state-validated')).toBe(true);

        TestBed.inject(ValidationIntl).update({'This field is required.': 'Obligāts lauks.'});
        await fixture.whenStable();
        expect(q('ngx-field-errors').textContent!.trim()).toBe('Obligāts lauks.');

        type(q('#name') as HTMLInputElement, 'Erik');
        await fixture.whenStable();
        expect(q('ngx-field-errors').hasAttribute('data-state-visible')).toBe(false);
    });

    it('submits through the directive and shows form errors', async () => {
        const {fixture, cmp, q} = await render();
        type(q('#name') as HTMLInputElement, 'Erik');
        cmp.fail = new Error('Generic error occurred.');
        q('button').click();
        await fixture.whenStable();
        expect(cmp.calls).toBe(1);
        expect(cmp.result).toBe(false);
        expect(q('ngx-form-errors').textContent).toContain('Generic error occurred.');
        expect(q('ngx-form-errors').querySelector('h4')!.textContent).toBe('Oops');

        cmp.fail = null;
        q('button').click();
        await fixture.whenStable();
        expect(cmp.result).toBe(true);
        expect(q('ngx-form-errors').textContent!.trim()).toBe('');
    });

    it('normalizes while typing and on blur', async () => {
        const {fixture, cmp, q} = await render();
        const iban = q('#iban') as HTMLInputElement;
        type(iban, 'lv80bank0000');
        await fixture.whenStable();
        expect(iban.value).toBe('LV80 BANK 0000');
        expect(cmp.model().iban).toBe('LV80 BANK 0000');

        const nick = q('#nick') as HTMLInputElement;
        type(nick, '  me  ');
        await fixture.whenStable();
        expect(cmp.model().nick).toBe('  me  ');
        nick.dispatchEvent(new Event('blur'));
        await fixture.whenStable();
        expect(cmp.model().nick).toBe('me');
        expect(nick.value).toBe('me');
    });
});

@Component({
    imports: [NgxForms],
    template: `
        <form [ngxForm]="form">
            @for (item of form.fields.lines; track item; let i = $index) {
                <div class="row">
                    <input class="sku" [formField]="item.sku">
                    <ngx-field-errors [field]="item.sku"/>
                    <button type="button" class="remove" (click)="lines.remove(i)">×</button>
                </div>
            }
            <button type="submit">Save</button>
        </form>
    `,
})
class TestArrayComponent {
    public readonly model = signal({lines: [{id: 1, sku: ''}]});
    public readonly form = ngxForm(this.model, p => applyEach(p.lines, $ => applyRules($.sku, [new RequiredRule()])), {
        action: async () => undefined,
    });
    public readonly lines = arrayOps(this.form.fields.lines);
}

describe('UI arrays', () => {
    it('removes a row after a failed submit', async () => {
        const errors: Array<unknown> = [];
        TestBed.configureTestingModule({providers: [{provide: ErrorHandler, useValue: {handleError: ($: unknown) => errors.push($)}}]});
        const fixture = TestBed.createComponent(TestArrayComponent);
        const el: HTMLElement = fixture.nativeElement;
        const cmp = fixture.componentInstance;
        await fixture.whenStable();

        type(el.querySelector('.sku') as HTMLInputElement, 'A1');
        cmp.lines.push({id: 2, sku: ''});
        await fixture.whenStable();
        type(el.querySelectorAll<HTMLInputElement>('.sku')[1], 'B2');
        cmp.lines.push({id: 3, sku: ''});
        await fixture.whenStable();

        (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(el.querySelectorAll('.row').length).toBe(3);
        expect(el.querySelectorAll('ngx-field-errors[data-state-visible]').length).toBe(1);

        el.querySelectorAll<HTMLButtonElement>('.remove')[1].click();
        await fixture.whenStable();
        expect(errors).toEqual([]);
        expect(cmp.model().lines.map($ => $.sku)).toEqual(['A1', '']);
        expect(Array.from(el.querySelectorAll<HTMLInputElement>('.sku')).map($ => $.value)).toEqual(['A1', '']);
    });

    it('re-exports FormField', () => {
        expect(NgxForms).toContain(FormField);
    });
});
