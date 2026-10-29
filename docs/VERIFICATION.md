> Historical 0.2 report. For the current revision see `verification-v03/README.md` and `RELEASE-0.3.md`.

# Verification — Nron Editor 0.2.0

## Actual results

| Check | Result |
|---|---|
| Browser regression/integration suite | **20 passed**, 0 failed |
| Node operation/plugin/manifest tests | **35 passed**, 0 failed |
| Rust unit tests | **7 passed**, 0 failed |
| `cargo fmt --check` | exit 0; no output |
| `cargo clippy --locked --all-targets --all-features -- -D warnings` | exit 0 on Linux host; no project warnings |
| `actionlint` | exit 0; no output |
| `npm audit` | 0 known vulnerabilities at verification time |
| Android release compilation and packaging | actual arm64 APK built |
| APK signature | verified APK signature v2 and v3; **test certificate**, not publisher production identity |
| Android package | `com.nron.editor`, version 0.2.0, versionCode 2000, min API 26, target API 36 |
| Android 16 KiB compatibility checks | zipalign `-P 16` passed; all ELF LOAD segments aligned to `0x4000` |
| Windows cross-compilation | actual x86_64-pc-windows-msvc release binary built |
| Windows file validation | PE32+ Windows GUI x86-64; OS DLL imports inspected |

**62 tests passed** across the three suites. Raw logs are preserved under
`docs/verification/raw`; empty fmt/actionlint logs correctly mean no output, not
invented success text. Commands above were run with `--manifest-path
src-tauri/Cargo.toml` where applicable. Windows compilation used the actual
cargo-xwin/MSVC SDK route from Linux, not an ELF renamed to `.exe`.

## Warnings and intermediate failures, not hidden

- An Android Gradle daemon was killed by the builder's memory limit. The cgroup
  counter recorded an OOM kill. `tools/android-config.cjs` now bounds Gradle to
  1 GiB, one worker and in-process Kotlin; subsequent complete builds succeeded.
- Native dependency versions initially mismatched their JavaScript counterparts;
  both are now pinned compatibly in the package/Cargo locks.
- Windows cross-linking emits vendor **LNK4099 missing CRT debug PDB** warnings
  for Microsoft's static libraries. They are retained in the raw build log; the
  linker still produced the real release PE. This is distinct from project code
  passing the host Clippy `-D warnings` gate.
- Generated Tauri/Gradle/Kotlin code emits upstream deprecation warnings. They were
  not edited in the package cache or falsely reported as warning-free.
- Tests first reproduced find-marker persistence, stale source statistics,
  unsafe HTML import/title handling, fake Word/EPUB outputs, stale backups,
  non-atomic restore, mobile menu overflow, modal stacking, overridden hidden
  semantics, and dark print/opacity regressions. These regressions now pass.

## Visual verification

Actual local Chromium renders at 390×844 mobile and 1440×960 desktop were opened
and inspected individually: light/dark writing surfaces, command palette,
settings, plugins, mobile menu, transform preview, confirmation layering,
update-error state and print. Mobile menu overflow, invisible glyph icons,
confirmation stacking and dark-print contrast were found and corrected.
Screenshots contain a QA example document, not preloaded user data.

## Explicit limits

- **No execution on a physical Android phone or real Windows host** was available.
  A successful build/signature/file validation is not a claim of device runtime QA.
- Windows download is a portable x64 executable, not MSI/NSIS. The workflow builds
  installers on Windows. WebView2 Runtime is required. Authenticode signing and
  Apple notarization are not configured without publisher credentials.
- Workflows were checked with actionlint, **not run in the user's GitHub account**.
  macOS/Linux distribution bundles have not been built here.
- Release discovery UI, semantic version checks and manifest generation are tested.
  A real owner-signed end-to-end published update has not been exercised. This
  build has no publisher updater key; manual release-page download is available.
- Plugins v1 are approved declarative text operations, not arbitrary executable
  third-party modules. There are 50 default commands, not 50 independent systems.
- Rich text still uses contenteditable/execCommand. Transforms flatten formatting
  after warning and snapshot. Word export is basic text/formatting, not full layout
  conversion. EPUB packages supported embedded raster images; remote/unsupported
  images become alt text. Android PDF is printable HTML plus browser print.
- Local autosave is not crash-proof journaling. An OS kill before a commit may
  lose the last pending fraction of a second. Large image-heavy history can grow;
  use backups and clear unnecessary history deliberately.
- Code review was performed manually in this session, not by an independent human
  reviewer. Mutation tests, real-device IME tests, and formal accessibility/security
  audits have not been completed.

## Binary integrity

| File | Bytes | SHA256 |
|---|---:|---|
| `Nron-Editor-0.2.0-Android-arm64-TEST.apk` | 9,003,559 | `2f30d5039aef6927044b0b56aacf28e3d8f7590bbac0efebfacac9e6b3bf66fe` |
| `Nron-Editor.exe` | 5,088,256 | `7c48efd71d8542e3def0d2bd4059ef61add8a5e749a28bd5f80d57b5dc3e349a` |

Private keystores, local SDK paths/configuration, `node_modules`, `.git`, Gradle
caches and native build trees are excluded from the source ZIP. The test signing
private key is not included. Back up old data before replacing an app signed with
another certificate; uninstalling removes its private database.
