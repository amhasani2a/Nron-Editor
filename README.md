<div align="center">

# Nron Editor

**یک برنامه نوشتن سریع، آفلاین و فارسی — با هسته‌ی Rust**

A fast, offline-first, RTL-native writing studio powered by a Rust core and Tauri v2.

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android-2783de)
![core](https://img.shields.io/badge/core-Rust-orange)
![license](https://img.shields.io/badge/license-MIT-46a171)

</div>

---

## فارسی

**Nron Editor** یک ادیتور  نوشتن ( است که کاملاً آفلاین کار می‌کند. هسته‌ی محاسباتی آن (شمارش، جستجو، تبدیل مارک‌داون، ساخت EPUB) با **Rust** نوشته شده تا سریع باشد، و رابط کاربری آن کاملاً **ریسپانسیو** و مناسب موبایل است.

### اجرا (دسکتاپ)

```bash
# پیش‌نیاز: Rust (rustup) + Tauri CLI
cargo install tauri-cli --version "^2" --locked

git clone https://github.com/<username>/nron-editor.git
cd nron-editor
cargo tauri dev      # اجرای توسعه
cargo tauri build    # ساخت نسخه‌ی نهایی ویندوز
```


## English

Nron Editor is a professional writing app (articles / stories / novels) that works fully offline. Its compute core (statistics, search, Markdown conversion, EPUB packaging) is written in **Rust** for speed, and the UI is fully **responsive** and mobile-friendly. It ships as a native **Windows** desktop app and an **Android** app from a single codebase via **Tauri v2**.

### Project layout

```
nron-editor/
├─ src/                 # Frontend (HTML/CSS/JS) — the webview UI
│  ├─ index.html
│  ├─ css/style.css     # responsive, RTL, light/dark
│  ├─ js/               # modular controllers (db, app, find, export, ...)
│  └─ assets/           # Vazirmatn + Roboto Mono fonts, logo
├─ src-tauri/           # Rust core (Tauri v2)
│  ├─ src/lib.rs        # command handlers + mobile entry point
│  ├─ src/core/         # stats.rs, markdown.rs, epub.rs (+ unit tests)
│  ├─ Cargo.toml
│  └─ tauri.conf.json
├─ .github/workflows/   # CI: Windows + Android build & release
└─ docs/                # ARCHITECTURE.md, FEATURES.md, CONTRIBUTING.md
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/FEATURES.md`](docs/FEATURES.md).

## License

GNU GENERAL PUBLIC LICENSE
 — see [LICENSE](LICENSE).
