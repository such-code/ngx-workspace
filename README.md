# ngx-workspace

Angular libraries by @such-code.

| Package | Path | Description |
|---|---|---|
| `@such-code/ngx-forms` | `projects/ngx-forms` | Signal based forms engine: Angular Signal Forms API shape, with dynamic rules, pushed errors with a lifecycle, stable array identity ([README](projects/ngx-forms/README.md)). |
| `@such-code/ngx-forms-validation` | `projects/ngx-forms-validation` | Validation templates, server errors, submit handling and wizards on top of `ngx-forms`. Replaces `@such-code/ngx-form-validation` ([migration guide](projects/ngx-forms-validation/MIGRATION.md), [README](projects/ngx-forms-validation/README.md)). |

Requires Node.js 22.22.3+ or 24.15+.

```bash
npm install
npm test                 # library unit tests (Vitest)
npm run build            # builds dist/ngx-forms, then dist/ngx-forms-validation
npm start                # playground on http://localhost:4200
```

The playground (`playground/`) has one page per feature: templates, server errors, semantic validation, dynamic
structure, wizard and input correction. It imports both libraries from source, so no build is needed while developing.
