window.NronWorkspaceModel = (() => {
  const looks = [
    { id: "paper", name: "کاغذ آرام" },
    { id: "ink", name: "مرکب" },
    { id: "mist", name: "مه صبحگاهی" },
    { id: "forest", name: "جنگل" },
    { id: "sepia", name: "سپیا" },
    { id: "midnight", name: "نیمه‌شب" },
  ];

  const templates = [
    {
      id: "blank-note",
      name: "یادداشت آزاد",
      category: "عمومی",
      content: "<h1>یادداشت آزاد</h1><p>ایده یا متن خود را بنویسید…</p>",
    },
    {
      id: "daily-journal",
      name: "روزنوشت",
      category: "روزانه",
      content:
        "<h1>روزنوشت</h1><h2>مهم‌ترین کارهای امروز</h2><ul><li></li></ul><h2>یادداشت‌ها</h2><p></p>",
    },
    {
      id: "meeting-notes",
      name: "صورت‌جلسه",
      category: "کاری",
      content:
        "<h1>یادداشت جلسه</h1><p><b>حاضران:</b> </p><h2>موضوعات مطرح‌شده</h2><ul><li></li></ul><h2>تصمیم‌ها و پیگیری</h2><ul><li></li></ul>",
    },
    {
      id: "article-draft",
      name: "پیش‌نویس مقاله",
      category: "پژوهش",
      content:
        "<h1>عنوان مقاله</h1><h2>چکیده</h2><p></p><h2>مقدمه</h2><p></p><h2>بدنه اصلی</h2><p></p><h2>نتیجه‌گیری</h2><p></p>",
    },
    {
      id: "book-chapter",
      name: "فصل کتاب",
      category: "داستان و کتاب",
      content:
        "<h1>فصل اول: عنوان فصل</h1><blockquote>نقل‌قول یا مدخل فصل…</blockquote><p></p>",
    },
    {
      id: "story-scene",
      name: "پرده داستان",
      category: "داستان و کتاب",
      content:
        "<h1>پرده جدید</h1><p><b>مکان و زمان:</b> </p><p><b>شخصیت‌ها:</b> </p><h2>روایت</h2><p></p>",
    },
    {
      id: "research-card",
      name: "فیش پژوهشی",
      category: "پژوهش",
      content:
        "<h1>فیش پژوهشی</h1><p><b>منبع:</b> </p><h2>نقل‌قول یا خلاصه</h2><blockquote></blockquote><h2>برداشت شخصی</h2><p></p>",
    },
    {
      id: "project-plan",
      name: "طرح پروژه",
      category: "کاری",
      content:
        "<h1>طرح پروژه</h1><h2>هدف</h2><p></p><h2>مراحل اجرا</h2><ol><li></li></ol><h2>ریسک‌ها و وابستگی‌ها</h2><p></p>",
    },
    {
      id: "weekly-review",
      name: "مرور هفتگی",
      category: "روزانه",
      content:
        "<h1>مرور هفتگی</h1><h2>دستاوردهای هفته</h2><ul><li></li></ul><h2>چالش‌ها</h2><ul><li></li></ul><h2>برنامه هفته آینده</h2><ul><li></li></ul>",
    },
    {
      id: "lecture-notes",
      name: "جزوه کلاس و سخنرانی",
      category: "پژوهش",
      content:
        "<h1>یادداشت درس</h1><p><b>استاد / سخنران:</b> </p><h2>نکات کلیدی</h2><ul><li></li></ul><h2>پرسش‌ها و مرور</h2><p></p>",
    },
    {
      id: "letter-formal",
      name: "نامه رسمی",
      category: "کاری",
      content:
        "<h1>موضوع: </h1><p>با سلام و احترام،</p><p></p><p>با سپاس</p>",
    },
    {
      id: "checklist-doc",
      name: "چک‌لیست اقدام",
      category: "عمومی",
      content:
        "<h1>فهرست کارها</h1><ul><li>[ ] مورد اول</li><li>[ ] مورد دوم</li></ul>",
    },
  ];

  function stamp(tab) {
    return Number(tab?.createdAt) || Number(tab?.id) || 0;
  }

  function newest(tabs = []) {
    const active = (Array.isArray(tabs) ? tabs : []).filter(
      (t) => t && !t.archived,
    );
    if (!active.length) return null;
    return active.slice().sort((a, b) => stamp(b) - stamp(a))[0];
  }

  function history(items = [], maxCount = 40, maxBytes = 2 * 1024 * 1024) {
    if (!Array.isArray(items) || !items.length) return [];
    const list = items.slice(-maxCount);
    const out = [];
    let used = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i];
      if (!entry || typeof entry.content !== "string") continue;
      const bytes = entry.content.length * 2;
      if (out.length > 0 && used + bytes > maxBytes) break;
      out.unshift(entry);
      used += bytes;
    }
    return out;
  }

  function validTemplate(t) {
    return Boolean(
      t &&
        typeof t === "object" &&
        typeof t.name === "string" &&
        t.name.trim().length > 0 &&
        t.name.length <= 120 &&
        typeof t.content === "string" &&
        t.content.length > 0 &&
        t.content.length <= 100000,
    );
  }

  function collections(tabs = []) {
    const set = new Set();
    for (const t of Array.isArray(tabs) ? tabs : []) {
      const c = typeof t?.collection === "string" ? t.collection.trim() : "";
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fa"));
  }

  function filter(
    tabs = [],
    {
      query = "",
      status = "active",
      collection = "",
      sort = "created",
      limit = 40,
    } = {},
  ) {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    const col = String(collection || "").trim();
    const filtered = (Array.isArray(tabs) ? tabs : []).filter((t) => {
      if (!t) return false;
      if (status === "active" && t.archived) return false;
      if (status === "archived" && !t.archived) return false;
      if (col && (t.collection || "").trim() !== col) return false;
      if (q) {
        const title = String(t.title || "").toLowerCase();
        const tag = String(t.collection || "").toLowerCase();
        if (!title.includes(q) && !tag.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === "name") {
        return String(a.title || "").localeCompare(String(b.title || ""), "fa");
      }
      if (sort === "edited") {
        return (
          (Number(b.updatedAt) || stamp(b)) - (Number(a.updatedAt) || stamp(a))
        );
      }
      return stamp(b) - stamp(a);
    });

    return {
      total: filtered.length,
      items: filtered.slice(0, Math.max(1, Number(limit) || 40)),
    };
  }

  function clampTimer(cfg = {}) {
    const work = Math.max(1, Math.min(180, Math.round(Number(cfg.work) || 25)));
    const rest = Math.max(1, Math.min(180, Math.round(Number(cfg.break) || 5)));
    return { work, break: rest };
  }

  return {
    looks,
    templates,
    newest,
    history,
    validTemplate,
    collections,
    filter,
    clampTimer,
  };
})();
