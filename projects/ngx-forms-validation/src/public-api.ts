/*
 * Public API Surface of @such-code/ngx-forms-validation
 */

// Core: rules, templates, server errors, i18n (no dependency on @angular/forms).
export * from './lib/core/validation-type';
export * from './lib/core/rules';
export * from './lib/core/constraints';
export * from './lib/core/registry';
export * from './lib/core/server-error';
export * from './lib/core/intl';
export * from './lib/core/path';
export {interpolate} from './lib/core/text';
export {maybeEquals, diff} from './lib/core/compare';

// Forms layer.
export * from './lib/signals/form';
export * from './lib/signals/rules';
export * from './lib/signals/error-store';
export * from './lib/signals/semantic';
export * from './lib/signals/metadata';
export * from './lib/signals/reactions';
export * from './lib/signals/wizard';
export {rulesOf, hasRule, constraintsOf} from './lib/signals/rule-lookup';
export {childField, walkFields} from './lib/signals/field-tree';
export type {AnyField, AnyReadonlyField} from './lib/signals/field-tree';

// The forms engine, re-exported so this package is all an application needs.
export * from '@such-code/ngx-forms';

// Template building blocks.
export * from './lib/ui/form.directive';
export * from './lib/ui/field-errors.component';
export * from './lib/ui/form-errors.component';
export * from './lib/ui/field-state.directive';
export * from './lib/ui/error-message.pipe';
export * from './lib/ui/index';
