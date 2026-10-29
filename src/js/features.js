window.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const editor = DOM.visualEditor || $("visual-editor");

  const escapeHtml = (s) =>
    (s || "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const stripHtml = (html) => {
    const d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.innerText || d.textContent || "").replace(/\s+/g, " ").trim();
  };
  const norm = (s) =>
    (s || "")
      .replace(/\u064A/g, "\u06CC")
      .replace(/\u0643/g, "\u06A9")
      .replace(
        /[\u0660-\u0669]/g,
        (d) =>
          "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9"[
            d.charCodeAt(0) - 0x0660
          ],
      )
      .toLowerCase();

  const gModal = $("gsearch-modal"),
    gInput = $("gsearch-input"),
    gResults = $("gsearch-results");

  function openGsearch() {
    if (!gModal) return;
    gModal.classList.remove("hidden");
    gInput.value = "";
    gResults.innerHTML =
      '<div class="gs-empty">عبارتی برای جستجو بنویسید</div>';
    setTimeout(() => gInput.focus(), 60);
  }

  async function runGlobalSearch() {
    const q = (gInput.value || "").trim();
    gResults.innerHTML = "";
    if (!q) {
      gResults.innerHTML =
        '<div class="gs-empty">عبارتی برای جستجو بنویسید</div>';
      return;
    }
    await saveCurrentTab();
    const nq = norm(q);
    let total = 0;
    for (const header of state.tabs) {
      const tab = header._lazy ? await dbGet("tabs", header.id) : header;
      const text = stripHtml(tab.content);
      const hay = norm(text);
      const inTitle = norm(tab.title).indexOf(nq) !== -1;
      const idx = hay.indexOf(nq);
      if (idx === -1 && !inTitle) continue;
      const count =
        (await NronCore.searchInHtml(hay, nq)).length || (inTitle ? 1 : 0);
      const pos = idx === -1 ? 0 : idx;
      const snippet = text.slice(Math.max(0, pos - 24), pos + 40) || "بدون متن";
      const item = document.createElement("div");
      item.className = "gs-item";
      item.innerHTML =
        '<div class="gs-title">' +
        escapeHtml(tab.title || "بی‌نام") +
        '<span class="gs-count">' +
        toFa(count) +
        "</span></div>" +
        '<div class="gs-snip">…' +
        escapeHtml(snippet) +
        "…</div>";
      item.addEventListener("click", async () => {
        gModal.classList.add("hidden");
        await switchTab(tab.id);
        if (typeof toggleFind === "function") {
          toggleFind(true);
          const fi = $("find-input");
          if (fi) {
            fi.value = q;
            if (typeof runFind === "function") runFind();
          }
        }
      });
      gResults.appendChild(item);
      total++;
    }
    if (!total)
      gResults.innerHTML = '<div class="gs-empty">نتیجه‌ای پیدا نشد</div>';
  }

  if ($("btn-gsearch")) $("btn-gsearch").addEventListener("click", openGsearch);
  if (gInput) {
    let gt;
    gInput.addEventListener("input", () => {
      clearTimeout(gt);
      gt = setTimeout(runGlobalSearch, 180);
    });
    gInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") gModal.classList.add("hidden");
    });
  }
  document.addEventListener("keydown", (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.key === "F" || e.key === "f")
    ) {
      e.preventDefault();
      openGsearch();
    }
  });

  const ZWNJ = "\u200c";
  const L = "\u0622-\u06CC";
  function fixPersian(t) {
    return t
      .replace(/\u064A/g, "\u06CC")
      .replace(/\u0643/g, "\u06A9")
      .replace(
        /[\u0660-\u0669]/g,
        (d) =>
          "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9"[
            d.charCodeAt(0) - 0x0660
          ],
      )
      .replace(
        new RegExp(
          '(^|[\\s(\u00ab"\u201c' +
            ZWNJ +
            "])(\u0646?\u0645\u06cc) +([" +
            L +
            "])",
          "g",
        ),
        "$1$2" + ZWNJ + "$3",
      )
      .replace(
        new RegExp(
          "([" +
            L +
            "]) +(\u0647\u0627(\u06cc\u06cc|\u06cc)?)(?=[\\s.,\u061b\u060c:!?)\u00bb\\]]|$)",
          "g",
        ),
        "$1" + ZWNJ + "$2",
      )
      .replace(
        new RegExp(
          "([" +
            L +
            "]) +(\u062a\u0631(\u06cc\u0646)?)(?=[\\s.,\u061b\u060c:!?)\u00bb\\]]|$)",
          "g",
        ),
        "$1" + ZWNJ + "$2",
      )
      .replace(new RegExp(ZWNJ + "{2,}", "g"), ZWNJ);
  }
  function cleanupCurrentDoc() {
    if (state.isSourceMode) {
      toast("در حالت سورس انجام نمی‌شود");
      return;
    }
    const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = w.nextNode())) nodes.push(n);
    let changed = 0;
    nodes.forEach((node) => {
      const b = node.nodeValue;
      const a = fixPersian(b);
      if (a !== b) {
        node.nodeValue = a;
        changed++;
      }
    });
    saveCurrentTab();
    updateStats();
    if (changed) window.trackChange && window.trackChange("پاکسازی متن");
    toast(
      changed
        ? "✔ پاکسازی شد (" + toFa(changed) + " بخش)"
        : "موردی برای اصلاح نبود",
    );
  }
  if ($("btn-cleanup"))
    $("btn-cleanup").addEventListener("click", cleanupCurrentDoc);

  async function doBackup() {
    clearTimeout(typingTimer);
    await saveCurrentTab();
    const [tabs, articles, settings] = await Promise.all([
      dbGetAll("tabs"),
      dbGetAll("articles"),
      dbGetAll("settings"),
    ]);
    const fonts = [];
    if ($("backup-fonts").checked) {
      for (const f of await dbGetAll("fonts")) {
        let raw = "";
        for (const byte of new Uint8Array(f.data))
          raw += String.fromCharCode(byte);
        fonts.push({ ...f, data: btoa(raw) });
      }
    }
    const data = {
      app: "Nron Editor",
      schema: 2,
      fonts,
      exportedAt: new Date().toISOString(),
      tabs,
      articles,
      settings,
    };
    const name =
      "nron-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    if (typeof saveOut === "function")
      await saveOut(JSON.stringify(data, null, 2), name, {
        mime: "application/json",
      });
  }
  async function doRestore(file) {
    try {
      if (file.size > 60 * 1024 * 1024)
        throw new Error("حداکثر حجم پشتیبان ۶۰ مگابایت است");
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.tabs)) {
        toast("✖ فایل پشتیبان معتبر نیست");
        return;
      }
      const record = (r) =>
        r &&
        ["number", "string"].includes(typeof r.id) &&
        typeof r.title === "string" &&
        typeof r.content === "string" &&
        r.content.length <= 10000000;
      if (
        data.tabs.length > 1000 ||
        !data.tabs.every(record) ||
        !Array.isArray(data.articles || []) ||
        !(data.articles || []).every(record) ||
        !Array.isArray(data.settings || [])
      )
        throw new Error("ساختار پشتیبان معتبر نیست");
      if (data.fonts && (!Array.isArray(data.fonts) || data.fonts.length > 10))
        throw Error("فهرست فونت معتبر نیست");
      const fonts = [];
      let fontBytes = 0;
      for (const f of data.fonts || []) {
        if (
          !f ||
          typeof f.id !== "string" ||
          !/^user-[a-zA-Z0-9-]+$/.test(f.id) ||
          typeof f.name !== "string" ||
          typeof f.data !== "string" ||
          f.data.length > 7 * 1024 * 1024
        )
          throw Error("فونت پشتیبان معتبر نیست");
        const raw = atob(f.data);
        const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        fontBytes += bytes.length;
        if (bytes.length > 5 * 1024 * 1024 || fontBytes > 20 * 1024 * 1024)
          throw Error("فونت‌های پشتیبان بزرگ هستند");
        await new FontFace("BackupValidation", bytes.buffer).load();
        fonts.push({
          id: f.id,
          name: f.name.slice(0, 80),
          size: bytes.length,
          custom: true,
          data: bytes.buffer,
        });
      }
      const tabs = data.tabs.map((t) => ({
        id: t.id,
        title: t.title.slice(0, 200),
        content: NronSafety.html(t.content),
        archived: t.archived === true,
        collection:
          typeof t.collection === "string" ? t.collection.slice(0, 80) : "",
        updatedAt: Number(t.updatedAt) || 0,
        createdAt: Number(t.createdAt) || Date.now(),
        goal: Math.max(0, Math.min(100000, Number(t.goal) || 0)),
        history: (Array.isArray(t.history) ? t.history : [])
          .filter((h) => h && typeof h.content === "string")
          .slice(-100)
          .map((h) => ({
            id: Number(h.id) || Date.now(),
            time: String(h.time || "").slice(0, 80),
            action: String(h.action || "").slice(0, 100),
            content: NronSafety.html(h.content),
          })),
      }));
      const articles = (data.articles || []).map((a) => ({
        id: a.id,
        title: a.title.slice(0, 200),
        content: NronSafety.html(a.content),
      }));
      const validSetting = (s) =>
        s &&
        typeof s.key === "string" &&
        ((s.key === "theme" && ["dark", "light"].includes(s.value)) ||
          (s.key === "dir" && ["rtl", "ltr"].includes(s.value)) ||
          (s.key === "font_size" &&
            Number(s.value) >= 14 &&
            Number(s.value) <= 32) ||
          (s.key === "line_height" &&
            Number(s.value) >= 1.4 &&
            Number(s.value) <= 2.6) ||
          (s.key === "bg_opacity" &&
            Number(s.value) >= 0.2 &&
            Number(s.value) <= 1) ||
          (s.key === "typewriter" && typeof s.value === "boolean"));
      const settings = (data.settings || [])
        .filter(
          (s) =>
            validSetting(s) ||
            (s &&
              s.key === "user_templates" &&
              Array.isArray(s.value) &&
              s.value.length <= 100 &&
              s.value.every(NronWorkspaceModel.validTemplate)) ||
            (s &&
              s.key === "writing_look" &&
              ["paper", "ink", "mist", "forest", "sepia", "midnight"].includes(
                s.value,
              )) ||
            (s && s.key === "reduce_motion" && typeof s.value === "boolean") ||
            (s &&
              s.key === "writing_font" &&
              typeof s.value === "string" &&
              /^[a-zA-Z0-9-]{0,100}$/.test(s.value)) ||
            (s &&
              s.key === "pomodoro" &&
              s.value &&
              Number(s.value.work) >= 1 &&
              Number(s.value.work) <= 180 &&
              Number(s.value.break) >= 1 &&
              Number(s.value.break) <= 180),
        )
        .map((s) =>
          s.key === "user_templates"
            ? {
                key: s.key,
                value: s.value.map((t) => ({
                  id: NronSafety.id(),
                  name: t.name,
                  content: NronSafety.html(t.content),
                })),
              }
            : s,
        );
      const yes = await askDialog(
        "بازیابی " +
          tabs.length +
          " سند؛ سندهای هم‌نام با شناسه یکسان جایگزین می‌شوند. ابتدا پشتیبان بگیرید.",
        [{ label: "برای تأیید بنویسید بله" }],
      );
      if (yes?.[0] !== "بله") return;
      clearTimeout(typingTimer);
      await saveCurrentTab();
      await dbImport({ tabs, articles, settings, fonts });
      toast("✔ بازیابی شد؛ در حال بارگذاری…");
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      toast("✖ خطا در بازیابی: " + (e && e.message ? e.message : e));
    }
  }
  if ($("btn-backup")) $("btn-backup").addEventListener("click", doBackup);
  if ($("btn-restore"))
    $("btn-restore").addEventListener(
      "click",
      () => $("restore-input") && $("restore-input").click(),
    );
  if ($("restore-input"))
    $("restore-input").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (f) doRestore(f);
      e.target.value = "";
    });

  if ($("btn-snapshot"))
    $("btn-snapshot").addEventListener("click", () => {
      window.trackChange && window.trackChange("نسخه دستی");
      saveCurrentTab();
      window.renderHistory && window.renderHistory();
      toast("✔ نسخه ثبت شد");
    });

  const kbar = $("kbd-bar");
  const vv = window.visualViewport;
  if (window.__TAURI__ && /android/i.test(navigator.userAgent))
    document.documentElement.dataset.nativeAndroid = "true";
  let edFocused = false;
  function placeKbar() {
    if (!kbar) return;
    // Both resize modes: the visual viewport shrinks, or the whole WebView shrinks.
    // Do not apply IME height a second time when Android already resized the WebView.
    const viewport = vv && vv.scale === 1 ? vv : null;
    const height = viewport ? viewport.height : window.innerHeight;
    const top = viewport ? viewport.offsetTop : 0;
    const inset = Math.max(0, window.innerHeight - height - top);
    const show = window.innerWidth <= 860 && edFocused;
    document.body.classList.toggle("typing", show);
    document.documentElement.style.setProperty(
      "--viewport-height",
      height + "px",
    );
    document.documentElement.style.setProperty("--viewport-top", top + "px");
    document.documentElement.style.setProperty("--ime-inset", inset + "px");
    document.body.classList.toggle("ime-open", show && inset > 100);
    kbar.style.bottom = inset + "px";
    kbar.style.display = show ? "flex" : "none";
  }
  for (const field of [editor, $("source-editor")])
    if (field) {
      field.addEventListener("focus", () => {
        edFocused = true;
        placeKbar();
      });
      field.addEventListener("blur", () =>
        setTimeout(() => {
          edFocused = [editor, $("source-editor")].includes(
            document.activeElement,
          );
          placeKbar();
        }, 60),
      );
    }
  if (vv) {
    vv.addEventListener("resize", placeKbar);
    vv.addEventListener("scroll", placeKbar);
  }
  window.addEventListener("resize", placeKbar);
  placeKbar();
  if (kbar) {
    kbar.addEventListener("pointerdown", (e) => e.preventDefault());
    kbar.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        const k = b.getAttribute("data-k");
        if (editor) editor.focus();
        if (k === "bold" || k === "italic" || k === "underline")
          executeCommand(k);
        else if (k === "h2") executeCommand("formatBlock", "h2");
        else if (k === "ul") executeCommand("insertUnorderedList");
        else if (k === "ol") executeCommand("insertOrderedList");
        else if (k === "link") insertLink();
        else if (k === "clean") cleanupCurrentDoc();
        else if (k === "undo") {
          document.execCommand("undo");
          scheduleSave();
        } else if (k === "redo") {
          document.execCommand("redo");
          scheduleSave();
        }
      }),
    );
  }
});
