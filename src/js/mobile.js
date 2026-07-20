window.addEventListener('DOMContentLoaded', () => {
  const backdrop = document.getElementById('sheet-backdrop');
  const sidebar = document.getElementById('sidebar');
  const rightPanel = document.getElementById('source-panel');
  const toolbar = document.getElementById('toolbar');
  const moreSheet = document.getElementById('more-sheet');
  const editor = document.getElementById('visual-editor');

  const panelSheets = [sidebar, rightPanel, toolbar];

  function markNav(activeBtn) {
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    const el = activeBtn || document.querySelector('.bottom-nav button[data-nav="editor"]');
    if (el) el.classList.add('active');
  }

  function closeAll() {
    panelSheets.forEach(s => { if (s) { s.classList.remove('mobile-open'); s.style.transform = ''; } });
    if (moreSheet) { moreSheet.classList.remove('open'); moreSheet.style.transform = ''; }
    if (backdrop) backdrop.classList.remove('show');
    markNav(null);
  }

  function toggleSheet(el, useOpenClass) {
    if (!el) return false;
    const cls = useOpenClass ? 'open' : 'mobile-open';
    const willOpen = !el.classList.contains(cls);
    closeAll();
    if (willOpen) {
      el.classList.add(cls);
      if (backdrop) backdrop.classList.add('show');
    }
    return willOpen;
  }

  if (backdrop) backdrop.addEventListener('click', closeAll);

  const menuBtn = document.getElementById('btn-menu');
  if (menuBtn) menuBtn.addEventListener('click', () => { toggleSheet(moreSheet, true); markNav(null); });

  const fab = document.getElementById('fab-new');
  if (fab) fab.addEventListener('click', () => {
    closeAll();
    const b = document.getElementById('btn-new-tab');
    if (b) b.click();
  });

  document.querySelectorAll('.bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.getAttribute('data-nav');
      if (nav === 'editor') { closeAll(); markNav(btn); if (editor) editor.focus(); return; }
      if (nav === 'format') { markNav(toggleSheet(toolbar) ? btn : null); return; }
      if (nav === 'articles') { markNav(toggleSheet(rightPanel) ? btn : null); return; }
      if (nav === 'history') { switchSidebarPanel('history'); markNav(toggleSheet(sidebar) ? btn : null); return; }
      if (nav === 'outline') {
        switchSidebarPanel('outline');
        window.renderOutline && window.renderOutline();
        markNav(toggleSheet(sidebar) ? btn : null);
      }
    });
  });

  document.querySelectorAll('#more-sheet [data-proxy]').forEach(b => {
    b.addEventListener('click', () => {
      const target = document.getElementById(b.getAttribute('data-proxy'));
      closeAll();
      if (target) target.click();
    });
  });
  document.querySelectorAll('#more-sheet [data-export]').forEach(b => {
    b.addEventListener('click', () => setTimeout(closeAll, 0));
  });

  if (editor) editor.addEventListener('focus', () => { if (window.innerWidth <= 860) closeAll(); });

  let startY = null, dragEl = null;
  const openSheetEl = () =>
    document.querySelector('.m-sheet.open, .sidebar.mobile-open, .source-panel.mobile-open, .toolbar.mobile-open');
  const scrolledInner = (node, limit) => {
    let el = node instanceof Element ? node : node ? node.parentElement : null;
    while (el && el !== limit) {
      if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) return true;
      el = el.parentElement;
    }
    return false;
  };
  document.addEventListener('touchstart', (e) => {
    startY = null;
    dragEl = null;
    if (window.innerWidth > 860 || e.touches.length !== 1) return;
    const sheet = openSheetEl();
    if (!sheet || !sheet.contains(e.target)) return;
    if (sheet.scrollTop > 0 || scrolledInner(e.target, sheet)) return;
    dragEl = sheet;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (startY === null || !dragEl) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) dragEl.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (startY === null || !dragEl) return;
    const dy = e.changedTouches[0].clientY - startY;
    dragEl.style.transform = '';
    if (dy > 90) closeAll();
    startY = null;
    dragEl = null;
  }, { passive: true });
});

function switchSidebarPanel(name) {
  document.querySelectorAll('.sidebar-tab').forEach(t =>
    t.classList.toggle('active', t.getAttribute('data-panel') === name));
  document.querySelectorAll('.sidebar-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'outline') window.renderOutline && window.renderOutline();
  if (name === 'history') window.renderHistory && window.renderHistory();
}
