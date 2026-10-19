# ngx-workspace

Angular libraries by such-code.

| Package | Path | Description |
|---|---|---|
| `@such-code/ngx-forms` | `projects/ngx-forms` | Validation templates, server errors, submit handling and wizards for Angular Signal Forms. Replaces `@such-code/ngx-form-validation` ([migration guide](projects/ngx-forms/MIGRATION.md)). |

Requires Node.js 22.22.3+ or 24.15+.

```bash
npm install
npm test                 # library unit tests (Vitest)
npm run build            # builds dist/ngx-forms
npm start                # playground on http://localhost:4200
```

The playground (`playground/`) has one page per feature: templates, server errors, semantic validation, dynamic
structure, wizard and input correction. It imports the library from source, so no build is needed while developing.
