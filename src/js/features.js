window.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const editor = DOM.visualEditor || $('visual-editor');

  const escapeHtml = (s) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stripHtml = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return (d.innerText || d.textContent || '').replace(/\s+/g, ' ').trim(); };
  const norm = (s) => (s || '')
    .replace(/\u064A/g, '\u06CC').replace(/\u0643/g, '\u06A9')
    .replace(/[\u0660-\u0669]/g, d => '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'[d.charCodeAt(0) - 0x0660])
    .toLowerCase();

  const gModal = $('gsearch-modal'), gInput = $('gsearch-input'), gResults = $('gsearch-results');

  function openGsearch() {
    if (!gModal) return;
    gModal.classList.remove('hidden');
    gInput.value = '';
    gResults.innerHTML = '<div class="gs-empty">عبارتی برای جستجو بنویسید</div>';
    setTimeout(() => gInput.focus(), 60);
  }

  async function runGlobalSearch() {
    const q = (gInput.value || '').trim();
    gResults.innerHTML = '';
    if (!q) { gResults.innerHTML = '<div class="gs-empty">عبارتی برای جستجو بنویسید</div>'; return; }
    await saveCurrentTab();
    const nq = norm(q);
    let total = 0;
    for (const tab of state.tabs) {
      const text = stripHtml(tab.content);
      const hay = norm(text);
      const inTitle = norm(tab.title).indexOf(nq) !== -1;
      const idx = hay.indexOf(nq);
      if (idx === -1 && !inTitle) continue;
      const count = (await NronCore.searchInHtml(hay, nq)).length || (inTitle ? 1 : 0);
      const pos = idx === -1 ? 0 : idx;
      const snippet = text.slice(Math.max(0, pos - 24), pos + 40) || 'بدون متن';
      const item = document.createElement('div');
      item.className = 'gs-item';
      item.innerHTML = '<div class="gs-title">' + escapeHtml(tab.title || 'بی‌نام') +
        '<span class="gs-count">' + toFa(count) + '</span></div>' +
        '<div class="gs-snip">…' + escapeHtml(snippet) + '…</div>';
      item.addEventListener('click', async () => {
        gModal.classList.add('hidden');
        await switchTab(tab.id);
        if (typeof toggleFind === 'function') {
          toggleFind(true);
          const fi = $('find-input');
          if (fi) { fi.value = q; if (typeof runFind === 'function') runFind(); }
        }
      });
      gResults.appendChild(item);
      total++;
    }
    if (!total) gResults.innerHTML = '<div class="gs-empty">نتیجه‌ای پیدا نشد</div>';
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

  const ZWNJ = '\u200c';
  const L = '\u0622-\u06CC';
  function fixPersian(t) {
    return t
      .replace(/\u064A/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/[\u0660-\u0669]/g, d => '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'[d.charCodeAt(0) - 0x0660])
      .replace(new RegExp('(^|[\\s(\u00ab"\u201c' + ZWNJ + '])(\u0646?\u0645\u06cc) +([' + L + '])', 'g'), '$1$2' + ZWNJ + '$3')
      .replace(new RegExp('([' + L + ']) +(\u0647\u0627(\u06cc\u06cc|\u06cc)?)(?=[\\s.,\u061b\u060c:!?)\u00bb\\]]|$)', 'g'), '$1' + ZWNJ + '$2')
      .replace(new RegExp('([' + L + ']) +(\u062a\u0631(\u06cc\u0646)?)(?=[\\s.,\u061b\u060c:!?)\u00bb\\]]|$)', 'g'), '$1' + ZWNJ + '$2')
      .replace(new RegExp(ZWNJ + '{2,}', 'g'), ZWNJ);
  }
  function cleanupCurrentDoc() {
    if (state.isSourceMode) { toast('در حالت سورس انجام نمی‌شود'); return; }
    const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = w.nextNode())) nodes.push(n);
    let changed = 0;
    nodes.forEach(node => {
      const b = node.nodeValue;
      const a = fixPersian(b);
      if (a !== b) { node.nodeValue = a; changed++; }
    });
    saveCurrentTab();
    updateStats();
    if (changed) window.trackChange && window.trackChange('پاکسازی متن');
    toast(changed ? ('✔ پاکسازی شد (' + toFa(changed) + ' بخش)') : 'موردی برای اصلاح نبود');
  }
  if ($('btn-cleanup')) $('btn-cleanup').addEventListener('click', cleanupCurrentDoc);

  async function doBackup() {
    const [tabs, articles, settings] = await Promise.all([dbGetAll('tabs'), dbGetAll('articles'), dbGetAll('settings')]);
    const data = { app: 'Nron Editor', schema: 1, exportedAt: new Date().toISOString(), tabs, articles, settings };
    const name = 'nron-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    if (typeof saveOut === 'function') await saveOut(JSON.stringify(data, null, 2), name, { mime: 'application/json' });
  }
  async function doRestore(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.tabs)) { toast('✖ فایل پشتیبان معتبر نیست'); return; }
      for (const t of data.tabs) await dbPut('tabs', t);
      for (const a of (data.articles || [])) await dbPut('articles', a);
      for (const s of (data.settings || [])) await dbPut('settings', s);
      toast('✔ بازیابی شد؛ در حال بارگذاری…');
      setTimeout(() => location.reload(), 800);
    } catch (e) { toast('✖ خطا در بازیابی: ' + (e && e.message ? e.message : e)); }
  }
  if ($('btn-backup')) $('btn-backup').addEventListener('click', doBackup);
  if ($('btn-restore')) $('btn-restore').addEventListener('click', () => $('restore-input') && $('restore-input').click());
  if ($('restore-input')) $('restore-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) doRestore(f);
    e.target.value = '';
  });

  if ($('btn-snapshot')) $('btn-snapshot').addEventListener('click', () => {
    saveCurrentTab();
    window.trackChange && window.trackChange('نسخه دستی');
    window.renderHistory && window.renderHistory();
    toast('✔ نسخه ثبت شد');
  });

  const kbar = $('kbd-bar');
  const vv = window.visualViewport;
  let edFocused = false;
  function placeKbar() {
    if (!kbar) return;
    const show = window.innerWidth <= 860 && edFocused;
    document.body.classList.toggle('typing', show);
    if (!show) { kbar.style.display = 'none'; return; }
    const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    kbar.style.bottom = inset + 'px';
    kbar.style.display = 'flex';
  }
  if (editor) {
    editor.addEventListener('focus', () => { edFocused = true; placeKbar(); });
    editor.addEventListener('blur', () => { edFocused = false; setTimeout(placeKbar, 60); });
  }
  if (vv) { vv.addEventListener('resize', placeKbar); vv.addEventListener('scroll', placeKbar); }
  window.addEventListener('resize', placeKbar);
  if (kbar) {
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
