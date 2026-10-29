const state = {
  tabs: [],
  activeTabId: null,
  isSourceMode: false,
  zenMode: false,
  pomodoroInterval: null,
  pomodoroTime: 1500,
};
const DOM = {};

const AUTOSAVE_MS = 700;
let typingTimer = null;
let loadedTabId = null;
let switchQueue = Promise.resolve();
let statsTimer;
let statsRevision = 0;
function scheduleStats() {
  clearTimeout(statsTimer);
  statsTimer = setTimeout(updateStats, 180);
}

window.addEventListener("DOMContentLoaded", async () => {
  Object.assign(DOM, {
    visualEditor: document.getElementById("visual-editor"),
    sourceEditor: document.getElementById("source-editor"),
    docTabs: document.getElementById("doc-tabs"),
    wordCount: document.getElementById("word-count"),
    charCount: document.getElementById("char-count"),
    readTime: document.getElementById("read-time"),
    statusMsg: document.getElementById("status-msg"),
    app: document.getElementById("app"),
    pomodoroDisplay: document.getElementById("pomodoro-display"),
  });

  await window.dbReady;
  await NronDurability.recover();
  await loadState();
  if (!state.activeTabId) await createNewTab();

  setupEventListeners();
  setupAutosaveGuards();

  if (state.activeTabId) await switchTab(state.activeTabId);
  else renderTabs();
  await updateStats();

  await window.workspaceReady;
  document.body.dataset.ready = "true";
  const info = await NronCore.coreInfo();
  DOM.statusMsg.textContent = info.native
    ? `\u0622\u0645\u0627\u062f\u0647 \u00b7 \u0647\u0633\u062a\u0647 Rust ${info.version || ""}`
    : "\u0622\u0645\u0627\u062f\u0647";
});

async function loadState() {
  const savedTabs = await dbTabHeaders();
  if (!savedTabs.length) return;
  state.tabs = savedTabs.sort(
    (a, b) =>
      (a.createdAt || Number(a.id) || 0) - (b.createdAt || Number(b.id) || 0),
  );
  state.activeTabId = NronWorkspaceModel.newest(state.tabs)?.id || null;
}

function setupEventListeners() {
  document
    .getElementById("btn-new-tab")
    .addEventListener("click", createNewTab);
  document
    .getElementById("btn-source")
    .addEventListener("click", toggleSourceMode);
  document.getElementById("btn-save").addEventListener("click", forceSave);
  document.getElementById("btn-zen").addEventListener("click", toggleZenMode);
  document
    .getElementById("btn-pomodoro")
    .addEventListener("click", togglePomodoro);
  document.getElementById("btn-outline").addEventListener("click", () => {
    if (window.innerWidth <= 860) {
      const b = document.querySelector(
        '.bottom-nav button[data-nav="outline"]',
      );
      if (b) b.click();
      return;
    }
    switchSidebarPanel("outline");
  });
  document.getElementById("btn-link").addEventListener("click", insertLink);

  const dropdown = document.querySelector(".dropdown");
  document
    .getElementById("btn-export")
    .addEventListener("click", () => dropdown.classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) dropdown?.classList.remove("open");
  });

  document
    .querySelectorAll(".sidebar-tab")
    .forEach((t) =>
      t.addEventListener("click", () =>
        switchSidebarPanel(t.getAttribute("data-panel")),
      ),
    );
  document
    .querySelectorAll(".format-btn")
    .forEach((btn) =>
      btn.addEventListener("click", (e) =>
        executeCommand(e.currentTarget.getAttribute("data-cmd")),
      ),
    );

  document
    .getElementById("font-select")
    .addEventListener("change", (e) =>
      executeCommand("fontName", e.target.value),
    );
  document
    .getElementById("format-select")
    .addEventListener("change", (e) =>
      executeCommand("formatBlock", e.target.value),
    );
  document.getElementById("btn-table").addEventListener("click", insertTable);
  document
    .getElementById("btn-image")
    .addEventListener("click", () =>
      document.getElementById("img-input").click(),
    );
  document
    .getElementById("img-input")
    .addEventListener("change", handleImageUpload);
  document
    .getElementById("btn-import")
    .addEventListener("click", () =>
      document.getElementById("import-input").click(),
    );
  document
    .getElementById("import-input")
    .addEventListener("change", handleImport);

  DOM.visualEditor.addEventListener("input", () => {
    scheduleStats();
    scheduleSave("\u062a\u0627\u06cc\u067e");
  });
  DOM.visualEditor.addEventListener("keyup", () => {
    updateToolbarState();
    typewriterScroll();
  });
  DOM.visualEditor.addEventListener("mouseup", updateToolbarState);
  DOM.sourceEditor.addEventListener("input", () => {
    scheduleStats();
    scheduleSave();
  });
  document
    .querySelectorAll(".toolbar button")
    .forEach((b) => b.addEventListener("mousedown", (e) => e.preventDefault()));
  DOM.visualEditor.addEventListener("paste", (e) => {
    e.preventDefault();
    const data = e.clipboardData;
    executeCommand(
      "insertHTML",
      data.getData("text/html")
        ? NronSafety.html(data.getData("text/html"))
        : escapeText(data.getData("text/plain")).replace(/\n/g, "<br>"),
    );
  });
}

