//! Markdown ↔ HTML conversion.

use pulldown_cmark::{html, Options, Parser};

/// Convert Markdown into HTML.
pub fn to_html(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);
    let parser = Parser::new_ext(markdown, options);
    let mut out = String::new();
    html::push_html(&mut out, parser);
    out
}

/// Best-effort HTML → Markdown. Handles the block/inline tags Nron emits.
pub fn from_html(html: &str) -> String {
    let mut out = String::new();
    let chars = html.chars();
    let mut buf = String::new();

    // Extremely small tag-aware transformer good enough for our own output.
    let mut tag = String::new();
    let mut in_tag = false;

    let flush = |buf: &mut String, out: &mut String| {
        let t = decode_entities(buf.trim());
        if !t.is_empty() {
            out.push_str(&t);
        }
        buf.clear();
    };

    for c in chars {
        match c {
            '<' => {
                in_tag = true;
                tag.clear();
            }
            '>' => {
                in_tag = false;
                let name = tag.trim().to_lowercase();
                match name.as_str() {
                    "h1" => {
                        flush(&mut buf, &mut out);
                        out.push_str("\n# ");
                    }
                    "h2" => {
                        flush(&mut buf, &mut out);
                        out.push_str("\n## ");
                    }
                    "h3" => {
                        flush(&mut buf, &mut out);
                        out.push_str("\n### ");
                    }
                    "blockquote" => {
                        flush(&mut buf, &mut out);
                        out.push_str("\n> ");
                    }
                    "b" | "strong" | "/b" | "/strong" => {
                        flush(&mut buf, &mut out);
                        out.push_str("**");
                    }
                    "i" | "em" | "/i" | "/em" => {
                        flush(&mut buf, &mut out);
                        out.push('*');
                    }
                    "br" | "br/" => out.push_str("  \n"),
                    "/p" | "/h1" | "/h2" | "/h3" | "/blockquote" | "/li" => {
                        flush(&mut buf, &mut out);
                        out.push('\n');
                    }
                    "li" => {
                        flush(&mut buf, &mut out);
                        out.push_str("\n- ");
                    }
                    _ => {
                        flush(&mut buf, &mut out);
                    }
                }
            }
            _ => {
                if in_tag {
                    tag.push(c);
                } else {
                    buf.push(c);
                }
            }
        }
    }
    flush(&mut buf, &mut out);
    while out.contains("\n\n\n") {
        out = out.replace("\n\n\n", "\n\n");
    }
    out.trim().to_string()
}

fn decode_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&quot;", "\"")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heading_roundtrips() {
        let html = to_html("# Title");
        assert!(html.contains("<h1>"));
    }

    #[test]
    fn html_to_md_heading() {
        let md = from_html("<h1>Title</h1><p>body</p>");
        assert!(md.contains("# Title"));
    }
}
