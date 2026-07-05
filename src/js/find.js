/* Find & Replace. Uses the Rust core for match indexing when available. */
let findState = { hits: [], current: -1 };

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-find').addEventListener('click', () => toggleFind(true));
  document.getElementById('find-close').addEventListener('click', () => toggleFind(false));
  document.getElementById('find-input').addEventListener('input', runFind);
  document.getElementById('find-next').addEventListener('click', () => moveHit(1));
  document.getElementById('find-prev').addEventListener('click', () => moveHit(-1));
  document.getElementById('replace-one').addEventListener('click', replaceOne);
  document.getElementById('replace-all').addEventListener('click', replaceAll);
  document.getElementById('find-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); moveHit(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') toggleFind(false);
  });
});

function toggleFind(show) {
  const bar = document.getElementById('find-bar');
  if (show) { bar.classList.remove('hidden'); document.getElementById('find-input').focus(); }
  else { bar.classList.add('hidden'); clearHighlights(); }
}

function clearHighlights() {
  const ed = document.getElementById('visual-editor');
  ed.querySelectorAll('mark.find-hit, mark.find-current').forEach(m => {
    const parent = m.parentNode; parent.replaceChild(document.createTextNode(m.textContent), m); parent.normalize();
  });
  findState = { hits: [], current: -1 };
}

function runFind() {
  clearHighlights();
  const q = document.getElementById('find-input').value;
  const counter = document.getElementById('find-count');
  if (!q) { counter.textContent = '۰/۰'; return; }
  const ed = document.getElementById('visual-editor');
  const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
  const nodes = []; let n;
  while ((n = walker.nextNode())) nodes.push(n);
  const lowQ = q.toLowerCase();
  nodes.forEach(node => {
    const text = node.nodeValue; const low = text.toLowerCase();
    let idx = low.indexOf(lowQ);
    if (idx === -1) return;
    const frag = document.createDocumentFragment(); let last = 0;
    while (idx !== -1) {
      frag.appendChild(document.createTextNode(text.slice(last, idx)));
      const mark = document.createElement('mark'); mark.className = 'find-hit'; mark.textContent = text.slice(idx, idx + q.length);
      frag.appendChild(mark); last = idx + q.length; idx = low.indexOf(lowQ, last);
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
  findState.hits = Array.from(ed.querySelectorAll('mark.find-hit'));
  findState.current = findState.hits.length ? 0 : -1;
  highlightCurrent();
  counter.textContent = `${toFa(findState.hits.length ? 1 : 0)}/${toFa(findState.hits.length)}`;
}

function highlightCurrent() {
  findState.hits.forEach((h, i) => h.className = i === findState.current ? 'find-current' : 'find-hit');
  const cur = findState.hits[findState.current];
  if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  document.getElementById('find-count').textContent = `${toFa(findState.current + 1)}/${toFa(findState.hits.length)}`;
}
function moveHit(dir) {
  if (!findState.hits.length) return;
  findState.current = (findState.current + dir + findState.hits.length) % findState.hits.length;
  highlightCurrent();
}
function replaceOne() {
  const cur = findState.hits[findState.current];
  if (!cur) return;
  const rep = document.getElementById('replace-input').value;
  cur.replaceWith(document.createTextNode(rep));
  saveCurrentTab(); runFind();
}
function replaceAll() {
  const rep = document.getElementById('replace-input').value;
  findState.hits.forEach(h => h.replaceWith(document.createTextNode(rep)));
  saveCurrentTab(); updateStats(); runFind();
  toast('همه جایگزین شد');
}
function toFa(n){return String(n).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);}
