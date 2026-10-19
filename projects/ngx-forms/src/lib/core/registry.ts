import {computed, inject, Injectable, InjectionToken, Injector, Provider, Signal, signal} from '@angular/core';
import {RuleConstraint, ValidationRule} from './rules';
import {ruleFromConstraint} from './constraints';
import {normalizePath} from './path';

/** `path (or glob) -> rules`. Same shape as v21 `ValidationConfiguration[context]`. */
export type RuleTemplate = Readonly<Record<string, ReadonlyArray<ValidationRule>>>;

/** `template name -> template`. Same shape as v21 `ValidationConfiguration`. */
export type RuleTemplates = Readonly<Record<string, RuleTemplate>>;

/** JSON-friendly template, e.g. for caching templates generated from server responses. */
export type SerializedRuleTemplate = Record<string, Array<RuleConstraint>>;

export const RULE_TEMPLATES = new InjectionToken<Array<RuleTemplates | InjectionToken<RuleTemplates>>>('RULE_TEMPLATES');

export type RuleMergeMode =
// Adds rules, keeping existing ones.
    | 'add'
    // Replaces existing rules of the same kind (name), adds the rest. Default.
    | 'replace-kind'
    // Replaces all rules of the path.
    | 'replace';

export function mergeRules(
    $existing: ReadonlyArray<ValidationRule>,
    $rules: ReadonlyArray<ValidationRule>,
    $mode: RuleMergeMode,
): ReadonlyArray<ValidationRule> {
    switch ($mode) {
        case 'replace':
            return [...$rules];
        case 'add':
            return [...$existing, ...$rules.filter($ => !$existing.includes($))];
        case 'replace-kind': {
            const names = new Set($rules.map($ => $.name));
            return [...$existing.filter($ => !names.has($.name)), ...$rules];
        }
    }
}

function normalizeTemplate($template: RuleTemplate): RuleTemplate {
    const result: Record<string, ReadonlyArray<ValidationRule>> = {};
    for (const key of Object.keys($template)) {
        const path = normalizePath(key);
        result[path] = result[path] ? [...result[path], ...$template[key]] : [...$template[key]];
    }
    return result;
}

/**
 * Stores named rule templates. Provided in root and re-provided with `provideRuleTemplates()` for a part of the
 * application: a child template extends the parent template of the same name, paths defined in the child replace the
 * parent's rules for those paths.
 */
@Injectable({providedIn: 'root'})
export class RuleRegistry {

    protected readonly parent = inject(RuleRegistry, {skipSelf: true, optional: true});
    protected readonly injector = inject(Injector);
    protected readonly templates = signal<Readonly<Record<string, RuleTemplate>>>({});
    protected readonly lookups = new Map<string, Signal<RuleTemplate | undefined>>();
    protected readonly loading = new Map<string, Promise<RuleTemplate>>();

    public constructor() {
        const configurations = inject(RULE_TEMPLATES, {self: true, optional: true}) ?? [];
        for (const record of configurations) {
            const templates = record instanceof InjectionToken ? this.injector.get(record) : record;
            for (const name of Object.keys(templates)) {
                for (const [path, rules] of Object.entries(templates[name])) {
                    this.merge(name, path, rules, 'add', true);
                }
            }
        }
    }

    /** Reactive lookup, `undefined` while the template is not known. */
    public template($name: string): Signal<RuleTemplate | undefined> {
        let lookup = this.lookups.get($name);
        if (!lookup) {
            lookup = computed(() => combine(this.parent?.template($name)(), this.templates()[$name]));
            this.lookups.set($name, lookup);
        }
        return lookup;
    }

    public snapshot($name: string): RuleTemplate | undefined {
        return combine(this.parent?.snapshot($name), this.templates()[$name]);
    }

    public has($name: string): boolean {
        return this.snapshot($name) !== undefined;
    }

    public set($name: string, $template: RuleTemplate): void {
        this.templates.update($ => ({...$, [$name]: normalizeTemplate($template)}));
    }

