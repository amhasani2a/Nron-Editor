/* Nron Editor — main application controller. */
const state = {
  tabs: [], activeTabId: null, isSourceMode: false, zenMode: false,
  pomodoroInterval: null, pomodoroTime: 1500,
};
const DOM = {};

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
  if (state.activeTabId) await switchTab(state.activeTabId);
  else renderTabs();
  await updateStats();
  const info = await NronCore.coreInfo();
  DOM.statusMsg.textContent = info.native ? `آماده · هسته Rust ${info.version || ''}` : 'آماده';
});

async function loadState() {
  const savedTabs = await dbGetAll('tabs');
  if (savedTabs && savedTabs.length > 0) {
    state.tabs = savedTabs.sort((a, b) => a.id - b.id);
    const active = await dbGet('settings', 'activeTabId');
    state.activeTabId = active ? active.value : state.tabs[0].id;
    if (!state.tabs.find(t => t.id === state.activeTabId)) state.activeTabId = state.tabs[0].id;
  }
}

function setupEventListeners() {
  document.getElementById('btn-new-tab').addEventListener('click', createNewTab);
  document.getElementById('btn-source').addEventListener('click', toggleSourceMode);
  document.getElementById('btn-save').addEventListener('click', forceSave);
  document.getElementById('btn-zen').addEventListener('click', toggleZenMode);
  document.getElementById('btn-pomodoro').addEventListener('click', togglePomodoro);
  document.getElementById('btn-outline').addEventListener('click', () => { switchSidebarPanel('outline'); if (window.innerWidth <= 860) document.getElementById('sidebar').classList.add('mobile-open'); });
  document.getElementById('btn-link').addEventListener('click', insertLink);
  document.getElementById('btn-export').addEventListener('click', (e) => { e.currentTarget.closest('.dropdown').classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown')) document.querySelector('.dropdown')?.classList.remove('open'); });

  document.querySelectorAll('.sidebar-tab').forEach(t =>
    t.addEventListener('click', () => switchSidebarPanel(t.getAttribute('data-panel'))));

  document.querySelectorAll('.format-btn').forEach(btn =>
    btn.addEventListener('click', (e) => executeCommand(e.currentTarget.getAttribute('data-cmd'))));

  document.getElementById('font-select').addEventListener('change', (e) => executeCommand('fontName', e.target.value));
  document.getElementById('format-select').addEventListener('change', (e) => executeCommand('formatBlock', e.target.value));
  document.getElementById('btn-table').addEventListener('click', insertTable);
  document.getElementById('btn-image').addEventListener('click', () => document.getElementById('img-input').click());
  document.getElementById('img-input').addEventListener('change', handleImageUpload);

  const importBtn = document.getElementById('btn-import');
  if (importBtn) importBtn.addEventListener('click', () => document.getElementById('import-input').click());
  document.getElementById('import-input').addEventListener('change', handleImport);

  let typingTimer;
  DOM.visualEditor.addEventListener('input', () => {
    clearTimeout(typingTimer); updateStats();
    typingTimer = setTimeout(() => { saveCurrentTab(); window.trackChange && window.trackChange('تایپ'); window.renderOutline && window.renderOutline(); }, 1200);
  });
  DOM.visualEditor.addEventListener('keyup', () => { updateToolbarState(); typewriterScroll(); });
  DOM.visualEditor.addEventListener('mouseup', updateToolbarState);
  DOM.sourceEditor.addEventListener('input', () => { clearTimeout(typingTimer); typingTimer = setTimeout(saveCurrentTab, 1200); });
}

async function createNewTab() {
  const id = Date.now();
  const newTab = { id, title: 'سند جدید', content: '<h1>سند جدید</h1><p></p>', history: [] };
  state.tabs.push(newTab);
  await dbPut('tabs', newTab);
  window.addToHistory && window.addToHistory(newTab, 'ایجاد');
  await dbPut('tabs', newTab);
  renderTabs();
  await switchTab(id);
}

function renderTabs() {
  DOM.docTabs.innerHTML = '';
  state.tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = `doc-tab ${tab.id === state.activeTabId ? 'active' : ''}`;
    const name = document.createElement('span');
    name.textContent = tab.title; name.contentEditable = 'true';
    name.addEventListener('blur', () => renameTab(tab.id, name.textContent));
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });
    name.addEventListener('click', (e) => e.stopPropagation());
    const close = document.createElement('span');
    close.className = 'close-tab'; close.textContent = '×';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });
    el.appendChild(name); el.appendChild(close);
    el.addEventListener('click', () => switchTab(tab.id));
    DOM.docTabs.appendChild(el);
  });
}

