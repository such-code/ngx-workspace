import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    inject,
    input,
    Renderer2,
} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {ERROR_COLLECTOR_SOURCE, ErrorCollection, IErrorCollectionError} from '../../data/error-collection';
import {Observable, of, switchMap} from 'rxjs';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';

@Component({
    standalone: true,
    selector: 'ngx-validation-form-error',
    templateUrl: './validation-form-error.component.html',
    styleUrl: './validation-form-error.component.scss',
    host: {
        role: 'alert',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AsyncPipe,
    ],
})
export class ValidationFormErrorComponent implements AfterViewInit {

    public static readonly STATE_VISIBLE = 'data-state-visible';

    public readonly heading = input<string | null>(null);

    protected readonly elementRef = inject(ElementRef);
    protected readonly destroyRef = inject(DestroyRef);
    protected readonly renderer2 = inject(Renderer2);
    protected readonly errorCollection = inject(ERROR_COLLECTOR_SOURCE, {skipSelf: true, optional: true});

    protected readonly errorCollectionInput = input<ErrorCollection | null>(null);

    protected readonly errors$: Observable<ReadonlyArray<IErrorCollectionError>>;

    public constructor() {
        this.errors$ = toObservable(this.errorCollectionInput).pipe(
            switchMap($errorCollectionInput => {
                if ($errorCollectionInput) {
                    return $errorCollectionInput.errors$;
                }
                return this.errorCollection
                    ? this.errorCollection.errors$
                    : of([]);
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.errors$.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe($errors => {
            if ($errors.length > 0) {
                this.renderer2.setAttribute(this.elementRef.nativeElement, ValidationFormErrorComponent.STATE_VISIBLE, '');
            } else {
                this.renderer2.removeAttribute(this.elementRef.nativeElement, ValidationFormErrorComponent.STATE_VISIBLE);
            }
        });
    }
}
