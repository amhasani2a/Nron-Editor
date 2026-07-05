//! Minimal but spec-valid EPUB 3 packager.
//!
//! Produces a proper ZIP container: an uncompressed `mimetype` entry first,
//! followed by the container, package (OPF), navigation, and content files.
//! Returns the whole thing base64-encoded so it can cross the JS bridge.

use std::io::Write;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub fn build(title: &str, author: &str, body_html: &str) -> zip::result::ZipResult<String> {
    let mut buf = Vec::new();
    {
        let cursor = std::io::Cursor::new(&mut buf);
        let mut zip = ZipWriter::new(cursor);

        // 1) `mimetype` MUST be first and stored (uncompressed).
        let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        zip.start_file("mimetype", stored)?;
        zip.write_all(b"application/epub+zip")?;

        let deflated =
            SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

        // 2) container.xml
        zip.start_file("META-INF/container.xml", deflated)?;
        zip.write_all(
            br#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#,
        )?;

        let t = escape_xml(title);
        let a = escape_xml(author);
        let uid = format!("nron-{}", chrono_like_id());

        // 3) content.opf (package document)
        let opf = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="fa">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">{uid}</dc:identifier>
    <dc:title>{t}</dc:title>
    <dc:creator>{a}</dc:creator>
    <dc:language>fa</dc:language>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>"#
        );
        zip.start_file("OEBPS/content.opf", deflated)?;
        zip.write_all(opf.as_bytes())?;

        // 4) nav.xhtml
        let nav = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="fa" dir="rtl">
<head><title>{t}</title></head>
<body><nav epub:type="toc"><h1>فهرست</h1><ol><li><a href="content.xhtml">{t}</a></li></ol></nav></body>
</html>"#
        );
        zip.start_file("OEBPS/nav.xhtml", deflated)?;
        zip.write_all(nav.as_bytes())?;

        // 5) style.css
        zip.start_file("OEBPS/style.css", deflated)?;
        zip.write_all(
            b"body{font-family:serif;line-height:1.9;direction:rtl;text-align:justify;padding:1em}\nh1,h2,h3{line-height:1.4}\nimg{max-width:100%}",
        )?;

        // 6) content.xhtml
        let content = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="fa" dir="rtl">
<head><title>{t}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><h1>{t}</h1>{body}</body>
</html>"#,
            body = body_html
        );
        zip.start_file("OEBPS/content.xhtml", deflated)?;
        zip.write_all(content.as_bytes())?;

        zip.finish()?;
    }
    Ok(STANDARD.encode(&buf))
}

/// Tiny non-cryptographic id derived from the current time (no extra deps).
fn chrono_like_id() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_nonempty_epub() {
        let b64 = build("عنوان", "نویسنده", "<p>متن</p>").unwrap();
        assert!(!b64.is_empty());
        let bytes = STANDARD.decode(b64).unwrap();
        // ZIP local file header magic.
        assert_eq!(&bytes[0..2], b"PK");
    }
}
