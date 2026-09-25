/**
 * Inline SVG icon set for the First Priority FISH app.
 * Line icons (24x24, stroke=currentColor) for UI chrome/navigation.
 * Bold filled glyphs for the FISH week markers, redrawn from the
 * source deck's compass/arrow iconography.
 */
const ICONS = {
  // ---- FISH ichthys outline ----
  fish: `<svg viewBox="0 0 48 24" fill="none" class="week-icon-glyph"><path d="M2 12C10 2 26 2 34 12C26 22 10 22 2 12Z" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round"/><path d="M34 12L46 5M34 12L46 19" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="11" r="1.6" fill="currentColor"/></svg>`,

  fishSmall: `<svg viewBox="0 0 48 24" fill="none"><path d="M2 12C10 2 26 2 34 12C26 22 10 22 2 12Z" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round"/><path d="M34 12L46 5M34 12L46 19" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ---- Week glyphs (bold filled, redrawn from the deck) ----
  weekFocus: `<svg viewBox="0 0 48 48" fill="currentColor"><g>
    <path d="M24 2 L29 15 L24 12 L19 15 Z"/>
    <path d="M24 46 L29 33 L24 36 L19 33 Z"/>
    <path d="M2 24 L15 19 L12 24 L15 29 Z"/>
    <path d="M46 24 L33 19 L36 24 L33 29 Z"/>
    <path d="M9 9 L20 16 L15 16 L18 21 Z"/>
    <path d="M39 39 L28 32 L33 32 L30 27 Z"/>
    <path d="M39 9 L28 16 L33 16 L30 21 Z"/>
    <path d="M9 39 L20 32 L15 32 L18 27 Z"/>
    <circle cx="24" cy="24" r="3.2"/>
  </g></svg>`,

  weekInspire: `<svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 3 L38 19 H29 V45 H19 V19 H10 Z"/></svg>`,

  weekShare: `<svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 45 L10 29 H19 V3 H29 V29 H38 Z"/></svg>`,

  weekHook: `<svg viewBox="0 0 48 48" fill="currentColor"><g>
    <path d="M24 2 L31 12 H26 V21 H17 V12 H12 Z"/>
    <path d="M24 46 L31 36 H26 V27 H17 V36 H12 Z"/>
    <path d="M2 24 L12 17 V22 H21 V26 H12 V31 Z"/>
    <path d="M46 24 L36 17 V22 H27 V26 H36 V31 Z"/>
  </g></svg>`,

  // small decorative diamond triad used on week cards
  diamonds: `<svg viewBox="0 0 60 18" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" transform="rotate(45 8 8)" fill="currentColor"/><rect x="23" y="1" width="14" height="14" rx="2" transform="rotate(45 30 8)" stroke="currentColor" stroke-width="2"/><rect x="45" y="1" width="14" height="14" rx="2" transform="rotate(45 52 8)" stroke="currentColor" stroke-width="2"/></svg>`,

  // ---- Navigation ----
  navHome: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 20v-5h4v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  navFish: `<svg viewBox="0 0 24 24" fill="none"><path d="M2 12C6 6.5 15 6.5 19 12C15 17.5 6 17.5 2 12Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M19 12L22.5 9M19 12L22.5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.4" cy="11.2" r="1" fill="currentColor"/></svg>`,

  navTeam: `<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="2"/><path d="M2.8 20c.6-3.6 3.2-5.6 6.2-5.6s5.6 2 6.2 5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15.5 5.2c1.6.4 2.7 1.8 2.7 3.4 0 1.5-1 2.9-2.5 3.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.2 14.6c2.5.5 4.3 2.4 4.8 5.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,

  navFive: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 4h9l-1 5.4c-.7-.3-1.5-.5-2.4-.5-3 0-5.3 2.1-5.3 5.1s2.4 5.3 5.4 5.3c2.6 0 4.7-1.6 5.2-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ---- UI chrome ----
  close: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  externalOpen: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  praying: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2v6M12 8c-1 0-1.6.8-1.6 1.8V15M12 8c1 0 1.6.8 1.6 1.8V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 21c0-3 1.8-5 4-5s4 2 4 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5c.6 2.3-.5 3.7-1.8 5.1C8.7 9 7 10.8 7 13.5a5 5 0 0 0 10 0c0-1.4-.5-2.4-1.1-3.3-.2 1.3-.9 2-1.6 2-.9 0-1.4-.8-1.1-1.8.5-1.9-.2-3.6-1.2-4.9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  invite: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H8l-4 3.5V6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M17 8h3M19 6v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.2c0-.8.7-1.4 1.6-1.2 2 .4 4.6 1.4 6.4 2.9 1.8-1.5 4.4-2.5 6.4-2.9.9-.2 1.6.4 1.6 1.2v13c0 .7-.5 1.2-1.1 1.3-2.1.4-4.9 1.4-6.9 3-2-1.6-4.8-2.6-6.9-3-.6-.1-1.1-.6-1.1-1.3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 6.9V19" stroke="currentColor" stroke-width="1.8"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.2s-7.6-4.6-9.6-9.3C1.2 7.6 3 4.6 6.2 4.2c2-.3 3.7.7 5.8 3 2.1-2.3 3.8-3.3 5.8-3 3.2.4 5 3.4 3.8 6.7C19.6 15.6 12 20.2 12 20.2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  megaphone: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5L6 9H4a1 1 0 0 0-1 1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9.5c1 .6 1.6 1.5 1.6 2.5s-.6 1.9-1.6 2.5M19.6 7c1.7 1 2.9 2.8 2.9 5s-1.2 4-2.9 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  compass2: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M15 9l-2 6-6 2 2-6 6-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none"><circle cx="8.5" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="16.5" cy="9.5" r="2.4" stroke="currentColor" stroke-width="1.8"/><path d="M2.7 19.5c.6-3.3 2.9-5.1 5.8-5.1s5.2 1.8 5.8 5.1M14.8 15c2.3.3 4 1.9 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5l2.5 5.4 5.9.7-4.4 4 1.2 5.9L12 16.6l-5.2 2.9 1.2-5.9-4.4-4 5.9-.7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>`,
  hands: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 13l3.5-3.5a1.5 1.5 0 0 1 2.1 0l3.9 3.9M21 13l-3.5-3.5a1.5 1.5 0 0 0-2.1 0l-3.9 3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 12.5 10 16a2 2 0 0 0 2.8 0l.2-.2M17.5 12.5 14 16a2 2 0 0 1-2.8 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  church: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2v3M10.5 3.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 5l7 6v10H5V11Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 21v-5a2 2 0 0 1 4 0v5" stroke="currentColor" stroke-width="1.8"/></svg>`,
  handshake: `<svg viewBox="0 0 24 24" fill="none"><path d="M2 11l4-3 4 2 3-2 3 1.5L20 7l2 3-4.5 5-3-1.5-3 2-4-2-3 1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  arrowUpRight: `<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// Helper: attach a fill/stroke color context via a wrapping span (used inline in templates).
function icon(name, cls = "") {
  return `<span class="icon ${cls}" aria-hidden="true">${ICONS[name] || ""}</span>`;
}
