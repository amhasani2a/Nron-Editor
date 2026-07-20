window.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  const t = e.target;
  const tag = t && t.tagName;
  const inEditor = t && (t.id === 'visual-editor' || t.id === 'source-editor');
  const inField = !inEditor && (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable));
  if (!ctrl) {
    if (e.key === 'F11') { e.preventDefault(); toggleZenMode(); }
    return;
  }
  if (inField) {
    if (e.key.toLowerCase() === 's') { e.preventDefault(); forceSave(); }
    return;
  }
  switch (e.key.toLowerCase()) {
    case 's': e.preventDefault(); forceSave(); break;
    case 'n': e.preventDefault(); createNewTab(); break;
    case 'f': e.preventDefault(); toggleFind(true); break;
    case 'b': e.preventDefault(); executeCommand('bold'); break;
    case 'i': e.preventDefault(); executeCommand('italic'); break;
    case 'u': e.preventDefault(); executeCommand('underline'); break;
    case 'k': e.preventDefault(); insertLink(); break;
    case '/': e.preventDefault(); toggleSourceMode(); break;
  }
});
