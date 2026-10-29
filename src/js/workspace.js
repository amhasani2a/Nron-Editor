let resolveWorkspaceReady;
window.workspaceReady = new Promise((resolve) => {
  resolveWorkspaceReady = resolve;
});
/* Workspace controller: library, declarative templates, font assets and deadline timer.
   Document text remains in app.js; this layer never rewrites it for appearance. */
window.NronWorkspace = (() => {
  const M = NronWorkspaceModel,
    $ = (id) => document.getElementById(id);
  let templates = [],
    customFonts = [],
    fontManifest = [],
    faces = new Map(),
    libraryPage = 0,
    lastArchived = null;
  let timer = { work: 25, break: 5, phase: "work", deadline: 0, left: 1500 };
  let tickHandle;
  const builtins = [
    ["یادداشت آزاد", "چند خط، بی‌عجله", "<h1>یادداشت تازه</h1><p></p>"],
    [
      "روزنگار",
      "روز را به کلمه‌ها بسپار",
      "<h1>روز من</h1><h2>امروز چه گذشت؟</h2><p></p><h2>چیزی که یاد گرفتم</h2><p></p>",
    ],
    [
      "داستان کوتاه",
      "یک شخصیت، یک اتفاق",
      "<h1>نام داستان</h1><p></p><h2>پردهٔ اول</h2><p></p>",
    ],
    [
      "مقاله",
      "از پرسش تا نتیجه",
      "<h1>عنوان مقاله</h1><h2>پرسش اصلی</h2><p></p><h2>بحث و شواهد</h2><p></p><h2>نتیجه</h2><p></p>",
    ],
    [
      "صورت‌جلسه",
      "تصمیم‌ها را روشن ثبت کن",
      "<h1>یادداشت جلسه</h1><p>تاریخ و حاضران:</p><h2>تصمیم‌ها</h2><ul><li></li></ul><h2>اقدام بعدی</h2><p></p>",
    ],
    [
      "برنامهٔ روز",
      "فقط سه کار مهم",
      "<h1>امروز</h1><ol><li>کار مهم اول</li><li>کار مهم دوم</li><li>کار مهم سوم</li></ol><h2>یادداشت</h2><p></p>",
    ],
    [
      "طرح کتاب",
      "فصل‌ها کنار هم",
      "<h1>نام کتاب</h1><h2>ایدهٔ مرکزی</h2><p></p><h2>فصل اول</h2><p></p><h2>فصل دوم</h2><p></p>",
    ],
    [
      "نامه",
      "ساده و خوانا",
      "<p>به نام خدا</p><p>گیرندهٔ گرامی،</p><p></p><p>با احترام</p>",
    ],
    [
      "یادداشت پژوهش",
      "پرسش، منبع، برداشت",
      "<h1>موضوع پژوهش</h1><h2>پرسش</h2><p></p><h2>منابع</h2><p></p><h2>برداشت من</h2><p></p>",
    ],
    [
      "نقد کتاب",
      "یک خواندنِ دوباره",
      "<h1>نام کتاب</h1><p>نویسنده:</p><h2>ایدهٔ اصلی</h2><p></p><h2>نکته‌های ماندگار</h2><p></p>",
    ],
    ["شعر", "جایی برای مکث", "<h1>نام شعر</h1><p></p>"],
    [
      "یادگیری",
      "موضوع را برای خودت توضیح بده",
      "<h1>چه یاد گرفتم؟</h1><h2>به زبان خودم</h2><p></p><h2>مثال</h2><p></p><h2>پرسش بعدی</h2><p></p>",
    ],
  ].map(([name, description, content], i) => ({
    id: "builtin-" + i,
    name,
    description,
    content,
  }));
  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function button(text, run, cls = "btn") {
    const b = el("button", text, cls);
    b.type = "button";
    b.onclick = () =>
      Promise.resolve()
        .then(run)
        .catch((error) => {
          console.error(error);
          toast(error.message || "عملیات انجام نشد");
        });
    return b;
  }
  function modal(id, title) {
    const overlay = el("div", undefined, "modal-overlay hidden");
    overlay.id = id;
    const box = el("section", undefined, "modal workspace-modal");
    box.setAttribute("aria-label", title);
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    const head = el("div", undefined, "modal-head");
    head.append(
      el("h3", title),
      button("×", () => hide(id), "icon-btn"),
    );
    head.lastChild.setAttribute("aria-label", "بستن");
    box.append(head);
    overlay.append(box);
    $("app").append(overlay);
    overlay.onclick = (e) => {
      if (e.target === overlay) hide(id);
    };
    return box;
  }
  function show(id) {
    document
      .querySelectorAll(".modal-overlay")
      .forEach((m) => m.classList.add("hidden"));
    $(id).classList.remove("hidden");
    $(id).querySelector("button,input,select")?.focus();
  }
  function hide(id) {
    $(id).classList.add("hidden");
  }
  async function archive(id, value) {
    await saveCurrentTab();
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab) return;
    await dbPut("tabs", { ...tab, archived: value });
    tab.archived = value;
    if (value) {
      lastArchived = id;
      if (id === state.activeTabId) {
        const next = M.newest(state.tabs);
        if (next) await switchTab(next.id);
        else await createNewTab();
      }
    }
    renderTabs();
    renderLibrary();
    toast(
      value
        ? "بایگانی شد؛ از کتابخانه قابل بازگردانی است"
        : "سند به نوشته‌ها برگشت",
    );
  }
  function renderLibrary() {
    if (!$("library-list")) return;
    const rows = M.list(state.tabs, {
      query: $("library-query").value,
      mode: $("library-mode").value,
      sort: $("library-sort").value,
      collection: $("library-collection").value,
    });
    const list = $("library-list");
    list.replaceChildren();
    $("library-count").textContent = toFa(rows.length) + " سند";
    for (const t of rows.slice(0, (libraryPage + 1) * 40)) {
      const row = el("article", undefined, "document-row");
      const open = button(
        t.title || "بی‌نام",
        async () => {
          hide("library-modal");
          await switchTab(t.id);
        },
        "document-open",
      );
      open.append(
        el(
          "small",
          (t.collection || "بدون مجموعه") +
            " · " +
            new Date(
              t.createdAt || Number(t.id) || Date.now(),
            ).toLocaleDateString("fa-IR"),
        ),
      );
      row.append(
        open,
        button(
          "مجموعه",
          async () => {
            const answer = await askDialog("مجموعهٔ سند", [
              {
                label: "نام مجموعه؛ خالی = بدون مجموعه",
                value: t.collection || "",
              },
            ]);
            if (!answer) return;
            t.collection = answer[0].slice(0, 80);
            await dbPut("tabs", t);
            refreshCollections();
            show("library-modal");
            renderLibrary();
          },
          "btn sm",
        ),
        button(
          t.archived ? "بازگردانی" : "بایگانی",
          () => archive(t.id, !t.archived),
          "btn sm",
        ),
      );
      list.append(row);
    }
    if (!rows.length)
      list.append(el("p", "اینجا هنوز نوشته‌ای نیست.", "muted"));
    if (rows.length > (libraryPage + 1) * 40)
      list.append(
        button("نمایش بیشتر", () => {
          libraryPage++;
          renderLibrary();
        }),
      );
    $("library-undo").hidden =
      !lastArchived || !state.tabs.find((t) => t.id === lastArchived)?.archived;
  }
  function refreshCollections() {
    const select = $("library-collection"),
      previous = select.value;
    select.replaceChildren(new Option("همهٔ مجموعه‌ها", ""));
    for (const name of [
      ...new Set(state.tabs.map((t) => t.collection).filter(Boolean)),
    ].sort())
      select.add(new Option(name, name));
    select.value = previous;
  }
  async function showLibrary() {
    await window.workspaceReady;
    libraryPage = 0;
    refreshCollections();
    renderLibrary();
    show("library-modal");
  }
  async function persistTemplates() {
    await dbPut("settings", { key: "user_templates", value: templates });
  }
  async function saveTemplate(name) {
    await saveCurrentTab();
    const t = {
      id: NronSafety.id(),
      name: name.trim(),
      content: activeTab().content,
    };
    if (!M.validTemplate(t))
      throw Error("نام قالب لازم است؛ حداکثر اندازهٔ قالب ۱۰۰ هزار نویسه است");
    if (templates.length >= 100) throw Error("حداکثر ۱۰۰ قالب شخصی");
    templates.push(t);
    await persistTemplates();
    toast("قالب شخصی ذخیره شد");
    renderTemplates();
  }
  async function useTemplate(t) {
    await createNewTab();
    DOM.visualEditor.innerHTML = NronSafety.html(t.content);
    DOM.sourceEditor.value = DOM.visualEditor.innerHTML;
    await renameTab(state.activeTabId, t.name);
    await saveCurrentTab();
    await updateStats();
    hide("templates-modal");
  }
  function renderTemplates() {
    const grid = $("template-grid");
    if (!grid) return;
    grid.replaceChildren();
    for (const t of [...builtins, ...templates]) {
      const card = el("article", undefined, "template-card");
      const b = button(t.name, () => useTemplate(t), "template-choice");
      b.append(el("small", t.description || "قالب شخصی؛ ساخت در سند تازه"));
      const preview = el(
        "div",
        NronSafety.text(t.content).slice(0, 110),
        "template-excerpt",
      );
      b.append(preview);
      card.append(b);
      if (!t.id.startsWith("builtin-")) {
        const actions = el("div", undefined, "card-actions");
        actions.append(
          button(
            "دریافت JSON",
            () =>
              saveOut(
                JSON.stringify({ name: t.name, content: t.content }, null, 2),
                sanitize(t.name) + ".nron-template.json",
                { mime: "application/json" },
              ),
            "btn sm",
          ),
          button(
            "حذف قالب",
            async () => {
              templates = templates.filter((x) => x.id !== t.id);
              await persistTemplates();
              renderTemplates();
            },
            "btn sm",
          ),
        );
        card.append(actions);
      }
      grid.append(card);
    }
  }
  async function showTemplates() {
    await window.workspaceReady;
    renderTemplates();
    show("templates-modal");
  }
  async function applyFont(id) {
    if (!id) {
      document.documentElement.style.setProperty("--editor-font", "Vazirmatn");
      await dbPut("settings", { key: "writing_font", value: "" });
      return;
    }
    const item =
      fontManifest.find((f) => f.id === id) ||
      customFonts.find((f) => f.id === id);
    if (!item) throw Error("فونت در دسترس نیست");
    if (!faces.has(id)) {
      const data = item.custom
        ? (await dbGet("fonts", id)).data
        : `url("assets/fonts-extra/${item.file}")`;
      const face = await new FontFace("NronFont_" + id, data).load();
      document.fonts.add(face);
      faces.set(id, face);
      while (faces.size > 3) {
        const first = faces.keys().next().value;
        document.fonts.delete(faces.get(first));
        faces.delete(first);
      }
    }
    document.documentElement.style.setProperty(
      "--editor-font",
      '"NronFont_' + id + '", Vazirmatn',
    );
    await dbPut("settings", { key: "writing_font", value: id });
  }
  async function importFont(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !file.size)
      throw Error("فونت باید کوچک‌تر از ۵ مگابایت باشد");
    if (
      customFonts.length >= 10 ||
      customFonts.reduce((n, f) => n + f.size, 0) + file.size > 20 * 1024 * 1024
    )
      throw Error("حداکثر ۱۰ فونت شخصی و مجموع ۲۰ مگابایت");
    const data = await file.arrayBuffer();
    const sig = new Uint8Array(data.slice(0, 4));
    if (
      !(
        (sig[0] === 0 && sig[1] === 1 && sig[2] === 0 && sig[3] === 0) ||
        ["OTTO", "wOF2"].includes(String.fromCharCode(...sig))
      )
    )
      throw Error("فایل فونت معتبر نیست");
    const id = "user-" + crypto.randomUUID();
    const face = await new FontFace("NronFont_" + id, data).load();
    document.fonts.add(face);
    faces.set(id, face);
    const item = {
      id,
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
      size: file.size,
      custom: true,
    };
    await dbPut("fonts", { ...item, data });
    customFonts.push(item);
    while (faces.size > 3) {
      const first = faces.keys().next().value;
      document.fonts.delete(faces.get(first));
      faces.delete(first);
    }
    refreshFonts();
    await applyFont(id);
    toast("فونت شخصی اضافه شد");
  }
  function refreshFonts() {
    const s = $("writing-font");
    s.replaceChildren(new Option("وزیر — پیش‌فرض", ""));
    for (const f of [...fontManifest, ...customFonts])
      s.add(new Option(f.name, f.id));
    const list = $("custom-font-list");
    list.replaceChildren();
    for (const f of customFonts) {
      const row = el("div", undefined, "document-row");
      row.append(
        el("span", f.name),
        button(
          "حذف",
          async () => {
            await dbDelete("fonts", f.id);
            if (faces.has(f.id)) {
              document.fonts.delete(faces.get(f.id));
              faces.delete(f.id);
            }
            customFonts = customFonts.filter((x) => x.id !== f.id);
            await dbPut("settings", { key: "writing_font", value: "" });
            await applyFont("");
            refreshFonts();
          },
          "btn sm",
        ),
      );
      list.append(row);
    }
  }
  function renderTimer() {
    const n = timer.deadline ? M.remaining(timer.deadline) : timer.left;
    const text = toFa(
      String(Math.floor(n / 60)).padStart(2, "0") +
        ":" +
        String(n % 60).padStart(2, "0"),
    );
    DOM.pomodoroDisplay.textContent = text;
    DOM.pomodoroDisplay.classList.toggle("running", !!timer.deadline);
    if ($("timer-clock")) {
      $("timer-clock").textContent = text;
      $("timer-phase").textContent =
        timer.phase === "work" ? "زمان نوشتن" : "زمان استراحت";
    }
    if (timer.deadline && !n) {
      timer.phase = timer.phase === "work" ? "break" : "work";
      timer.deadline = 0;
      timer.left = timer[timer.phase] * 60;
      persistTimer();
      toast(
        timer.phase === "break" ? "وقت استراحت است" : "آمادهٔ نوشتن دوباره‌ای؟",
      );
    }
  }
  function persistTimer() {
    return dbPut("settings", { key: "pomodoro", value: timer });
  }
  async function showTimer() {
    await window.workspaceReady;
    $("timer-work").value = timer.work;
    $("timer-break").value = timer.break;
    renderTimer();
    show("timer-modal");
  }
  function applyLook(value) {
    document.documentElement.dataset.look = value;
    dbPut("settings", { key: "writing_look", value });
    document
      .querySelectorAll("[data-look-value]")
      .forEach((b) =>
        b.classList.toggle("selected", b.dataset.lookValue === value),
      );
  }
  async function init() {
    const lib = modal("library-modal", "کتابخانهٔ نوشته‌ها");
    lib.classList.add("library-modal");
    const tools = el("div", undefined, "workspace-actions");
    tools.append(
      button(
        "＋ سند جدید",
        async () => {
          await createNewTab();
          hide("library-modal");
        },
        "btn btn-primary",
      ),
      button("قالب‌ها", showTemplates),
    );
    lib.append(tools);
    const filters = el("div", undefined, "library-filters");
    const query = el("input");
    query.id = "library-query";
    query.className = "field";
    query.placeholder = "جستجوی نام سند…";
    query.setAttribute("aria-label", "جستجوی اسناد");
    filters.append(query);
    for (const [id, options] of [
      [
        "library-mode",
        [
          ["active", "نوشته‌ها"],
          ["archive", "بایگانی"],
          ["all", "همه"],
        ],
      ],
      [
        "library-sort",
        [
          ["created", "تازه‌ترین ایجاد"],
          ["updated", "آخرین ویرایش"],
          ["name", "نام"],
        ],
      ],
      ["library-collection", [["", "همهٔ مجموعه‌ها"]]],
    ]) {
      const select = el("select");
      select.id = id;
      select.setAttribute("aria-label", options[0][1]);
      for (const [value, label] of options)
        select.add(new Option(label, value));
      select.onchange = () => {
        libraryPage = 0;
        renderLibrary();
      };
      filters.append(select);
    }
    query.oninput = () => {
      libraryPage = 0;
      renderLibrary();
    };
    lib.append(filters, el("p", "", "muted"));
    lib.lastChild.id = "library-count";
    const undo = button("برگرداندن آخرین بایگانی", () =>
      archive(lastArchived, false),
    );
    undo.id = "library-undo";
    undo.hidden = true;
    lib.append(undo);
    const list = el("div");
    list.id = "library-list";
    lib.append(list);
    const tmpl = modal("templates-modal", "از یک قالب شروع کن");
    tmpl.classList.add("template-modal");
    tmpl.append(
      el(
        "p",
        "هر قالب یک سند تازه می‌سازد؛ نوشتهٔ فعلی دست‌نخورده می‌ماند.",
        "muted",
      ),
    );
    const actions = el("div", undefined, "workspace-actions");
    actions.append(
      button("ذخیرهٔ سند به‌عنوان قالب", async () => {
        const a = await askDialog("نام قالب شخصی", [{ label: "نام قالب" }]);
        if (a?.[0]) await saveTemplate(a[0]);
        showTemplates();
      }),
      button("افزودن فایل قالب", () => $("template-file").click()),
    );
    tmpl.append(actions);
    const grid = el("div");
    grid.id = "template-grid";
    tmpl.append(grid);
    const input = el("input");
    input.type = "file";
    input.accept = ".json";
    input.hidden = true;
    input.id = "template-file";
    input.onchange = async () => {
      try {
        const f = input.files[0];
        if (!f) return;
        if (f.size > 300000) throw Error("فایل قالب بزرگ است");
        const data = JSON.parse(await f.text());
        if (!M.validTemplate(data)) throw Error("ساختار قالب معتبر نیست");
        if (templates.length >= 100) throw Error("حداکثر ۱۰۰ قالب");
        templates.push({
          id: NronSafety.id(),
          name: data.name.trim(),
          content: NronSafety.html(data.content),
        });
        await persistTemplates();
        renderTemplates();
      } catch (e) {
        toast(e.message);
      } finally {
        input.value = "";
      }
    };
    tmpl.append(input);
    const personal = modal("personalize-modal", "محیط نوشتن تو");
    personal.append(
      el("p", "ظاهر فقط محیط را عوض می‌کند؛ متن تغییر نمی‌کند.", "muted"),
    );
    const looks = el("div", undefined, "look-grid");
    for (const [value, label] of [
      ["paper", "کاغذ"],
      ["ink", "جوهر"],
      ["mist", "مه"],
      ["forest", "جنگل"],
      ["sepia", "سپیا"],
      ["midnight", "نیمه‌شب"],
    ]) {
      const b = button(label, () => applyLook(value), "look-card");
      b.dataset.lookValue = value;
      looks.append(b);
    }
    personal.append(looks, el("h4", "فونت نوشته"));
    const fonts = el("select");
    fonts.id = "writing-font";
    fonts.className = "field";
    fonts.setAttribute("aria-label", "فونت نوشته");
    fonts.onchange = () =>
      applyFont(fonts.value).catch((e) => toast(e.message));
    personal.append(
      fonts,
      el(
        "p",
        "پیش‌نمایش: می‌نویسم، پس دوباره می‌خوانم. ۱۲۳ · English",
        "font-preview",
      ),
    );
    const fi = el("input");
    fi.type = "file";
    fi.accept = ".ttf,.otf,.woff2";
    fi.hidden = true;
    fi.id = "personal-font-file";
    fi.onchange = () =>
      importFont(fi.files[0])
        .catch((e) => toast(e.message))
        .finally(() => (fi.value = ""));
    personal.append(
      button("＋ فونت شخصی", () => fi.click()),
      fi,
      el(
        "p",
        "TTF، OTF یا WOFF2؛ تا ۵ مگابایت. فونت فقط روی دستگاه ذخیره می‌شود.",
        "muted",
      ),
    );
    const cf = el("div");
    cf.id = "custom-font-list";
    personal.append(cf);
    const motion = el("label", undefined, "motion-control");
    const check = el("input");
    check.type = "checkbox";
    check.id = "reduce-motion";
    check.onchange = () => {
      document.documentElement.dataset.motion = check.checked ? "off" : "on";
      dbPut("settings", { key: "reduce_motion", value: check.checked });
    };
    motion.append(check, el("span", "کاهش حرکت‌ها"));
    personal.append(
      motion,
      button("قالب‌های سند", showTemplates),
      button("درخواست نگهداری پایدار داده‌ها", async () => {
        const granted = await navigator.storage?.persist?.();
        toast(
          granted
            ? "نگهداری پایدار پذیرفته شد"
            : "سیستم تضمین نگهداری نداد؛ پشتیبان منظم بگیرید",
        );
      }),
    );
    const tm = modal("timer-modal", "ریتم نوشتن");
    tm.append(
      el(
        "p",
        "زمان‌سنج با ساعت واقعی محاسبه می‌شود؛ اجرای اعلان در پس‌زمینه تضمین‌شده نیست.",
        "muted",
      ),
    );
    const phase = el("p");
    phase.id = "timer-phase";
    const clock = el("p", "", "timer-clock");
    clock.id = "timer-clock";
    tm.append(phase, clock);
    for (const [id, label] of [
      ["timer-work", "نوشتن (دقیقه)"],
      ["timer-break", "استراحت (دقیقه)"],
    ]) {
      const l = el("label", label);
      const inp = el("input");
      inp.id = id;
      inp.type = "number";
      inp.min = "1";
      inp.max = "180";
      inp.className = "field";
      l.htmlFor = id;
      tm.append(l, inp);
    }
    const timerButtons = el("div", undefined, "workspace-actions");
    const save = button(
      "ذخیرهٔ زمان‌ها",
      async () => {
        timer.work = M.minutes($("timer-work").value);
        timer.break = M.minutes($("timer-break").value);
        timer.deadline = 0;
        timer.left = timer[timer.phase] * 60;
        await persistTimer();
        renderTimer();
        hide("timer-modal");
      },
      "btn btn-primary",
    );
    save.id = "timer-save";
    timerButtons.append(
      save,
      button("شروع / ادامه", async () => {
        if (!timer.deadline) {
          timer.deadline = Date.now() + timer.left * 1000;
          await persistTimer();
          renderTimer();
        }
      }),
      button("مکث", async () => {
        if (timer.deadline) timer.left = M.remaining(timer.deadline);
        timer.deadline = 0;
        await persistTimer();
        renderTimer();
      }),
      button("بازنشانی", async () => {
        timer.deadline = 0;
        timer.left = timer[timer.phase] * 60;
        await persistTimer();
        renderTimer();
      }),
    );
    tm.append(timerButtons);
    $("quick-new").onclick = () => createNewTab().catch(console.error);
    $("btn-library").onclick = showLibrary;
    $("btn-personalize").onclick = () => show("personalize-modal");
    DOM.pomodoroDisplay.style.cursor = "pointer";
    DOM.pomodoroDisplay.onclick = showTimer;
    const more = document.querySelector("#more-sheet .m-actions");
    more.prepend(
      button(
        "قالب‌های سند",
        () => {
          showTemplates();
          $("more-sheet").classList.remove("open");
          $("sheet-backdrop").classList.remove("show");
        },
        "m-action",
      ),
      button(
        "کتابخانه",
        () => {
          showLibrary();
          $("more-sheet").classList.remove("open");
          $("sheet-backdrop").classList.remove("show");
        },
        "m-action",
      ),
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape")
        document
          .querySelectorAll(".workspace-modal")
          .forEach((m) => m.parentElement.classList.add("hidden"));
    });
    await window.dbReady;
    const all = await dbGetAll("settings");
    const get = (k) => all.find((x) => x.key === k)?.value;
    templates = (get("user_templates") || [])
      .filter(M.validTemplate)
      .slice(0, 100);
    customFonts = (await dbGetAll("fonts")).map(({ data, ...f }) => f);
    try {
      fontManifest = await (
        await fetch("assets/fonts-extra/manifest.json")
      ).json();
    } catch (e) {
      console.error(e);
    }
    refreshFonts();
    if (get("writing_font")) {
      await applyFont(get("writing_font")).catch(console.error);
      fonts.value = get("writing_font");
    }
    if (get("writing_look")) applyLook(get("writing_look"));
    if (get("reduce_motion")) {
      check.checked = true;
      document.documentElement.dataset.motion = "off";
    }
    if (get("pomodoro")) {
      const p = get("pomodoro");
      timer = {
        work: M.minutes(p.work),
        break: M.minutes(p.break),
        phase: p.phase === "break" ? "break" : "work",
        deadline: Number(p.deadline) || 0,
        left: Math.max(0, Math.min(10800, Number(p.left) || 1500)),
      };
    }
    renderTimer();
    tickHandle = setInterval(renderTimer, 1000);
    document.addEventListener("visibilitychange", renderTimer);
    window.addEventListener("pagehide", () => clearInterval(tickHandle));
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) {
        clearInterval(tickHandle);
        tickHandle = setInterval(renderTimer, 1000);
        renderTimer();
      }
    });
  }
  window.addEventListener("DOMContentLoaded", () =>
    init()
      .then(() => resolveWorkspaceReady())
      .catch((error) => {
        console.error(error);
        toast("بخش شخصی‌سازی کامل بارگذاری نشد");
        resolveWorkspaceReady();
      }),
  );
  return {
    archive,
    showLibrary,
    showTemplates,
    saveTemplate,
    showTimer,
    applyFont,
    importFont,
  };
})();
