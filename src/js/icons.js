/* Monochrome, resolution-independent controls. */
window.addEventListener("DOMContentLoaded", () => {
  const paths = {
    bold: "M7 3h6a5 5 0 0 1 0 9H7V3M7 12h7a5 5 0 0 1 0 9H7v-9",
    italic: "M10 3h10M4 21h10M16 3 8 21",
    underline: "M6 3v8a6 6 0 0 0 12 0V3M4 21h16",
    strike: "M17 5c-3-3-10-2-10 2 0 5 10 3 10 8 0 4-7 5-11 2M3 11h18",
    heading: "M3 4v16M13 4v16M3 12h10M17 14c0-4 5-4 5-1 0 2-5 4-5 7h5",
    ul: "M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1",
    ol: "M10 6h11M10 12h11M10 18h11M3 3h2v6M3 13c3-3 5 0 2 2l-2 3h4",
    undo: "M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14",
    redo: "M16 4 21 9l-5 5M21 9H11a7 7 0 0 0 0 14",
    plus: "M12 4v16M4 12h16",
    library: "M4 3v18M9 3v18M15 4l5 16M2 21h20",
    right: "M3 5h18M8 10h13M3 15h18M8 20h13",
    left: "M3 5h18M3 10h13M3 15h18M3 20h13",
    center: "M3 5h18M6 10h12M3 15h18M6 20h12",
    close: "M6 6l12 12M6 18 18 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    settings:
      "M9 3h6l1 4 4 1v6l-4 1-1 4H9l-1-4-4-1V8l4-1z M14 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    clean: "M4 20h16M5 16l9-12 5 4-9 12z",
    timer: "M9 2h6M12 6v6l3 2M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    focus: "M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6",
    theme: "M12 3a9 9 0 1 0 0 18V3z",
    import: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    link: "M9 8l2-2a5 5 0 0 1 7 7l-2 2M15 16l-2 2a5 5 0 0 1-7-7l2-2M8 16l8-8",
    image: "M3 3h18v18H3z M3 16l6-6 6 6 3-3 3 3M16 7h1",
    snapshot: "M4 6h4l2-3h4l2 3h4v14H4z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
    write: "M4 20l1-5L17 3l4 4L9 19z M14 6l4 4",
    history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2",
    book: "M12 5C9 3 5 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1v16",
    format: "M4 4h16M12 4v17M8 21h8",
    table: "M3 3h18v18H3z M3 9h18M3 15h18M9 3v18M15 3v18",
  };
  function svg(name) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", "20");
    s.setAttribute("height", "20");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.6");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(s.namespaceURI, "path");
    p.setAttribute("d", paths[name] || paths.write);
    s.append(p);
    return s;
  }
  for (const b of document.querySelectorAll("#kbd-bar button,.format-btn")) {
    const key = b.dataset.k || b.dataset.cmd;
    const name =
      {
        h2: "heading",
        clean: "clean",
        strikeThrough: "strike",
        insertUnorderedList: "ul",
        insertOrderedList: "ol",
        justifyRight: "right",
        justifyLeft: "left",
        justifyCenter: "center",
      }[key] || key;
    b.replaceChildren(svg(name));
    b.setAttribute("aria-label", b.title || key);
  }
  const ids = {
    "quick-new": "plus",
    "btn-new-tab": "plus",
    "btn-library": "library",
    "btn-menu": "menu",
    "btn-find": "search",
    "btn-gsearch": "search",
    "btn-cleanup": "clean",
    "btn-pomodoro": "timer",
    "btn-zen": "focus",
    "btn-theme": "theme",
    "btn-import": "import",
    "btn-settings": "settings",
    "btn-link": "link",
    "btn-image": "image",
    "btn-snapshot": "snapshot",
    "btn-clear-history": "trash",
    "btn-outline": "menu",
    "btn-table": "table",
  };
  for (const [id, name] of Object.entries(ids)) {
    const b = document.getElementById(id);
    if (b) {
      b.replaceChildren(svg(name));
      if (!b.getAttribute("aria-label"))
        b.setAttribute("aria-label", b.title || name);
    }
  }
  for (const b of document.querySelectorAll(
    ".icon-btn[data-close],#find-close",
  )) {
    b.replaceChildren(svg("close"));
    b.setAttribute("aria-label", "بستن");
  }
  for (const b of document.querySelectorAll(".m-action")) {
    const span = b.querySelector(".mi");
    if (span) {
      span.replaceChildren(
        svg(
          ids[b.dataset.proxy] ||
            {
              pdf: "book",
              docx: "write",
              epub: "book",
              html: "write",
              md: "import",
              txt: "write",
            }[b.dataset.export] ||
            "write",
        ),
      );
    }
  }
  for (const b of document.querySelectorAll(".bottom-nav button")) {
    const label = b.querySelector("span");
    b.replaceChildren(
      svg(
        {
          editor: "write",
          outline: "menu",
          history: "history",
          articles: "book",
          format: "format",
        }[b.dataset.nav],
      ),
      label,
    );
  }
});
