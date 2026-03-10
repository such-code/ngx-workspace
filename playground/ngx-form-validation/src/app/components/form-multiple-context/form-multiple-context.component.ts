import {Component, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
    provideValidationService,
    RequiredRule,
    MinLengthRule,
    ValidationCheckSubmitDirective,
    ValidationControlStateDirective,
    ValidationFieldErrorComponent,
    ValidationModelDirective,
    ValidationNamedContextDirective,
    ValidationNamedFormContextDirective,
    ValidationSubmitEvent,
} from '@such-code/ngx-form-validation';

type FormType = {
    first: string | null,
    second: string | null,
    third: string | null,
    forth: string | null,
    fifth: string | null,
}

@Component({
    standalone: true,
    templateUrl: './form-multiple-context.component.html',
    imports: [
        FormsModule,

        ValidationModelDirective,
        ValidationNamedFormContextDirective,
        ValidationNamedContextDirective,

        ValidationCheckSubmitDirective,

        ValidationControlStateDirective,
        ValidationFieldErrorComponent,
    ],
    providers: [
        provideValidationService({
            'MultipleContextForm': {
                parent: [new RequiredRule()],
                'children.*.child': [new MinLengthRule(2)],
            },
            'MultipleContextFormChild': {
                child: [new RequiredRule()],
            }
        }),
    ]
})
export class FormMultipleContextComponent {
    public readonly rows = signal<Array<number>>([0]);

    public trackByRow($index: number, $row: number): string {
        return `${$index}-${$row}`;
    }

    public removeRow(index: number): void {
        this.rows.update(rows => rows.filter((_, $i) => $i !== index));
    }

    public addRow(): void {
        this.rows.update(rows => [...rows, (rows.at(-1) || 0) + 1]);
    }

    public handleSubmit($event: ValidationSubmitEvent<FormType>): void {
        console.warn($event);
    }
}
