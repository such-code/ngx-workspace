import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
    ErrorObservingService,
    FORM_DISABLED_SOURCE,
    formDisabledSourceProvider,
    ValidationContextModule,
    ValidationSubmitEvent,
    ValidationType,
} from '@such-code/ngx-form-validation';
import {ErrorProducingService} from '../../services/error-producing.service';
import {shareReplay, tap} from 'rxjs';

type FormType = {
    first: string | null,
    second: string | null,
    third: string | null,
}

@Component({
    standalone: true,
    templateUrl: 'form-observation.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        ValidationContextModule,
    ],
    viewProviders: [
        formDisabledSourceProvider,
    ],
})
export class FormObservationComponent {

    protected readonly errorObservingService = inject(ErrorObservingService);
    protected readonly errorProducingService = inject(ErrorProducingService);
    protected readonly formDisabledSource = inject(FORM_DISABLED_SOURCE, {self: true});

    public handleSubmit($event: ValidationSubmitEvent<FormType>): void {
        const request$ = (
            Math.random() < .4
                ? this.errorProducingService.waitAndProduceGenericError$()
                : this.errorProducingService.waitAndProduceValidationError$([
                    {
                        param: 'first',
                        message: 'This is an incorrect value.',
                    },
                    {
                        param: 'second',
                        // This message is interpolated
                        message: 'This field is required.',
                        constraint: {
                            type: ValidationType.REQUIRED,
                            // This is a raw message, the rule might apply interpolation.
                            message: 'This field is required',
                            context: 'FormObservation',
                        },
                    },
                ])
        ).pipe(
            tap(this.errorObservingService.observeOn($event)),
            shareReplay(1),
        );

        // Disable form while request lasts.
        this.formDisabledSource.next(request$);

        request$.subscribe(() => {
            console.warn('Will never happen.');
        });
    }
}
