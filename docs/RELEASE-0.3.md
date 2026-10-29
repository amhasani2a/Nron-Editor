# Nron Editor 0.3 — writing-first workspace

## What changed
- Native Android system-bar, cutout and IME insets are consumed once at the content root. `tools/android-config.cjs` reapplies `native/android/MainActivity.kt` after Android initialization. The viewport-aware web layout remains a fallback for browser/desktop contexts.
- SVG keyboard toolbar (10 actions), touch-sized controls, grouped format sheet, explicit header new-document and library controls.
- Startup selects the latest **created, nonarchived** document. The mobile tab strip shows only the current document; the library contains all documents.
- Closing a document tab now **archives** it, rather than deleting it. Archive and restore are reversible. Library search, collection labels and name/created/edited sorting compose. Rows are paginated in batches of 40.
- 12 built-in document templates; create personal templates from the current document, import/export declarative JSON templates, delete personal templates. Applying a template always creates another document, never overwrites the current one. HTML is sanitized. Limit: 100 personal templates, 100,000 characters each.
- Six appearance presets and short, optional transitions. OS reduced-motion preference is respected. Appearance does not rewrite document contents.
- Ten bundled OFL fonts, verified to contain پ چ ژ گ ک ی. Faces load on selection; only three extra faces stay registered. A system fallback remains available.
- Personal TTF/OTF/WOFF2 import, binary validation and FontFace parsing before storage; local IndexedDB storage and removal. Limits: 5 MiB/file, 10 fonts, 20 MiB total. Personal fonts are included in backups only when requested. Fonts are not uploaded.
- Configurable work/break periods (1–180 minutes), pause/resume/reset and persistent wall-clock deadline. The timer does not drift because JavaScript intervals were throttled. It does not guarantee background alarms or keep the OS awake.

- Feature dialogs wait for preference initialization; selecting the default font is persisted across restart.

## Document safety and memory
- IndexedDB v3 adds the fonts store without resetting existing tabs, articles or settings.
- Startup uses a cursor to project document headers instead of retaining all bodies/history. Only the opened document is hydrated; outgoing document bodies/history are released. Metadata-only writes merge within the same read/write transaction, preserving stored text.
- IndexedDB transaction completion is required before reporting save success. New documents enter UI state only after their initial record commits.
- Every scheduled edit also writes a synchronous emergency journal; failed primary saves do not clear it. Recovery runs before initial document selection. Journal and IndexedDB can both fail if storage is full/unavailable; visible error feedback remains important.
- History is bounded to 40 snapshots and approximately 2 MiB per opened document (the latest snapshot is always retained, even if larger). This can prune older history; **current text is not truncated**.
- Backup restore is transactional and validates document/template/font shapes before writing. Archive/collection metadata is preserved. Older schema-1 backups remain accepted. Font payloads are optional, checked before import.
- Uninstalling the app, clearing app storage, filesystem/device failure, or the OS purging unprotected web storage can still destroy local data. Export backups regularly. No application can honestly promise zero data loss under all conditions.

## Persian export
- Unicode, ZWNJ and logical source ordering are preserved; no manual reversal, shaping to presentation forms, or automatic yeh/kaf normalization during export.
- DOCX uses real OOXML with bidi paragraphs, right alignment, Persian language and complex-script font declarations; Arabic-script and other runs are distinguished. Basic bold/italic and line breaks are supported. Full complex table/image/style fidelity is not promised. DOCX font is not embedded; Word may substitute a locally installed font.
- HTML uses UTF-8, RTL, an embedded Vazirmatn font and isolated LTR code blocks.
- EPUB contains the embedded font, RTL spine, XHTML and supported local images. Reader support for embedded WOFF2 varies.
- Plain text uses UTF-8 with BOM for Windows compatibility. Markdown remains Unicode text; layout depends on the receiving renderer.
- Desktop PDF uses the system print dialog. Android exports printable HTML for browser Print/PDF; it is not a native PDF renderer. Device/Word/reader matrix testing remains necessary.

## Design/architecture
Keep the existing lightweight Tauri + vanilla web frontend. No Electron, React or animation framework was added.
- `workspace-model.js`: pure tested selection, filtering, template schema, history-budget and timer policies.
- `durability.js`: emergency journal and startup recovery.
- `workspace.js`: library/templates/fonts/timer UI controllers; never stores arbitrary executable plugin code.
- `export-font.js`: on-demand offline export font.
- `app.js` / `db.js`: document lifecycle and transactional persistence.
- `native/android/MainActivity.kt`: Android-only window inset boundary.

## Finding the features
- Header **＋**: new document. Header **books/library icon**: library, archive and collections.
- Library → **قالب‌ها**: built-in/personal templates and JSON import/export.
- Settings → **ظاهر، فونت‌ها و قالب‌های شخصی**: fonts, personal font import, appearance and motion preference.
- Mobile menu → **پومودورو**, or desktop timer icon: durations and start/pause/reset.
- Settings → Backup: optional **فونت‌های شخصی هم در بکاپ باشند**.

## Builds and signing
Use the included GitHub Actions for publisher builds. Android owner signing secrets and desktop updater keys from `docs/UPDATES.md` still apply. Delivered test-signed APKs are not publisher-signed releases. Back up before installing; a signature mismatch can require uninstalling the old app, which erases private data.

No universal claim of support for every phone/OS is made: minimum Android API remains 26; supported ABI(s) are stated on the delivered APK. Windows portable x64 requires WebView2. Physical device and Windows runtime validation is not available in this builder.