function scheduleSave(action) {
  NronDurability.capture();
  clearTimeout(typingTimer);
  typingTimer = setTimeout(async () => {
    if (action) window.trackChange?.(action);
    await saveCurrentTab();
    window.renderOutline?.();
  }, AUTOSAVE_MS);
}

function setupAutosaveGuards() {
  const flush = () => {
    clearTimeout(typingTimer);
    NronDurability.capture();
    saveCurrentTab().catch(console.error);
  };
  DOM.visualEditor.addEventListener("blur", flush);
  DOM.sourceEditor.addEventListener("blur", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

async function createNewTab() {
  const tab = {
    id: NronSafety.id(),
    createdAt: Date.now(),
    title: "\u0633\u0646\u062f \u062c\u062f\u06cc\u062f",
    content: "<h1>\u0633\u0646\u062f \u062c\u062f\u06cc\u062f</h1><p></p>",
    history: [],
  };
  window.addToHistory?.(tab, "\u0627\u06cc\u062c\u0627\u062f");
  await dbPut("tabs", tab);
  state.tabs.push(tab);
  await switchTab(tab.id);
}

function renderTabs() {
  DOM.docTabs.innerHTML = "";
  state.tabs
    .filter((tab) => !tab.archived)
    .forEach((tab) => {
      const el = document.createElement("div");
      el.tabIndex = 0;
      el.setAttribute("role", "tab");
      el.setAttribute("aria-selected", String(tab.id === state.activeTabId));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          switchTab(tab.id);
        }
      });
      el.className = `doc-tab ${tab.id === state.activeTabId ? "active" : ""}`;

      const name = document.createElement("span");
      name.className = "doc-tab-name";
      name.textContent = tab.title;

      el.addEventListener("click", () => {
        if (name.isContentEditable) return;
        switchTab(tab.id);
      });
      const startRename = (e) => {
        e.preventDefault();
        e.stopPropagation();
        name.contentEditable = "true";
        name.focus();
        document.execCommand("selectAll", false, null);
      };
      name.addEventListener("dblclick", startRename);
      name.addEventListener("contextmenu", startRename);
      name.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          name.blur();
        }
      });
      name.addEventListener("blur", () => {
        name.contentEditable = "false";
        renameTab(tab.id, name.textContent);
      });

      const close = document.createElement("span");
      close.className = "close-tab";
      close.textContent = "−";
      close.title = "بایگانی سند";
      close.setAttribute("role", "button");
      close.tabIndex = 0;
      close.setAttribute("aria-label", "بایگانی " + tab.title);
      close.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          closeTab(tab.id);
        }
      });
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });

      el.append(name, close);
      DOM.docTabs.appendChild(el);
    });
}

function switchTab(id) {
  switchQueue = switchQueue.catch(() => {}).then(() => performSwitch(id));
  return switchQueue;
}
async function performSwitch(id) {
  clearTimeout(typingTimer);
  await saveCurrentTab();
  if (loadedTabId !== id) {
    const previous = state.tabs.find((t) => t.id === loadedTabId);
    if (previous) {
      delete previous.content;
      delete previous.history;
      previous._lazy = true;
    }
  }
  state.activeTabId = id;
  await dbPut("settings", { key: "activeTabId", value: id });

  const tab = state.tabs.find((t) => t.id === id);
  if (!tab) return;
  if (tab._lazy) {
    const full = await dbGet("tabs", id);
    Object.assign(tab, full);
    delete tab._lazy;
  }
  if (tab.archived) {
    tab.archived = false;
    await dbPut("tabs", tab);
  }
  DOM.visualEditor.innerHTML = NronSafety.html(tab.content);
  DOM.sourceEditor.value = tab.content;
  loadedTabId = id;
  applySourceModeView();
  renderTabs();
  window.renderHistory?.();
  window.renderOutline?.();
  await updateStats();
  if (window.NronStudio) NronStudio.progress();
  if (window.innerWidth > 860) DOM.visualEditor.focus();
}

