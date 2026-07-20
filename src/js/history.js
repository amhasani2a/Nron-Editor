window.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('btn-clear-history');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (tab) { tab.history = []; dbPut('tabs', tab); window.renderHistory(); toast('تاریخچه پاک شد'); }
  });
});

window.trackChange = function (actionName) {
  if (!state.activeTabId) return;
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;
  if (!tab.history) tab.history = [];
  const current = state.isSourceMode
    ? document.getElementById('source-editor').value
    : document.getElementById('visual-editor').innerHTML;
  const last = tab.history[tab.history.length - 1];
  if (last && last.content === current) return;
  if (actionName === 'تایپ' && last && last.action === 'تایپ' && Date.now() - last.id < 120000) {
    last.content = current;
    last.time = new Date().toLocaleTimeString('fa-IR');
  } else {
    tab.history.push({ id: Date.now(), time: new Date().toLocaleTimeString('fa-IR'), action: actionName, content: current });
    if (tab.history.length > 100) tab.history.shift();
  }
  const panel = document.getElementById('panel-history');
  if (panel && panel.classList.contains('active')) window.renderHistory();
};

window.addToHistory = function (tab, actionName) {
  if (!tab.history) tab.history = [];
  tab.history.push({ id: Date.now(), time: new Date().toLocaleTimeString('fa-IR'), action: actionName, content: tab.content });
};

window.renderHistory = function () {
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = '';
  if (!state.activeTabId) return;
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab || !tab.history || tab.history.length === 0) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:10px;">تغییری ثبت نشده</div>';
    return;
  }
  [...tab.history].reverse().forEach((entry, idx) => {
    const realIdx = tab.history.length - 1 - idx;
    const item = document.createElement('div');
    item.className = 'history-item';
    const preview = (entry.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 42);
    const previewSafe = preview.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    item.innerHTML = `<div class="h-time">${entry.time}</div><div class="h-action">${entry.action}</div>` + (preview ? `<div class="h-preview">${previewSafe}…</div>` : '');
    item.addEventListener('click', () => {
      const e = tab.history[realIdx];
      document.getElementById('visual-editor').innerHTML = e.content;
      document.getElementById('source-editor').value = e.content;
      tab.content = e.content;
      dbPut('tabs', tab);
      updateStats();
      window.trackChange('بازیابی: ' + e.time);
      toast('نسخه بازیابی شد');
    });
    list.appendChild(item);
  });
};
