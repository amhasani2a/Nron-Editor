// User settings, persisted to the settings store and reapplied on load.
window.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('settings-modal');
  document.getElementById('btn-settings').addEventListener('click', () => modal.classList.remove('hidden'));
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => document.getElementById(b.getAttribute('data-close')).classList.add('hidden')));

  const root = document.documentElement;
  const setVar = (k, v) => root.style.setProperty(k, v);
  const save = (key, value) => dbPut('settings', { key, value });

  // Theme (header toggle + segmented control)
  const applyTheme = (t) => {
    root.setAttribute('data-theme', t);
    save('theme', t);
    document.querySelectorAll('#seg-theme button').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-theme-val') === t));
  };
  document.getElementById('btn-theme').addEventListener('click', () =>
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  document.querySelectorAll('#seg-theme button').forEach(b =>
    b.addEventListener('click', () => applyTheme(b.getAttribute('data-theme-val'))));

  // Direction
  const applyDir = (d) => {
    setVar('--editor-dir', d);
    document.documentElement.setAttribute('dir', d);
    save('dir', d);
    document.querySelectorAll('#seg-dir button').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-dir-val') === d));
  };
  document.querySelectorAll('#seg-dir button').forEach(b =>
    b.addEventListener('click', () => applyDir(b.getAttribute('data-dir-val'))));

  // Font size
  const fs = document.getElementById('font-size');
  fs.addEventListener('input', e => {
    setVar('--editor-fs', e.target.value + 'px');
    document.getElementById('fs-val').textContent = e.target.value;
    save('font_size', e.target.value);
  });
  // Line height
  const lh = document.getElementById('line-height');
  lh.addEventListener('input', e => {
    setVar('--editor-lh', e.target.value);
    document.getElementById('lh-val').textContent = e.target.value;
    save('line_height', e.target.value);
  });
  // Opacity
  const op = document.getElementById('editor-opacity');
  op.addEventListener('input', e => {
    setVar('--editor-bg-opacity', e.target.value);
    document.getElementById('op-val').textContent = e.target.value;
    save('bg_opacity', e.target.value);
  });
  // Background image
  const bgFile = document.getElementById('bg-file');
  bgFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setVar('--bg-image', `url('${ev.target.result}')`); save('bg_image', ev.target.result); };
    reader.readAsDataURL(f);
  });
  document.getElementById('btn-clear-bg').addEventListener('click', () => {
    setVar('--bg-image', 'none'); dbDelete('settings', 'bg_image'); bgFile.value = '';
  });
  // Typewriter mode
  const tw = document.getElementById('typewriter-mode');
  tw.addEventListener('change', e => {
    document.getElementById('app').classList.toggle('typewriter', e.target.checked);
    save('typewriter', e.target.checked);
  });

  // Restore persisted settings.
  (async () => {
    const all = await dbGetAll('settings');
    const get = (k) => all.find(s => s.key === k);
    const theme = get('theme'); if (theme) applyTheme(theme.value); else applyTheme('dark');
    const dir = get('dir'); if (dir) applyDir(dir.value); else applyDir('rtl');
    const g = get('font_size'); if (g) { setVar('--editor-fs', g.value + 'px'); fs.value = g.value; document.getElementById('fs-val').textContent = g.value; }
    const l = get('line_height'); if (l) { setVar('--editor-lh', l.value); lh.value = l.value; document.getElementById('lh-val').textContent = l.value; }
    const o = get('bg_opacity'); if (o) { setVar('--editor-bg-opacity', o.value); op.value = o.value; document.getElementById('op-val').textContent = o.value; }
    const bg = get('bg_image'); if (bg) setVar('--bg-image', `url('${bg.value}')`);
    const t = get('typewriter'); if (t && t.value) { tw.checked = true; document.getElementById('app').classList.add('typewriter'); }
  })();
});
