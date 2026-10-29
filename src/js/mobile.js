window.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("bottom-nav");
  const sidebar = document.getElementById("sidebar");
  const sourcePanel = document.getElementById("source-panel");
  const toolbar = document.getElementById("toolbar");
  const moreSheet = document.getElementById("more-sheet");
  const backdrop = document.getElementById("sheet-backdrop");
  const btnMenu = document.getElementById("btn-menu");
  const fabNew = document.getElementById("fab-new");

  function closeAllSheets() {
    sidebar?.classList.remove("mobile-open");
    sourcePanel?.classList.remove("mobile-open");
    toolbar?.classList.remove("mobile-open");
    moreSheet?.classList.remove("open");
    backdrop?.classList.remove("show");
  }

  function setActiveNav(key) {
    if (!nav) return;
    nav.querySelectorAll("button[data-nav]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-nav") === key);
    });
  }

  function openSheet(panelEl, navKey) {
    if (typeof window.exitTypingImmediate === "function") {
      window.exitTypingImmediate(true);
    }
    const alreadyOpen =
      panelEl?.classList.contains("mobile-open") ||
      panelEl?.classList.contains("open");
    closeAllSheets();
    if (alreadyOpen && navKey !== "editor") {
      setActiveNav("editor");
      return;
    }
    if (panelEl === moreSheet) {
      moreSheet?.classList.add("open");
    } else if (panelEl) {
      panelEl.classList.add("mobile-open");
    }
    if (panelEl) backdrop?.classList.add("show");
    if (navKey) setActiveNav(navKey);
  }

  if (nav) {
    nav.querySelectorAll("button[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-nav");
        if (target === "editor") {
          closeAllSheets();
          setActiveNav("editor");
        } else if (target === "outline") {
          if (typeof switchSidebarPanel === "function")
            switchSidebarPanel("outline");
          window.renderOutline?.();
          openSheet(sidebar, "outline");
        } else if (target === "history") {
          if (typeof switchSidebarPanel === "function")
            switchSidebarPanel("history");
          window.renderHistory?.();
          openSheet(sidebar, "history");
        } else if (target === "articles") {
          openSheet(sourcePanel, "articles");
        } else if (target === "format") {
          openSheet(toolbar, "format");
        }
      });
    });
  }

  if (btnMenu) {
    btnMenu.addEventListener("click", () => {
      openSheet(moreSheet, null);
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => {
      closeAllSheets();
      setActiveNav("editor");
    });
  }

  if (fabNew) {
    fabNew.addEventListener("click", () => {
      closeAllSheets();
      setActiveNav("editor");
      if (typeof createNewTab === "function") createNewTab();
    });
  }

  if (moreSheet) {
    moreSheet.querySelectorAll("[data-proxy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-proxy");
        closeAllSheets();
        setActiveNav("editor");
        document.getElementById(id)?.click();
      });
    });
    moreSheet.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeAllSheets();
        setActiveNav("editor");
      });
    });
  }

  if (toolbar) {
    toolbar.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (window.innerWidth <= 860) {
          closeAllSheets();
          setActiveNav("editor");
        }
      });
    });
  }

  window.closeMobileSheets = () => {
    closeAllSheets();
    setActiveNav("editor");
  };
});
