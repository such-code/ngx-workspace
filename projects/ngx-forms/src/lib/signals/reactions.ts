import {assertInInjectionContext, effect, EffectRef, inject, Injector, untracked, WritableSignal} from '@angular/core';
import {maybeEquals} from '../core/compare';

export interface ReactionOptions<V> {
    /** Run once for the initial value as well. Default `false`. */
    readonly immediate?: boolean;
    readonly equal?: ($a: V, $b: V) => boolean;
    readonly injector?: Injector;
}

const MAX_CHAIN = 25;
let chain = 0;
let chainReset: Promise<void> | null = null;

/**
 * Updates the model when a selected part of it changes, e.g. reset `state` when `country` changes, or add a group
 * when a checkbox is ticked. `$apply` returns the next model (or nothing to keep it). Runs as an effect, after the
 * change; for corrections that must happen while typing use `[ngxNormalize]` instead.
 */
export function reaction<T, V>(
    $model: WritableSignal<T>,
    $select: ($model: T) => V,
    $apply: ($value: V, $model: T, $previous: V | undefined) => T | void,
    $options: ReactionOptions<V> = {},
): EffectRef {
    if (!$options.injector) {
        assertInInjectionContext(reaction);
    }
    const injector = $options.injector ?? inject(Injector);
    const equal = $options.equal ?? (($a: V, $b: V) => maybeEquals($a, $b));
    let initialized = false;
    let previous: V | undefined;

    return effect(() => {
        const value = $select($model());
        if (initialized && equal(previous as V, value)) {
            return;
        }
        const old = previous;
        const first = !initialized;
        initialized = true;
        previous = value;
        if (first && !$options.immediate) {
            return;
        }
        untracked(() => {
            if (++chain > MAX_CHAIN) {
                console.error('reaction(): too many chained model updates, a reaction probably triggers itself. Stopped.');
                return;
            }
            chainReset ??= Promise.resolve().then(() => {
                chain = 0;
                chainReset = null;
            });
            const current = $model();
            const next = $apply(value, current, old);
            if (next !== undefined && next !== current) {
                $model.set(next as T);
            }
        });
    }, {injector});
}
