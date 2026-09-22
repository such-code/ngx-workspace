import {Directive, OnDestroy} from '@angular/core';
import {ValidationCheckBaseDirective} from './validation-check-base.directive';

@Directive({})
export abstract class ValidationCheckPointerBaseDirective extends ValidationCheckBaseDirective implements OnDestroy {

    public constructor() {
        super();

        if (this.form) {
            this.handleClick = this.handleClick.bind(this);
            this.element.nativeElement.addEventListener('click', this.handleClick);
        }
    }

    protected abstract performSubmit(): void;

    protected handleClick($event: PointerEvent): void {
        if (this.controlContainer.enabled) {
            // Trigger form validation.
            this.performSubmit();

            // Just in case this will be required someday, saving this here.
            // this.ngForm.onReset();

            this.performValidationAndEmit();

            // Not sure if this is required;
            $event.preventDefault();
            $event.stopPropagation();
        }
    }

    public ngOnDestroy(): void {
        this.element.nativeElement.removeEventListener('click', this.handleClick);
    }
}
