// Desktop side panels: collapse toggles and drag-to-resize, persisted in
// localStorage.
(function () {
  const LS = window.localStorage;
  const varFor = (id) => (id === 'sidebar' ? '--sidebar-w' : '--rightpanel-w');
  const widthKey = (id) => 'nron-w-' + id;
  const collapseKey = (id) => 'nron-collapsed-' + id;

  function setCollapsed(id, collapsed) {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.toggle('collapsed', collapsed);
    const rz = document.querySelector(`.resizer[data-resize="${id}"]`);
    if (rz) rz.classList.toggle('collapsed', collapsed);
    const btn = id === 'sidebar'
      ? document.getElementById('btn-panel-left')
      : document.getElementById('btn-panel-right');
    if (btn) btn.classList.toggle('active', collapsed);
  }

  function toggleCollapse(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    const collapsed = !panel.classList.contains('collapsed');
    setCollapsed(id, collapsed);
    LS.setItem(collapseKey(id), collapsed ? '1' : '0');
  }

  function setupResizer(rz) {
    const id = rz.getAttribute('data-resize');
    const panel = document.getElementById(id);
    if (!panel) return;
    const cssVar = varFor(id);

    rz.addEventListener('pointerdown', (e) => {
      if (panel.classList.contains('collapsed')) return;
      e.preventDefault();
      const startX = e.clientX;
      const startW = panel.offsetWidth;
      // Direction-agnostic: does moving the pointer right grow the panel?
      const sign = panel.getBoundingClientRect().left < rz.getBoundingClientRect().left ? 1 : -1;
      rz.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const move = (ev) => {
        let w = startW + (ev.clientX - startX) * sign;
        w = Math.max(180, Math.min(560, w));
        document.documentElement.style.setProperty(cssVar, w + 'px');
      };
      const up = () => {
        rz.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const final = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
        if (final) LS.setItem(widthKey(id), final);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    // Double-click the divider to reset to default width.
    rz.addEventListener('dblclick', () => {
      document.documentElement.style.removeProperty(cssVar);
      LS.removeItem(widthKey(id));
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    ['sidebar', 'source-panel'].forEach((id) => {
      const w = LS.getItem(widthKey(id));
      if (w) document.documentElement.style.setProperty(varFor(id), w);
      if (LS.getItem(collapseKey(id)) === '1') setCollapsed(id, true);
    });

    document.querySelectorAll('[data-collapse]').forEach((b) =>
      b.addEventListener('click', () => toggleCollapse(b.getAttribute('data-collapse'))));

    const bl = document.getElementById('btn-panel-left');
    if (bl) bl.addEventListener('click', () => toggleCollapse('sidebar'));
    const br = document.getElementById('btn-panel-right');
    if (br) br.addEventListener('click', () => toggleCollapse('source-panel'));

    document.querySelectorAll('.resizer').forEach(setupResizer);
  });
})();
