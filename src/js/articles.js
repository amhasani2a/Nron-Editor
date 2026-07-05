/* Articles / references side panel. */
const artState = { articles: [], activeId: null };
let artDOM = {};

window.addEventListener('DOMContentLoaded', async () => {
  artDOM = {
    tabs: document.getElementById('article-tabs'),
    viewer: document.getElementById('article-viewer'),
    modal: document.getElementById('article-modal'),
    title: document.getElementById('art-title'),
    content: document.getElementById('art-content')
  };
  document.getElementById('btn-add-article').addEventListener('click', () => artDOM.modal.classList.remove('hidden'));
  document.getElementById('btn-save-article').addEventListener('click', saveNewArticle);

  const saved = await dbGetAll('articles');
  if (saved && saved.length > 0) {
    artState.articles = saved;
    renderArticles();
    switchArticle(saved[0].id);
  } else {
    artDOM.viewer.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">منبعی افزوده نشده.</div>';
  }
});

async function saveNewArticle() {
  const t = artDOM.title.value.trim();
  const c = artDOM.content.value.trim();
  if (!t || !c) { toast('عنوان و متن لازم است'); return; }
  const formatted = c.split('\n').filter(l => l.trim()).map(l => `<p>${escapeHtml(l)}</p>`).join('');
  const newArt = { id: Date.now(), title: t, content: formatted };
  artState.articles.push(newArt);
  await dbPut('articles', newArt);
  artDOM.title.value = ''; artDOM.content.value = '';
  artDOM.modal.classList.add('hidden');
  renderArticles();
  switchArticle(newArt.id);
  toast('منبع ذخیره شد');
}

function escapeHtml(s){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

function renderArticles() {
  artDOM.tabs.innerHTML = '';
  artState.articles.forEach(art => {
    const t = document.createElement('div');
    t.className = `art-tab ${art.id === artState.activeId ? 'active' : ''}`;
    t.innerHTML = `<span>${art.title}</span> <span class="del-art">×</span>`;
    t.addEventListener('click', (e) => {
      if (e.target.classList.contains('del-art')) deleteArticle(art.id);
      else switchArticle(art.id);
    });
    artDOM.tabs.appendChild(t);
  });
}

function switchArticle(id) {
  artState.activeId = id;
  const art = artState.articles.find(a => a.id === id);
  artDOM.viewer.innerHTML = art
    ? `<h3>${art.title}</h3><hr>${art.content}`
    : '<div style="color:var(--text-dim);font-size:13px;">منبعی انتخاب نشده.</div>';
  renderArticles();
}

async function deleteArticle(id) {
  artState.articles = artState.articles.filter(a => a.id !== id);
  await dbDelete('articles', id);
  if (artState.articles.length > 0) switchArticle(artState.articles[0].id);
  else switchArticle(null);
}
