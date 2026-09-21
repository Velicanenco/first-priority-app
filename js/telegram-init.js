/**
 * Telegram Mini App — boot + theme sync + haptics wrapper.
 * Safe to run in a plain browser tab (local preview) — everything no-ops
 * gracefully when window.Telegram.WebApp doesn't exist.
 */
(function () {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  window.__tg = tg;

  // Real bug this fixes: these --tg-* variables are set as INLINE styles on
  // <html>, which always wins over the [data-color-scheme="dark"] rule in
  // style.css no matter how that selector's specificity compares -- inline
  // style beats any stylesheet selector short of !important. Not every
  // Telegram client sends every themeParams key on every launch (some omit
  // e.g. secondary_bg_color depending on client/version), and the fallback
  // used to be hardcoded to the LIGHT value regardless of colorScheme. So a
  // client on dark theme that simply didn't send one particular key would
  // get that one property permanently pinned to its light value -- while
  // colorScheme correctly said "dark" and every OTHER property flipped
  // correctly -- producing exactly the kind of "text is the same color as
  // its own background" invisible-content bug that CSS alone can't cause.
  // The fallback now matches whichever theme colorScheme actually reports,
  // mirroring the light/dark values already defined in style.css.
  function syncTheme() {
    const p = tg?.themeParams || {};
    const scheme = tg?.colorScheme || "light";
    const dark = scheme === "dark";
    const root = document.documentElement.style;
    const set = (name, key, lightFallback, darkFallback) =>
      root.setProperty(name, p[key] || (dark ? darkFallback : lightFallback));
    set("--tg-bg", "bg_color", "#ffffff", "#131313");
    set("--tg-text", "text_color", "#121212", "#f2f2ee");
    set("--tg-hint", "hint_color", "#7a7a76", "#8d8d88");
    set("--tg-link", "link_color", "#a3242f", "#a3242f");
    set("--tg-button", "button_color", "#121212", "#121212");
    set("--tg-button-text", "button_text_color", "#ffffff", "#ffffff");
    set("--tg-secondary-bg", "secondary_bg_color", "#f2f2ee", "#1e1e1c");
    set("--tg-header-bg", "header_bg_color", p.bg_color || "#ffffff", p.bg_color || "#131313");
    set("--tg-section-bg", "section_bg_color", p.bg_color || "#ffffff", p.bg_color || "#131313");
    set("--tg-subtitle-text", "subtitle_text_color", p.hint_color || "#7a7a76", p.hint_color || "#8d8d88");
    document.documentElement.dataset.colorScheme = scheme;
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
