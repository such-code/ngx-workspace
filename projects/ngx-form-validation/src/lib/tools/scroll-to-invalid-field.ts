import {ValidationControlStateDirective} from '../directives/validation/validation-control-state.directive';

export function scrollToFirstInvalidField($element: Element, $window: Window, $delay: number = 200) {
    const allErrorElements = $element.querySelectorAll(
        `[${ValidationControlStateDirective.ATTRIBUTE_INVALID}]`,
    );

    if (allErrorElements.length > 0) {
        $window.setTimeout(() => {
            allErrorElements[0].scrollIntoView({behavior: 'smooth', block: 'center'});
        }, $delay);
    }
}
