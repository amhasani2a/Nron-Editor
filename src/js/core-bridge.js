/*
 * core-bridge.js
 * Bridges the frontend to the Rust core exposed via Tauri commands.
 * When running inside Tauri (desktop/Android), heavy operations (word stats,
 * search, markdown, EPUB packaging) are handled by the compiled Rust core for
 * speed. When running in a plain browser (e.g. preview / QA), it transparently
 * falls back to pure-JS implementations so the UI keeps working everywhere.
 */
window.NronCore = (function () {
  const hasTauri = typeof window.__TAURI__ !== 'undefined'
    && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function';
  const invoke = hasTauri ? window.__TAURI__.core.invoke : null;

  // Persian/Arabic digit normalization for consistent counting.
  const toEnDigits = (s) => s.replace(/[\u06f0-\u06f9]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                              .replace(/[\u0660-\u0669]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

  function jsStats(text) {
    const t = (text || '').trim();
    const words = t ? t.split(/\s+/).filter(Boolean).length : 0;
    const chars = (text || '').length;
    const charsNoSpace = (text || '').replace(/\s/g, '').length;
    const sentences = (t.match(/[.!?؟۔\n]+/g) || []).length;
    const paragraphs = t ? t.split(/\n{2,}/).filter(s => s.trim()).length : 0;
    // Persian avg reading speed ~ 200 wpm.
    const readingTime = Math.max(0, Math.ceil(words / 200));
    return { words, chars, chars_no_space: charsNoSpace, sentences, paragraphs, reading_time_min: readingTime };
  }

  async function stats(text) {
    if (invoke) { try { return await invoke('count_stats', { text: text || '' }); } catch (e) { /* fallback */ } }
    return jsStats(text || '');
  }

  async function markdownToHtml(md) {
    if (invoke) { try { return await invoke('markdown_to_html', { markdown: md || '' }); } catch (e) {} }
    // minimal fallback
    return (md || '')
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .split(/\n{2,}/).map(p => p.startsWith('<h') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }

  async function htmlToMarkdown(html) {
    if (invoke) { try { return await invoke('html_to_markdown', { html: html || '' }); } catch (e) {} }
    const tmp = document.createElement('div'); tmp.innerHTML = html || '';
    let out = '';
    tmp.childNodes.forEach(n => {
      const tag = (n.tagName || '').toLowerCase();
      const txt = (n.textContent || '').trim();
      if (!txt) return;
      if (tag === 'h1') out += `# ${txt}\n\n`;
      else if (tag === 'h2') out += `## ${txt}\n\n`;
      else if (tag === 'h3') out += `### ${txt}\n\n`;
      else if (tag === 'blockquote') out += `> ${txt}\n\n`;
      else out += `${txt}\n\n`;
    });
    return out.trim();
  }

  async function buildEpub(title, author, htmlBody) {
    if (invoke) {
      try {
        const b64 = await invoke('build_epub', { title: title || 'document', author: author || 'Nron', body: htmlBody || '' });
        return b64; // base64 of a valid .epub
      } catch (e) {}
    }
    return null; // signals caller to use JS fallback
  }

  async function searchInHtml(html, query) {
    if (invoke) { try { return await invoke('find_matches', { text: html || '', query: query || '' }); } catch (e) {} }
    if (!query) return [];
    const idx = []; const hay = (html || '').toLowerCase(); const needle = query.toLowerCase();
    let i = hay.indexOf(needle);
    while (i !== -1) { idx.push(i); i = hay.indexOf(needle, i + needle.length); }
    return idx;
  }

  async function coreInfo() {
    if (invoke) { try { return await invoke('core_info'); } catch (e) {} }
    return { engine: 'javascript-fallback', version: 'web', native: false };
  }

  return { hasTauri, stats, markdownToHtml, htmlToMarkdown, buildEpub, searchInHtml, coreInfo, toEnDigits };
})();
