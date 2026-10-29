/* All HTML trust boundaries live here. No remote script or plugin code runs. */
window.NronSafety = {
  html(value) {
    const safe = DOMPurify.sanitize(String(value || ""), {
      USE_PROFILES: { html: true },
      FORBID_TAGS: [
        "style",
        "form",
        "input",
        "button",
        "video",
        "audio",
        "iframe",
        "object",
        "embed",
      ],
      FORBID_ATTR: [
        "id",
        "name",
        "srcset",
        "contenteditable",
        "tabindex",
        "autofocus",
        "accesskey",
      ],
      ALLOW_DATA_ATTR: false,
    });
    const root = document.createElement("div");
    root.innerHTML = safe;
    root
      .querySelectorAll("mark.find-hit,mark.find-current")
      .forEach((m) => m.replaceWith(...m.childNodes));
    root
      .querySelectorAll("[class]")
      .forEach((el) => el.removeAttribute("class"));
    root.querySelectorAll("[style]").forEach((el) => {
      const allow = [
        "font-weight",
        "font-style",
        "text-decoration",
        "text-align",
        "direction",
        "font-family",
        "color",
        "background-color",
      ];
      for (const name of Array.from(el.style))
        if (!allow.includes(name)) el.style.removeProperty(name);
    });
    root
      .querySelectorAll("a")
      .forEach((a) => a.setAttribute("rel", "noopener noreferrer"));
    return root.innerHTML;
  },
  url(value) {
    try {
      return ["https:", "http:", "mailto:", "tel:"].includes(
        new URL(value).protocol,
      );
    } catch {
      return false;
    }
  },
  text(html) {
    const d = document.createElement("div");
    d.innerHTML = this.html(html);
    d.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
    d.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr").forEach(
      (el) => el.append("\n"),
    );
    return d.textContent || "";
  },
  id() {
    return Date.now() + "-" + crypto.randomUUID();
  },
};
window.addEventListener("unhandledrejection", (e) => {
  console.error(e.reason);
  const s = document.getElementById("status-msg");
  if (s) s.textContent = "ذخیره یا عملیات انجام نشد؛ دوباره تلاش کنید";
  if (typeof toast === "function")
    toast("عملیات کامل نشد؛ داده‌ها را پشتیبان بگیرید.");
});
