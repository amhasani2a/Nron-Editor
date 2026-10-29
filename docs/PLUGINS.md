# Adding a plugin

1. Open **فرمان‌ها → مدیریت پلاگین‌ها**.
2. Choose **افزودن پلاگین JSON** and select `plugins/persian-cleanup.json`.
3. Review its name and type **بله** to approve.
4. Its commands appear in the palette. Each command previews a **whole-document**
   text transformation; applying it flattens rich formatting but saves a history
   snapshot first. Nothing is changed merely by installing a plugin.
5. Disable or delete it in the same manager. Plugins persist locally in settings.

```json
{
  "id": "my.text-tools",
  "name": "My text tools",
  "version": "1.0.0",
  "permissions": ["document:read", "document:replace"],
  "commands": [{"id": "trim", "label": "Trim text", "operation": "trim"}]
}
```

`operation` must name a built-in pure operation in `NronText.operations`.
`id` must be lowercase ASCII with letters, digits, dots or hyphens. Maximum:
64 KiB per manifest, 20 commands per plugin, 30 installed plugins. Duplicate IDs
replace a plugin only after approval. Labels are inserted as text, never HTML.
A JSON `script`, URL, or invented permission cannot execute code.

To add a new operation as a developer: write a failing test in
`tests/commands.test.cjs`, implement a pure function in `text-tools.js`, add its
localized palette label, run both test suites and the native quality gates. Avoid
adding it to the default 50-command set accidentally; update the catalogue/test
intentionally if expanding it. The boundary is deliberately simple to audit.
