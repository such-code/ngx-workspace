import {computed, Signal, signal, untracked} from '@angular/core';
import {FieldTree} from '@such-code/ngx-forms';
import {NgxForm, NgxSubmitOptions, NgxSubmitAction} from './form';
import {STEP} from './metadata';
import {AnyField, walkFields} from './field-tree';

export interface WizardStep<T> {
    readonly id: string;
    /** Subtree validated by this step. */
    readonly field?: ($fields: FieldTree<T>) => AnyField;
    /** Fields tagged with `step(path, id)` (use when a step is not one subtree). Default when `field` is absent. */
    readonly tagged?: boolean;
    /** Step is skipped while this returns `false`. */
    readonly when?: () => boolean;
}

export interface Wizard<T> {
    readonly steps: Signal<ReadonlyArray<WizardStep<T>>>;
    readonly current: Signal<WizardStep<T>>;
    readonly index: Signal<number>;
    readonly isFirst: Signal<boolean>;
    readonly isLast: Signal<boolean>;

    isValid($id: string): boolean;

    /** Marks the current step touched; moves forward only when it is valid. */
    next(): boolean;

    previous(): void;

    /** Moves to a step; going forward requires every step before it to be valid unless `force`. */
    goTo($id: string, $force?: boolean): boolean;

    /** Validates all active steps; on failure moves to the first invalid one, otherwise submits the form. */
    submit($action?: NgxSubmitAction<T>, $options?: NgxSubmitOptions<T>): Promise<boolean>;
}


/** Fields belonging to a tagged step: tagged fields (with their subtrees), tags are inherited by descendants. */
function taggedFields($root: AnyField, $id: string): Array<AnyField> {
    const result: Array<AnyField> = [];
    walkFields($root, $field => {
        const tags = $field().metadata(STEP)?.() ?? [];
        if (tags.includes($id)) {
            result.push($field as AnyField);
            return false;
        }
        return true;
    });
    return result;
}

/**
 * Multistep wizard over one form: one model, steps are views over it. Unrendered steps are still validated, since
 * validity comes from the model, not from rendered controls.
 */
export function wizard<T>($form: NgxForm<T>, $steps: ReadonlyArray<WizardStep<T>>): Wizard<T> {
    const steps = computed(() => $steps.filter($ => !$.when || $.when()));
    const currentId = signal($steps[0]?.id);

    const index = computed(() => {
        const active = steps();
        const found = active.findIndex($ => $.id === currentId());
        return found < 0 ? 0 : found;
    });
    const current = computed(() => steps()[index()]);

    const fieldsOf = ($step: WizardStep<T>): Array<AnyField> => $step.field
        ? [$step.field($form.fields)]
        : taggedFields($form.fields, $step.id);

    const stepValid = ($step: WizardStep<T>): boolean => fieldsOf($step).every($ => $().valid());
    const touch = ($step: WizardStep<T>): void => {
        for (const field of fieldsOf($step)) {
            field().markAsTouched();
        }
    };
    const byId = ($id: string) => untracked(steps).find($ => $.id === $id);

    const wizardApi: Wizard<T> = {
        steps,
        current,
        index,
        isFirst: computed(() => index() === 0),
        isLast: computed(() => index() === steps().length - 1),

        isValid($id: string): boolean {
            const step = byId($id);
            return step ? stepValid(step) : true;
        },

        next(): boolean {
            return untracked(() => {
                const step = current();
                touch(step);
                if (!stepValid(step)) {
                    focusFirst(step);
                    return false;
                }
                const nextStep = steps()[index() + 1];
                if (nextStep) {
                    currentId.set(nextStep.id);
                }
                return true;
            });
        },

        previous(): void {
            untracked(() => {
                const previousStep = steps()[index() - 1];
                if (previousStep) {
                    currentId.set(previousStep.id);
                }
            });
        },

        goTo($id: string, $force: boolean = false): boolean {
            return untracked(() => {
                const active = steps();
                const target = active.findIndex($ => $.id === $id);
                if (target < 0) {
                    return false;
                }
                if (!$force) {
                    for (const step of active.slice(0, target)) {
                        if (!stepValid(step)) {
                            touch(step);
                            currentId.set(step.id);
                            return false;
                        }
                    }
                }
                currentId.set($id);
                return true;
            });
        },

        async submit($action?: NgxSubmitAction<T>, $options?: NgxSubmitOptions<T>): Promise<boolean> {
            const invalid = untracked(() => {
                const active = steps();
                active.forEach(touch);
                return active.find($ => !stepValid($));
            });
            if (invalid) {
                currentId.set(invalid.id);
                // Let the step render before focusing.
                setTimeout(() => focusFirst(invalid));
                return false;
            }
            return $form.submit($action, $options);
        },
    };

    function focusFirst($step: WizardStep<T>): void {
        for (const field of fieldsOf($step)) {
            if (field().invalid() && field().focus()) {
                return;
            }
        }
    }

    return wizardApi;
}
