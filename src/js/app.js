// Main controller: bootstrap, document tabs, editor commands, autosave.

const state = {
  tabs: [],
  activeTabId: null,
  isSourceMode: false,
  zenMode: false,
  pomodoroInterval: null,
  pomodoroTime: 1500,
};
const DOM = {};

const AUTOSAVE_MS = 700;
let typingTimer = null;

window.addEventListener('DOMContentLoaded', async () => {
  Object.assign(DOM, {
    visualEditor: document.getElementById('visual-editor'),
    sourceEditor: document.getElementById('source-editor'),
    docTabs: document.getElementById('doc-tabs'),
    wordCount: document.getElementById('word-count'),
    charCount: document.getElementById('char-count'),
    readTime: document.getElementById('read-time'),
    statusMsg: document.getElementById('status-msg'),
    app: document.getElementById('app'),
    pomodoroDisplay: document.getElementById('pomodoro-display'),
  });

  await initDB();
  await loadState();
  if (state.tabs.length === 0) await createNewTab();

  setupEventListeners();
  setupAutosaveGuards();

  if (state.activeTabId) await switchTab(state.activeTabId);
  else renderTabs();
  await updateStats();

  const info = await NronCore.coreInfo();
  DOM.statusMsg.textContent = info.native ? `آماده · هسته Rust ${info.version || ''}` : 'آماده';
});

async function loadState() {
  const savedTabs = await dbGetAll('tabs');
  if (!savedTabs.length) return;
  state.tabs = savedTabs.sort((a, b) => a.id - b.id);
  const active = await dbGet('settings', 'activeTabId');
  state.activeTabId = active ? active.value : state.tabs[0].id;
  if (!state.tabs.some(t => t.id === state.activeTabId)) state.activeTabId = state.tabs[0].id;
}

function setupEventListeners() {
  document.getElementById('btn-new-tab').addEventListener('click', createNewTab);
  document.getElementById('btn-source').addEventListener('click', toggleSourceMode);
  document.getElementById('btn-save').addEventListener('click', forceSave);
  document.getElementById('btn-zen').addEventListener('click', toggleZenMode);
  document.getElementById('btn-pomodoro').addEventListener('click', togglePomodoro);
  document.getElementById('btn-outline').addEventListener('click', () => {
    switchSidebarPanel('outline');
    if (window.innerWidth <= 860) document.getElementById('sidebar').classList.add('mobile-open');
  });
  document.getElementById('btn-link').addEventListener('click', insertLink);

  const dropdown = document.querySelector('.dropdown');
  document.getElementById('btn-export').addEventListener('click', () => dropdown.classList.toggle('open'));
  document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown')) dropdown?.classList.remove('open'); });

  document.querySelectorAll('.sidebar-tab').forEach(t =>
    t.addEventListener('click', () => switchSidebarPanel(t.getAttribute('data-panel'))));
  document.querySelectorAll('.format-btn').forEach(btn =>
    btn.addEventListener('click', (e) => executeCommand(e.currentTarget.getAttribute('data-cmd'))));

  document.getElementById('font-select').addEventListener('change', (e) => executeCommand('fontName', e.target.value));
  document.getElementById('format-select').addEventListener('change', (e) => executeCommand('formatBlock', e.target.value));
  document.getElementById('btn-table').addEventListener('click', insertTable);
  document.getElementById('btn-image').addEventListener('click', () => document.getElementById('img-input').click());
  document.getElementById('img-input').addEventListener('change', handleImageUpload);
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-input').click());
  document.getElementById('import-input').addEventListener('change', handleImport);

  DOM.visualEditor.addEventListener('input', () => {
    updateStats();
    scheduleSave('تایپ');
  });
  DOM.visualEditor.addEventListener('keyup', () => { updateToolbarState(); typewriterScroll(); });
  DOM.visualEditor.addEventListener('mouseup', updateToolbarState);
  DOM.sourceEditor.addEventListener('input', () => scheduleSave());
}

function scheduleSave(action) {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    saveCurrentTab();
    if (action) window.trackChange?.(action);
    window.renderOutline?.();
  }, AUTOSAVE_MS);
}

// The webview can be killed without a beforeunload, especially on Android, so
// persist eagerly whenever the app is backgrounded or the editor loses focus.
function setupAutosaveGuards() {
  const flush = () => { clearTimeout(typingTimer); saveCurrentTab(); };
  DOM.visualEditor.addEventListener('blur', flush);
  DOM.sourceEditor.addEventListener('blur', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}

async function createNewTab() {
  const tab = { id: Date.now(), title: 'سند جدید', content: '<h1>سند جدید</h1><p></p>', history: [] };
  window.addToHistory?.(tab, 'ایجاد');
  state.tabs.push(tab);
  await dbPut('tabs', tab);
  await switchTab(tab.id);
}

function renderTabs() {
  DOM.docTabs.innerHTML = '';
  state.tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = `doc-tab ${tab.id === state.activeTabId ? 'active' : ''}`;

    const name = document.createElement('span');
    name.className = 'doc-tab-name';
    name.textContent = tab.title;

    // Single tap switches; double-tap renames. Keeping the title read-only by
    // default is what makes tab switching reliable on touch screens.
    el.addEventListener('click', () => { if (name.isContentEditable) return; switchTab(tab.id); });
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      name.contentEditable = 'true';
      name.focus();
      document.execCommand('selectAll', false, null);
    });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });
    name.addEventListener('blur', () => { name.contentEditable = 'false'; renameTab(tab.id, name.textContent); });

    const close = document.createElement('span');
    close.className = 'close-tab';
    close.textContent = '×';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });

    el.append(name, close);
    DOM.docTabs.appendChild(el);
  });
}

