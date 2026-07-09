// Table of contents built from the headings in the active document.
window.renderOutline = function () {
  const list = document.getElementById('outline-list');
  if (!list) return;
  list.innerHTML = '';
  const editor = document.getElementById('visual-editor');
  const heads = editor.querySelectorAll('h1,h2,h3');
  if (heads.length === 0) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:10px;">تیتری یافت نشد</div>';
    return;
  }
  heads.forEach((h, i) => {
    if (!h.id) h.id = 'h-' + i;
    const lvl = h.tagName.toLowerCase();
    const item = document.createElement('div');
    item.className = `outline-item ${lvl === 'h2' ? 'lvl-2' : lvl === 'h3' ? 'lvl-3' : ''}`;
    item.textContent = h.textContent || '(بدون عنوان)';
    item.addEventListener('click', () => h.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    list.appendChild(item);
  });
};