function applySourceModeView() {
  DOM.visualEditor.classList.toggle("hidden", state.isSourceMode);
  DOM.sourceEditor.style.display = state.isSourceMode ? "block" : "none";
}

async function saveCurrentTab() {
  const tab = state.tabs.find((t) => t.id === loadedTabId);
  if (!tab || tab._lazy) return;
  const content = NronSafety.html(
    state.isSourceMode ? DOM.sourceEditor.value : DOM.visualEditor.innerHTML,
  );
  if (tab.content !== content) tab.updatedAt = Date.now();
  tab.content = content;
  tab.history = NronWorkspaceModel.history(tab.history || []);
  await dbPut("tabs", tab);
  NronDurability.committed(tab.id, content);
}

async function forceSave() {
  clearTimeout(typingTimer);
  window.trackChange?.(
    "\u0630\u062e\u06cc\u0631\u0647 \u062f\u0633\u062a\u06cc",
  );
  await saveCurrentTab();
  DOM.statusMsg.textContent =
    "\u0630\u062e\u06cc\u0631\u0647 \u0634\u062f \u2713";
  setTimeout(
    () => (DOM.statusMsg.textContent = "\u0622\u0645\u0627\u062f\u0647"),
    1800,
  );
}

async function renameTab(id, title) {
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab || !title.trim()) {
    renderTabs();
    return;
  }
  tab.title = title.trim();
  tab.updatedAt = Date.now();
  await dbPut("tabs", tab);
  renderTabs();
}

async function closeTab(id) {
  return NronWorkspace.archive(id, true);
}

function executeCommand(cmd, val = null) {
  if (state.isSourceMode) return;
  DOM.visualEditor.focus();
  document.execCommand(cmd, false, val);
  updateStats();
  updateToolbarState();
  scheduleSave(cmd);
}

function updateToolbarState() {
  document.querySelectorAll(".format-btn").forEach((btn) => {
    try {
      btn.classList.toggle(
        "active",
        document.queryCommandState(btn.getAttribute("data-cmd")),
      );
    } catch {}
  });
}

function toggleSourceMode() {
  state.isSourceMode = !state.isSourceMode;
  if (state.isSourceMode) DOM.sourceEditor.value = DOM.visualEditor.innerHTML;
  else DOM.visualEditor.innerHTML = NronSafety.html(DOM.sourceEditor.value);
  updateStats();
  applySourceModeView();
  (state.isSourceMode ? DOM.sourceEditor : DOM.visualEditor).focus();
}

function toggleZenMode() {
  state.zenMode = !state.zenMode;
  DOM.app.classList.toggle("zen-mode", state.zenMode);
}

function togglePomodoro() {
  NronWorkspace.showTimer();
}

let savedRange = null;

function saveSelection() {
  const sel = window.getSelection();
  savedRange =
    sel.rangeCount && DOM.visualEditor.contains(sel.anchorNode)
      ? sel.getRangeAt(0).cloneRange()
      : null;
}

function restoreSelection() {
  DOM.visualEditor.focus();
  if (!savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
}

function askDialog(title, fields) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("ask-modal");
    const box = overlay.querySelector(".modal");
    box.innerHTML = "";
    const head = document.createElement("div");
    head.className = "modal-head";
    const h = document.createElement("h3");
    h.textContent = title;
    head.appendChild(h);
    box.appendChild(head);
    const inputs = fields.map((f) => {
      const inp = document.createElement("input");
      inp.className = "field";
      inp.type = f.type || "text";
      if (f.type === "number") inp.inputMode = "numeric";
      inp.placeholder = f.label;
      inp.value = f.value || "";
      inp.dir = f.dir || "auto";
      box.appendChild(inp);
      return inp;
    });
    const btns = document.createElement("div");
    btns.className = "modal-btns";
    const ok = document.createElement("button");
    ok.className = "btn btn-primary";
    ok.textContent = "تأیید";
    const cancel = document.createElement("button");
    cancel.className = "btn";
    cancel.textContent = "لغو";
    btns.append(ok, cancel);
    box.appendChild(btns);
    const close = (vals) => {
      overlay.classList.add("hidden");
      resolve(vals);
    };
    ok.onclick = () => close(inputs.map((i) => i.value.trim()));
    cancel.onclick = () => close(null);
    overlay.onclick = (e) => {
      if (e.target === overlay) close(null);
    };
    inputs.forEach((inp) =>
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ok.click();
        }
        if (e.key === "Escape") close(null);
      }),
    );
    overlay.classList.remove("hidden");
    setTimeout(() => inputs[0] && inputs[0].focus(), 60);
  });
}

