// Mobile UX: side panels and the toolbar become bottom sheets with a backdrop,
// swipe-to-close, a bottom nav bar, a "more" sheet, and a FAB for new documents.
window.addEventListener('DOMContentLoaded', () => {
  const backdrop = document.getElementById('sheet-backdrop');
  const sidebar = document.getElementById('sidebar');
  const rightPanel = document.getElementById('source-panel');
  const toolbar = document.getElementById('toolbar');
  const moreSheet = document.getElementById('more-sheet');
  const editor = document.getElementById('visual-editor');

  const panelSheets = [sidebar, rightPanel, toolbar];
  const allSheets = [sidebar, rightPanel, toolbar, moreSheet];

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

  // useOpenClass picks .open (more-sheet) vs .mobile-open (reused panels).
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

  // Hamburger (top-left) opens the "more" menu sheet.
  const menuBtn = document.getElementById('btn-menu');
  if (menuBtn) menuBtn.addEventListener('click', () => { toggleSheet(moreSheet, true); markNav(null); });

  // Floating action button -> new document.
  const fab = document.getElementById('fab-new');
  if (fab) fab.addEventListener('click', () => {
    closeAll();
    const b = document.getElementById('btn-new-tab');
    if (b) b.click();
  });

  // Bottom navigation.
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
        return;
      }
    });
  });

  // "More" sheet: proxy buttons trigger the real (desktop-only, hidden) controls.
  document.querySelectorAll('#more-sheet [data-proxy]').forEach(b => {
    b.addEventListener('click', () => {
      const target = document.getElementById(b.getAttribute('data-proxy'));
      closeAll();
      if (target) target.click();
    });
  });
  // Export buttons inside the sheet are handled by export.js; just close after.
  document.querySelectorAll('#more-sheet [data-export]').forEach(b => {
    b.addEventListener('click', () => setTimeout(closeAll, 0));
  });

  // Starting to type closes any open sheet.
  if (editor) editor.addEventListener('focus', () => { if (window.innerWidth <= 860) closeAll(); });

  // Swipe-down to dismiss the open sheet.
  let startY = null, dragEl = null;
  const openSheetEl = () =>
    document.querySelector('.m-sheet.open, .sidebar.mobile-open, .source-panel.mobile-open, .toolbar.mobile-open');
  document.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 860) { startY = null; return; }
    dragEl = openSheetEl();
    if (dragEl && e.touches.length === 1 && dragEl.scrollTop <= 0) startY = e.touches[0].clientY;
    else startY = null;
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
    startY = null; dragEl = null;
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
