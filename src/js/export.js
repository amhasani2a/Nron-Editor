/* Export: PDF, DOCX, EPUB (real, via Rust core when available), MD, HTML, TXT. */
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-export]').forEach(b =>
    b.addEventListener('click', () => doExport(b.getAttribute('data-export'))));
});

function activeTab() {
  if (!state.activeTabId) return null;
  return state.tabs.find(t => t.id === state.activeTabId) || null;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function sanitize(name) { return (name || 'document').replace(/[\\/:*?"<>|]/g, '_').trim() || 'document'; }

async function doExport(kind) {
  const tab = activeTab();
  if (!tab) { toast('سندی باز نیست'); return; }
  const title = sanitize(tab.title);
  document.querySelector('.dropdown')?.classList.remove('open');
  if (kind === 'pdf') return exportPDF(tab);
  if (kind === 'docx') return exportDOCX(tab, title);
  if (kind === 'epub') return exportEPUB(tab, title);
  if (kind === 'md') {
    const md = await NronCore.htmlToMarkdown(tab.content);
    download(new Blob([md], { type: 'text/markdown' }), title + '.md'); toast('Markdown ذخیره شد');
  } else if (kind === 'html') {
    const doc = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${tab.title}</title></head><body>${tab.content}</body></html>`;
    download(new Blob([doc], { type: 'text/html' }), title + '.html'); toast('HTML ذخیره شد');
  } else if (kind === 'txt') {
    const tmp = document.createElement('div'); tmp.innerHTML = tab.content;
    download(new Blob([tmp.innerText], { type: 'text/plain' }), title + '.txt'); toast('متن ذخیره شد');
  }
}

function exportPDF(tab) {
  const original = document.title;
  document.title = tab.title;
  window.print();
  setTimeout(() => { document.title = original; }, 500);
}

function exportDOCX(tab, title) {
  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body{font-family:'Vazirmatn',Tahoma;direction:rtl}</style></head><body>";
  const src = header + tab.content + '</body></html>';
  download(new Blob(['\ufeff', src], { type: 'application/msword' }), title + '.doc');
  toast('DOCX ذخیره شد');
}

async function exportEPUB(tab, title) {
  const b64 = await NronCore.buildEpub(tab.title, 'Nron', tab.content);
  if (b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    download(new Blob([bytes], { type: 'application/epub+zip' }), title + '.epub');
    toast('EPUB (هسته Rust) ذخیره شد');
    return;
  }
  const html = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="fa" dir="rtl"><head><title>${tab.title}</title><meta charset="utf-8"/></head><body><h1>${tab.title}</h1>${tab.content}</body></html>`;
  download(new Blob([html], { type: 'application/epub+zip' }), title + '.epub');
  toast('EPUB ذخیره شد (حالت مرورگر)');
}
