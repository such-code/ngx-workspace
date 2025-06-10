import {DestroyRef, Directive, DoCheck, inject, input, signal} from '@angular/core';
import {FormGroup, NgModelGroup} from '@angular/forms';
import {combineLatest, distinctUntilChanged} from 'rxjs';
import {filter, skip, startWith} from 'rxjs/operators';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';

@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[ngModelGroup][disabled]',
})
export class ModelGroupDisabledDirective implements DoCheck {

    protected readonly ngModelGroup = inject(NgModelGroup);
    protected readonly destroyRef = inject(DestroyRef);

    protected readonly disabled = input(false);
    protected readonly target = signal<FormGroup | null>(null);

    public constructor() {
        const target$ = toObservable(this.target).pipe(
            skip(1),
            startWith(this.ngModelGroup.control),
            distinctUntilChanged(),
            filter(($): $ is FormGroup<any> => $ !== null),
        );

        combineLatest([
            target$,
            toObservable(this.disabled),
        ]).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(([$formGroup, $disabled]) => {
            if ($disabled) {
                if ($formGroup.enabled) {
                    $formGroup.disable();
                }
            } else {
                if ($formGroup.disabled) {
                    $formGroup.enable();
                }
            }
        });
    }

    public ngDoCheck(): void {
        const currentTarget = this.target();
        if (this.ngModelGroup.control !== currentTarget) {
            this.target.set(this.ngModelGroup.control);
        }
    }
}
