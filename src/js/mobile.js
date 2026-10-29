/**
 * Nron Editor - Mobile UX & Instant Toolbar/Footer Switcher
 * حل قطعی باگ باقی ماندن منوی دستورات تایپی پس از خروج از حالت تایپ در اندروید/موبایل
 */

(function (global) {
  'use strict';

  const FORMAT_BAR_SELECTORS = [
    '#mobile-format-bar',
    '.mobile-format-bar',
    '#typing-toolbar',
    '.typing-toolbar',
    '#format-toolbar',
    '.format-toolbar',
    '.editor-toolbar-bottom'
  ];

  const FOOTER_TABS_SELECTORS = [
    '#mobile-tab-bar',
    '.mobile-tab-bar',
    '#mobile-nav',
    '.mobile-nav',
    '#app-footer',
    '.app-footer',
    '.bottom-nav',
    'footer.mobile-footer'
  ];

  const EDITOR_SELECTORS = [
    '.workspace-pane-editor',
    '#editor',
    '.editor-surface',
    '.editor-content',
    '[contenteditable="true"]',
    'textarea.editor-input'
  ];

  class MobileInteractionManager {
    constructor() {
      this.isTyping = false;
      this.keyboardOpen = false;
      this.maxViewportHeight = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      this.formatBarEl = null;
      this.footerTabsEl = null;
    }

    init() {
      this.locateBars();
      this.protectFormatBarFocus();
      this.bindEditorFocusEvents();
      this.bindVisualViewportKeyboardDetector();
      this.bindOutsideTapAndBackExit();

      // در ابتدای اجرا، مطمئن شویم منوی تایپ مخفی و تب‌های فوتر نمایان هستند
      this.exitTypingModeImmediately(false);
    }

    locateBars() {
      for (const sel of FORMAT_BAR_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) {
          this.formatBarEl = el;
          break;
        }
      }

      for (const sel of FOOTER_TABS_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) {
          this.footerTabsEl = el;
          break;
        }
      }
    }

    isEditorElement(el) {
      if (!el || el.nodeType !== 1) return false;
      return el.matches(EDITOR_SELECTORS.join(',')) || !!el.closest(EDITOR_SELECTORS.join(','));
    }

    isFormatBarElement(el) {
      if (!el || el.nodeType !== 1) return false;
      if (this.formatBarEl && this.formatBarEl.contains(el)) return true;
      return !!el.closest(FORMAT_BAR_SELECTORS.join(','));
    }

    /**
     * جلوگیری از پریدن فوکوس ادیتور هنگام زدن دکمه‌های فرمت (B, I, U, H2 و...)
     * این کار باعث می‌شود نیازی به هیچ تاخیری (setTimeout) هنگام خروج از تایپ نباشد!
     */
    protectFormatBarFocus() {
      const preventFocusLoss = (e) => {
        const target = e.target;
        if (this.isFormatBarElement(target)) {
          const btn = target.closest('button, [role="button"], .format-btn, .tool-btn');
          if (btn) {
            // مانع از blur شدن ادیتور هنگام زدن دکمه‌های تایپی می‌شود
            e.preventDefault();
          }
        }
      };

      document.addEventListener('mousedown', preventFocusLoss, { passive: false });
      document.addEventListener('touchstart', preventFocusLoss, { passive: true });
    }

    /**
     * مدیریت ورود و خروج فوری از حالت تایپ
     */
    bindEditorFocusEvents() {
      document.addEventListener(
        'focusin',
        (e) => {
          if (this.isEditorElement(e.target)) {
            this.enterTypingMode();
          } else if (!this.isFormatBarElement(e.target)) {
            this.exitTypingModeImmediately(false);
          }
        },
        true
      );

      document.addEventListener(
        'focusout',
        (e) => {
          if (!this.isEditorElement(e.target)) return;

          // بررسی فوری در همان فریم: اگر فوکوس به منوی تایپی یا ادیتور دیگری نرفته، سریعا خارج شو
          const nextTarget = e.relatedTarget;
          if (nextTarget && (this.isFormatBarElement(nextTarget) || this.isEditorElement(nextTarget))) {
            return;
          }

          this.exitTypingModeImmediately(false);
        },
        true
      );
    }

    /**
     * تشخیص آنی بسته شدن کیبورد در اندروید/iOS (وقتی کاربر دکمه Back گوشی را می‌زند)
     */
    bindVisualViewportKeyboardDetector() {
      if (!window.visualViewport) return;

      const onViewportChange = () => {
        const vv = window.visualViewport;
        if (vv.height > this.maxViewportHeight) {
          this.maxViewportHeight = vv.height;
        }

        const heightDiff = this.maxViewportHeight - vv.height;
        const isNowOpen = heightDiff > 115; // کیبورد باز است اگر بیش از ۱۱۵ پیکسل از صفحه را گرفته باشد

        if (isNowOpen && !this.keyboardOpen) {
          this.keyboardOpen = true;
          document.documentElement.style.setProperty('--keyboard-inset-height', `${heightDiff}px`);
          if (this.isEditorElement(document.activeElement)) {
            this.enterTypingMode();
          }
        } else if (!isNowOpen && this.keyboardOpen) {
          // کیبورد بسته شد (مثلاً با دکمه Back اندروید)!
          // سریعا از حالت تایپ خارج شو، نشانگر تایپ را ببند و تب‌های فوتر را برگردان
          this.keyboardOpen = false;
          document.documentElement.style.setProperty('--keyboard-inset-height', '0px');
          this.exitTypingModeImmediately(true);
        }
      };

      window.visualViewport.addEventListener('resize', onViewportChange);
    }

    /**
     * خروج فوری با زدن دکمه Escape یا کلیک روی هدر/تب‌ها/فضای بیرون ادیتور
     */
    bindOutsideTapAndBackExit() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isTyping) {
          this.exitTypingModeImmediately(true);
        }
      });

      document.addEventListener(
        'pointerdown',
        (e) => {
          if (!this.isTyping) return;
          const target = e.target;
          if (this.isEditorElement(target) || this.isFormatBarElement(target)) {
            return;
          }
          // کاربر بیرون از ناحیه متن و بیرون از منوی تایپ زده است -> خروج فوری
          this.exitTypingModeImmediately(true);
        },
        true
      );
    }

    enterTypingMode() {
      this.locateBars();
      this.isTyping = true;

      document.body.classList.add('is-typing', 'keyboard-open');
      document.body.classList.remove('footer-tabs-active');

      if (this.formatBarEl) {
        this.formatBarEl.classList.add('active', 'is-visible');
        this.formatBarEl.removeAttribute('hidden');
        this.formatBarEl.style.display = 'flex';
      }

      if (this.footerTabsEl) {
        this.footerTabsEl.classList.add('is-hidden-by-typing');
        this.footerTabsEl.style.display = 'none';
      }
    }

    /**
     * خروج آنی (0ms) از حالت تایپ و بازگرداندن فوری دکمه‌های تب فوتر اپ
     * @param {boolean} forceBlurEditor آیا فوکوس و قطره کرسر ادیتور هم برداشته شود؟
     */
    exitTypingModeImmediately(forceBlurEditor = true) {
      this.locateBars();
      this.isTyping = false;

      if (forceBlurEditor) {
        const activeEl = document.activeElement;
        if (activeEl && this.isEditorElement(activeEl)) {
          activeEl.blur();
        }
        // پاک کردن قطره انتخابگر متن (Selection Handle) در اندروید
        try {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            sel.removeAllRanges();
          }
        } catch (_) {}
      }

      document.body.classList.remove('is-typing', 'keyboard-open');
      document.body.classList.add('footer-tabs-active');

      if (this.formatBarEl) {
        this.formatBarEl.classList.remove('active', 'is-visible');
        this.formatBarEl.setAttribute('hidden', 'hidden');
        this.formatBarEl.style.display = 'none';
      }

      if (this.footerTabsEl) {
        this.footerTabsEl.classList.remove('is-hidden-by-typing');
        this.footerTabsEl.removeAttribute('hidden');
        this.footerTabsEl.style.display = 'flex';
      }
    }
  }

  const mobileManager = new MobileInteractionManager();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mobileManager.init());
  } else {
    mobileManager.init();
  }

  global.mobileInteractionManager = mobileManager;
})(window);
