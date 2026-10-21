/** Plain object or array: values the form descends into. Dates, files, maps and class instances are leaves. */
export function isContainer($: unknown): $ is Record<string, unknown> | Array<unknown> {
    if ($ === null || typeof $ !== 'object') {
        return false;
    }
    if (Array.isArray($)) {
        return true;
    }
    const proto = Object.getPrototypeOf($);
    return proto === Object.prototype || proto === null;
}

export function isObject($: unknown): $ is object {
    return typeof $ === 'object' && $ !== null;
}

/** Structural equality for plain data (objects, arrays, dates); other objects compare by reference. */
export function deepEqual($a: unknown, $b: unknown): boolean {
    if (Object.is($a, $b)) {
        return true;
    }
    if ($a instanceof Date && $b instanceof Date) {
        return $a.getTime() === $b.getTime();
    }
    if (!isContainer($a) || !isContainer($b) || Array.isArray($a) !== Array.isArray($b)) {
        return false;
    }
    const aKeys = Object.keys($a);
    const bKeys = Object.keys($b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    for (const key of aKeys) {
        if (!Object.prototype.hasOwnProperty.call($b, key)
            || !deepEqual(($a as Record<string, unknown>)[key], ($b as Record<string, unknown>)[key])) {
            return false;
        }
    }
    return true;
}

/** Same own keys with `Object.is` values. */
export function shallowEqual($a: object, $b: object): boolean {
    if ($a === $b) {
        return true;
    }
    const aKeys = Object.keys($a);
    if (aKeys.length !== Object.keys($b).length) {
        return false;
    }
    for (const key of aKeys) {
        if (!Object.is(($a as any)[key], ($b as any)[key])) {
            return false;
        }
    }
    return true;
}

/** Equality for error lists, so recomputed but identical errors do not notify consumers. */
export function errorListEqual($a: ReadonlyArray<object>, $b: ReadonlyArray<object>): boolean {
    if ($a === $b) {
        return true;
    }
    if ($a.length !== $b.length) {
        return false;
    }
    for (let i = 0; i < $a.length; i++) {
        if (!shallowEqual($a[i], $b[i])) {
            return false;
        }
    }
    return true;
}

export function arrayIdentityEqual<T>($a: ReadonlyArray<T>, $b: ReadonlyArray<T>): boolean {
    if ($a === $b) {
        return true;
    }
    if ($a.length !== $b.length) {
        return false;
    }
    for (let i = 0; i < $a.length; i++) {
        if ($a[i] !== $b[i]) {
            return false;
        }
    }
    return true;
}

export type PathSegment = string | number;

/** `a.b[0].c` / `a.b.0.c` / segments to string segments. */
export function toSegments($path: string | ReadonlyArray<PathSegment>): ReadonlyArray<string> {
    if (typeof $path !== 'string') {
        return $path.map(String);
    }
    return $path
        .replace(/\[(\w+|\*)]/g, '.$1')
        .split('.')
        .filter($ => $.length > 0);
}
