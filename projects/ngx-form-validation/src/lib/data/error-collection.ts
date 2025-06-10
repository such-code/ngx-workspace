import {InjectionToken, Provider, signal} from '@angular/core';
import {Observable} from 'rxjs';
import {toObservable} from '@angular/core/rxjs-interop';
// import {gettext} from 'i18n-plugin';

export const ERROR_COLLECTOR_SOURCE = new InjectionToken<ErrorCollection>('ERROR_COLLECTOR_SOURCE');

export function errorCollectionSourceFactory(): ErrorCollection {
    return new ErrorCollection();
}

export const errorCollectionSourceProvider: Provider = {
    provide: ERROR_COLLECTOR_SOURCE,
    useFactory: errorCollectionSourceFactory,
};

export interface IErrorCollectionError {
    readonly message: string;
    readonly status: string | null;
}

export class ErrorCollectionError implements IErrorCollectionError {

    public constructor(
        public readonly message: string,
        public readonly status: string | null = null,
    ) {
    }
}

export class ErrorCollection {

    public readonly errors$: Observable<ReadonlyArray<IErrorCollectionError>>;

    protected readonly errors = signal<ReadonlyArray<IErrorCollectionError>>([]);

    public constructor() {
        this.errors$ = toObservable(this.errors);
    }

    public addError($error: IErrorCollectionError): void {
        this.errors.update($errors => {
            if ($errors.indexOf($error) < 0) {
                return [...$errors, $error];
            }
            return $errors;
        });
    }

    public removeError($error: IErrorCollectionError): void {
        this.errors.update($errors => {
            const index = $errors.indexOf($error);
            if (index > -1) {
                return [...$errors.slice(0, index), ...$errors.slice(index + 1)];
            }
            return $errors;
        });
    }

    public clear(): void {
        this.errors.set([]);
    }

    public get errorsSnapshot(): ReadonlyArray<IErrorCollectionError> {
        return this.errors();
    }
}
