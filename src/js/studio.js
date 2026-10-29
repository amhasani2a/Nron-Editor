/* Host for the command palette, declarative plugins and release UI. No eval. */
window.NronStudio = (() => {
  const $ = (id) => document.getElementById(id);
  const version = "0.3.0";
  let plugins = [];
  let pendingTransform = null;
  const names = [
    "حروف بزرگ انگلیسی",
    "حروف کوچک انگلیسی",
    "حروف اول بزرگ",
    "حذف فاصله ابتدا و انتها",
    "حذف فاصله هر سطر",
    "یک‌دست کردن فاصله‌ها",
    "کاهش سطرهای خالی",
    "حذف سطرهای خالی",
    "مرتب‌سازی صعودی",
    "مرتب‌سازی نزولی",
    "مرتب‌سازی عددی",
    "حذف سطرهای تکراری",
    "معکوس کردن سطرها",
    "اعداد فارسی",
    "اعداد انگلیسی",
    "ی و ک فارسی",
    "حذف اعراب",
    "تبدیل نیم‌فاصله به فاصله",
    "اصلاح فاصله‌های خاص",
    "نقل‌قول ساده",
    "شماره‌گذاری سطرها",
    "نشانه‌گذاری سطرها",
    "نقل‌قول سطرها",
    "حذف شماره سطرها",
    "پیوستن سطرها",
    "هر جمله در یک سطر",
  ];
  const commands = Object.keys(NronText.operations).map((op, i) => ({
    id: op,
    label: names[i],
    group: "تبدیل متن",
    run: () => preview(op, names[i]),
  }));
  const add = (id, label, group, run) =>
    commands.push({ id, label, group, run });
  function open(id) {
    document
      .querySelectorAll(".modal-overlay")
      .forEach((m) => m.classList.add("hidden"));
    $(id).classList.remove("hidden");
  }
  function close(id) {
    $(id).classList.add("hidden");
  }
  function text() {
    return state.isSourceMode
      ? NronSafety.text(DOM.sourceEditor.value)
      : DOM.visualEditor.innerText;
  }
  async function replace(textValue, label) {
    window.trackChange("پیش از " + label);
    await saveCurrentTab();
    const html = String(textValue)
      .split("\n")
      .map((s) => "<p>" + escapeText(s || "") + "</p>")
      .join("");
    DOM.visualEditor.innerHTML = html;
    DOM.sourceEditor.value = html;
    window.trackChange(label);
    await saveCurrentTab();
    await updateStats();
    window.renderOutline?.();
  }
  function preview(op, label) {
    pendingTransform = { op, label };
    $("transform-title").textContent = label;
    $("transform-preview").value = NronText.transform(op, text());
    open("transform-modal");
  }
  function insert(value) {
    if (state.isSourceMode) {
      const el = DOM.sourceEditor;
      el.setRangeText(
        escapeText(value),
        el.selectionStart,
        el.selectionEnd,
        "end",
      );
      scheduleSave();
      scheduleStats();
    } else executeCommand("insertText", value);
  }
  function template(title, html) {
    return async () => {
      await createNewTab();
      DOM.visualEditor.innerHTML = html;
      DOM.sourceEditor.value = html;
      await renameTab(state.activeTabId, title);
      await saveCurrentTab();
      await updateStats();
    };
  }
  add("duplicate", "نسخه دوم از سند", "سند", async () => {
    await saveCurrentTab();
    const original = { ...activeTab() };
    await createNewTab();
    DOM.visualEditor.innerHTML = original.content;
    DOM.sourceEditor.value = original.content;
    await renameTab(state.activeTabId, original.title + " — کپی");
    await saveCurrentTab();
  });
  add("rename", "تغییر نام سند", "سند", async () => {
    const a = await askDialog("نام سند", [
      { label: "نام", value: activeTab().title },
    ]);
    if (a?.[0]) await renameTab(state.activeTabId, a[0]);
  });
  add("save-all", "ذخیره همه سندها", "سند", async () => {
    await saveCurrentTab();
    for (const t of state.tabs) await dbPut("tabs", t);
    toast("همه سندها ذخیره شدند");
  });
  add("date", "درج تاریخ محلی", "درج", () =>
    insert(new Date().toLocaleDateString("fa-IR")),
  );
  add("time", "درج ساعت", "درج", () =>
    insert(
      new Date().toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    ),
  );
  add("iso-date", "درج تاریخ میلادی", "درج", () =>
    insert(new Date().toISOString().slice(0, 10)),
  );
  add("divider", "درج جداکننده", "درج", () =>
    executeCommand("insertHTML", "<hr><p><br></p>"),
  );
  add("code-block", "درج بلوک کد", "درج", () =>
    executeCommand(
      "insertHTML",
      '<pre dir="ltr"><code>code</code></pre><p><br></p>',
    ),
  );
  add("checklist", "درج چک‌لیست ساده", "درج", () =>
    insert("☐ کار اول\n☐ کار دوم"),
  );
  add(
    "meeting",
    "قالب یادداشت جلسه",
    "قالب",
    template(
      "یادداشت جلسه",
      "<h1>یادداشت جلسه</h1><h2>موضوع و حاضران</h2><p><br></p><h2>تصمیم‌ها</h2><p><br></p><h2>قدم بعدی</h2><p><br></p>",
    ),
  );
  add(
    "journal",
    "قالب یادداشت روزانه",
    "قالب",
    template(
      "یادداشت روزانه",
      "<h1>امروز</h1><h2>چه گذشت؟</h2><p><br></p><h2>چه یاد گرفتم؟</h2><p><br></p><h2>فردا</h2><p><br></p>",
    ),
  );
  add(
    "brief",
    "قالب طرح نوشته",
    "قالب",
    template(
      "طرح نوشته",
      "<h1>عنوان نوشته</h1><h2>مخاطب</h2><p><br></p><h2>پیام اصلی</h2><p><br></p><h2>شواهد</h2><p><br></p><h2>پایان‌بندی</h2><p><br></p>",
    ),
  );
  add("zoom-in", "بزرگ‌تر کردن متن", "نمایش", () => font(1));
  add("zoom-out", "کوچک‌تر کردن متن", "نمایش", () => font(-1));
  add("zoom-reset", "بازنشانی اندازه متن", "نمایش", () => font(0));
  add("spellcheck", "تغییر بررسی املا", "نمایش", () => {
    DOM.visualEditor.spellcheck = !DOM.visualEditor.spellcheck;
    toast(
      DOM.visualEditor.spellcheck
        ? "بررسی املا فعال شد"
        : "بررسی املا خاموش شد",
    );
  });
  add("source-wrap", "تغییر شکستن سطر سورس", "نمایش", () => {
    DOM.sourceEditor.wrap = DOM.sourceEditor.wrap === "off" ? "soft" : "off";
    toast("نمایش سطرهای سورس تغییر کرد");
  });
  add("system-theme", "هماهنگی با رنگ سیستم", "نمایش", () =>
    document
      .querySelector(
        `[data-theme-val="${matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"}"]`,
      )
      .click(),
  );
  add("word-goal", "هدف روزانه کلمات", "نوشتن", async () => {
    const a = await askDialog("هدف سند؛ صفر برای حذف", [
      {
        label: "تعداد کلمه",
        type: "number",
        value: String(activeTab().goal || 500),
      },
    ]);
    if (!a) return;
    activeTab().goal = Math.min(100000, Math.max(0, Number(a[0]) || 0));
    await saveCurrentTab();
    await progress();
  });
  add("statistics", "گزارش کامل آمار", "نوشتن", async () => {
    const s = await NronCore.stats(text());
    $("stats-detail").textContent =
      `${toFa(s.words)} کلمه · ${toFa(s.chars)} نویسه · ${toFa(s.sentences)} جمله · ${toFa(s.paragraphs)} پاراگراف · ${toFa(s.reading_time_min)} دقیقه مطالعه`;
    open("stats-modal");
  });
  add("reading", "حالت فقط خواندن", "نمایش", () => {
    const locked = DOM.visualEditor.contentEditable === "false";
    DOM.visualEditor.contentEditable = String(locked);
    DOM.sourceEditor.readOnly = !locked;
    toast(locked ? "ویرایش فعال شد" : "فقط خواندن؛ از همین فرمان خارج شوید");
  });
  add("plugins", "مدیریت پلاگین‌ها", "تنظیمات", () => {
    renderPlugins();
    open("plugins-modal");
  });
  add("updates", "بررسی به‌روزرسانی GitHub", "تنظیمات", checkUpdates);
  add("shortcuts", "راهنمای میان‌برها", "راهنما", () => open("help-modal"));
  function font(delta) {
    const el = $("font-size");
    el.value = delta ? Math.max(14, Math.min(32, +el.value + delta)) : 18;
    el.dispatchEvent(new Event("input"));
  }
  function all() {
    return [
      ...commands,
      ...plugins
        .filter((p) => p.enabled !== false)
        .flatMap((p) =>
          p.commands.map((c) => ({
            id: p.id + ":" + c.id,
            label: c.label,
            group: p.name,
            run: () => preview(c.operation, c.label),
          })),
        ),
    ];
  }
  function renderCommands() {
    const query = $("command-query").value.toLocaleLowerCase();
    const list = $("command-list");
    list.replaceChildren();
    for (const c of all().filter((c) =>
      (c.label + " " + c.group + " " + c.id)
        .toLocaleLowerCase()
        .includes(query),
    )) {
      const b = document.createElement("button");
      b.className = "command-row";
      const title = document.createElement("span");
      title.textContent = c.label;
      const group = document.createElement("small");
      group.textContent = c.group;
      b.append(title, group);
      b.onclick = () => {
        close("commands-modal");
        Promise.resolve(c.run()).catch((e) =>
          toast(e.message || "خطا در فرمان"),
        );
      };
      list.append(b);
    }
    if (!list.children.length) list.textContent = "فرمانی پیدا نشد.";
  }
  function palette() {
    saveSelection();
    open("commands-modal");
    $("command-query").value = "";
    renderCommands();
    $("command-query").focus();
  }
  async function progress() {
    if (!DOM.wordCount) return;
    const goal = activeTab()?.goal;
    const words = (await NronCore.stats(text())).words;
    const el = $("goal-progress");
    el.hidden = !goal;
    if (goal) {
      el.textContent = `هدف ${toFa(Math.min(100, Math.floor((words / goal) * 100)))}٪ · ${toFa(goal)} کلمه`;
      el.title = `${words} / ${goal}`;
    }
  }
  function renderPlugins() {
    const list = $("plugin-list");
    list.replaceChildren();
    if (!plugins.length)
      list.textContent =
        "هنوز پلاگینی اضافه نکرده‌اید. نمونه آماده داخل پوشه plugins است.";
    for (const p of plugins) {
      const row = document.createElement("div");
      row.className = "plugin-row";
      const text = document.createElement("span");
      text.textContent = p.name + " · " + p.version;
      const toggle = document.createElement("button");
      toggle.className = "btn";
      toggle.textContent = p.enabled === false ? "فعال کردن" : "غیرفعال کردن";
      toggle.onclick = async () => {
        p.enabled = p.enabled === false;
        await storePlugins();
        renderPlugins();
      };
      const remove = document.createElement("button");
      remove.className = "btn";
      remove.textContent = "حذف";
      remove.onclick = async () => {
        plugins = plugins.filter((x) => x.id !== p.id);
        await storePlugins();
        renderPlugins();
      };
      row.append(text, toggle, remove);
      list.append(row);
    }
  }
  async function storePlugins() {
    await dbPut("settings", { key: "plugins-v1", value: plugins });
  }
  async function importPlugin(file) {
    if (!file || file.size > 65536)
      throw new Error("فایل پلاگین باید کمتر از ۶۴ کیلوبایت باشد");
    const p = JSON.parse(await file.text());
    if (!NronText.validPlugin(p))
      throw new Error("پلاگین معتبر نیست؛ اجرای کد و دسترسی سیستمی مجاز نیست");
    if (plugins.length >= 30 && !plugins.some((x) => x.id === p.id))
      throw new Error("حداکثر ۳۰ پلاگین");
    const approved = await askDialog(
      "افزودن «" + p.name + "»؛ فقط تبدیل متن سند. برای تأیید بنویسید بله",
      [{ label: "بله" }],
    );
    if (approved?.[0] !== "بله") return;
    plugins = plugins.filter((x) => x.id !== p.id);
    plugins.push({
      id: p.id,
      name: p.name,
      version: p.version,
      commands: p.commands,
      enabled: true,
    });
    await storePlugins();
    renderPlugins();
    open("plugins-modal");
  }
  async function checkUpdates() {
    open("updates-modal");
    $("update-status").textContent = "در حال بررسی انتشار رسمی…";
    $("update-link").hidden = true;
    $("update-install").hidden = true;
    try {
      const res = await fetch(
        "https://api.github.com/repos/amhasani2a/Nron-Editor/releases/latest",
        {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!res.ok)
        throw new Error(
          res.status === 404
            ? "هنوز انتشاری ثبت نشده است."
            : "دریافت نسخه ممکن نشد (" + res.status + ")",
        );
      const data = await res.json();
      if (!/^v?\d+\.\d+\.\d+$/.test(data.tag_name))
        throw new Error("شماره نسخه انتشار معتبر نیست");
      const newer = NronText.isNewer(data.tag_name, version);
      $("update-status").textContent = newer
        ? `نسخه ${data.tag_name} در دسترس است. نسخه فعلی ${version}.`
        : `نسخه نصب‌شده ${version} است؛ انتشار فعلی ${data.tag_name}.`;
      $("release-notes").textContent = String(data.body || "").slice(0, 12000);
      $("update-link").hidden = false;
      $("update-link").onclick = () =>
        openRelease(
          "https://github.com/amhasani2a/Nron-Editor/releases/latest",
        );
      if (newer && !/android/i.test(navigator.userAgent) && window.__TAURI__) {
        $("update-install").hidden = false;
      }
    } catch (e) {
      $("update-status").textContent =
        e.message || "اتصال برقرار نشد؛ بعداً دوباره تلاش کنید.";
    }
  }
  async function openRelease(url) {
    if (window.__TAURI__)
      await window.__TAURI__.core.invoke("open_release", { url });
    else window.open(url, "_blank", "noopener,noreferrer");
  }
  window.addEventListener("DOMContentLoaded", async () => {
    $("btn-commands").onclick = palette;
    $("command-query").oninput = renderCommands;
    $("command-query").onkeydown = (e) => {
      if (e.key === "ArrowDown") {
        $("command-list").querySelector("button")?.focus();
        e.preventDefault();
      }
      if (e.key === "Enter") $("command-list").querySelector("button")?.click();
    };
    $("transform-apply").onclick = async () => {
      if (!pendingTransform) return;
      await replace($("transform-preview").value, pendingTransform.label);
      close("transform-modal");
      toast("تبدیل انجام شد؛ نسخه قبلی در تاریخچه است");
    };
    $("plugin-import").onclick = () => $("plugin-file").click();
    $("plugin-file").onchange = (e) => {
      importPlugin(e.target.files[0]).catch((e) => toast(e.message));
      e.target.value = "";
    };
    $("btn-updates").onclick = checkUpdates;
    $("update-install").onclick = async () => {
      try {
        const update = await NronUpdate.check();
        if (!update) {
          toast("نسخه جدیدی برای نصب نیست");
          return;
        }
        const yes = await askDialog(
          "نصب نسخه امضاشده؛ سپس برنامه را دوباره باز کنید",
          [{ label: "برای نصب بنویسید بله" }],
        );
        if (yes?.[0] !== "بله") return;
        $("update-status").textContent = "در حال دریافت و بررسی امضا…";
        await update.downloadAndInstall();
        $("update-status").textContent =
          "نصب کامل شد؛ برنامه را ببندید و دوباره باز کنید.";
      } catch (e) {
        $("update-status").textContent =
          "نصب خودکار در این بیلد تنظیم نشده یا ناموفق بود؛ از صفحه انتشار فایل مناسب را بگیرید. " +
          String(e).slice(0, 160);
      }
    };
    $("btn-exit-focus").onclick = () => {
      if (state.zenMode) toggleZenMode();
    };
    document.addEventListener("keydown", (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "p"
      ) {
        e.preventDefault();
        palette();
      }
      if (e.key === "Escape") {
        document
          .querySelectorAll(".modal-overlay")
          .forEach((m) => m.classList.add("hidden"));
        if (state.zenMode) toggleZenMode();
      }
    });
    document.querySelectorAll(".modal-overlay").forEach((el) => {
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.addEventListener("click", (e) => {
        if (e.target === el) el.classList.add("hidden");
      });
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const focusable = [
          ...el.querySelectorAll("button,input,textarea,select,a[href]"),
        ].filter((n) => !n.hidden && n.offsetParent !== null);
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      });
    });
    await window.dbReady;
    const saved = await dbGet("settings", "plugins-v1");
    plugins = (saved?.value || []).filter(NronText.validPlugin).slice(0, 30);
    DOM.visualEditor.addEventListener("input", () => {
      clearTimeout(window.__goalTimer);
      window.__goalTimer = setTimeout(progress, 500);
    });
  });
  return { commands, palette, progress, importPlugin, version };
})();
