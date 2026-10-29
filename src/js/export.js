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
  const label = { md: 'Markdown', html: 'HTML', txt: 'Text', docx: 'Word', epub: 'EPUB' }[ext] || 'File';
  return [{ name: label, extensions: [ext] }];
}

const isAndroid = () => /android/i.test(navigator.userAgent || '');

async function saveOut(data, name, opts = {}) {
  const T = window.__TAURI__ ? window.NronNative : null;
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
      throw new Error('انتخاب محل ذخیره در این دستگاه در دسترس نیست');
    } catch (e) {
      toast('خطا در ذخیره: ' + (e?.message || e));
      throw e;
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
  toast('دریافت فایل آغاز شد: ' + name);
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
  if(['html','epub','pdf'].includes(kind))await NronExportFont.load();
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
      return saveOut('\ufeff'+NronSafety.text(tab.content), title + '.txt', { mime: 'text/plain' });
    }
  }
}

function pageHtml(tab) {
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${escapeText(tab.title)}</title>` +
    `<style>${window.NronExportFont?.css||''}@page{margin:2cm}body{font-family:NronExport,'Vazirmatn',Tahoma,sans-serif;direction:rtl;line-height:1.9;font-size:16px;max-width:800px;margin:auto;padding:24px}p,li{white-space:pre-wrap}pre,code{direction:ltr;text-align:left;unicode-bidi:isolate}img{max-width:100%}</style>` +
    `</head><body>${NronSafety.html(tab.content)}</body></html>`;
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
  await saveOut(NronFormats.docx(tab), title + '.docx', {binary:true});
}
async function exportEPUB(tab, title) {
  await saveOut(NronFormats.epub(tab), title + '.epub', {binary:true});
}
