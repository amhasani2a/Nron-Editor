/**
 * Nron Editor - Workspace State Model
 * مدیریت تب‌ها و پنجره‌های موازی (Sliding Panes کنار هم به سبک Obsidian)
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'nron_workspace_state_v2';

  function generateId() {
    return 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  class WorkspaceModel {
    constructor() {
      this.panes = [];
      this.activePaneId = null;
      this.layoutMode = 'sliding'; // 'sliding' (کنار هم اسکرول افقی مثل ابسیدین) | 'split'
      this.listeners = new Set();
      this.load();
    }

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.panes) && parsed.panes.length > 0) {
            this.panes = parsed.panes;
            this.activePaneId = parsed.activePaneId || this.panes[0].id;
            this.layoutMode = parsed.layoutMode || 'sliding';
            return;
          }
        }
      } catch (err) {
        console.warn('[WorkspaceModel] خطا در بازیابی وضعیت:', err);
      }

      // وضعیت پیش‌فرض اولیه با یک سند
      const initialPane = this.createPaneObject({
        title: 'سند جدید',
        content: 'سند جدید'
      });
      this.panes = [initialPane];
      this.activePaneId = initialPane.id;
    }

    save() {
      try {
        const payload = {
          panes: this.panes,
          activePaneId: this.activePaneId,
          layoutMode: this.layoutMode,
          updatedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn('[WorkspaceModel] خطا در ذخیره‌سازی وضعیت:', err);
      }
    }

    subscribe(listener) {
      if (typeof listener === 'function') {
        this.listeners.add(listener);
      }
      return () => this.listeners.delete(listener);
    }

    notify(reason = 'update', meta = {}) {
      this.save();
      this.listeners.forEach((fn) => {
        try {
          fn(this.getState(), reason, meta);
        } catch (err) {
          console.error('[WorkspaceModel] خطا در اجرای شنونده:', err);
        }
      });
    }

    getState() {
      return {
        panes: [...this.panes],
        activePaneId: this.activePaneId,
        activePane: this.getActivePane(),
        layoutMode: this.layoutMode
      };
    }

    createPaneObject(data = {}) {
      const indexNumber = this.panes.length + 1;
      const defaultTitle = indexNumber === 1 ? 'سند جدید' : `سند جدید ${indexNumber}`;
      return {
        id: data.id || generateId(),
        articleId: data.articleId || null,
        title: data.title || defaultTitle,
        content: typeof data.content === 'string' ? data.content : (data.title || defaultTitle),
        createdAt: data.createdAt || Date.now(),
        updatedAt: Date.now()
      };
    }

    getActivePane() {
      return this.panes.find((p) => p.id === this.activePaneId) || this.panes[0] || null;
    }

    getPaneById(id) {
      return this.panes.find((p) => p.id === id) || null;
    }

    /**
     * افزودن سند جدید دقیقاً در کنار سند فعلی (و فعال‌سازی آن برای اسکرول افقی)
     */
    addPaneBesideActive(data = {}) {
      const newPane = this.createPaneObject(data);
      const currentIndex = this.panes.findIndex((p) => p.id === this.activePaneId);

      if (currentIndex === -1) {
        this.panes.push(newPane);
      } else {
        // درج بلافاصله در کنار پنجره فعلی
        this.panes.splice(currentIndex + 1, 0, newPane);
      }

      this.activePaneId = newPane.id;
      this.notify('pane-added', { pane: newPane, index: currentIndex + 1 });
      return newPane;
    }

    setActivePane(id, notifyReason = 'pane-activated') {
      if (!id || this.activePaneId === id) return;
      const target = this.getPaneById(id);
      if (!target) return;
      this.activePaneId = target.id;
      this.notify(notifyReason, { pane: target });
    }

    updatePane(id, patch = {}) {
      const pane = this.getPaneById(id);
      if (!pane) return null;

      if (typeof patch.title === 'string') {
        pane.title = patch.title.trim() || 'سند بی‌نام';
      }
      if (typeof patch.content === 'string') {
        pane.content = patch.content;
        // اگر عنوان جداگانه تغییر نکرده، خط اول متن به عنوان نام تب استفاده شود
        if (!patch.title) {
          const firstLine = patch.content
            .replace(/<[^>]*>/g, ' ')
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0);
          if (firstLine) {
            pane.title = firstLine.slice(0, 35);
          }
        }
      }
      pane.updatedAt = Date.now();
      this.save();
      this.notify('pane-updated', { pane });
      return pane;
    }

    closePane(id) {
      if (this.panes.length <= 1) {
        // اگر تنها یک تب باقی مانده، محتوای آن را ریست کن
        const onlyPane = this.panes[0];
        onlyPane.title = 'سند جدید';
        onlyPane.content = '';
        onlyPane.updatedAt = Date.now();
        this.notify('pane-reset', { pane: onlyPane });
        return onlyPane;
      }

      const idx = this.panes.findIndex((p) => p.id === id);
      if (idx === -1) return null;

      const [removed] = this.panes.splice(idx, 1);
      if (this.activePaneId === id) {
        const nextPane = this.panes[idx] || this.panes[idx - 1] || this.panes[0];
        this.activePaneId = nextPane ? nextPane.id : null;
      }

      this.notify('pane-closed', { removed, activePaneId: this.activePaneId });
      return removed;
    }
  }

  global.WorkspaceModel = WorkspaceModel;
  global.workspaceModel = global.workspaceModel || new WorkspaceModel();
})(window);
