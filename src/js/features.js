// Add-ons loaded after app.js: global search, Persian cleanup, backup/restore,
// manual snapshots, and the on-keyboard formatting bar for mobile.
window.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const editor = DOM.visualEditor || $('visual-editor');

  const escapeHtml = (s) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stripHtml = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return (d.innerText || d.textContent || '').replace(/\s+/g, ' ').trim(); };
  // Fold Arabic ي/ك and digits so search and title compare are consistent.
  const norm = (s) => (s || '')
    .replace(/\u064A/g, '\u06CC').replace(/\u0643/g, '\u06A9')
    .replace(/[\u0660-\u0669]/g, d => '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'[d.charCodeAt(0) - 0x0660])
    .toLowerCase();

  // Global search across all documents.
  const gModal = $('gsearch-modal'), gInput = $('gsearch-input'), gResults = $('gsearch-results');

  function openGsearch() {
    if (!gModal) return;
    gModal.classList.remove('hidden');
    gInput.value = '';
    gResults.innerHTML = '<div class="gs-empty">\u0639\u0628\u0627\u0631\u062a\u06cc \u0628\u0631\u0627\u06cc \u062c\u0633\u062a\u062c\u0648 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f</div>';
    setTimeout(() => gInput.focus(), 60);
  }

  async function runGlobalSearch() {
    const q = (gInput.value || '').trim();
    gResults.innerHTML = '';
    if (!q) { gResults.innerHTML = '<div class="gs-empty">\u0639\u0628\u0627\u0631\u062a\u06cc \u0628\u0631\u0627\u06cc \u062c\u0633\u062a\u062c\u0648 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f</div>'; return; }
    await saveCurrentTab();
    const nq = norm(q);
    let total = 0;
    for (const tab of state.tabs) {
      const text = stripHtml(tab.content);
      const hay = norm(text);
      const inTitle = norm(tab.title).indexOf(nq) !== -1;
      const idx = hay.indexOf(nq);
      if (idx === -1 && !inTitle) continue;
      // Match counting is offloaded to the Rust core (JS fallback inside).
      const count = (await NronCore.searchInHtml(hay, nq)).length;
      const pos = idx === -1 ? 0 : idx;
      const snippet = text.slice(Math.max(0, pos - 24), pos + 40) || '\u0628\u062f\u0648\u0646 \u0645\u062a\u0646';
      const item = document.createElement('div');
      item.className = 'gs-item';
      item.innerHTML = '<div class="gs-title">' + escapeHtml(tab.title || '\u0628\u06cc\u200c\u0646\u0627\u0645') +
        '<span class="gs-count">' + toFa(count) + '</span></div>' +
        '<div class="gs-snip">\u2026' + escapeHtml(snippet) + '\u2026</div>';
      item.addEventListener('click', async () => {
        gModal.classList.add('hidden');
        await switchTab(tab.id);
        if (typeof toggleFind === 'function') {
          toggleFind(true);
          const fi = $('find-input'); if (fi) { fi.value = q; if (typeof runFind === 'function') runFind(); }
        }
      });
      gResults.appendChild(item);
      total++;
    }
    if (!total) gResults.innerHTML = '<div class="gs-empty">\u0646\u062a\u06cc\u062c\u0647\u200c\u0627\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f</div>';
  }

  if ($('btn-gsearch')) $('btn-gsearch').addEventListener('click', openGsearch);
  if (gInput) {
    let gt;
    gInput.addEventListener('input', () => { clearTimeout(gt); gt = setTimeout(runGlobalSearch, 180); });
    gInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') gModal.classList.add('hidden'); });
  }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); openGsearch(); }
  });

  // Persian cleanup: normalize Arabic letters/digits and insert ZWNJ (nim-fasele)
  // for the می/نمی prefix and the ها/تر suffixes.
  const ZWNJ = '\u200c';
  const L = '\u0622-\u06CC'; // Persian/Arabic letter range
  function fixPersian(t) {
    return t
      .replace(/\u064A/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/[\u0660-\u0669]/g, d => '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'[d.charCodeAt(0) - 0x0660])
      // می / نمی prefix: "می رود" -> "می‌رود"
      .replace(new RegExp('(^|[\\s(\u00ab"\u201c' + ZWNJ + '])(\u0646?\u0645\u06cc) +([' + L + '])', 'g'), '$1$2' + ZWNJ + '$3')
      // ها / های / هایی plural suffix
      .replace(new RegExp('([' + L + ']) +(\u0647\u0627(\u06cc\u06cc|\u06cc)?)(?=[\\s.,\u061b\u060c:!?)\u00bb\\]]|$)', 'g'), '$1' + ZWNJ + '$2')
      // تر / ترین comparative suffix
      .replace(new RegExp('([' + L + ']) +(\u062a\u0631(\u06cc\u0646)?)(?=[\\s.,\u061b\u060c:!?)\u00bb\\]]|$)', 'g'), '$1' + ZWNJ + '$2')
      .replace(new RegExp(ZWNJ + '{2,}', 'g'), ZWNJ);
  }
  function cleanupCurrentDoc() {
    if (state.isSourceMode) { toast('\u062f\u0631 \u062d\u0627\u0644\u062a \u0633\u0648\u0631\u0633 \u0627\u0646\u062c\u0627\u0645 \u0646\u0645\u06cc\u200c\u0634\u0648\u062f'); return; }
    const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
    let changed = 0;
    nodes.forEach(node => { const b = node.nodeValue; const a = fixPersian(b); if (a !== b) { node.nodeValue = a; changed++; } });
    saveCurrentTab(); updateStats();
    if (changed) window.trackChange && window.trackChange('\u067e\u0627\u06a9\u0633\u0627\u0632\u06cc \u0645\u062a\u0646');
    toast(changed ? ('\u2714 \u067e\u0627\u06a9\u0633\u0627\u0632\u06cc \u0634\u062f (' + toFa(changed) + ' \u0628\u062e\u0634)') : '\u0645\u0648\u0631\u062f\u06cc \u0628\u0631\u0627\u06cc \u0627\u0635\u0644\u0627\u062d \u0646\u0628\u0648\u062f');
  }
  if ($('btn-cleanup')) $('btn-cleanup').addEventListener('click', cleanupCurrentDoc);

  // Backup/restore. Restore merges by id so it never wipes existing docs.
  async function doBackup() {
    const [tabs, articles, settings] = await Promise.all([dbGetAll('tabs'), dbGetAll('articles'), dbGetAll('settings')]);
    const data = { app: 'Nron Editor', schema: 1, exportedAt: new Date().toISOString(), tabs, articles, settings };
    const name = 'nron-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    if (typeof saveOut === 'function') await saveOut(JSON.stringify(data, null, 2), name, { mime: 'application/json' });
  }
  function clearStore(store) {
    return new Promise(res => { if (!window.db) return res(); const tx = window.db.transaction(store, 'readwrite'); tx.objectStore(store).clear(); tx.oncomplete = () => res(); tx.onerror = () => res(); });
  }
  async function doRestore(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.tabs)) { toast('\u2716 \u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a'); return; }
      // Merge (non-destructive): same ids overwrite, new ids add, others kept.
      for (const t of data.tabs) await dbPut('tabs', t);
      for (const a of (data.articles || [])) await dbPut('articles', a);
      for (const s of (data.settings || [])) await dbPut('settings', s);
      toast('\u2714 \u0628\u0627\u0632\u06cc\u0627\u0628\u06cc \u0634\u062f\u061b \u062f\u0631 \u062d\u0627\u0644 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc\u2026');
      setTimeout(() => location.reload(), 800);
    } catch (e) { toast('\u2716 \u062e\u0637\u0627 \u062f\u0631 \u0628\u0627\u0632\u06cc\u0627\u0628\u06cc: ' + (e && e.message ? e.message : e)); }
  }
  if ($('btn-backup')) $('btn-backup').addEventListener('click', doBackup);
  if ($('btn-restore')) $('btn-restore').addEventListener('click', () => $('restore-input') && $('restore-input').click());
  if ($('restore-input')) $('restore-input').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) doRestore(f); e.target.value = ''; });

  // Manual version snapshot.
  if ($('btn-snapshot')) $('btn-snapshot').addEventListener('click', () => {
    saveCurrentTab();
    window.trackChange && window.trackChange('\u0646\u0633\u062e\u0647 \u062f\u0633\u062a\u06cc');
    window.renderHistory && window.renderHistory();
    toast('\u2714 \u0646\u0633\u062e\u0647 \u062b\u0628\u062a \u0634\u062f');
  });

  // Formatting bar pinned above the on-screen keyboard (mobile only).
  const kbar = $('kbd-bar');
  const vv = window.visualViewport;
  let edFocused = false;
  function placeKbar() {
    if (!kbar) return;
    if (window.innerWidth > 860 || !edFocused) { kbar.style.display = 'none'; return; }
    const kb = window.innerHeight - ((vv ? vv.height : window.innerHeight) + (vv ? vv.offsetTop : 0));
    if (kb > 120) { kbar.style.display = 'flex'; kbar.style.bottom = kb + 'px'; }
    else { kbar.style.display = 'none'; }
  }
  if (editor) {
    editor.addEventListener('focus', () => { edFocused = true; placeKbar(); });
    editor.addEventListener('blur', () => { edFocused = false; setTimeout(placeKbar, 60); });
  }
  if (vv) { vv.addEventListener('resize', placeKbar); vv.addEventListener('scroll', placeKbar); }
  if (kbar) {
    // Prevent the bar from stealing focus (which would close the keyboard).
    kbar.addEventListener('pointerdown', (e) => e.preventDefault());
    kbar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const k = b.getAttribute('data-k');
      if (editor) editor.focus();
      if (k === 'bold' || k === 'italic' || k === 'underline') executeCommand(k);
      else if (k === 'h2') executeCommand('formatBlock', 'h2');
      else if (k === 'ul') executeCommand('insertUnorderedList');
      else if (k === 'ol') executeCommand('insertOrderedList');
      else if (k === 'link') insertLink();
      else if (k === 'clean') cleanupCurrentDoc();
      else if (k === 'undo') document.execCommand('undo');
      else if (k === 'redo') document.execCommand('redo');
    }));
  }
});
