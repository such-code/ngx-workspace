export function isPlainObject($: any): $ is Record<string, any> {
    return typeof $ === 'object'
        && $ !== null
        && !Array.isArray($);
}

export function isNullOrUndefined($: any): $ is (null | undefined) {
    return $ === null || $ === undefined;
}

export function fastObjectEquals($a: Record<string, any> | null, $b: Record<string, any> | null): boolean {
    if (isPlainObject($a) && isPlainObject($b) && $a !== $b) {
        const aKeys = Object.keys($a);
        for (const aKey of aKeys) {
            // Since this is fast comparison, only top level is supported.
            if (!$b.hasOwnProperty(aKey) || $a[aKey] !== $b[aKey]) {
                return false;
            }
        }
        return true;
    }
    return $a === $b;
}

export function diff<T extends Record<string, any>>($a?: T | null, $b?: T | null, $deep: boolean = false): Partial<T> {
    if ($a === $b || (isNullOrUndefined($a) && isNullOrUndefined($b))) {
        return {};
    }

    if (isNullOrUndefined($a) && !isNullOrUndefined($b)) {
        return {...$b};
    }

    let result: Partial<T> = {};
    if (!isNullOrUndefined($a) && isNullOrUndefined($b)) {
        return {...$a};
    }

    const abCommonKeys: Array<string> = [];
    for (const bKey of Object.keys($b!)) {
        if ($a!.hasOwnProperty(bKey)) {
            abCommonKeys.push(bKey);

            if (!maybeEquals($a![bKey], $b![bKey], $deep)) {
                result = {
                    ...result,
                    [bKey]: $b![bKey],
                };
            }
        } else {
            result = {
                ...result,
                [bKey]: $b![bKey],
            };
        }
    }

    for (const aKey of Object.keys($a!)) {
        if (abCommonKeys.indexOf(aKey) === -1) {
            result = {
                ...result,
                [aKey]: $a![aKey],
            };
        }
    }

    return result;
}

export function maybeEquals($a: any, $b: any, $deep: boolean = true): boolean {
    if ($a !== $b) {
        if (Array.isArray($a) && Array.isArray($b)) {
            return $a.length === $b.length
                && !$a.some(($, $idx) => !maybeEquals($, $b[$idx], $deep));
        } else if (isPlainObject($a) && isPlainObject($b)) {
            // If both of them are empty arrays or empty objects, then consider as equal
            if (Object.keys($a).length === 0 && Object.keys($b).length === 0) {
                return true;
            } else if ($deep) {
                return Object.keys(diff($a, $b, $deep)).length === 0;
            }
        }
        return false;
    }

    return true;
}
