//! Nron Editor — Rust core.
//!
//! Exposes fast, native commands to the web frontend via Tauri v2. The same
//! `run()` entry point is used for desktop (Windows) and mobile (Android),
//! which is why it is annotated with `#[cfg_attr(mobile, tauri::mobile_entry_point)]`.

mod core;

use core::{epub, markdown, stats};

/// Open only the publisher's fixed release page, never an arbitrary URL.
#[tauri::command]
fn open_release(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(
            "https://github.com/amhasani2a/Nron-Editor/releases/latest",
            None::<&str>,
        )
        .map_err(|e| e.to_string())
}

/// Text statistics returned to the frontend.
#[tauri::command]
fn count_stats(text: String) -> stats::TextStats {
    stats::analyze(&text)
}

/// Byte offsets of every (case-insensitive) match of `query` inside `text`.
#[tauri::command]
fn find_matches(text: String, query: String) -> Vec<usize> {
    stats::find_matches(&text, &query)
}

/// Convert Markdown to sanitized-ish HTML using pulldown-cmark.
#[tauri::command]
fn markdown_to_html(markdown: String) -> String {
    markdown::to_html(&markdown)
}

/// Best-effort HTML → Markdown conversion.
#[tauri::command]
fn html_to_markdown(html: String) -> String {
    markdown::from_html(&html)
}

/// Build a spec-valid EPUB 3 file and return it base64-encoded.
#[tauri::command]
fn build_epub(title: String, author: String, body: String) -> Result<String, String> {
    epub::build(&title, &author, &body).map_err(|e| e.to_string())
}

/// Report which engine is running (used by the UI status bar).
#[tauri::command]
fn core_info() -> serde_json::Value {
    serde_json::json!({
        "engine": "rust",
        "version": env!("CARGO_PKG_VERSION"),
        "native": true
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            count_stats,
            find_matches,
            markdown_to_html,
            html_to_markdown,
            build_epub,
            core_info,
            open_release
        ]);
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = if let Some(key) = option_env!("NRON_UPDATER_PUBLIC_KEY") {
        if key.trim().is_empty() {
            builder
        } else {
            builder.plugin(tauri_plugin_updater::Builder::new().pubkey(key).build())
        }
    } else {
        builder
    };
    builder
        .run(tauri::generate_context!())
        .expect("error while running Nron Editor");
}
