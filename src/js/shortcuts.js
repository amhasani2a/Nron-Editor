/* Keyboard shortcuts. */
window.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) {
    if (e.key === 'F11') { e.preventDefault(); toggleZenMode(); }
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
