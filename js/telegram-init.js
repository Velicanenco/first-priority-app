/**
 * Telegram Mini App — boot + theme sync + haptics wrapper.
 * Safe to run in a plain browser tab (local preview) — everything no-ops
 * gracefully when window.Telegram.WebApp doesn't exist.
 */
(function () {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  window.__tg = tg;

  function syncTheme() {
    const p = tg?.themeParams || {};
    const root = document.documentElement.style;
    const set = (name, key, fallback) => root.setProperty(name, p[key] || fallback);
    set("--tg-bg", "bg_color", "#ffffff");
    set("--tg-text", "text_color", "#121212");
    set("--tg-hint", "hint_color", "#7a7a76");
    set("--tg-link", "link_color", "#a3242f");
    set("--tg-button", "button_color", "#121212");
    set("--tg-button-text", "button_text_color", "#ffffff");
    set("--tg-secondary-bg", "secondary_bg_color", "#f2f2ee");
    set("--tg-header-bg", "header_bg_color", p.bg_color || "#ffffff");
    set("--tg-section-bg", "section_bg_color", p.bg_color || "#ffffff");
    set("--tg-subtitle-text", "subtitle_text_color", p.hint_color || "#7a7a76");
    document.documentElement.dataset.colorScheme = tg?.colorScheme || "light";
  }

  function syncViewport() {
    if (!tg) return;
    document.documentElement.style.setProperty(
      "--tg-viewport-stable-height",
      `${tg.viewportStableHeight}px`
    );
  }

  function init() {
    if (!tg) {
      document.documentElement.dataset.colorScheme = "light";
      console.info("[first-priority-app] Running outside Telegram — using dev defaults.");
      return;
    }
    tg.ready();
    tg.expand();
    syncTheme();
    tg.onEvent("themeChanged", syncTheme);
    syncViewport();
    tg.onEvent("viewportChanged", syncViewport);
    try { tg.setHeaderColor && tg.setHeaderColor("secondary_bg_color"); } catch (e) {}
  }

  window.haptic = {
    impact(style = "light") { tg?.HapticFeedback?.impactOccurred(style); },
    notification(type = "success") { tg?.HapticFeedback?.notificationOccurred(type); },
    selection() { tg?.HapticFeedback?.selectionChanged(); },
  };

  window.wireUpPressFeedback = function (root = document) {
    root.querySelectorAll(".tg-press").forEach((el) => {
      if (el.dataset.tgHapticWired) return;
      el.dataset.tgHapticWired = "true";
      el.addEventListener("pointerdown", () => window.haptic.impact("light"));
    });
  };

  // Cloud-friendly local storage helper: uses Telegram CloudStorage when
  // available (real device persistence), falls back to an in-memory object
  // when running outside Telegram (e.g. quick browser preview).
  const memoryStore = {};
  window.tgStorage = {
    get(key) {
      return new Promise((resolve) => {
        if (tg?.CloudStorage?.getItem) {
          tg.CloudStorage.getItem(key, (err, value) => resolve(err ? null : value));
        } else {
          resolve(memoryStore[key] ?? null);
        }
      });
    },
    set(key, value) {
      return new Promise((resolve) => {
        if (tg?.CloudStorage?.setItem) {
          tg.CloudStorage.setItem(key, value, () => resolve(true));
        } else {
          memoryStore[key] = value;
          resolve(true);
        }
      });
    },
  };

  init();
})();
