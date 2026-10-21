/**
 * Field paths are dotted strings (`user.addresses.0.street`). Templates may use `*` as a segment to match any key or
 * array index (`items.*.name`). Server payloads often use bracket notation (`items[0].name`), it is normalized here.
 */

export type PathSegments = ReadonlyArray<string>;

export const GLOB_SEGMENT = '*';

export function splitPath($path: string): PathSegments {
    return normalizePath($path)
        .split('.')
        .filter($ => $.length > 0);
}

export function joinPath($segments: PathSegments): string {
    return $segments.join('.');
}

/** Converts `a[0].b` / `a[0][1]` to `a.0.b` / `a.0.1`. */
export function normalizePath($path: string): string {
    return $path.replace(/\[(\w+|\*)]/g, '.$1').replace(/^\./, '');
}

export function isGlobPath($path: string): boolean {
    return splitPath($path).includes(GLOB_SEGMENT);
}

/** Checks whether concrete path segments match a (possibly glob) template path. */
export function matchPath($template: PathSegments, $concrete: PathSegments): boolean {
    if ($template.length !== $concrete.length) {
        return false;
    }
    for (let i = 0; i < $template.length; i++) {
        if ($template[i] !== GLOB_SEGMENT && $template[i] !== $concrete[i]) {
            return false;
        }
    }
    return true;
}

export function valueAt($root: unknown, $segments: PathSegments): unknown {
    let current: any = $root;
    for (const segment of $segments) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}

/**
 * Expands a template path against a value. Glob segments are replaced by every existing key (object) or index (array).
 * Non-glob segments are kept even if they do not exist in the value, so rules like `required` still apply to them.
 */
export function expandPath($root: unknown, $template: PathSegments): Array<PathSegments> {
    let results: Array<PathSegments> = [[]];
    for (const segment of $template) {
        const next: Array<PathSegments> = [];
        for (const prefix of results) {
            if (segment === GLOB_SEGMENT) {
                const value = valueAt($root, prefix);
                if (value !== null && typeof value === 'object') {
                    for (const key of Object.keys(value)) {
                        next.push([...prefix, key]);
                    }
                }
            } else {
                next.push([...prefix, segment]);
            }
        }
        results = next;
    }
    return results;
}

/** Removes a leading prefix (`body.`) and normalizes bracket notation. */
export function stripPathPrefix($path: string, $prefixes: ReadonlyArray<string>): string {
    const normalized = normalizePath($path);
    for (const prefix of $prefixes) {
        const normalizedPrefix = normalizePath(prefix).replace(/\.$/, '');
        if (normalizedPrefix && normalized.startsWith(normalizedPrefix + '.')) {
            return normalized.substring(normalizedPrefix.length + 1);
        }
    }
    return normalized;
}
