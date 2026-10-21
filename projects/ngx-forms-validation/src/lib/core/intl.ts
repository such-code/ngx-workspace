import {Injectable, signal} from '@angular/core';
import {interpolate} from './text';
import {isValidationRuleError} from './rules';

export type PluralFn = ($value: number) => number;

const defaultPluralFn: PluralFn = function pluralizationFn($value: number): number {
    return $value === 0 || $value === 1 ? 0 : 1;
};

type ValidationIntlState = {
    messages: Readonly<Record<string, string>>,
    pluralFn: PluralFn,
};

/**
 * Message translations. `translate()` reads a signal, so templates and computeds update when messages change.
 * Keys are raw (untranslated) messages; for Signal Forms errors without a raw message the error `kind` is used.
 */
@Injectable({providedIn: 'root'})
export class ValidationIntl {

    protected readonly state = signal<ValidationIntlState>({
        messages: {},
        pluralFn: defaultPluralFn,
    });

    public update($messages: Record<string, string>, $pluralFn?: PluralFn): void {
        this.state.update($state => ({
            messages: {...$state.messages, ...$messages},
            pluralFn: $pluralFn ?? $state.pluralFn,
        }));
    }

    public translate(
        $message: string,
        $params: Readonly<Record<string, any>> | null = null,
        $plural: number | null = null,
    ): string {
        const state = this.state();
        const source = state.messages[$message] ?? $message;
        const message = typeof $plural === 'number' ? plural(source.split('|'), state.pluralFn, $plural) : source;
        return $params ? interpolate(message, $params) : message;
    }

    /** Translates any error object: library rule errors, Signal Forms errors (`kind`/`message`) or strings. */
    public translateError($error: unknown): string {
        if (typeof $error === 'string') {
            return this.translate($error);
        }
        if (isValidationRuleError($error)) {
            return this.translate($error.rawMessage, $error.params, $error.plural ?? null);
        }
        if (typeof $error === 'object' && $error !== null) {
            const {kind, message} = $error as { kind?: unknown, message?: unknown };
            if (typeof message === 'string' && message.length > 0) {
                return this.translate(message, $error as Record<string, any>);
            }
            if (typeof kind === 'string') {
                return this.translate(defaultKindMessages[kind] ?? kind, $error as Record<string, any>);
            }
        }
        return String($error);
    }
}

function plural($messages: Array<string>, $pluralFn: PluralFn, $value: number): string {
    const index = $pluralFn($value);
    if (index >= 0 && index < $messages.length) {
        return $messages[index];
    }
    return $messages.length > 0 ? $messages[0] : '';
}

/** Fallback messages for Signal Forms built-in errors that carry no message. */
export const defaultKindMessages: Readonly<Record<string, string>> = {
    required: 'This field is required.',
    min: 'Value must be greater than or equal to {{ min }}.',
    max: 'Value must be lower than or equal to {{ max }}.',
    minLength: 'Length should be greater then {{ minLength }}.',
    maxLength: 'Length must not exceed {{ maxLength }}.',
    pattern: 'Pattern does not match.',
    email: 'Valid email address must be provided.',
    parse: 'Value can not be parsed.',
};
