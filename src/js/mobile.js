/* Mobile navigation: slide-out panels, toolbar sheet, bottom nav. */
window.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const rightPanel = document.getElementById('source-panel');
  const toolbar = document.getElementById('toolbar');

  const closeAll = () => {
    sidebar.classList.remove('mobile-open');
    rightPanel.classList.remove('mobile-open');
    toolbar.classList.remove('mobile-open');
  };

  const menuBtn = document.getElementById('btn-menu');
  if (menuBtn) menuBtn.addEventListener('click', () => {
    const open = sidebar.classList.contains('mobile-open');
    closeAll(); if (!open) sidebar.classList.add('mobile-open');
  });

  document.querySelectorAll('.bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.getAttribute('data-nav');
      document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      closeAll();
      if (nav === 'editor') { document.getElementById('visual-editor').focus(); }
      else if (nav === 'format') { toolbar.classList.add('mobile-open'); }
      else if (nav === 'articles') { rightPanel.classList.add('mobile-open'); }
      else if (nav === 'history') { switchSidebarPanel('history'); sidebar.classList.add('mobile-open'); }
      else if (nav === 'outline') { switchSidebarPanel('outline'); window.renderOutline(); sidebar.classList.add('mobile-open'); }
    });
  });

  document.getElementById('visual-editor').addEventListener('focus', () => {
    if (window.innerWidth <= 860) closeAll();
  });
});

function switchSidebarPanel(name) {
  document.querySelectorAll('.sidebar-tab').forEach(t =>
    t.classList.toggle('active', t.getAttribute('data-panel') === name));
  document.querySelectorAll('.sidebar-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'outline') window.renderOutline();
  if (name === 'history') window.renderHistory();
}
