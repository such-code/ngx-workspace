import {DEBOUNCE, DebounceConfig, MAX, MAX_LENGTH, MIN, MIN_LENGTH, PATTERN, REQUIRED} from './metadata';
import {LogicFn, metadata, SchemaPath, validate} from './schema';

export interface ValidatorConfig<T> {
    /** Error message; the error `kind` stays the same, so messages can also be translated by kind. */
    readonly message?: string | LogicFn<T, string>;
    /** Rule applies only while this returns `true` (metadata included). */
    readonly when?: LogicFn<T, boolean>;
}

/** Empty for `required`: `null`, `undefined`, `''`, `false`, `NaN` and empty arrays. */
export function isEmpty($value: unknown): boolean {
    return $value === null
        || $value === undefined
        || $value === ''
        || $value === false
        || (typeof $value === 'number' && Number.isNaN($value))
        || (Array.isArray($value) && $value.length === 0);
}

function lengthOf($value: unknown): number | null {
    if (typeof $value === 'string' || Array.isArray($value)) {
        return $value.length;
    }
    if ($value instanceof Set || $value instanceof Map) {
        return $value.size;
    }
    return null;
}

function resolve<T, V>($value: V | LogicFn<T, V | undefined>, $ctx: Parameters<LogicFn<T, V>>[0]): V | undefined {
    return typeof $value === 'function' ? ($value as LogicFn<T, V | undefined>)($ctx) : $value;
}

function message<T>($config: ValidatorConfig<T> | undefined, $ctx: Parameters<LogicFn<T, string>>[0]): { message?: string } {
    const text = $config?.message === undefined ? undefined : resolve($config.message, $ctx);
    return text === undefined ? {} : {message: text};
}

function active<T>($config: ValidatorConfig<T> | undefined, $ctx: Parameters<LogicFn<T, boolean>>[0]): boolean {
    return !$config?.when || $config.when($ctx);
}

export function required<T>($path: SchemaPath<T>, $config?: ValidatorConfig<T>): void {
    metadata($path, REQUIRED, ctx => active($config, ctx));
    validate($path, ctx => active($config, ctx) && isEmpty(ctx.value())
        ? {kind: 'required', ...message($config, ctx)}
        : null);
}

export function min<T extends number | null | undefined>($path: SchemaPath<T>, $min: number | LogicFn<T, number | undefined>, $config?: ValidatorConfig<T>): void {
    metadata($path, MIN, ctx => active($config, ctx) ? resolve($min, ctx) : undefined);
    validate($path, ctx => {
        const limit = active($config, ctx) ? resolve($min, ctx) : undefined;
        const value = ctx.value();
        return limit !== undefined && typeof value === 'number' && !Number.isNaN(value) && value < limit
            ? {kind: 'min', min: limit, ...message($config, ctx)}
            : null;
    });
}

export function max<T extends number | null | undefined>($path: SchemaPath<T>, $max: number | LogicFn<T, number | undefined>, $config?: ValidatorConfig<T>): void {
    metadata($path, MAX, ctx => active($config, ctx) ? resolve($max, ctx) : undefined);
    validate($path, ctx => {
        const limit = active($config, ctx) ? resolve($max, ctx) : undefined;
        const value = ctx.value();
        return limit !== undefined && typeof value === 'number' && !Number.isNaN(value) && value > limit
            ? {kind: 'max', max: limit, ...message($config, ctx)}
            : null;
    });
}

export function minLength<T>($path: SchemaPath<T>, $minLength: number | LogicFn<T, number | undefined>, $config?: ValidatorConfig<T>): void {
    metadata($path, MIN_LENGTH, ctx => active($config, ctx) ? resolve($minLength, ctx) : undefined);
    validate($path, ctx => {
        const limit = active($config, ctx) ? resolve($minLength, ctx) : undefined;
        const length = lengthOf(ctx.value());
        // Empty values are `required`'s business.
        return limit !== undefined && length !== null && length > 0 && length < limit
            ? {kind: 'minLength', minLength: limit, ...message($config, ctx)}
            : null;
    });
}

export function maxLength<T>($path: SchemaPath<T>, $maxLength: number | LogicFn<T, number | undefined>, $config?: ValidatorConfig<T>): void {
    metadata($path, MAX_LENGTH, ctx => active($config, ctx) ? resolve($maxLength, ctx) : undefined);
    validate($path, ctx => {
        const limit = active($config, ctx) ? resolve($maxLength, ctx) : undefined;
        const length = lengthOf(ctx.value());
        return limit !== undefined && length !== null && length > limit
            ? {kind: 'maxLength', maxLength: limit, ...message($config, ctx)}
            : null;
    });
}

export function pattern<T extends string | null | undefined>($path: SchemaPath<T>, $pattern: RegExp | LogicFn<T, RegExp | undefined>, $config?: ValidatorConfig<T>): void {
    metadata($path, PATTERN, ctx => active($config, ctx) ? resolve($pattern, ctx) : undefined);
    validate($path, ctx => {
        const regexp = active($config, ctx) ? resolve($pattern, ctx) : undefined;
        const value = ctx.value();
        if (regexp === undefined || typeof value !== 'string' || value === '') {
            return null;
        }
        regexp.lastIndex = 0;
        return regexp.test(value) ? null : {kind: 'pattern', pattern: regexp, ...message($config, ctx)};
    });
}

const EMAIL = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function email<T extends string | null | undefined>($path: SchemaPath<T>, $config?: ValidatorConfig<T>): void {
    validate($path, ctx => {
        const value = ctx.value();
        return active($config, ctx) && typeof value === 'string' && value !== '' && !EMAIL.test(value)
            ? {kind: 'email', ...message($config, ctx)}
            : null;
    });
}

/**
 * How bound controls commit typed text to the model: after `ms` of inactivity or on `'blur'`. The model only ever
 * holds committed values; leaving the control commits immediately.
 */
export function debounce<T>($path: SchemaPath<T>, $config: DebounceConfig): void {
    metadata($path, DEBOUNCE, () => $config);
}
