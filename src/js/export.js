/* Export: PDF, DOCX, EPUB (real, via Rust core when available), MD, HTML, TXT.
 *
 * Uses the NATIVE OS Save dialog + filesystem when running inside Tauri
 * (Windows / Android), so the file is written exactly WHERE THE USER CHOOSES
 * and we report the real path in the toast. In a plain browser (preview / QA)
 * it falls back to a normal blob download. */
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-export]').forEach(b =>
    b.addEventListener('click', () => doExport(b.getAttribute('data-export'))));
});

function activeTab() {
  if (!state.activeTabId) return null;
  return state.tabs.find(t => t.id === state.activeTabId) || null;
}
function sanitize(name) { return (name || 'document').replace(/[\\/:*?"<>|]/g, '_').trim() || 'document'; }

function extFilter(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const label = { md: 'Markdown', html: 'HTML', txt: 'Text', doc: 'Word', epub: 'EPUB' }[ext] || 'File';
  return [{ name: label, extensions: [ext] }];
}

/*
 * Central save routine.
 *   data       : string (text) OR Uint8Array (binary)
 *   name       : suggested file name incl. extension
 *   opts.binary: true for Uint8Array payloads (e.g. EPUB)
 *   opts.mime  : MIME type for the browser fallback
 */
async function saveOut(data, name, opts = {}) {
  const T = window.__TAURI__;
  if (T && T.fs) {
    const fs = T.fs, dlg = T.dialog;
    try {
      let path = null;
      if (dlg && typeof dlg.save === 'function') {
        // Native "Save As" (Windows) / document picker (Android SAF).
        path = await dlg.save({ defaultPath: name, filters: extFilter(name) });
        if (path === null || path === undefined) { toast('ذخیره لغو شد'); return; }
      }
      if (path) {
        if (opts.binary) await fs.writeFile(path, data);
        else await fs.writeTextFile(path, data);
        toast('✔ ذخیره شد:\n' + path);
        return;
      }
      // No dialog available → drop into the Download folder and report it.
      const bd = fs.BaseDirectory.Download;
      if (opts.binary) await fs.writeFile(name, data, { baseDir: bd });
      else await fs.writeTextFile(name, data, { baseDir: bd });
      toast('✔ ذخیره شد در پوشه Download:\n' + name);
      return;
    } catch (e) {
      // Last resort: Download folder.
      try {
        const bd = fs.BaseDirectory.Download;
        if (opts.binary) await fs.writeFile(name, data, { baseDir: bd });
        else await fs.writeTextFile(name, data, { baseDir: bd });
        toast('✔ ذخیره شد در پوشه Download:\n' + name);
      } catch (e2) {
        toast('✖ خطا در ذخیره: ' + (e2 && e2.message ? e2.message : e2));
      }
      return;
    }
  }
  // Browser fallback (preview / QA).
  const blob = opts.binary ? new Blob([data]) : new Blob([data], { type: opts.mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('دانلود شد: ' + name);
}

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
    await saveOut(md, title + '.md', { mime: 'text/markdown' });
  } else if (kind === 'html') {
    const doc = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${tab.title}</title></head><body>${tab.content}</body></html>`;
    await saveOut(doc, title + '.html', { mime: 'text/html' });
  } else if (kind === 'txt') {
    const tmp = document.createElement('div'); tmp.innerHTML = tab.content;
    await saveOut(tmp.innerText, title + '.txt', { mime: 'text/plain' });
  }
}

function exportPDF(tab) {
  const original = document.title;
  document.title = tab.title;
  window.print();
  setTimeout(() => { document.title = original; }, 500);
}

async function exportDOCX(tab, title) {
  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body{font-family:'Vazirmatn',Tahoma;direction:rtl}</style></head><body>";
  const src = '\ufeff' + header + tab.content + '</body></html>';
  await saveOut(src, title + '.doc', { mime: 'application/msword' });
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
  const html = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="fa" dir="rtl"><head><title>${tab.title}</title><meta charset="utf-8"/></head><body><h1>${tab.title}</h1>${tab.content}</body></html>`;
  await saveOut(html, title + '.epub', { mime: 'application/epub+zip' });
}
