window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-export]').forEach(b =>
    b.addEventListener('click', () => doExport(b.getAttribute('data-export'))));
});

function activeTab() {
  return state.activeTabId ? state.tabs.find(t => t.id === state.activeTabId) || null : null;
}

function sanitize(name) {
  return (name || 'document').replace(/[\\/:*?"<>|]/g, '_').trim() || 'document';
}

function extFilter(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const label = { md: 'Markdown', html: 'HTML', txt: 'Text', doc: 'Word', epub: 'EPUB' }[ext] || 'File';
  return [{ name: label, extensions: [ext] }];
}

const isAndroid = () => /android/i.test(navigator.userAgent || '');

async function saveOut(data, name, opts = {}) {
  const T = window.__TAURI__;
  if (T && T.fs) {
    const fs = T.fs, dlg = T.dialog;
    try {
      const path = dlg?.save ? await dlg.save({ defaultPath: name, filters: extFilter(name) }) : null;
      if (dlg?.save && path == null) { toast('ذخیره لغو شد'); return; }
      if (path) {
        opts.binary ? await fs.writeFile(path, data) : await fs.writeTextFile(path, data);
        toast('✔ ذخیره شد:\n' + path);
        return;
      }
      await writeToDownloads(fs, data, name, opts);
    } catch (e) {
      try { await writeToDownloads(fs, data, name, opts); }
      catch (e2) { toast('✖ خطا در ذخیره: ' + (e2?.message || e2)); }
    }
    return;
  }
  const blob = new Blob([data], opts.binary ? {} : { type: opts.mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('دانلود شد: ' + name);
}

async function writeToDownloads(fs, data, name, opts) {
  const baseDir = fs.BaseDirectory.Download;
  opts.binary ? await fs.writeFile(name, data, { baseDir }) : await fs.writeTextFile(name, data, { baseDir });
  toast('✔ ذخیره شد در پوشه Download:\n' + name);
}

async function doExport(kind) {
  clearTimeout(typingTimer);
  await saveCurrentTab();
  const tab = activeTab();
  if (!tab) { toast('سندی باز نیست'); return; }
  const title = sanitize(tab.title);
  document.querySelector('.dropdown')?.classList.remove('open');

  switch (kind) {
    case 'pdf': return exportPDF(tab, title);
    case 'docx': return exportDOCX(tab, title);
    case 'epub': return exportEPUB(tab, title);
    case 'md': return saveOut(await NronCore.htmlToMarkdown(tab.content), title + '.md', { mime: 'text/markdown' });
    case 'html': return saveOut(pageHtml(tab), title + '.html', { mime: 'text/html' });
    case 'txt': {
      const tmp = document.createElement('div');
      tmp.innerHTML = tab.content;
      return saveOut(tmp.innerText, title + '.txt', { mime: 'text/plain' });
    }
  }
}

function pageHtml(tab) {
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${tab.title}</title>` +
    `<style>@page{margin:2cm}body{font-family:'Vazirmatn',Tahoma,sans-serif;direction:rtl;line-height:1.9;font-size:16px;max-width:800px;margin:auto;padding:24px}img{max-width:100%}</style>` +
    `</head><body>${tab.content}</body></html>`;
}

function exportPDF(tab, title) {
  if (window.__TAURI__ && isAndroid()) {
    saveOut(pageHtml(tab), title + '.html', { mime: 'text/html' });
    toast('فایل آمادهٔ چاپ ذخیره شد. در مرورگر باز کن ← Print ← Save as PDF');
    return;
  }
  const original = document.title;
  document.title = tab.title;
  window.print();
  setTimeout(() => { document.title = original; }, 500);
}

async function exportDOCX(tab, title) {
  const head = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body{font-family:'Vazirmatn',Tahoma;direction:rtl}</style></head><body>";
  await saveOut('\ufeff' + head + tab.content + '</body></html>', title + '.doc', { mime: 'application/msword' });
}

async function exportEPUB(tab, title) {
  const b64 = await NronCore.buildEpub(tab.title, 'Nron', tab.content);
  if (b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await saveOut(bytes, title + '.epub', { binary: true });
    return;
  }
  const xhtml = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="fa" dir="rtl"><head><title>${tab.title}</title><meta charset="utf-8"/></head><body><h1>${tab.title}</h1>${tab.content}</body></html>`;
  await saveOut(xhtml, title + '.epub', { mime: 'application/epub+zip' });
}
