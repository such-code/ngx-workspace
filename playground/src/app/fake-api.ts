import {Injectable} from '@angular/core';
import {SerializedValidationErrorDetails} from '@such-code/ngx-forms-validation';

const delay = ($ms: number) => new Promise($resolve => setTimeout($resolve, $ms));

/** Stands in for a backend: throws errors in the same shapes an `HttpClient` call would. */
@Injectable({providedIn: 'root'})
export class FakeApi {
    public async ok(): Promise<void> {
        await delay(800);
    }

    public async validationError($details: Array<SerializedValidationErrorDetails>): Promise<never> {
        await delay(800);
        throw {name: 'HttpErrorResponse', status: 400, headers: {}, message: 'Bad Request', error: {details: $details}};
    }

    public async networkError(): Promise<never> {
        await delay(800);
        throw {name: 'HttpErrorResponse', status: 0, headers: {}, message: 'Http failure response: 0 Unknown Error', error: new ProgressEvent('error')};
    }

    public async genericError(): Promise<never> {
        await delay(800);
        throw new Error('Generic error occurred.');
    }
}
