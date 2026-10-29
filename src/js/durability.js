/* A bounded emergency journal supplements transactional IndexedDB, not replaces it. */
window.NronDurability = (() => {
  const prefix = "nron-draft-v1:";
  let failed = false;
  function capture() {
    if (!loadedTabId) return;
    const content = state.isSourceMode
      ? DOM.sourceEditor.value
      : DOM.visualEditor.innerHTML;
    const draft = { id: loadedTabId, content, at: Date.now() };
    try {
      localStorage.setItem(prefix + loadedTabId, JSON.stringify(draft));
      failed = false;
    } catch (error) {
      failed = true;
      const s = document.getElementById("status-msg");
      if (s)
        s.textContent = "فضای پیش‌نویس کافی نیست؛ ذخیرهٔ اصلی را بررسی کنید";
      saveCurrentTab().catch(console.error);
    }
    return draft;
  }
  function committed(id, content) {
    try {
      const key = prefix + id;
      const d = JSON.parse(localStorage.getItem(key) || "null");
      if (d && NronSafety.html(d.content) === content)
        localStorage.removeItem(key);
    } catch {}
  }
  async function recover() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) keys.push(k);
      }
    } catch (error) {
      console.error("Journal unavailable; IndexedDB still used", error);
      return;
    }
    for (const key of keys) {
      try {
        const draft = JSON.parse(localStorage.getItem(key));
        if (!draft || typeof draft.content !== "string") continue;
        const tab = await dbGet("tabs", draft.id);
        if (!tab) continue;
        if ((tab.updatedAt || 0) > (draft.at || 0)) {
          localStorage.removeItem(key);
          continue;
        }
        tab.content = NronSafety.html(draft.content);
        tab.updatedAt = Math.max(tab.updatedAt || 0, draft.at || 0);
        await dbPut("tabs", tab);
        localStorage.removeItem(key);
      } catch (error) {
        console.error("Draft recovery retained for retry", error);
      }
    }
  }
  return {
    capture,
    committed,
    recover,
    get failed() {
      return failed;
    },
  };
})();