async function insertTable() {
  if (state.isSourceMode) return;
  saveSelection();
  const vals = await askDialog("درج جدول", [
    { label: "تعداد سطر", type: "number", value: "3" },
    { label: "تعداد ستون", type: "number", value: "3" },
  ]);
  if (!vals) return;
  const rows = Math.min(50, parseInt(vals[0], 10) || 0);
  const cols = Math.min(20, parseInt(vals[1], 10) || 0);
  if (rows < 1 || cols < 1) return;
  restoreSelection();
  let html = "<table><tbody>";
  for (let i = 0; i < rows; i++)
    html += "<tr>" + "<td>&nbsp;</td>".repeat(cols) + "</tr>";
  html += "</tbody></table><p></p>";
  executeCommand("insertHTML", html);
}

async function insertLink() {
  if (state.isSourceMode) return;
  saveSelection();
  const vals = await askDialog("افزودن پیوند", [
    { label: "آدرس پیوند", value: "https://", dir: "ltr" },
  ]);
  const url = vals && vals[0];
  if (!url || url === "https://") return;
  if (!NronSafety.url(url)) {
    toast("پیوند معتبر نیست؛ از https استفاده کنید.");
    return;
  }
  restoreSelection();
  if (savedRange && !savedRange.collapsed) executeCommand("createLink", url);
  else
    executeCommand(
      "insertHTML",
      `<a href="${url.replace(/"/g, "&quot;")}">${escapeText(url)}</a>`,
    );
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  if (file.size > 5 * 1024 * 1024) {
    toast("حداکثر حجم تصویر ۵ مگابایت است");
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) =>
    executeCommand(
      "insertHTML",
      `<img src="${ev.target.result}" alt=""><p></p>`,
    );
  reader.readAsDataURL(file);
  e.target.value = "";
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast("حداکثر حجم متن ۱۰ مگابایت است");
    return;
  }
  const text = await file.text();
  let html;
  if (/\.md$/i.test(file.name)) html = await NronCore.markdownToHtml(text);
  else if (/\.html?$/i.test(file.name)) html = text;
  else
    html = text
      .split("\n")
      .map((l) => `<p>${escapeText(l) || "<br>"}</p>`)
      .join("");

  const tab = {
    id: NronSafety.id(),
    createdAt: Date.now(),
    title: file.name.replace(/\.[^.]+$/, ""),
    content: NronSafety.html(html),
    history: [],
  };
  await dbPut("tabs", tab);
  state.tabs.push(tab);
  await switchTab(tab.id);
  e.target.value = "";
  toast("\u0641\u0627\u06cc\u0644 \u0648\u0627\u0631\u062f \u0634\u062f");
}

function escapeText(s) {
  return s.replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );
}

async function updateStats() {
  const revision = ++statsRevision;
  const text = state.isSourceMode
    ? NronSafety.text(DOM.sourceEditor.value)
    : DOM.visualEditor.innerText;
  const s = await NronCore.stats(text || "");
  if (revision !== statsRevision) return;
  DOM.wordCount.textContent = `\u06a9\u0644\u0645\u0627\u062a: ${toFa(s.words)}`;
  DOM.charCount.textContent = `\u0646\u0648\u06cc\u0633\u0647: ${toFa(s.chars_no_space)}`;
  DOM.readTime.textContent = `\u0645\u0637\u0627\u0644\u0639\u0647: ${toFa(s.reading_time_min)} \u062f\u0642\u06cc\u0642\u0647`;
}

function typewriterScroll() {
  if (!DOM.app.classList.contains("typewriter")) return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (rect.top) DOM.visualEditor.scrollTop += rect.top - window.innerHeight / 2;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.style.opacity = "1";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.classList.add("hidden"), 250);
  }, 1900);
}

function toFa(v) {
  return String(v).replace(
    /[0-9]/g,
    (d) => "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"[d],
  );
}
