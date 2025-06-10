import {isPlainObject} from './comparison-utils';

function findPropInsideObjects($keyword: string, $values: Array<object>): any {
    for (const value of $values) {
        if (isPlainObject(value) && $keyword in value) {
            return value[$keyword];
        }
    }
    throw Error('Not Found');
}

export function interpolate($msg: string, ...$values: Array<object>): string {
    return ($msg || '').replace(/{{\s*(\S+?)\s*}}/g, function interpolateReplacer($match: string, $keyword: string): string {
        try {
            return '' + findPropInsideObjects($keyword, $values);
        } catch (e) {
            return $match;
        }
    });
}