    public remove($name: string): void {
        this.templates.update($ => {
            if (!($name in $)) {
                return $;
            }
            const next = {...$};
            delete next[$name];
            return next;
        });
    }

    /**
     * Adds rules for a path. When the template is defined by a parent registry it is updated there (unless `$local`),
     * so server constraints for application-wide templates reach every form that uses them.
     */
    public merge(
        $name: string,
        $path: string,
        $rules: ReadonlyArray<ValidationRule>,
        $mode: RuleMergeMode = 'replace-kind',
        $local: boolean = false,
    ): void {
        if (!$local && !(this.templates()[$name]) && this.parent?.has($name)) {
            this.parent.merge($name, $path, $rules, $mode);
            return;
        }
        const path = normalizePath($path);
        this.templates.update($templates => {
            const template = $templates[$name] ?? {};
            return {
                ...$templates,
                [$name]: {...template, [path]: mergeRules(template[path] ?? [], $rules, $mode)},
            };
        });
    }

    /** Loads a template once (e.g. from a route resolver), concurrent calls share the request. */
    public load($name: string, $loader: () => Promise<RuleTemplate | SerializedRuleTemplate>): Promise<RuleTemplate> {
        const known = this.snapshot($name);
        if (known) {
            return Promise.resolve(known);
        }
        let pending = this.loading.get($name);
        if (!pending) {
            pending = $loader()
                .then($ => {
                    const template = isSerializedTemplate($) ? deserializeRuleTemplate($) : $;
                    this.set($name, template);
                    return this.snapshot($name)!;
                })
                .finally(() => this.loading.delete($name));
            this.loading.set($name, pending);
        }
        return pending;
    }

    /** Serializable rules only; function based rules (`ExternalValidatorRule`) are skipped. */
    public export($name: string): SerializedRuleTemplate | undefined {
        const template = this.snapshot($name);
        return template ? serializeRuleTemplate(template) : undefined;
    }

    public import($name: string, $template: SerializedRuleTemplate): void {
        this.set($name, deserializeRuleTemplate($template));
    }
}

/** Child templates extend parent templates; a path defined in the child replaces the parent's rules for that path. */
function combine($parent: RuleTemplate | undefined, $own: RuleTemplate | undefined): RuleTemplate | undefined {
    if (!$parent || !$own) {
        return $own ?? $parent;
    }
    return {...$parent, ...$own};
}

function isSerializedTemplate($: RuleTemplate | SerializedRuleTemplate): $ is SerializedRuleTemplate {
    return Object.values($).some(($rules: ReadonlyArray<unknown>) => $rules.some($rule => !($rule instanceof ValidationRule)));
}

export function serializeRuleTemplate($template: RuleTemplate): SerializedRuleTemplate {
    const result: SerializedRuleTemplate = {};
    for (const [path, rules] of Object.entries($template)) {
        const constraints = rules
            .map($ => $.toConstraint())
            .filter(($): $ is RuleConstraint => $ !== null);
        if (constraints.length > 0) {
            result[path] = constraints;
        }
    }
    return result;
}

export function deserializeRuleTemplate($template: SerializedRuleTemplate): RuleTemplate {
    const result: Record<string, Array<ValidationRule>> = {};
    for (const [path, constraints] of Object.entries($template)) {
        const rules: Array<ValidationRule> = [];
        for (const constraint of constraints) {
            const rule = ruleFromConstraint(constraint);
            if (rule) {
                rules.push(rule);
            } else {
                console.warn(`Unknown "${constraint.type}" constraint type for "${path}"; register it with registerRuleFactory().`);
            }
        }
        result[path] = rules;
    }
    return result;
}

/**
 * Provides rule templates. In `providers` of a component or route it creates a child registry that overrides
 * templates for that subtree; at application level it seeds the root registry.
 */
export function provideRuleTemplates(...$templates: Array<RuleTemplates | InjectionToken<RuleTemplates>>): Array<Provider> {
    return [
        ...$templates.map($ => ({provide: RULE_TEMPLATES, multi: true, useValue: $})),
        RuleRegistry,
    ];
}
