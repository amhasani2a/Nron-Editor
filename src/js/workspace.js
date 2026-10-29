/**
 * Nron Editor - Workspace Controller (Obsidian Sliding Panes & Horizontal Tabs)
 * مدیریت رندر هم‌زمان پنجره‌ها در کنار هم، اسکرول افقی نرم و همگام‌سازی تب‌ها
 */

(function (global) {
  'use strict';

  const model = global.workspaceModel || new global.WorkspaceModel();

  const SELECTORS = {
    newDocButtons: [
      '#new-tab-btn',
      '#btn-new-tab',
      '#new-doc-btn',
      '#btn-new-doc',
      '#add-tab-btn',
      '[data-action="new-tab"]',
      '[data-action="new-doc"]',
      '[data-action="new-article"]',
      '.new-tab-btn',
      '.btn-new-doc'
    ],
    splitButtons: [
      '#split-btn',
      '#btn-split',
      '#toggle-split-btn',
      '[data-action="split"]',
      '[data-action="toggle-split"]',
      '.split-btn'
    ],
    tabsContainer: [
      '#workspace-tabs',
      '.workspace-tabs',
      '#tab-bar',
      '.tab-bar',
      '.tabs-container'
    ],
    panesContainer: [
      '#workspace-panes',
      '.workspace-panes',
      '#panes-container',
      '.panes-container',
      '#editor-container',
      '.editor-Workspace'
    ]
  };

  function findFirstElement(selectorList) {
    for (const sel of selectorList) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  class WorkspaceController {
    constructor(workspaceModel) {
      this.model = workspaceModel;
      this.tabsEl = null;
      this.panesEl = null;
      this.isProgrammaticScroll = false;
      this.scrollSyncTimer = null;
    }

    init() {
      this.ensureDOMStructure();
      this.bindHeaderActions();
      this.bindScrollSync();

      this.model.subscribe((state, reason, meta) => {
        if (reason === 'pane-updated') {
          this.updateTabTitlesOnly(state);
          return;
        }
        this.render(state, reason, meta);
      });

      this.render(this.model.getState(), 'init');
    }

    /**
     * اطمینان از وجود کانتینر افقی تب‌ها و کانتینر افقی پنجره‌ها در DOM
     */
    ensureDOMStructure() {
      this.tabsEl = findFirstElement(SELECTORS.tabsContainer);
      this.panesEl = findFirstElement(SELECTORS.panesContainer);

      // اگر کانتینر پنجره‌ها وجود نداشت، از روی ادیتور فعلی صفحه آن را به کانتینر افقی تبدیل کن
      if (!this.panesEl) {
        const existingEditor =
          document.querySelector('#editor') ||
          document.querySelector('.editor-content') ||
          document.querySelector('[contenteditable="true"]');

        if (existingEditor && existingEditor.parentElement) {
          const wrapper = document.createElement('div');
          wrapper.id = 'workspace-panes';
          wrapper.className = 'workspace-panes';
          existingEditor.parentElement.insertBefore(wrapper, existingEditor);
          existingEditor.style.display = 'none'; // مخفی‌سازی ادیتور تکی قدیمی
          this.panesEl = wrapper;
        }
      }

      if (this.panesEl) {
        this.panesEl.classList.add('workspace-panes');
      }
      if (this.tabsEl) {
        this.tabsEl.classList.add('workspace-tabs');
      }
    }

    /**
     * اتصال دکمه "+" (متن جدید) و دکمه Split در هدر بالا
     */
    bindHeaderActions() {
      // پیدا کردن تمام دکمه‌های + در هدر
      const explicitButtons = document.querySelectorAll(SELECTORS.newDocButtons.join(','));
      explicitButtons.forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openNewDocumentBesideCurrent();
        };
      });

      // تشخیص هوشمند دکمه "+" در صورتی که کلاس یا آیدی متفاوتی داشته باشد
      document.addEventListener(
        'click',
        (e) => {
          const btn = e.target.closest('button, [role="button"], .icon-btn, .toolbar-btn');
          if (!btn) return;

          // اگر داخل نوار تب یا منوی فرمتینگ است نادیده بگیر
          if (btn.closest('.workspace-tabs, .mobile-format-bar, .typing-toolbar')) return;

          const text = (btn.textContent || '').trim();
          const aria = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').trim();
          const isPlusBtn =
            text === '+' ||
            text === '＋' ||
            aria.includes('جدید') ||
            aria.toLowerCase().includes('new') ||
            btn.matches(SELECTORS.newDocButtons.join(','));

          if (isPlusBtn) {
            e.preventDefault();
            e.stopPropagation();
            this.openNewDocumentBesideCurrent();
          }
        },
        true
      );

      // اتصال دکمه Split (دو ستونه / کنار هم)
      const splitButtons = document.querySelectorAll(SELECTORS.splitButtons.join(','));
      splitButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openNewDocumentBesideCurrent();
        });
      });
    }

    /**
     * ایجاد متن جدید در کنار متن فعلی و اسکرول افقی نرم به سمت آن
     */
    openNewDocumentBesideCurrent(initialData = {}) {
      const newPane = this.model.addPaneBesideActive(initialData);
      requestAnimationFrame(() => {
        this.scrollToPane(newPane.id, true);
      });
      return newPane;
    }

    /**
     * همگام‌سازی اسکرول افقی پنجره‌ها با تب فعال در بالا (مشابه Obsidian Sliding Panes)
     */
    bindScrollSync() {
      if (!this.panesEl) return;

      this.panesEl.addEventListener(
        'scroll',
        () => {
          if (this.isProgrammaticScroll) return;
          clearTimeout(this.scrollSyncTimer);
          this.scrollSyncTimer = setTimeout(() => {
            this.detectCenteredPaneAndActivate();
          }, 80);
        },
        { passive: true }
      );
    }

    detectCenteredPaneAndActivate() {
      if (!this.panesEl) return;
      const containerRect = this.panesEl.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      let closestPaneId = null;
      let minDistance = Infinity;

      const paneNodes = this.panesEl.querySelectorAll('.workspace-pane');
      paneNodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        const paneCenter = rect.left + rect.width / 2;
        const dist = Math.abs(containerCenter - paneCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestPaneId = node.getAttribute('data-pane-id');
        }
      });

      if (closestPaneId && closestPaneId !== this.model.activePaneId) {
        this.model.setActivePane(closestPaneId, 'scroll-sync');
      }
    }

    /**
     * اسکرول افقی نرم به پنجره و تب موردنظر
     */
    scrollToPane(paneId, focusEditor = false) {
      if (!paneId) return;

      this.isProgrammaticScroll = true;

      if (this.tabsEl) {
        const tabNode = this.tabsEl.querySelector(`[data-tab-id="${paneId}"]`);
        if (tabNode) {
          tabNode.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      }

      if (this.panesEl) {
        const paneNode = this.panesEl.querySelector(`[data-pane-id="${paneId}"]`);
        if (paneNode) {
          paneNode.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });

          if (focusEditor) {
            const editorEl = paneNode.querySelector('.workspace-pane-editor');
            if (editorEl) {
              setTimeout(() => {
                editorEl.focus({ preventScroll: true });
              }, 220);
            }
          }
        }
      }

      setTimeout(() => {
        this.isProgrammaticScroll = false;
      }, 400);
    }

    updateTabTitlesOnly(state) {
      if (!this.tabsEl) return;
      state.panes.forEach((pane) => {
        const titleEl = this.tabsEl.querySelector(
          `[data-tab-id="${pane.id}"] .workspace-tab-title`
        );
        if (titleEl && titleEl.textContent !== pane.title) {
          titleEl.textContent = pane.title;
        }
      });
    }

    render(state, reason = 'update', meta = {}) {
      this.renderTabs(state);
      this.renderPanes(state, reason);

      if (reason === 'pane-added' || reason === 'pane-activated') {
        const targetId = (meta.pane && meta.pane.id) || state.activePaneId;
        requestAnimationFrame(() => {
          this.scrollToPane(targetId, false);
        });
      }
    }

    renderTabs(state) {
      if (!this.tabsEl) return;
      this.tabsEl.innerHTML = '';

      state.panes.forEach((pane) => {
        const isActive = pane.id === state.activePaneId;
        const tab = document.createElement('div');
        tab.className = 'workspace-tab tab-item' + (isActive ? ' active is-active' : '');
        tab.setAttribute('data-tab-id', pane.id);
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');

        const titleSpan = document.createElement('span');
        titleSpan.className = 'workspace-tab-title tab-title';
        titleSpan.textContent = pane.title || 'سند جدید';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'workspace-tab-close tab-close';
        closeBtn.setAttribute('aria-label', 'بستن تب');
        closeBtn.textContent = '−';

        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.model.closePane(pane.id);
        });

        tab.addEventListener('click', () => {
          this.model.setActivePane(pane.id, 'tab-clicked');
          this.scrollToPane(pane.id, false);
        });

        tab.appendChild(titleSpan);
        tab.appendChild(closeBtn);
        this.tabsEl.appendChild(tab);
      });
    }

    renderPanes(state, reason) {
      if (!this.panesEl) return;

      // افزودن کلاس چندپنجره‌ای برای فعال شدن نمای کارت‌های کنار هم (Obsidian Sliding Panes)
      this.panesEl.classList.toggle('has-multiple-panes', state.panes.length > 1);

      // اگر فقط تب عوض شده (با کلیک یا اسکرول)، DOM ادیتورها را بازسازی نکن تا فوکوس/اسکرول نپرد
      if (reason === 'pane-activated' || reason === 'scroll-sync') {
        const allPaneEls = this.panesEl.querySelectorAll('.workspace-pane');
        if (allPaneEls.length === state.panes.length) {
          allPaneEls.forEach((el) => {
            const id = el.getAttribute('data-pane-id');
            const active = id === state.activePaneId;
            el.classList.toggle('active', active);
            el.classList.toggle('is-active', active);
          });
          return;
        }
      }

      this.panesEl.innerHTML = '';

      state.panes.forEach((pane) => {
        const isActive = pane.id === state.activePaneId;

        const paneEl = document.createElement('section');
        paneEl.className = 'workspace-pane editor-pane' + (isActive ? ' active is-active' : '');
        paneEl.setAttribute('data-pane-id', pane.id);

        const editorEl = document.createElement('div');
        editorEl.className = 'workspace-pane-editor editor-surface';
        editorEl.setAttribute('contenteditable', 'true');
        editorEl.setAttribute('dir', 'auto');
        editorEl.setAttribute('data-placeholder', 'شروع به نوشتن کنید...');
        editorEl.innerHTML = pane.content || '';

        // فعال شدن پنجره با کلیک یا فوکوس روی آن
        paneEl.addEventListener('mousedown', () => {
          if (this.model.activePaneId !== pane.id) {
            this.model.setActivePane(pane.id, 'pane-clicked');
          }
        });

        editorEl.addEventListener('focus', () => {
          if (this.model.activePaneId !== pane.id) {
            this.model.setActivePane(pane.id, 'editor-focused');
          }
        });

        // ذخیره تغییرات متن و آپدیت عنوان تب
        editorEl.addEventListener('input', () => {
          this.model.updatePane(pane.id, {
            content: editorEl.innerHTML
          });
        });

        paneEl.appendChild(editorEl);
        this.panesEl.appendChild(paneEl);
      });
    }
  }

  const controller = new WorkspaceController(model);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => controller.init());
  } else {
    controller.init();
  }

  global.workspaceController = controller;
})(window);
