import {Injectable, signal} from '@angular/core';
import {interpolate} from '../util/text-utils';
import {distinctUntilChanged, Observable} from 'rxjs';
import {toObservable} from '@angular/core/rxjs-interop';
import {map} from 'rxjs/operators';

type ValidationIntlState = {
    messages: Record<string, string>,
    pluralFn: PluralFn,
}

export type PluralFn = ($value: number) => number;

const defaultPluralFn: PluralFn = function pluralizationFn($value: number): number {
    return $value === 0 || $value === 1 ? 0 : 1;
}

function plural($messages: Array<string>, $pluralFn: PluralFn, $value: number): string {
    const index = $pluralFn($value);
    if (index >= 0 && index < $messages.length) {
        return $messages[index];
    }
    return $messages.length > 0 ? $messages[0] : '';
}

export interface IValidationIntl {
    update($messages: Record<string, string>, $pluralFn?: PluralFn): void;

    getTranslation($message: string, $interpolationTarget?: Record<string, any> | null, $plural?: number | null): string;

    getTranslation$($message: string, $interpolationTarget?: Record<string, any> | null, $plural?: number | null): Observable<string>;
}

@Injectable({providedIn: 'root'})
export class ValidationIntl implements IValidationIntl {

    public readonly state$: Observable<ValidationIntlState>;

    protected readonly state = signal<ValidationIntlState>({
        messages: {},
        pluralFn: defaultPluralFn,
    });

    public constructor() {
        this.state$ = toObservable(this.state);
    }

    public update(
        $messages: Record<string, string>,
        $pluralFn: PluralFn = defaultPluralFn,
    ): void {
        this.state.update($state => {
            return {
                messages: {
                    ...$state.messages,
                    ...$messages,
                },
                pluralFn: $pluralFn,
            };
        });
    }

    public getTranslation($message: string, $interpolationTarget: Record<string, any> | null = null, $plural: number | null = null): string {
        const translation = this.state().messages[$message];

        let message = typeof $plural === 'number'
            ? plural($message.split('|'), this.state().pluralFn, $plural)
            : $message;

        if ($interpolationTarget) {
            return interpolate(translation || message, $interpolationTarget);
        }
        return translation || message;
    }

    public getTranslation$($message: string, $interpolationTarget: Record<string, any> | null = null, $plural: number | null = null): Observable<string> {
        return this.state$.pipe(
            map($state => {
                const translation = $state.messages[$message];

                let message = typeof $plural === 'number'
                    ? plural($message.split('|'), $state.pluralFn, $plural)
                    : $message;

                if ($interpolationTarget) {
                    return interpolate(translation || message, $interpolationTarget);
                }
                return translation || message;
            }),
            distinctUntilChanged(),
        );
    }
}
