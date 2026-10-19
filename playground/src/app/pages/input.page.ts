import {Component, model, signal} from '@angular/core';
import {JsonPipe} from '@angular/common';
import {FormValueControl, transformedValue} from '@angular/forms/signals';
import {
    applyRules,
    MinOrEqualRule,
    ngxForm,
    NgxForms,
    normalizers,
    PatternRule,
    reaction,
    RequiredRule,
} from '@such-code/ngx-forms';

/** Parse/format: shows "1 234,50", stores 1234.5. Parse errors are reported to the field by Signal Forms. */
@Component({
    selector: 'app-amount-input',
    template: `<input class="form-control" inputmode="decimal" [value]="raw()" (input)="raw.set($any($event.target).value)" (blur)="touched.set(true)">`,
})
export class AmountInput implements FormValueControl<number | null> {
    public readonly value = model.required<number | null>();
    public readonly touched = model(false);
    protected readonly raw = transformedValue(this.value, {
        parse: ($: string) => {
            const text = $.replace(/\s/g, '').replace(',', '.');
            if (!text) {
                return {value: null};
            }
            const parsed = Number(text);
            return Number.isNaN(parsed) ? {error: {kind: 'parse', message: `"${$}" is not an amount.`}} : {value: parsed};
        },
        format: ($: number | null) => $ === null ? '' : $.toLocaleString('lv-LV', {minimumFractionDigits: 2}),
    });
}

const regions: Record<string, ReadonlyArray<string>> = {
    LV: ['Rīga', 'Kurzeme', 'Latgale'],
    EE: ['Harju', 'Tartu'],
};

@Component({
    imports: [NgxForms, JsonPipe, AmountInput],
    template: `
        <h2>Transforming input</h2>
        <form [ngxForm]="form" [ngxFormAction]="save">
            <div class="mb-3">
                <label class="form-label" for="iban">IBAN (uppercased and grouped while typing)</label>
                <input class="form-control" id="iban" [formField]="form.fields.iban" [ngxNormalize]="iban" ngxFieldState>
                <ngx-field-errors [field]="form.fields.iban"/>
            </div>
            <div class="mb-3">
                <label class="form-label" for="nick">Nickname (trimmed on blur)</label>
                <input class="form-control" id="nick" [formField]="form.fields.nick" [ngxNormalize]="trim" ngxNormalizeOn="blur">
            </div>
            <div class="mb-3">
                <label class="form-label">Amount (parse/format)</label>
                <app-amount-input [formField]="form.fields.amount"/>
                <ngx-field-errors [field]="form.fields.amount"/>
            </div>
            <div class="row g-2 mb-3">
                <div class="col">
                    <label class="form-label" for="country">Country</label>
                    <select class="form-select" id="country" [formField]="form.fields.country">
                        <option value="LV">Latvia</option>
                        <option value="EE">Estonia</option>
                    </select>
                </div>
                <div class="col">
                    <label class="form-label" for="region">Region (reset when the country changes)</label>
                    <select class="form-select" id="region" [formField]="form.fields.region" ngxFieldState>
                        <option value="">—</option>
                        @for (r of regionsFor(); track r) {
                            <option [value]="r">{{ r }}</option>
                        }
                    </select>
                    <ngx-field-errors [field]="form.fields.region"/>
                </div>
            </div>
            <button type="submit" class="btn btn-primary">Submit</button>
        </form>
        <pre class="model mt-3">{{ model() | json }}</pre>
    `,
})
export class InputPage {
    protected readonly model = signal({iban: '', nick: '', amount: null as number | null, country: 'LV', region: ''});
    protected readonly form = ngxForm(this.model, p => {
        applyRules(p.iban, [new RequiredRule(), new PatternRule(/^[A-Z]{2}\d{2}( ?[A-Z0-9]{1,4})+$/, true, 'Not an IBAN.')]);
        applyRules(p.amount, [new RequiredRule(), new MinOrEqualRule(1)]);
        applyRules(p.region, [new RequiredRule()]);
    });
    protected readonly iban = ($: string) => normalizers.group(4)(normalizers.upper($).replace(/[^A-Z0-9]/g, ''));
    protected readonly trim = normalizers.trim;
    protected readonly regionsFor = () => regions[this.model().country] ?? [];
    protected readonly save = () => console.info('submitted', this.model());

    public constructor() {
        reaction(this.model, $ => $.country, (_, $model) => ({...$model, region: ''}));
    }
}
