import {Component, signal} from '@angular/core';
import {JsonPipe} from '@angular/common';

import {
    applyRules,
    arrayOps,
    bindTemplate,
    MinOrEqualRule,
    ngxForm,
    NgxForms,
    provideRuleTemplates,
    reaction,
    RequiredRule,
} from '@such-code/ngx-forms-validation';

type Line = { id: number, sku: string, qty: number | null };
type Company = { name: string, vat: string };
type Order = { type: 'person' | 'business', company?: Company, lines: Array<Line> };

let nextId = 1;
const line = (): Line => ({id: nextId++, sku: '', qty: 1});

@Component({
    imports: [NgxForms, JsonPipe],
    providers: [
        provideRuleTemplates({
            Order: {
                'lines.*.sku': [new RequiredRule()],
                'lines.*.qty': [new RequiredRule(), new MinOrEqualRule(1)],
            },
            Company: {
                name: [new RequiredRule()],
                vat: [new RequiredRule()],
            },
        }),
    ],
    template: `
        <h2>Dynamic structure</h2>
        <form [ngxForm]="form" [ngxFormAction]="save">
            <div class="mb-3">
                <select class="form-select w-auto" [ngxField]="form.fields.type">
                    <option value="person">Person</option>
                    <option value="business">Business</option>
                </select>
            </div>
            @if (form.fields.company; as company) {
                <fieldset class="border rounded p-3 mb-3">
                    <legend class="fs-6">Company (added to the model when "Business" is selected)</legend>
                    <input class="form-control mb-1" placeholder="Name" [ngxField]="company.name" ngxFieldState>
                    <ngx-field-errors [field]="company.name"/>
                    <input class="form-control mb-1" placeholder="VAT" [ngxField]="company.vat" ngxFieldState>
                    <ngx-field-errors [field]="company.vat"/>
                </fieldset>
            }
            @for (item of form.fields.lines; track item; let i = $index) {
                <div class="row g-2 mb-2">
                    <div class="col"><input class="form-control" placeholder="SKU" [ngxField]="item.sku" ngxFieldState>
                        <ngx-field-errors [field]="item.sku"/></div>
                    <div class="col-3"><input class="form-control" type="number" [ngxField]="item.qty" ngxFieldState>
                        <ngx-field-errors [field]="item.qty"/></div>
                    <div class="col-auto">
                        <button type="button" class="btn btn-outline-secondary" (click)="lines.move(i, i - 1)" [disabled]="i === 0">↑</button>
                        <button type="button" class="btn btn-outline-danger ms-1" (click)="lines.remove(i)">×</button>
                    </div>
                </div>
            }
            <button type="button" class="btn btn-outline-primary me-2" (click)="lines.push(newLine())">Add line</button>
            <button type="submit" class="btn btn-primary">Submit</button>
        </form>
        <pre class="model mt-3">{{ model() | json }}</pre>
    `,
})
export class DynamicPage {
    protected readonly model = signal<Order>({type: 'person', lines: [line()]});
    protected readonly form = ngxForm(this.model, p => {
        // `company` is optional in the model; its rules apply whenever it exists.
        bindTemplate(p.company!, 'Company');
        applyRules(p.lines, [new RequiredRule('Add at least one line.')]);
    }, {name: 'Order'});
    protected readonly lines = arrayOps(this.form.fields.lines);
    protected readonly newLine = line;
    protected readonly save = () => console.info('submitted', this.model());

    public constructor() {
        // Structure follows input: the company group exists only for business orders.
        reaction(this.model, $ => $.type, ($type, $model) => $type === 'business'
            ? {...$model, company: $model.company ?? {name: '', vat: ''}}
            : {...$model, company: undefined});
    }
}
