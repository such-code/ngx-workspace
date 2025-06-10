import {Injectable} from '@angular/core';
import {SerializedValidationErrorDetails} from '@such-code/ngx-form-validation';
import {map, Observable, timer} from 'rxjs';

class GeneratedValidationError extends Error {
    constructor(
        $message: string,
        public readonly details: Array<SerializedValidationErrorDetails>,
    ) {
        super($message);
    }
}

@Injectable({providedIn: 'root'})
export class ErrorProducingService {

    waitAndProduceGenericError$(): Observable<any> {
        return timer(2500).pipe(
            map(() => {
                throw Error('Generic error occurred.');
            }),
        );
    }

    waitAndProduceValidationError$($details: Array<SerializedValidationErrorDetails>): Observable<any> {
        return timer(2500).pipe(
            map(() => {
                throw new GeneratedValidationError('Validation error occurred.', $details);
            }),
        )
    }
}
