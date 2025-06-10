import {ValidationContext} from '../../data/validation-context';
import {ErrorCollection} from '../../data/error-collection';

export enum ValidationSubmitEventType {
    INVALID = 'invalid',
    VALID = 'valid',
}

export class ValidationSubmitEvent<T = any> {
    constructor(
        public readonly type: string,
        public readonly target: EventTarget,
        public readonly formData: T | null = null,
        public readonly context: ValidationContext | null = null,
        public readonly localContext: ValidationContext | null = null,
        public readonly errorCollection: ErrorCollection | null = null,
        public readonly errors: any | null = null,
    ) {
    }
}