async function switchTab(id) {
  clearTimeout(typingTimer);
  await saveCurrentTab();
  state.activeTabId = id;
  await dbPut('settings', { key: 'activeTabId', value: id });

  const tab = state.tabs.find(t => t.id === id);
  if (!tab) return;
  DOM.visualEditor.innerHTML = tab.content;
  DOM.sourceEditor.value = tab.content;
  applySourceModeView();
  renderTabs();
  window.renderHistory?.();
  window.renderOutline?.();
  await updateStats();
  if (window.innerWidth > 860) DOM.visualEditor.focus();
}

function applySourceModeView() {
  DOM.visualEditor.classList.toggle('hidden', state.isSourceMode);
  DOM.sourceEditor.style.display = state.isSourceMode ? 'block' : 'none';
}

async function saveCurrentTab() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;
  tab.content = state.isSourceMode ? DOM.sourceEditor.value : DOM.visualEditor.innerHTML;
  await dbPut('tabs', tab);
}

async function forceSave() {
  clearTimeout(typingTimer);
  await saveCurrentTab();
  window.trackChange?.('ذخیره دستی');
  DOM.statusMsg.textContent = 'ذخیره شد ✓';
  setTimeout(() => (DOM.statusMsg.textContent = 'آماده'), 1800);
}

async function renameTab(id, title) {
  const tab = state.tabs.find(t => t.id === id);
  if (!tab || !title.trim()) { renderTabs(); return; }
  tab.title = title.trim();
  await dbPut('tabs', tab);
  renderTabs();
}

async function closeTab(id) {
  if (state.tabs.length <= 1) { toast('حداقل یک سند لازم است'); return; }
  state.tabs = state.tabs.filter(t => t.id !== id);
  await dbDelete('tabs', id);
  if (state.activeTabId === id) await switchTab(state.tabs[state.tabs.length - 1].id);
  else renderTabs();
}

function executeCommand(cmd, val = null) {
  if (state.isSourceMode) return;
  DOM.visualEditor.focus();
  document.execCommand(cmd, false, val);
  updateStats();
  updateToolbarState();
  scheduleSave(cmd);
}

function updateToolbarState() {
  document.querySelectorAll('.format-btn').forEach(btn => {
    try { btn.classList.toggle('active', document.queryCommandState(btn.getAttribute('data-cmd'))); }
    catch { /* queryCommandState throws for some commands; ignore */ }
  });
}

function toggleSourceMode() {
  state.isSourceMode = !state.isSourceMode;
  if (state.isSourceMode) DOM.sourceEditor.value = DOM.visualEditor.innerHTML;
  else DOM.visualEditor.innerHTML = DOM.sourceEditor.value;
  applySourceModeView();
  (state.isSourceMode ? DOM.sourceEditor : DOM.visualEditor).focus();
}

function toggleZenMode() {
  state.zenMode = !state.zenMode;
  DOM.app.classList.toggle('zen-mode', state.zenMode);
}

function togglePomodoro() {
  const disp = DOM.pomodoroDisplay;
  if (state.pomodoroInterval) {
    clearInterval(state.pomodoroInterval);
    state.pomodoroInterval = null;
    state.pomodoroTime = 1500;
    disp.textContent = '۲۵:۰۰';
    disp.classList.remove('running');
    return;
  }
  disp.classList.add('running');
  state.pomodoroInterval = setInterval(() => {
    state.pomodoroTime--;
    const m = Math.floor(state.pomodoroTime / 60), s = state.pomodoroTime % 60;
    disp.textContent = toFa(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    if (state.pomodoroTime <= 0) { togglePomodoro(); toast('وقت استراحت است! ☕'); }
  }, 1000);
}

function insertTable() {
  if (state.isSourceMode) return;
  const rows = parseInt(prompt('تعداد سطر:', '3'), 10);
  const cols = parseInt(prompt('تعداد ستون:', '3'), 10);
  if (!(rows > 0) || !(cols > 0)) return;
  let html = '<table><tbody>';
  for (let i = 0; i < rows; i++) {
    html += '<tr>' + '<td>&nbsp;</td>'.repeat(cols) + '</tr>';
  }
  html += '</tbody></table><p></p>';
  executeCommand('insertHTML', html);
}

function insertLink() {
  if (state.isSourceMode) return;
  const url = prompt('آدرس پیوند (URL):', 'https://');
  if (url) executeCommand('createLink', url);
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (ev) => executeCommand('insertHTML', `<img src="${ev.target.result}" alt=""><p></p>`);
  reader.readAsDataURL(file);
  e.target.value = '';
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  let html;
  if (/\.md$/i.test(file.name)) html = await NronCore.markdownToHtml(text);
  else if (/\.html?$/i.test(file.name)) html = text;
  else html = text.split('\n').map(l => `<p>${escapeText(l) || '<br>'}</p>`).join('');

  const tab = { id: Date.now(), title: file.name.replace(/\.[^.]+$/, ''), content: html, history: [] };
  state.tabs.push(tab);
  await dbPut('tabs', tab);
  await switchTab(tab.id);
  e.target.value = '';
  toast('فایل وارد شد');
}

function escapeText(s) {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function updateStats() {
  const s = await NronCore.stats(DOM.visualEditor.innerText || '');
  DOM.wordCount.textContent = `کلمات: ${toFa(s.words)}`;
  DOM.charCount.textContent = `نویسه: ${toFa(s.chars_no_space)}`;
  DOM.readTime.textContent = `مطالعه: ${toFa(s.reading_time_min)} دقیقه`;
}

function typewriterScroll() {
  if (!DOM.app.classList.contains('typewriter')) return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (rect.top) DOM.visualEditor.scrollTop += rect.top - window.innerHeight / 2;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.opacity = '1';
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.classList.add('hidden'), 250);
  }, 1900);
}

function toFa(v) {
  return String(v).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
