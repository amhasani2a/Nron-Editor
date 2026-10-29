# Nron 0.2 — architecture

## Goals
Offline writing, responsive touch controls, readable RTL text, small distribution,
explicit trust boundaries, and extensions without unrestricted code execution.
This remains a Tauri 2 app with a vanilla JavaScript frontend. It was not replaced
with Electron, a React dependency tree, or a second rendering engine.

## Layers

| Layer | Files | Contract |
|---|---|---|
| Document host | `src/js/app.js`, `db.js` | Existing `NronDB` v2 records; queued tab navigation; save errors propagate |
| HTML boundary | `safety.js` + locally bundled DOMPurify | Sanitize imports, paste, saved HTML, history restore and exports; strip transient find marks |
| Pure operations | `text-tools.js` | String in/string out; no DOM, filesystem, network or IPC; unit-tested |
| Studio host | `studio.js` | Palette, transform preview, snapshot before replacement, plugin registry, update UI |
| Output packaging | `formats.js`, `export.js` | Real OOXML ZIP and EPUB ZIP; explicit native save picker; print/PDF separate |
| Rust core | `src-tauri/src/core/*` | Existing statistics/search/Markdown/EPUB commands retained; thin IPC in `lib.rs` |
| UI | `style.css`, `features.css`, `studio.css`, `icons.js` | Tokens, reusable panels, mobile sheets, SVG icons, reduced motion |
| Distribution | `.github/workflows/*`, `tools/update-manifest.cjs` | Quality gate; platform artifacts; optional signed desktop updates |

## Document compatibility
The database name/version and old numeric IDs are retained. New document IDs use
a timestamp plus UUID, with `createdAt` for sorting. There is no destructive DB
migration. Before installing a differently signed Android build, export a JSON
backup from the old installation. Uninstalling an app erases its private database.

The rich editor still uses the browser's contenteditable/execCommand stack to
preserve existing editing behavior. This is a known maintenance risk, not a new
ProseMirror-grade collaborative document model. HTML source mode is supported,
but executable HTML, arbitrary form controls, remote scripts, application CSS classes, custom element IDs
and dangerous CSS do not round-trip: this is an intentional security change.

## Save and navigation contract
- A switch request joins one queue; saves the loaded document before changing DOM.
- Typing statistics are debounced rather than invoking Rust on every keystroke.
- Input saves after 700 ms; blur/visibility/pagehide request a flush. An OS process
  kill before a pending IndexedDB commit may still lose the last fraction of a
  second. No claim of crash-proof journaling is made.
- Find highlights are never persisted. Manual snapshots are persisted after creation.
- A backup flushes pending edits first. Restore validates the whole payload and
  writes tabs/articles/allowed preferences in one IndexedDB transaction, after
  explicit confirmation. It merges by ID; it is not an automatic conflict resolver.

## Plugin v1
See `PLUGINS.md`. Declarative recipes only. There is no eval, JS module import,
subprocess, shell, remote dependency downloader, network grant, or direct IPC exposed
to plugins. Future code plugins would require a separate sandbox/host protocol,
resource limits and an explicit review; merely adding a permission string must
never grant a capability.

## Updates
See `UPDATES.md`. Release discovery uses the fixed GitHub repository. Native opening
of the release page accepts no user-controlled URL. Desktop installation uses the
official Tauri updater only when the owner's public key is compiled into the build.
Android uses normal user-approved installation and a persistent signing identity.

## Deliberately out of scope
Cloud synchronization, collaboration, arbitrary code plugins, PDF layout engine,
end-to-end Windows runtime testing on this Linux builder, and automatic recovery
from every OS/database failure. Existing global scripts have not all been converted
to ESM; the new pure boundaries make that migration possible incrementally.

## 0.3 workspace evolution
See `RELEASE-0.3.md` for the document/header lazy-loading boundary, atomic metadata merging,
emergency journal, font asset limits, declarative template schema and native inset ownership.
The previous “all documents resident” architecture no longer applies to inactive bodies/history.
Closing tabs now archives documents and startup selects newest-created active documents.
