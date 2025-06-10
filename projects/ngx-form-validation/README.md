# Template-driven form validation for Angular

## Description

This library is aimed to add reactive form validation for a template-driven form. It allows invoking action only for valid form, skipping manual validation. Validation rules could be changed on the fly by accessing `ValidationService` methods.

## Main concept

### Errors

There are two types of errors:
- control error (produced by `AbstractControl` validation pipeline);
- form error (non-validation error that relates on form action and is stored in `ErrorCollection` @see `ErrorObservingService`).

### Context

Validation context defines rules for a set of fields. You can think of a form as a set of contexts. Each form provides several contexts for different purposes for "Check" and "Validation item" directives:
- Local context (disposable context for every form that can be populated with errors);
- Named context (widely used context that has a name and can be populated from outside using `ValidationService` API).

There also exists an additional context that is used for semantic validation (When you need to check several fields of a FormGroup at once).

## Usage

Take a look at examples in `playground/ngx-form-validation`.

## Building

To build the library, run:

```bash
ng build ngx-form-validation
```

This command will compile your project, and the build artifacts will be placed in the `dist/` directory.