async function switchTab(id) {
  await saveCurrentTab();
  state.activeTabId = id;
  await dbPut('settings', { key: 'activeTabId', value: id });
  const tab = state.tabs.find(t => t.id === id);
  if (!tab) return;
  DOM.visualEditor.innerHTML = tab.content;
  DOM.sourceEditor.value = tab.content;
  applySourceModeView();
  renderTabs();
  window.renderHistory && window.renderHistory();
  window.renderOutline && window.renderOutline();
  await updateStats();
  if (window.innerWidth > 860) DOM.visualEditor.focus();
}

function applySourceModeView() {
  if (state.isSourceMode) {
    DOM.visualEditor.classList.add('hidden');
    DOM.sourceEditor.style.display = 'block';
  } else {
    DOM.visualEditor.classList.remove('hidden');
    DOM.sourceEditor.style.display = 'none';
  }
}

async function saveCurrentTab() {
  if (!state.activeTabId) return;
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;
  tab.content = state.isSourceMode ? DOM.sourceEditor.value : DOM.visualEditor.innerHTML;
  await dbPut('tabs', tab);
}

async function forceSave() {
  await saveCurrentTab();
  window.trackChange && window.trackChange('ذخیره دستی');
  DOM.statusMsg.textContent = 'ذخیره شد ✓';
  setTimeout(() => (DOM.statusMsg.textContent = 'آماده'), 1800);
}

async function renameTab(id, newTitle) {
  const tab = state.tabs.find(t => t.id === id);
  if (tab && newTitle.trim()) { tab.title = newTitle.trim(); await dbPut('tabs', tab); renderTabs(); }
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
  updateStats(); updateToolbarState();
  window.trackChange && window.trackChange(cmd);
}

function updateToolbarState() {
  document.querySelectorAll('.format-btn').forEach(btn => {
    const cmd = btn.getAttribute('data-cmd');
    try { btn.classList.toggle('active', document.queryCommandState(cmd)); } catch (e) {}
  });
}

function toggleSourceMode() {
  state.isSourceMode = !state.isSourceMode;
  if (state.isSourceMode) DOM.sourceEditor.value = DOM.visualEditor.innerHTML;
  else DOM.visualEditor.innerHTML = DOM.sourceEditor.value;
  applySourceModeView();
  (state.isSourceMode ? DOM.sourceEditor : DOM.visualEditor).focus();
}

function toggleZenMode() { state.zenMode = !state.zenMode; DOM.app.classList.toggle('zen-mode', state.zenMode); }

function togglePomodoro() {
  const disp = DOM.pomodoroDisplay, btn = document.getElementById('btn-pomodoro');
  if (state.pomodoroInterval) {
    clearInterval(state.pomodoroInterval); state.pomodoroInterval = null; state.pomodoroTime = 1500;
    disp.textContent = '۲۵:۰۰'; disp.classList.remove('running');
  } else {
    disp.classList.add('running');
    state.pomodoroInterval = setInterval(() => {
      state.pomodoroTime--;
      const m = Math.floor(state.pomodoroTime / 60), s = state.pomodoroTime % 60;
      disp.textContent = toFa(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      if (state.pomodoroTime <= 0) { togglePomodoro(); toast('وقت استراحت است! ☕'); }
    }, 1000);
  }
}

function insertTable() {
  if (state.isSourceMode) return;
  const rows = parseInt(prompt('تعداد سطر:', '3'));
  const cols = parseInt(prompt('تعداد ستون:', '3'));
  if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1) return;
  let html = '<table><tbody>';
  for (let i = 0; i < rows; i++) { html += '<tr>'; for (let j = 0; j < cols; j++) html += '<td>&nbsp;</td>'; html += '</tr>'; }
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
  if (/\.(md)$/i.test(file.name)) html = await NronCore.markdownToHtml(text);
  else if (/\.(html?|htm)$/i.test(file.name)) html = text;
  else html = text.split(/\n/).map(l => `<p>${l.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) || '<br>'}</p>`).join('');
  const id = Date.now();
  const tab = { id, title: file.name.replace(/\.[^.]+$/, ''), content: html, history: [] };
  state.tabs.push(tab); await dbPut('tabs', tab); renderTabs(); await switchTab(id);
  e.target.value = ''; toast('فایل وارد شد');
}

async function updateStats() {
  const text = DOM.visualEditor.innerText || '';
  const s = await NronCore.stats(text);
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
  t.textContent = msg; t.classList.remove('hidden'); t.style.opacity = '1';
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 250); }, 1900);
}
function toFa(v){return String(v).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);}
