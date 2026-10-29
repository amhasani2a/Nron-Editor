(() => {
  let resolveReady;
  window.workspaceReady = new Promise((r) => {
    resolveReady = r;
  });

  const wsState = {
    look: "paper",
    reduceMotion: false,
    writingFont: "Vazirmatn",
    bundledFonts: [],
    userFonts: [],
    loadedFaces: [],
    userTemplates: [],
    pomodoro: { work: 25, break: 5 },
    timer: {
      running: false,
      mode: "work",
      remainingSec: 25 * 60,
      deadline: 0,
      interval: null,
    },
    libraryLimit: 40,
  };

  function toFaDigits(v) {
    return String(v).replace(
      /[0-9]/g,
      (d) => "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"[d],
    );
  }

  function formatClock(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const r = String(s % 60).padStart(2, "0");
    return toFaDigits(`${m}:${r}`);
  }

  async function saveSetting(key, value) {
    await dbPut("settings", { key, value });
  }

  function applyLook(lookId) {
    const valid = NronWorkspaceModel.looks.some((l) => l.id === lookId)
      ? lookId
      : "paper";
    wsState.look = valid;
    document.documentElement.setAttribute("data-look", valid);
  }

  function applyMotion(reduce) {
    wsState.reduceMotion = Boolean(reduce);
    document.documentElement.setAttribute(
      "data-motion",
      wsState.reduceMotion ? "off" : "on",
    );
  }

  async function registerFontFace(id, name, sourceUrlOrBuffer) {
    const existing = wsState.loadedFaces.find((f) => f.id === id);
    if (existing) return existing.family;
    const family = `NronFont_${id}`;
    const face = new FontFace(
      family,
      typeof sourceUrlOrBuffer === "string"
        ? `url(${sourceUrlOrBuffer})`
        : sourceUrlOrBuffer,
    );
    await face.load();
    document.fonts.add(face);
    wsState.loadedFaces.push({ id, family, face });
    while (wsState.loadedFaces.length > 3) {
      const oldest = wsState.loadedFaces.shift();
      if (oldest?.face) document.fonts.delete(oldest.face);
    }
    return family;
  }

  async function applyWritingFont(fontId) {
    wsState.writingFont = fontId || "Vazirmatn";
    const builtIn = ["Vazirmatn", "Tahoma", "Arial", "'Roboto Mono'"];
    if (builtIn.includes(wsState.writingFont)) {
      document.documentElement.style.setProperty(
        "--editor-font",
        wsState.writingFont,
      );
      const sel = document.getElementById("font-select");
      if (sel) sel.value = wsState.writingFont;
      return;
    }

    const bundled = wsState.bundledFonts.find(
      (f) => f.id === wsState.writingFont,
    );
    if (bundled) {
      try {
        const family = await registerFontFace(
          bundled.id,
          bundled.name,
          `assets/fonts-extra/${bundled.file}`,
        );
        document.documentElement.style.setProperty(
          "--editor-font",
          `'${family}', 'Vazirmatn', sans-serif`,
        );
      } catch (e) {
        console.warn("خطا در بارگذاری فونت:", e);
      }
      return;
    }

    const custom = wsState.userFonts.find((f) => f.id === wsState.writingFont);
    if (custom && custom.data) {
      try {
        const family = await registerFontFace(
          custom.id,
          custom.name,
          custom.data,
        );
        document.documentElement.style.setProperty(
          "--editor-font",
          `'${family}', 'Vazirmatn', sans-serif`,
        );
      } catch (e) {
        console.warn("خطا در بارگذاری فونت شخصی:", e);
      }
    }
  }

  function syncFontSelectOptions() {
    const sel = document.getElementById("font-select");
    if (!sel) return;
    sel.querySelectorAll("option[data-extra-font]").forEach((o) => o.remove());
    for (const f of wsState.bundledFonts) {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      opt.setAttribute("data-extra-font", "true");
      sel.appendChild(opt);
    }
    for (const f of wsState.userFonts) {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = `${f.name} (شخصی)`;
      opt.setAttribute("data-extra-font", "true");
      sel.appendChild(opt);
    }
    if (wsState.writingFont) sel.value = wsState.writingFont;
  }

  function ensureModal(id, extraClass = "workspace-modal") {
    let overlay = document.getElementById(id);
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = id;
    overlay.className = "modal-overlay hidden";
    const modal = document.createElement("section");
    modal.className = `modal ${extraClass}`;
    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
    document.getElementById("app")?.appendChild(overlay);
    return overlay;
  }

  async function archive(id, createFallback = true) {
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab) return;
    if (tab.id === state.activeTabId) {
      await saveCurrentTab();
    }
    tab.archived = true;
    tab.updatedAt = Date.now();
    await dbPut("tabs", tab);

    if (state.activeTabId === id) {
      const next = NronWorkspaceModel.newest(state.tabs);
      if (next) {
        await switchTab(next.id);
      } else if (createFallback) {
        await createNewTab();
      }
    } else {
      renderTabs();
    }
    toast("سند به بایگانی منتقل شد");
  }

  async function restoreArchived(id) {
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.archived = false;
    tab.updatedAt = Date.now();
    await dbPut("tabs", tab);
    await switchTab(tab.id);
    toast("سند بازگردانی شد");
  }

  function showLibrary() {
    const overlay = ensureModal("library-modal", "workspace-modal");
    const box = overlay.querySelector(".modal");
    wsState.libraryLimit = 40;

    function render() {
      const q = box.querySelector("#lib-query")?.value || "";
      const status = box.querySelector("#lib-status")?.value || "active";
      const collection = box.querySelector("#lib-col")?.value || "";
      const sort = box.querySelector("#lib-sort")?.value || "created";

      const cols = NronWorkspaceModel.collections(state.tabs);
      const res = NronWorkspaceModel.filter(state.tabs, {
        query: q,
        status,
        collection,
        sort,
        limit: wsState.libraryLimit,
      });

      box.innerHTML = `
        <div class="modal-head">
          <h3>کتابخانه اسناد</h3>
          <button class="icon-btn" id="lib-close" aria-label="بستن">✕</button>
        </div>
        <div class="workspace-actions">
          <button class="btn btn-primary" id="lib-new-doc">＋ سند جدید</button>
          <button class="btn" id="lib-open-templates">قالب‌ها</button>
        </div>
        <div class="library-filters">
          <input type="text" id="lib-query" class="field" placeholder="جستجو در عنوان یا مجموعه…" value="${escapeText(q)}" />
          <select id="lib-status" title="وضعیت">
            <option value="active" ${status === "active" ? "selected" : ""}>فعال</option>
            <option value="archived" ${status === "archived" ? "selected" : ""}>بایگانی</option>
            <option value="all" ${status === "all" ? "selected" : ""}>همه</option>
          </select>
          <select id="lib-col" title="مجموعه">
            <option value="">همه مجموعه‌ها</option>
            ${cols.map((c) => `<option value="${escapeText(c)}" ${c === collection ? "selected" : ""}>${escapeText(c)}</option>`).join("")}
          </select>
          <select id="lib-sort" title="مرتب‌سازی">
            <option value="created" ${sort === "created" ? "selected" : ""}>جدیدترین ساخت</option>
            <option value="edited" ${sort === "edited" ? "selected" : ""}>آخرین ویرایش</option>
            <option value="name" ${sort === "name" ? "selected" : ""}>الفبایی</option>
          </select>
        </div>
        <div id="lib-list"></div>
        ${res.total > res.items.length ? `<div class="workspace-actions"><button class="btn" id="lib-more">نمایش بیشتر (${toFaDigits(res.total - res.items.length)})</button></div>` : ""}
      `;

      const listEl = box.querySelector("#lib-list");
      if (!res.items.length) {
        listEl.innerHTML = `<p class="muted">سندی با این مشخصات پیدا نشد.</p>`;
      } else {
        res.items.forEach((t) => {
          const row = document.createElement("div");
          row.className = "document-row";
          const openBtn = document.createElement("button");
          openBtn.className = "document-open";
          openBtn.innerHTML = `${escapeText(t.title || "بی‌نام")}<small>${t.collection ? `مجموعه: ${escapeText(t.collection)} · ` : ""}${t.archived ? "بایگانی‌شده" : "فعال"}</small>`;
          openBtn.onclick = async () => {
            overlay.classList.add("hidden");
            await switchTab(t.id);
          };

          const colBtn = document.createElement("button");
          colBtn.className = "btn sm";
          colBtn.textContent = "مجموعه";
          colBtn.onclick = async () => {
            const vals = await askDialog("نام مجموعه", [
              { label: "مجموعه (خالی برای حذف)", value: t.collection || "" },
            ]);
            if (!vals) return;
            t.collection = vals[0].slice(0, 80);
            t.updatedAt = Date.now();
            await dbPut("tabs", t);
            render();
          };

          const archBtn = document.createElement("button");
          archBtn.className = "btn sm";
          archBtn.textContent = t.archived ? "بازگردانی" : "بایگانی";
          archBtn.onclick = async () => {
            if (t.archived) await restoreArchived(t.id);
            else await archive(t.id, true);
            render();
          };

          row.append(openBtn, colBtn, archBtn);
          listEl.appendChild(row);
        });
      }

      box.querySelector("#lib-close").onclick = () =>
        overlay.classList.add("hidden");
      box.querySelector("#lib-new-doc").onclick = async () => {
        overlay.classList.add("hidden");
        await createNewTab();
      };
      box.querySelector("#lib-open-templates").onclick = () => {
        overlay.classList.add("hidden");
        showTemplates();
      };
      box.querySelector("#lib-query").oninput = render;
      box.querySelector("#lib-status").onchange = render;
      box.querySelector("#lib-col").onchange = render;
      box.querySelector("#lib-sort").onchange = render;
      const moreBtn = box.querySelector("#lib-more");
      if (moreBtn) {
        moreBtn.onclick = () => {
          wsState.libraryLimit += 40;
          render();
        };
      }
    }

    render();
    overlay.classList.remove("hidden");
  }

  function showTemplates() {
    const overlay = ensureModal(
      "templates-modal",
      "workspace-modal template-modal",
    );
    const box = overlay.querySelector(".modal");

    function render() {
      const all = [
        ...NronWorkspaceModel.templates.map((t) => ({ ...t, builtin: true })),
        ...wsState.userTemplates.map((t) => ({ ...t, builtin: false })),
      ];

      box.innerHTML = `
        <div class="modal-head">
          <h3>قالب‌های نوشته</h3>
          <button class="icon-btn" id="tpl-close" aria-label="بستن">✕</button>
        </div>
        <div class="workspace-actions">
          <button class="btn btn-primary" id="tpl-save-current">ذخیره سند فعلی به‌عنوان قالب</button>
          <button class="btn" id="tpl-import-btn">ورود قالب JSON</button>
          <input type="file" id="tpl-import-input" accept=".json,application/json" hidden />
        </div>
        <div id="template-grid"></div>
      `;

      const grid = box.querySelector("#template-grid");
      all.forEach((tpl) => {
        const card = document.createElement("div");
        card.className = "template-card";
        const choice = document.createElement("button");
        choice.className = "template-choice";
        const excerpt = NronSafety.text(tpl.content).slice(0, 120);
        choice.innerHTML = `
          ${escapeText(tpl.name)}
          <small>${tpl.builtin ? escapeText(tpl.category || "آماده") : "قالب شخصی"}</small>
          <div class="template-excerpt">${escapeText(excerpt)}</div>
        `;
        choice.onclick = async () => {
          const tab = {
            id: NronSafety.id(),
            createdAt: Date.now(),
            title: tpl.name,
            content: NronSafety.html(tpl.content),
            history: [],
          };
          window.addToHistory?.(tab, "ایجاد از قالب");
          await dbPut("tabs", tab);
          state.tabs.push(tab);
          overlay.classList.add("hidden");
          await switchTab(tab.id);
          toast("سند جدید از قالب ساخته شد");
        };
        card.appendChild(choice);

        if (!tpl.builtin) {
          const actions = document.createElement("div");
          actions.className = "card-actions";
          const expBtn = document.createElement("button");
          expBtn.className = "btn sm";
          expBtn.textContent = "دریافت JSON";
          expBtn.onclick = () => {
            if (typeof saveOut === "function") {
              saveOut(
                JSON.stringify(
                  { name: tpl.name, content: tpl.content },
                  null,
                  2,
                ),
                `${tpl.name}.json`,
                { mime: "application/json" },
              );
            }
          };
          const delBtn = document.createElement("button");
          delBtn.className = "btn sm";
          delBtn.textContent = "حذف";
          delBtn.onclick = async () => {
            wsState.userTemplates = wsState.userTemplates.filter(
              (u) => u.id !== tpl.id,
            );
            await saveSetting("user_templates", wsState.userTemplates);
            render();
          };
          actions.append(expBtn, delBtn);
          card.appendChild(actions);
        }
        grid.appendChild(card);
      });

      box.querySelector("#tpl-close").onclick = () =>
        overlay.classList.add("hidden");
      box.querySelector("#tpl-save-current").onclick = async () => {
        if (wsState.userTemplates.length >= 100) {
          toast("حداکثر ۱۰۰ قالب شخصی مجاز است");
          return;
        }
        await saveCurrentTab();
        const current = state.tabs.find((t) => t.id === state.activeTabId);
        const vals = await askDialog("ذخیره قالب شخصی", [
          { label: "نام قالب", value: current?.title || "قالب من" },
        ]);
        const name = vals?.[0];
        if (!name) return;
        const content = NronSafety.html(DOM.visualEditor.innerHTML);
        const candidate = { id: NronSafety.id(), name, content };
        if (!NronWorkspaceModel.validTemplate(candidate)) {
          toast("محتوای قالب معتبر نیست یا بیش از حد طولانی است");
          return;
        }
        wsState.userTemplates.push(candidate);
        await saveSetting("user_templates", wsState.userTemplates);
        render();
        toast("قالب شخصی ذخیره شد");
      };

      const impBtn = box.querySelector("#tpl-import-btn");
      const impInput = box.querySelector("#tpl-import-input");
      impBtn.onclick = () => impInput.click();
      impInput.onchange = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        try {
          const parsed = JSON.parse(await f.text());
          if (!NronWorkspaceModel.validTemplate(parsed)) {
            throw new Error("ساختار قالب معتبر نیست");
          }
          wsState.userTemplates.push({
            id: NronSafety.id(),
            name: parsed.name.trim(),
            content: NronSafety.html(parsed.content),
          });
          await saveSetting("user_templates", wsState.userTemplates);
          render();
          toast("قالب وارد شد");
        } catch (err) {
          toast("خطا در ورود قالب: " + (err?.message || err));
        }
      };
    }

    render();
    overlay.classList.remove("hidden");
  }

  function showPersonalize() {
    const overlay = ensureModal("personalize-modal", "workspace-modal");
    const box = overlay.querySelector(".modal");

    function render() {
      box.innerHTML = `
        <div class="modal-head">
          <h3>ظاهر، فونت‌ها و قالب‌های شخصی</h3>
          <button class="icon-btn" id="pers-close" aria-label="بستن">✕</button>
        </div>
        <h4>حال‌وهوای میز کار</h4>
        <div class="look-grid">
          ${NronWorkspaceModel.looks
            .map(
              (l) => `
            <button class="look-card ${wsState.look === l.id ? "selected" : ""}" data-look-value="${l.id}">
              ${escapeText(l.name)}
            </button>
          `,
            )
            .join("")}
        </div>
        <label class="motion-control">
          <input type="checkbox" id="pers-motion" ${wsState.reduceMotion ? "checked" : ""} />
          <span>کاهش حرکت و انیمیشن‌های محیط</span>
        </label>
        <h4>فونت نوشتن</h4>
        <select id="pers-font-select" class="field">
          <option value="Vazirmatn">وزیرمتن (پیش‌فرض)</option>
          <option value="Tahoma">Tahoma</option>
          <option value="Arial">Arial</option>
          <option value="'Roboto Mono'">Roboto Mono</option>
          ${wsState.bundledFonts.map((f) => `<option value="${f.id}">${escapeText(f.name)}</option>`).join("")}
          ${wsState.userFonts.map((f) => `<option value="${f.id}">${escapeText(f.name)} (شخصی)</option>`).join("")}
        </select>
        <div class="font-preview">نمونه متن فارسی با حروف پ چ ژ گ ک ی — ۱۲۳۴۵۶۷۸۹۰</div>
        <div class="workspace-actions">
          <button class="btn" id="pers-add-font">افزودن فونت شخصی (TTF/OTF/WOFF2)</button>
          <button class="btn" id="pers-open-tpl">مدیریت قالب‌ها</button>
          <input type="file" id="pers-font-file" accept=".ttf,.otf,.woff2" hidden />
        </div>
      `;

      const fontSel = box.querySelector("#pers-font-select");
      fontSel.value = wsState.writingFont;
      fontSel.onchange = async () => {
        await applyWritingFont(fontSel.value);
        await saveSetting("writing_font", wsState.writingFont);
        syncFontSelectOptions();
      };

      box.querySelectorAll(".look-card").forEach((btn) => {
        btn.onclick = async () => {
          const val = btn.getAttribute("data-look-value");
          applyLook(val);
          await saveSetting("writing_look", val);
          render();
        };
      });

      box.querySelector("#pers-motion").onchange = async (e) => {
        applyMotion(e.target.checked);
        await saveSetting("reduce_motion", wsState.reduceMotion);
      };

      box.querySelector("#pers-close").onclick = () =>
        overlay.classList.add("hidden");
      box.querySelector("#pers-open-tpl").onclick = () => {
        overlay.classList.add("hidden");
        showTemplates();
      };

      const addFontBtn = box.querySelector("#pers-add-font");
      const fontInput = box.querySelector("#pers-font-file");
      addFontBtn.onclick = () => fontInput.click();
      fontInput.onchange = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) {
          toast("حداکثر حجم هر فونت ۵ مگابایت است");
          return;
        }
        if (wsState.userFonts.length >= 10) {
          toast("حداکثر ۱۰ فونت شخصی مجاز است");
          return;
        }
        try {
          const buf = await f.arrayBuffer();
          await new FontFace("NronTestFont", buf.slice(0)).load();
          const id = "user-" + Date.now().toString(36);
          const name = f.name.replace(/\.[^.]+$/, "").slice(0, 60);
          const record = { id, name, size: buf.byteLength, custom: true, data: buf };
          await dbPut("fonts", record);
          wsState.userFonts.push(record);
          syncFontSelectOptions();
          await applyWritingFont(id);
          await saveSetting("writing_font", id);
          render();
          toast("فونت شخصی اضافه و فعال شد");
        } catch (err) {
          toast("فایل فونت معتبر نیست");
        }
      };
    }

    render();
    overlay.classList.remove("hidden");
  }

  function updateHeaderPomodoro() {
    const el = document.getElementById("pomodoro-display");
    if (!el) return;
    el.textContent = formatClock(wsState.timer.remainingSec);
    el.classList.toggle("running", wsState.timer.running);
  }

  function tickTimer() {
    if (!wsState.timer.running) return;
    const left = Math.max(
      0,
      Math.ceil((wsState.timer.deadline - Date.now()) / 1000),
    );
    wsState.timer.remainingSec = left;
    updateHeaderPomodoro();
    const clockEl = document.querySelector("#timer-modal .timer-clock");
    if (clockEl) clockEl.textContent = formatClock(left);
    if (left <= 0) {
      wsState.timer.running = false;
      clearInterval(wsState.timer.interval);
      wsState.timer.mode = wsState.timer.mode === "work" ? "break" : "work";
      wsState.timer.remainingSec =
        (wsState.timer.mode === "work"
          ? wsState.pomodoro.work
          : wsState.pomodoro.break) * 60;
      updateHeaderPomodoro();
      toast(
        wsState.timer.mode === "break"
          ? "نوبت استراحت است!"
          : "نوبت تمرکز و نوشتن است!",
      );
    }
  }

  function showTimer() {
    const overlay = ensureModal("timer-modal", "workspace-modal");
    const box = overlay.querySelector(".modal");

    function render() {
      box.innerHTML = `
        <div class="modal-head">
          <h3>زمان‌سنج پومودورو</h3>
          <button class="icon-btn" id="tm-close" aria-label="بستن">✕</button>
        </div>
        <div class="timer-clock">${formatClock(wsState.timer.remainingSec)}</div>
        <div class="workspace-actions">
          <button class="btn btn-primary" id="tm-toggle">${wsState.timer.running ? "توقف" : "شروع"}</button>
          <button class="btn" id="tm-reset">بازنشانی</button>
        </div>
        <label>زمان تمرکز (دقیقه ۱ تا ۱۸۰)</label>
        <input type="number" id="tm-work" class="field" min="1" max="180" value="${wsState.pomodoro.work}" />
        <label>زمان استراحت (دقیقه ۱ تا ۱۸۰)</label>
        <input type="number" id="tm-break" class="field" min="1" max="180" value="${wsState.pomodoro.break}" />
      `;

      box.querySelector("#tm-close").onclick = () =>
        overlay.classList.add("hidden");
      box.querySelector("#tm-toggle").onclick = () => {
        if (wsState.timer.running) {
          tickTimer();
          wsState.timer.running = false;
          clearInterval(wsState.timer.interval);
        } else {
          wsState.timer.running = true;
          wsState.timer.deadline =
            Date.now() + wsState.timer.remainingSec * 1000;
          clearInterval(wsState.timer.interval);
          wsState.timer.interval = setInterval(tickTimer, 500);
        }
        updateHeaderPomodoro();
        render();
      };
      box.querySelector("#tm-reset").onclick = () => {
        wsState.timer.running = false;
        clearInterval(wsState.timer.interval);
        wsState.timer.mode = "work";
        wsState.timer.remainingSec = wsState.pomodoro.work * 60;
        updateHeaderPomodoro();
        render();
      };

      const onDurationChange = async () => {
        wsState.pomodoro = NronWorkspaceModel.clampTimer({
          work: box.querySelector("#tm-work").value,
          break: box.querySelector("#tm-break").value,
        });
        await saveSetting("pomodoro", wsState.pomodoro);
        if (!wsState.timer.running) {
          wsState.timer.remainingSec = wsState.pomodoro.work * 60;
          updateHeaderPomodoro();
          render();
        }
      };
      box.querySelector("#tm-work").onchange = onDurationChange;
      box.querySelector("#tm-break").onchange = onDurationChange;
    }

    render();
    overlay.classList.remove("hidden");
  }

  window.addEventListener("DOMContentLoaded", async () => {
    try {
      await window.dbReady;
      const [settings, fonts] = await Promise.all([
        dbGetAll("settings"),
        dbGetAll("fonts"),
      ]);
      wsState.userFonts = Array.isArray(fonts) ? fonts : [];

      try {
        const res = await fetch("assets/fonts-extra/manifest.json");
        if (res.ok) wsState.bundledFonts = await res.json();
      } catch {}

      const map = new Map((settings || []).map((s) => [s.key, s.value]));
      if (map.has("writing_look")) applyLook(map.get("writing_look"));
      if (map.has("reduce_motion")) applyMotion(map.get("reduce_motion"));
      if (Array.isArray(map.get("user_templates"))) {
        wsState.userTemplates = map
          .get("user_templates")
          .filter(NronWorkspaceModel.validTemplate);
      }
      if (map.has("pomodoro")) {
        wsState.pomodoro = NronWorkspaceModel.clampTimer(map.get("pomodoro"));
        wsState.timer.remainingSec = wsState.pomodoro.work * 60;
      }

      syncFontSelectOptions();
      if (map.has("writing_font")) {
        await applyWritingFont(map.get("writing_font"));
      }
      updateHeaderPomodoro();

      document
        .getElementById("quick-new")
        ?.addEventListener("click", () => createNewTab());
      document
        .getElementById("btn-library")
        ?.addEventListener("click", showLibrary);
      document
        .getElementById("btn-personalize")
        ?.addEventListener("click", showPersonalize);
    } finally {
      resolveReady();
    }
  });

  window.NronWorkspace = {
    archive,
    restoreArchived,
    showLibrary,
    showTemplates,
    showPersonalize,
    showTimer,
  };
})();
