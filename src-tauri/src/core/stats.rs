//! Text statistics and search, tuned for Persian/Arabic + Latin scripts.

use serde::Serialize;

#[derive(Serialize)]
pub struct TextStats {
    pub words: usize,
    pub chars: usize,
    pub chars_no_space: usize,
    pub sentences: usize,
    pub paragraphs: usize,
    pub reading_time_min: usize,
}

/// Normalize Persian/Arabic-Indic digits to ASCII so counting is consistent.
fn normalize(input: &str) -> String {
    input
        .chars()
        .map(|c| match c {
            '\u{06F0}'..='\u{06F9}' => char::from(b'0' + (c as u32 - 0x06F0) as u8),
            '\u{0660}'..='\u{0669}' => char::from(b'0' + (c as u32 - 0x0660) as u8),
            _ => c,
        })
        .collect()
}

pub fn analyze(text: &str) -> TextStats {
    let normalized = normalize(text);
    let trimmed = normalized.trim();

    let words = trimmed.split_whitespace().filter(|w| !w.is_empty()).count();
    let chars = text.chars().count();
    let chars_no_space = text.chars().filter(|c| !c.is_whitespace()).count();

    let sentences = trimmed
        .chars()
        .filter(|c| matches!(c, '.' | '!' | '?' | '\u{061F}' | '\u{06D4}' | '\n'))
        .count()
        .max(if words > 0 { 1 } else { 0 });

    let paragraphs = trimmed
        .split("\n\n")
        .filter(|p| !p.trim().is_empty())
        .count();

    // ~200 words per minute average Persian reading speed.
    let reading_time_min = words.div_ceil(200);

    TextStats {
        words,
        chars,
        chars_no_space,
        sentences,
        paragraphs,
        reading_time_min,
    }
}

/// Return byte offsets of every case-insensitive occurrence of `query`.
pub fn find_matches(text: &str, query: &str) -> Vec<usize> {
    if query.is_empty() {
        return Vec::new();
    }
    let hay = text.to_lowercase();
    let needle = query.to_lowercase();
    let mut out = Vec::new();
    let mut start = 0usize;
    while let Some(pos) = hay[start..].find(&needle) {
        let abs = start + pos;
        out.push(abs);
        start = abs + needle.len();
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_persian_words() {
        let s = analyze("سلام دنیای زیبا");
        assert_eq!(s.words, 3);
    }

    #[test]
    fn reading_time_rounds_up() {
        let text = "کلمه ".repeat(201);
        let s = analyze(&text);
        assert_eq!(s.reading_time_min, 2);
    }

    #[test]
    fn finds_all_matches() {
        let m = find_matches("aXaXa", "a");
        assert_eq!(m, vec![0, 2, 4]);
    }

    #[test]
    fn empty_query_returns_empty() {
        assert!(find_matches("abc", "").is_empty());
    }
}
