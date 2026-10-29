> **نسخهٔ ۰.۳:** کتابخانه و بایگانی، قالب شخصی، فونت شخصی، پومودوروی قابل تنظیم و رفع حاشیهٔ کیبورد. راهنمای تغییرات: `docs/RELEASE-0.3.md`.

# Nron Editor · 0.2

A small offline-first writing desk for Persian and English. Tauri 2, Rust and
vanilla JavaScript. Mobile sheets, keyboard shortcuts, local history and real
multi-format output. Licensed **GPL-3.0-only** (see `LICENSE`).

## شروع سریع

- **فرمان‌ها** در بالای برنامه، یا `Ctrl/Cmd + Shift + P`: ۵۰ فرمان سبک.
- تبدیل متن پیش‌نمایش دارد؛ قبل از جایگزینی، نسخه قبلی در تاریخچه ثبت می‌شود.
- در موبایل: نوشتن، فهرست، تاریخچه، منابع و قالب در نوار پایین؛ ورود/خروجی و
  تنظیمات در منوی بالا. از بخش قالب هم می‌توانید سند تازه بسازید.
- نوشته‌ها روی دستگاه ذخیره می‌شوند؛ پشتیبان JSON را منظم دانلود کنید.
- پلاگین نمونه: `plugins/persian-cleanup.json`؛ راهنما: `docs/PLUGINS.md`.
- به‌روزرسانی: تنظیمات → بررسی به‌روزرسانی GitHub؛ جزئیات امضا در `docs/UPDATES.md`.

## Build prerequisites

Node 24, Rust stable (with rustfmt/clippy), and the OS prerequisites for Tauri 2.
Linux: GTK3/WebKitGTK 4.1 development packages. Android: Java 17, SDK 36,
Build Tools 36.0.0 and NDK 28.2.13676358. Build Windows installers on a Windows
runner with MSVC and WebView2 prerequisites; macOS bundles require macOS/Xcode.

```sh
npm ci
npm run vendor
npm test
npm run test:ui  # npx playwright install chromium on a fresh machine
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run tauri -- build
```

For local browser development: `python3 -m http.server 4318 --directory src`.
This is a development preview, not a hosted production service. Do not deploy the
source directory with user secrets. All frontend dependencies are bundled locally.

### Android

Set `JAVA_HOME`, `ANDROID_HOME` and `NDK_HOME` to your own installations, then:

```sh
rustup target add aarch64-linux-android
npm run tauri -- android init --ci
node tools/android-config.cjs
npm run tauri -- icon src-tauri/icons/icon.png
npm run tauri -- android build --apk --target aarch64 --debug
```

The debug APK installs for testing. For release, omit `--debug` and sign with your
persistent publisher key; see `docs/UPDATES.md`. The generated Android project is
not committed; `android init` recreates it. To change generator settings, apply
and document an explicit post-init patch rather than checking in local paths.

## GitHub Actions

Upload the source contents to the repository root, including hidden `.github`.
Actions → **Cross-platform builds** → Run workflow creates independent desktop
and Android artifacts after quality checks. **Android test APK** creates an
installable arm64 test build without production secrets. A `v*` tag builds a draft
release; inspect it before publishing. Workflows were statically validated here,
not executed on your GitHub account. Your existing repository is not modified
until you upload/push these files.

## Output fidelity

- TXT, Markdown, sanitized HTML, genuine `.docx` OOXML ZIP and `.epub` ZIP.
- Word export is a compact text/basic-format export, not a full HTML/CSS layout
  converter. Complex tables/layouts and images are best preserved with HTML.
- EPUB contains sanitized XHTML. Supported embedded raster images are packaged;
  unsupported/remote images become their alternative text.
- **Print / PDF** uses the desktop print dialog. On Android it saves printable
  HTML for opening in a browser and printing to PDF; no fake `.pdf` is produced.
- Text transforms flatten rich formatting deliberately and warn before applying.

## Documentation

- `docs/ARCHITECTURE.md`: modules, compatibility and limits
- `docs/FEATURES-50.md`: exact implemented command catalogue
- `docs/PLUGINS.md`: plugin schema and host permissions
- `docs/UPDATES.md`: publisher signing and release updates
- `docs/VERIFICATION.md`: actual test/build results and known limitations

The supplied logo is used, not redrawn. Third-party notices are in
`THIRD_PARTY_NOTICES.md`. Skills used for the workflow are included under
`.agents/skills`; they are development references, not an app runtime dependency.
