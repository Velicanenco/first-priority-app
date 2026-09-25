/* ==========================================================================
   First Priority — FISH Mini App
   App logic: rendering, navigation (tabs + a real push/pop "back" stack),
   sheets, "My 5" tracker.
   ========================================================================== */

const state = {
  tab: "home",
  five: [],
  sheetMode: null, // 'week' | 'testimony'
  sheetWeek: null,
  navStack: [], // {type:'page', key} | {type:'sheet'} — mirrors browser history depth
  me: null, // backend profile: { telegram_id, first_name, username, role, country, group }
  meStatus: "idle", // idle | loading | loaded | no-telegram | error
  groups: [], // coordinator/admin: groups visible to them (GET /api/groups)
  lastCode: null, // most recently generated invite code, shown until the page re-renders past it
  stats: null, // coordinator/admin: GET /api/stats response
  statsStatus: "idle", // idle | loading | loaded | error
  fiveJustToggled: null, // {id, field} | null -- see renderFiveItem's "just-toggled" pop animation
  // Which group's drill-down is open in the "stats-group-detail" stack page,
  // and what GET /api/stats/group/:id has returned for it so far. Set right
  // before pushPage("stats-group-detail") -- see wireStatsGroupRows().
  statsGroupDetail: null, // { groupId, groupName, country } | null
  statsGroupDetailStatus: "idle", // idle | loading | loaded | error
  statsGroupDetailData: null,
  // Which country's clubs are open in the "stats-country-detail" stack page
  // (admin only, when there's more than one country to group by). No fetch
  // of its own -- it's a client-side filter over the already-loaded
  // state.stats.groups/byCountry, since the backend already rolls those up
  // in one GET /api/stats call.
  statsCountryDetail: null, // { country } | null
};

const el = {
  device: document.getElementById("device"),
  app: document.getElementById("app"),
  splash: document.getElementById("splash"),
  pages: {
    home: document.getElementById("page-home"),
    fish: document.getElementById("page-fish"),
    team: document.getElementById("page-team"),
    five: document.getElementById("page-five"),
  },
  tabbar: document.getElementById("tabbar"),
  tabBg: document.getElementById("tabBg"),
  langSwitch: document.getElementById("langSwitch"),
  stackRoot: document.getElementById("stackRoot"),
  sheetBackdrop: document.getElementById("sheetBackdrop"),
  sheet: document.getElementById("sheet"),
  sheetTitle: document.getElementById("sheetTitle"),
  sheetBody: document.getElementById("sheetBody"),
  sheetCloseBtn: document.getElementById("sheetCloseBtn"),
  toast: document.getElementById("toast"),
};

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ------------------------------------------------------------------ */
/* Navigation stack — real "back" behaviour                             */
/* Every pushed sub-page or opened sheet gets its own history entry.    */
/* Going back (hardware back, browser back, Telegram BackButton, the    */
/* on-screen ← arrow, or tapping the sheet's backdrop) always resolves  */
/* through history.back() → popstate, so there is exactly ONE code path*/
/* that closes things — it can never fall out of sync.                  */
/* ------------------------------------------------------------------ */

const stackRegistry = {}; // key -> { title: () => string, render: (container) => void }
function registerStackPage(key, title, render) {
  stackRegistry[key] = { title, render };
}

function goBack() {
  if (state.navStack.length === 0) return;
  history.back();
}

function pushPage(key) {
  const def = stackRegistry[key];
  if (!def) return;
  const node = document.createElement("div");
  node.className = "stack-page";
  node.dataset.key = key;
  node.innerHTML = `
    <div class="stack-head">
      <button class="stack-back tg-press" aria-label="${esc(t().common.back)}">${ICONS.chevronLeft}</button>
      <h2>${esc(def.title())}</h2>
    </div>
    <div class="stack-body"></div>
  `;
  def.render(node.querySelector(".stack-body"));
  el.stackRoot.appendChild(node);

  const pages = el.stackRoot.querySelectorAll(".stack-page");
  if (pages.length > 1) pages[pages.length - 2].classList.add("behind");
  requestAnimationFrame(() => node.classList.add("active"));

  node.querySelector(".stack-back").addEventListener("click", goBack);
  window.wireUpPressFeedback(node);

  state.navStack.push({ type: "page", key });
  history.pushState({ depth: state.navStack.length }, "", "#" + key);
  window.haptic.impact("light");
  window.sound?.open();
  updateBackButton();
}

function actuallyPopPage() {
  const pages = el.stackRoot.querySelectorAll(".stack-page");
  const top = pages[pages.length - 1];
  if (!top) return;
  top.classList.remove("active");
  if (pages.length > 1) pages[pages.length - 2].classList.remove("behind");
  window.setTimeout(() => top.remove(), 340);
  window.sound?.close();
}

function openSheetTracked() {
  el.sheetBackdrop.classList.add("open");
  requestAnimationFrame(() => el.sheet.classList.add("open"));
  window.haptic.impact("light");
  window.sound?.open();
  state.navStack.push({ type: "sheet" });
  history.pushState({ depth: state.navStack.length }, "", "#sheet");
  updateBackButton();
}
function actuallyCloseSheet() {
  el.sheet.classList.remove("open");
  el.sheetBackdrop.classList.remove("open");
  state.sheetMode = null;
  window.sound?.close();
}

function updateBackButton() {
  const tg = window.__tg;
  if (!tg?.BackButton) return;
  if (state.navStack.length > 0) tg.BackButton.show();
  else tg.BackButton.hide();
}

function handlePopState(e) {
  const targetDepth = e.state?.depth ?? 0;
  while (state.navStack.length > targetDepth) {
    const top = state.navStack.pop();
    if (top.type === "sheet") actuallyCloseSheet();
    else if (top.type === "page") actuallyPopPage();
    else if (top.type === "testimony") {
      // Un-nest one level: swap the sheet's content back to the week
      // detail it was opened from, instead of closing the whole sheet.
      state.sheetMode = "week";
      renderWeekSheetContent(top.week);
    }
  }
  updateBackButton();
}

/* ------------------------------------------------------------------ */
/* Language                                                            */
/* ------------------------------------------------------------------ */

function setLang(lang, { silent } = {}) {
  CURRENT_LANG = lang;
  localStorage_safe_set(lang);
  document.documentElement.lang = lang === "uk" ? "uk" : lang;
  el.langSwitch.querySelectorAll(".lang-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  renderAll();
  if (!silent) window.haptic.selection();
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                 */
/* ------------------------------------------------------------------ */

function switchTab(tab) {
  state.tab = tab;
  Object.entries(el.pages).forEach(([k, node]) => {
    node.classList.toggle("active", k === tab);
  });
  el.tabbar.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  if (el.tabBg) {
    el.tabBg.querySelectorAll(".tab-bg-icon").forEach((n) => {
      n.classList.toggle("active", n.dataset.bg === tab);
    });
  }
  if (el.pages[tab]) {
    // .hero-ribbon / .hero-title span / .hero-sub animate via a plain CSS
    // selector (not a toggled class, since they're always the same three
    // elements) -- included here so re-visiting a tab replays the whole
    // hero entrance together, the same way .fade-in already does.
    el.pages[tab].querySelectorAll(".fade-in, .hero-ribbon, .hero-title span, .hero-sub").forEach((n) => {
      n.style.animation = "none"; n.offsetHeight; n.style.animation = "";
    });
  }
  // html (documentElement) owns scrolling — see style.css for why .device
  // is a plain, non-scrolling wrapper.
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  window.haptic.selection();
}

/* ------------------------------------------------------------------ */
/* Nav bar (icons only rendered once; labels re-rendered on lang switch)*/
/* ------------------------------------------------------------------ */

// Faint, oversized brand-icon watermark behind each tab -- same glyph as
// that tab's own nav icon, so the mapping is obvious and free (no new
// icon-to-tab decision to make). Built once; switchTab() just toggles
// which one is .active. See #tabBg / .tab-bg-icon in style.css for the
// stacking-context trick that keeps this behind content but above the
// flat .device background.
function renderTabBg() {
  if (!el.tabBg) return;
  const layers = [
    ["home", ICONS.navHome],
    ["fish", ICONS.navFish],
    ["team", ICONS.navTeam],
    ["five", ICONS.navFive],
  ];
  el.tabBg.innerHTML = layers
    .map(([key, svg]) => `<div class="tab-bg-icon" data-bg="${key}">${svg}</div>`)
    .join("");
}

function renderNav() {
  const c = t().common.tabs;
  document.getElementById("navHomeBtn").innerHTML = `${ICONS.navHome}<span>${esc(c.home)}</span>`;
  document.getElementById("navFishBtn").innerHTML = `${ICONS.navFish}<span>FISH</span>`;
  document.getElementById("navTeamBtn").innerHTML = `${ICONS.navTeam}<span>${esc(c.team)}</span>`;
  document.getElementById("navFiveBtn").innerHTML = `${ICONS.navFive}<span>${esc(c.five)}</span>`;
  el.sheetCloseBtn.innerHTML = ICONS.close;
}

// Staggers a list/grid's children in with a small per-index delay (~40ms
// apart) instead of all appearing at once -- see the .stagger-item /
// fade-in-up keyframe in style.css. Called right after the parent's
// innerHTML is set, before any user interaction, so it only ever plays as
// a genuine entrance, never as a reaction to something the user did.
function staggerIn(root, selector, stepMs = 40) {
  root.querySelectorAll(selector).forEach((el, i) => {
    el.style.animationDelay = `${i * stepMs}ms`;
    el.classList.add("stagger-item");
  });
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Counts a number element up from 0 to its already-rendered target value.
// The DOM always has the correct final number even if this never runs
// (reduced motion, or a very old browser) -- this only ever overlays a
// temporary visual animation on top of markup that's already correct.
function animateCountUp(el, duration = 600) {
  const target = parseInt(el.textContent, 10);
  if (!Number.isFinite(target) || target <= 0 || prefersReducedMotion()) return;
  const start = performance.now();
  el.textContent = "0";
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Called once, right after the Statistics card first shows real numbers
// (see loadStats()) -- NOT on every re-render of the Team page, so
// reopening an accordion or creating a group elsewhere on the same page
// never replays it.
function animateStatTiles(root) {
  root.querySelectorAll(".stat-tile b, .stat-role-chip b").forEach((el) => animateCountUp(el));
}

function navRow({ icon, title, desc, key }) {
  return `
    <button class="nav-row tg-press" data-push="${key}">
      <div class="nav-row-icon">${icon}</div>
      <div class="nav-row-body"><h4>${esc(title)}</h4><p>${esc(desc)}</p></div>
      ${ICONS.chevronRight}
    </button>`;
}
function wirePushRows(root) {
  root.querySelectorAll("[data-push]").forEach((btn) => {
    btn.addEventListener("click", () => pushPage(btn.dataset.push));
  });
}

/* Accordion rows — tap a label, its text unfolds right there on the page
   (used for Vision/Mission/Strategy, Where we fish, Connect steps, and the
   team growth tips — content that's short enough not to deserve its own
   full pushed sub-page). */
function accordionItem({ title, text }) {
  return `
    <div class="accordion-item">
      <button class="accordion-head tg-press">
        <h4>${esc(title)}</h4>
        ${ICONS.chevronRight}
      </button>
      <div class="accordion-panel">
        <div class="accordion-panel-inner"><p>${esc(text)}</p></div>
      </div>
    </div>`;
}
function wireAccordions(root) {
  root.querySelectorAll(".accordion-item").forEach((item) => {
    const head = item.querySelector(".accordion-head");
    const panel = item.querySelector(".accordion-panel");
    head.addEventListener("click", () => {
      if (item.classList.contains("open")) {
        panel.style.maxHeight = panel.scrollHeight + "px";
        requestAnimationFrame(() => {
          item.classList.remove("open");
          panel.style.maxHeight = "0px";
        });
      } else {
        item.classList.add("open");
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
      window.haptic.selection();
    });
  });
}

/* ------------------------------------------------------------------ */
/* PAGE: HOME (short hub) + pushed sub-pages                            */
/* ------------------------------------------------------------------ */

// Home used to be one long scroll: full paragraphs for "about", a text
// block for "battle", and a whole accordion for "where we fish", all
// inline, one after another. Now each of those is one tap away as its own
// pushed page (see registerHomeSubpages below) -- Home itself is just the
// hero, the quote, a short list of what to explore, and the CTA.
function renderHome() {
  const d = t().home;
  el.pages.home.innerHTML = `
    <div class="hero fade-in">
      <img src="assets/img/hero-focus.jpg" alt="" />
      <div class="hero-inner">
        <span class="hero-ribbon">${esc(d.heroRibbon)}</span>
        <h1 class="display hero-title"><span>${esc(d.heroTitle)}</span></h1>
        <p class="hero-sub">${esc(d.heroSub)}</p>
      </div>
    </div>

    <div class="section fade-in">
      <div class="quote-card">
        <p>${esc(d.quote)}</p>
        <cite class="quote-attribution">— ${esc(d.quoteAuthor)}</cite>
      </div>
    </div>

    <div class="section fade-in">
      <p class="section-label">${esc(d.exploreLabel)}</p>
      <h2 class="display section-title">${esc(d.exploreTitle)}</h2>
      <div class="card" style="padding:0 var(--space-4)">
        ${navRow({ icon: ICONS.heart, title: d.aboutTitle, desc: d.aboutLabel, key: "home-about" })}
        ${navRow({ icon: ICONS.target, title: d.battleTitle, desc: d.battleLabel, key: "home-context" })}
        ${navRow({ icon: ICONS.hands, title: d.pillarsTitle, desc: d.pillarsLabel, key: "home-pillars" })}
        ${navRow({ icon: ICONS.church, title: d.whereTitle, desc: d.whereLabel, key: "home-where" })}
      </div>
    </div>

    <div class="section fade-in" style="padding-bottom:8px">
      <div class="quote-card tg-press" id="homeCta" style="cursor:pointer">
        <p style="font-size:17px">${esc(d.ctaTitle)}</p>
        <cite>${esc(d.ctaText)}</cite>
      </div>
    </div>
  `;
  document.getElementById("homeCta").addEventListener("click", () => switchTab("fish"));
  wirePushRows(el.pages.home);
  window.wireUpPressFeedback(el.pages.home);
  staggerIn(el.pages.home, ".nav-row");
}

function registerHomeSubpages() {
  registerStackPage("home-pillars", () => t().home.pillarsTitle, (body) => {
    const d = t().home;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <p class="section-text">${esc(d.pillarsTitle)}</p>
        <div class="pillar-grid">
          ${d.pillars.map((p, i) => `
            <div class="pillar">
              <div class="pillar-icon">${[ICONS.hands, ICONS.book, ICONS.praying, ICONS.handshake][i]}</div>
              <h4>${esc(p.title)}</h4>
              <p>${esc(p.text)}</p>
            </div>
          `).join("")}
        </div>
      </div>`;
    staggerIn(body, ".pillar");
  });

  // "About" -- moved here wholesale from the old inline Home section:
  // the intro paragraph plus the Vision/Mission/Strategy accordion.
  registerStackPage("home-about", () => t().home.aboutTitle, (body) => {
    const d = t().home;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <p class="section-text">${esc(d.aboutText)}</p>
        <div class="card accordion" style="padding:0 var(--space-4);margin-top:var(--space-3)">
          ${accordionItem({ title: d.visionLabel, text: d.visionText })}
          ${accordionItem({ title: d.missionLabel, text: d.missionText })}
          ${accordionItem({ title: d.strategyLabel, text: d.strategyText })}
        </div>
      </div>`;
    wireAccordions(body);
  });

  // "Context / battle" -- the scrolling belief-quote ribbon plus the
  // battle text, also moved here unchanged from the old inline section.
  registerStackPage("home-context", () => t().home.battleTitle, (body) => {
    const d = t().home;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <div class="ribbon-wrap"><div class="ribbon"><span>${esc(d.beliefQuote)}</span><span>${esc(d.beliefQuote)}</span></div></div>
        <p class="section-text">${esc(d.battleText)}</p>
      </div>`;
  });

  // "Where we fish" -- the Churches/Clubs/Schools accordion.
  registerStackPage("home-where", () => t().home.whereTitle, (body) => {
    const d = t().home;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <div class="card accordion" style="padding:0 var(--space-4)">
          ${d.where.map((w) => accordionItem({ title: w.title, text: w.text })).join("")}
        </div>
      </div>`;
    wireAccordions(body);
  });
}

/* ------------------------------------------------------------------ */
/* PAGE: FISH                                                           */
/* ------------------------------------------------------------------ */

const WEEK_ORDER = ["focus", "inspire", "share", "hook"];
const WEEK_ICON = { focus: "weekFocus", inspire: "weekInspire", share: "weekShare", hook: "weekHook" };
const WEEK_PHOTO = { focus: "hero-focus.jpg", inspire: "hero-inspire.jpg", share: "hero-share.jpg", hook: "hero-hook.jpg" };
const WEEK_DAYS = { focus: "1–7", inspire: "8–14", share: "15–21", hook: "22–28" };

function renderFish() {
  const d = t().fish;
  el.pages.fish.innerHTML = `
    <div class="hero fade-in">
      <img src="assets/img/hero-hook.jpg" alt="" />
      <div class="hero-inner">
        <span class="hero-ribbon">${esc(d.heroRibbon)}</span>
        <h1 class="display hero-title"><span>${esc(d.heroTitle)}</span></h1>
        <p class="hero-sub">${esc(d.heroSub)}</p>
      </div>
    </div>

    <div class="section fade-in">
      <div class="card" style="display:flex;align-items:center;gap:14px;color:var(--ink)">
        <div style="width:40px;flex:none">${ICONS.fish}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${d.acronym.map(a => `<span class="team-pill" style="background:var(--tg-secondary-bg);color:var(--ink)">${esc(a.l)} — ${esc(a.w)}</span>`).join("")}
        </div>
      </div>
    </div>

    <div class="section fade-in">
      <p class="section-label">${esc(d.cycleLabel)}</p>
      <h2 class="display section-title">${esc(d.cycleTitle)}</h2>
      <div class="cycle-strip">
        ${WEEK_ORDER.map(wk => `
          <div class="cycle-row" data-week="${wk}">
            <div class="cycle-icon">${ICONS[WEEK_ICON[wk]]}</div>
            <div class="cycle-days">${d.weeks[wk].name} · ${WEEK_DAYS[wk]}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="section fade-in" style="padding-top:0">
      <p class="section-label">${esc(d.weeksLabel)}</p>
      <h2 class="display section-title">${esc(d.weeksTitle)}</h2>
      <div class="week-grid">
        ${WEEK_ORDER.map(wk => renderWeekCard(wk, d.weeks[wk], d)).join("")}
      </div>
    </div>

    <div class="section fade-in">
      <div class="card" style="padding:0 var(--space-4)">
        ${navRow({ icon: ICONS.fish, title: d.symbolTitle, desc: d.symbolLabel, key: "fish-symbol" })}
        ${navRow({ icon: ICONS.handshake, title: d.connectTitle, desc: d.connectLabel, key: "fish-connect" })}
      </div>
    </div>

    <div class="section fade-in">
      <div class="five-card tg-press" id="fishFiveCta" style="cursor:pointer">
        <h2>${esc(d.fiveCardTitle)}</h2>
        <p>${esc(d.fiveCardText)}</p>
        <div style="margin-top:16px"><span class="btn" style="background:#fff;color:var(--slab-bg)">${esc(d.fiveCardBtn)} ${ICONS.arrowUpRight}</span></div>
      </div>
    </div>
  `;
  document.getElementById("fishFiveCta").addEventListener("click", () => switchTab("five"));

  el.pages.fish.querySelectorAll("[data-open-week]").forEach((btn) => {
    btn.addEventListener("click", () => openWeekSheet(btn.dataset.openWeek));
  });
  wirePushRows(el.pages.fish);
  window.wireUpPressFeedback(el.pages.fish);
  staggerIn(el.pages.fish, ".nav-row");
  staggerIn(el.pages.fish, ".cycle-row");
  staggerIn(el.pages.fish, ".week-card");
}

function renderWeekCard(wk, w, d) {
  return `
  <div class="week-card" data-week="${wk}">
    <div class="week-card-top">
      <div class="week-photo">
        <img src="assets/img/${WEEK_PHOTO[wk]}" alt="" />
        <div class="fish-badge">${ICONS.fish}</div>
      </div>
      <div class="week-card-head">
        <div class="week-num">${esc(w.num)}</div>
        <h3 class="display week-name">${esc(w.name)}</h3>
        <div class="week-dots"><span></span><span></span><span></span></div>
      </div>
    </div>
    <p class="week-desc">${esc(w.goal)}</p>
    <span class="week-team">${ICONS.fishSmall}${esc(w.team)}</span>
    <button class="week-open tg-press" data-open-week="${wk}">
      ${esc(d.openLabel)} ${ICONS.chevronRight}
    </button>
  </div>`;
}

function openWeekSheet(wk) {
  state.sheetMode = "week";
  renderWeekSheetContent(wk);
  openSheetTracked();
}

function renderWeekSheetContent(wk) {
  const d = t().fish;
  const w = d.weeks[wk];
  state.sheetWeek = wk;
  el.sheetTitle.textContent = w.name;
  const bandColorMap = { focus: "var(--focus)", inspire: "var(--inspire)", share: "var(--share)", hook: "var(--hook)" };
  const bandInkMap = { focus: "var(--focus-ink)", inspire: "var(--inspire-ink)", share: "#fff", hook: "var(--hook-ink)" };

  let extra = "";
  if (wk === "focus") {
    extra = `
      <h3 style="font-size:16px;margin:20px 0 4px">${esc(w.hopeTitle)}</h3>
      <div class="hope-grid">
        ${w.hope.map(h => `
          <div class="hope-item">
            <div class="hope-letter">${esc(h.l)}</div>
            <p><b>${esc(h.t)}</b> — ${esc(h.d)}</p>
          </div>
        `).join("")}
      </div>`;
  } else if (wk === "inspire") {
    extra = `
      <h3 style="font-size:16px;margin:20px 0 8px">${esc(w.hopeTitle)}</h3>
      <div class="card">
        ${w.guidelines.map((g, i) => `
          <div class="list-row"><div class="list-row-num">${i + 1}</div><div class="list-row-body"><p>${esc(g)}</p></div></div>
        `).join("")}
      </div>`;
  } else if (wk === "share") {
    extra = `
      <button class="witness-btn tg-press" id="openTestimonyBtn">
        <div class="wb-icon">${ICONS.book}</div>
        <div class="wb-text"><b>${esc(t().testimony.sheetTitle)}</b><span>${esc(t().testimony.sheetSubtitle)}</span></div>
        ${ICONS.chevronRight}
      </button>`;
  } else if (wk === "hook") {
    extra = `
      <div class="myfive-mini">
        <p>${esc(t().five.heroSub)}</p>
        <button class="btn tg-press" id="openFiveFromHook">${esc(t().fish.fiveCardBtn)} ${ICONS.arrowUpRight}</button>
      </div>`;
  }

  el.sheetBody.innerHTML = `
    <span class="sheet-band" style="background:${bandColorMap[wk]};color:${bandInkMap[wk]}">${esc(w.num)} · ${esc(w.team)}</span>
    <div style="padding:0 var(--space-4)">
      <p class="section-text" style="margin-top:14px">${esc(w.desc)}</p>
      <h3 style="font-size:16px;margin:20px 0 0">${esc(d.agendaTitle)}</h3>
      <div class="agenda">
        ${w.agenda.map(a => `<div class="agenda-row"><span>${esc(a.t)}</span><span>${esc(a.m)} ${esc(t().common.min)}</span></div>`).join("")}
      </div>
      ${extra}
      ${w.note ? `<div class="card" style="margin-top:16px"><p class="section-label" style="margin-bottom:6px">${esc(d.noteLabel)}</p><p style="font-size:13.5px;line-height:1.5;color:var(--ink-soft);margin:0">${esc(w.note)}</p></div>` : ""}
    </div>
  `;

  const testimonyBtn = document.getElementById("openTestimonyBtn");
  if (testimonyBtn) testimonyBtn.addEventListener("click", openTestimonySheet);
  const fiveBtn = document.getElementById("openFiveFromHook");
  if (fiveBtn) fiveBtn.addEventListener("click", () => { goBack(); switchTab("five"); });
  window.wireUpPressFeedback(el.sheetBody);
}

function renderTestimonyContent() {
  const d = t().testimony;
  el.sheetTitle.textContent = d.sheetTitle;
  el.sheetBody.innerHTML = `
    <span class="sheet-band" style="background:var(--slab-bg);color:var(--slab-text)">${esc(d.sheetLabel)}</span>
    <div style="padding:0 var(--space-4)">
      <p class="section-text" style="margin-top:14px">${esc(d.intro)}</p>
      <div style="margin-top:8px">
        ${d.steps.map((s, i) => `
          <div class="testimony-step">
            <div class="testimony-step-head">
              <div class="testimony-step-num">${i + 1}</div>
              <h4>${esc(s.t)}</h4>
            </div>
            <p>${esc(s.d)}</p>
            ${s.words ? `<div class="word-cloud">${s.words.map(w => `<span class="word-chip ${s.positive ? "positive" : ""}">${esc(w)}</span>`).join("")}</div>` : ""}
          </div>
        `).join("")}
      </div>
      <div class="card" style="margin-top:8px">
        <p style="font-size:13px;line-height:1.5;color:var(--ink-soft);margin:0">${esc(d.tip)}</p>
      </div>
    </div>
  `;
  window.wireUpPressFeedback(el.sheetBody);
}

function openTestimonySheet() {
  // The testimony guide is opened from within the already-open Share-week
  // sheet: swap its content for the guide in place (the sheet itself stays
  // open — no re-animation), but push a DISTINCT "testimony" stack entry
  // (not a generic "sheet" one) so popping it restores the week detail's
  // content instead of closing the whole sheet. That's what makes "back"
  // un-nest one level at a time: guide → week detail → FISH hub.
  state.sheetMode = "testimony";
  renderTestimonyContent();
  state.navStack.push({ type: "testimony", week: state.sheetWeek });
  history.pushState({ depth: state.navStack.length }, "", "#testimony");
  window.haptic.impact("light");
  updateBackButton();
}

function registerFishSubpages() {
  registerStackPage("fish-symbol", () => t().fish.symbolTitle, (body) => {
    const d = t().fish;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <p class="section-text">${esc(d.symbolText)}</p>
      </div>`;
  });

  // "Connect" -- what happens after Hook. Moved off the FISH hub (same
  // reasoning as the Home redesign): a lead paragraph plus a 4-step
  // accordion is exactly the kind of text wall that reads as cheap when
  // it's just sitting in the middle of a scrolling hub.
  registerStackPage("fish-connect", () => t().fish.connectTitle, (body) => {
    const d = t().fish;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <p class="section-text">${esc(d.connectText)}</p>
        <div class="card accordion" style="padding:0 var(--space-4);margin-top:var(--space-3)">
          ${d.connectSteps.map((s, i) => accordionItem({ title: `${t().common.step} ${i + 1}`, text: s })).join("")}
        </div>
      </div>`;
    wireAccordions(body);
  });
}

/* ------------------------------------------------------------------ */
/* PAGE: TEAM (short hub) + pushed sub-pages                            */
/* ------------------------------------------------------------------ */

function renderTeam() {
  const d = t().team;
  el.pages.team.innerHTML = `
    <div class="hero fade-in">
      <img src="assets/img/hero-team.jpg" alt="" />
      <div class="hero-inner">
        <span class="hero-ribbon">${esc(d.heroRibbon)}</span>
        <h1 class="display hero-title"><span>${esc(d.heroTitle)}</span></h1>
        <p class="hero-sub">${esc(d.heroSub)}</p>
      </div>
    </div>

    ${renderAccountSection()}

    <div class="section fade-in">
      <div class="card" style="padding:0 var(--space-4)">
        ${navRow({ icon: ICONS.book, title: d.resourcesTitle, desc: d.resourcesLabel, key: "team-resources" })}
        ${navRow({ icon: ICONS.users, title: d.structureTitle, desc: d.structureLabel, key: "team-structure" })}
        ${navRow({ icon: ICONS.fish, title: d.teamsTitle, desc: d.teamsLabel, key: "team-teams" })}
        ${navRow({ icon: ICONS.star, title: d.growTitle, desc: d.growLabel, key: "team-grow" })}
      </div>
    </div>
  `;
  wirePushRows(el.pages.team);
  wireAccountSection(el.pages.team);
  window.wireUpPressFeedback(el.pages.team);
  staggerIn(el.pages.team, ".nav-row");
  staggerIn(el.pages.team, ".group-row");
  staggerIn(el.pages.team, ".stat-group-row");
}

/* ------------------------------------------------------------------ */
/* PROFILE / REGISTRATION — real Telegram-verified role, backed by the  */
/* first-priority-backend service. No separate "sign up" screen: the    */
/* very first verified request for a telegram_id silently registers    */
/* them server-side as a plain "participant" (see requireAuth.js). A    */
/* participant can only become a leader/coordinator by redeeming a code */
/* that a coordinator/admin generated for them — never by picking a     */
/* role themselves.                                                     */
/* ------------------------------------------------------------------ */

async function loadMe() {
  if (!window.__tg?.initData) {
    // Running outside Telegram (plain browser preview) — there is no
    // signed initData to authenticate with, so there is nothing to load.
    state.meStatus = "no-telegram";
    if (state.tab === "team") renderTeam();
    return;
  }
  state.meStatus = "loading";
  if (state.tab === "team") renderTeam();
  try {
    state.me = await window.fpApi.me();
    state.meStatus = "loaded";
    if (state.me.role === "coordinator" || state.me.role === "national_coordinator" || state.me.role === "admin") {
      await refreshGroups();
      loadStats(); // fire-and-forget: its own status drives its own section, doesn't block the rest of the profile from showing
    }
  } catch (err) {
    console.error("[first-priority-app] loadMe failed:", err);
    state.meStatus = "error";
  }
  renderTeam();
  if (state.tab === "team") window.wireUpPressFeedback(el.pages.team);
}

async function refreshGroups() {
  try {
    state.groups = await window.fpApi.listGroups();
  } catch (err) {
    console.error("[first-priority-app] refreshGroups failed:", err);
    state.groups = [];
  }
}

// "Мои 5" is the one real discipleship signal the schema tracks (see
// stats.js on the backend for why) — this pulls the rolled-up numbers for
// whatever a coordinator/admin is allowed to see and re-renders just the
// stats card, independent of the rest of the profile section.
async function loadStats() {
  // renderTeam() below is called UNCONDITIONALLY, deliberately matching
  // loadMe()'s own pattern -- not gated behind `state.tab === "team"`.
  // This call resolves quickly (right after boot, on the "home" tab), so a
  // tab-gated render here would only ever paint the "loaded" state into a
  // team page nobody's looking at yet; switching to "team" later does NOT
  // re-render on its own (switchTab just shows/hides already-rendered
  // markup), so that stale "loading…" text would sit there forever. Only
  // the haptic wiring stays tab-gated, since that's genuinely wasted work
  // on a hidden page.
  state.statsStatus = "loading";
  renderTeam();
  let justLoaded = false;
  try {
    state.stats = await window.fpApi.getStats();
    state.statsStatus = "loaded";
    justLoaded = true;
  } catch (err) {
    console.error("[first-priority-app] loadStats failed:", err);
    state.statsStatus = "error";
  }
  renderTeam();
  if (state.tab === "team") window.wireUpPressFeedback(el.pages.team);
  // Only the render right after a real fetch completes gets the count-up --
  // never a re-render triggered by something unrelated later (creating a
  // group, redeeming a code), which would just make the numbers flicker
  // for no reason.
  if (justLoaded) animateStatTiles(el.pages.team);
}

function roleLabel(role) {
  const roles = t().account.roles;
  return roles[role] || role;
}

function renderAccountSection() {
  const d = t().account;

  if (state.meStatus === "no-telegram") {
    // Temporary debug line so a screenshot tells us WHICH thing is
    // actually missing (script never loaded vs. WebApp exists but
    // initData is empty, e.g. opened as a plain link instead of a real
    // Web App launch) instead of us having to guess blind. Safe to
    // remove once the real-Telegram issue is confirmed fixed.
    const dbg = `[dbg] Telegram=${!!window.Telegram} WebApp=${!!window.Telegram?.WebApp} initData.len=${(window.Telegram?.WebApp?.initData || "").length} __tg=${!!window.__tg}`;
    return `
      <div class="section fade-in">
        <div class="myfive-mini"><p>${esc(d.offlineNotice)}</p><p style="margin-top:6px;font-size:11px;opacity:.6;user-select:text">${esc(dbg)}</p></div>
      </div>`;
  }
  if (state.meStatus === "idle" || state.meStatus === "loading") {
    // Shaped like the real "loaded" card below (role-badge pill + one text
    // line) so there's no layout jump once the actual profile arrives --
    // just a shimmer standing in for content that's already known to be
    // coming, instead of a plain "please wait" sentence.
    return `
      <div class="section fade-in">
        <p class="section-label">${esc(d.title)}</p>
        <div class="card" style="padding:var(--space-4)">
          <div class="skeleton" style="width:96px;height:28px;border-radius:999px"></div>
          <div class="skeleton" style="width:55%;height:13px;margin-top:14px"></div>
        </div>
        <p class="section-text" style="margin-top:var(--space-3);text-align:center;font-size:12.5px">${esc(d.loadingHint)}</p>
      </div>`;
  }
  if (state.meStatus === "error") {
    return `
      <div class="section fade-in">
        <div class="myfive-mini">
          <p>${esc(d.errorNotice)}</p>
          <button class="btn secondary tg-press" id="meRetryBtn">${esc(d.retryBtn)}</button>
        </div>
      </div>`;
  }

  const me = state.me;
  let groupBlock = "";
  if (me.role === "leader") {
    groupBlock = me.group
      ? `<p class="section-text" style="margin:8px 0 0">${esc(d.groupLabel)}: <b>${esc(me.group.name)}</b></p>`
      : `<p class="section-text" style="margin:8px 0 0">${esc(d.noGroup)}</p>`;
  }

  let redeemBlock = "";
  if (me.role !== "admin") {
    redeemBlock = `
      <div class="card" style="margin-top:var(--space-3)">
        <h4 style="margin:0 0 4px">${esc(d.redeemTitle)}</h4>
        <p class="section-text" style="margin:0">${esc(d.redeemText)}</p>
        <div class="five-add" id="redeemRow">
          <input type="text" id="redeemInput" placeholder="${esc(d.redeemPlaceholder)}" maxlength="16" style="text-transform:uppercase" />
          <button id="redeemBtn" class="tg-press" aria-label="${esc(d.redeemBtn)}">${ICONS.check}</button>
        </div>
      </div>`;
  }

  const adminBlock = (me.role === "coordinator" || me.role === "national_coordinator" || me.role === "admin") ? renderAdminTools(me, d) : "";

  return `
    <div class="section fade-in">
      <p class="section-label">${esc(d.title)}</p>
      <div class="card" style="padding:var(--space-4)">
        <span class="role-badge">${esc(roleLabel(me.role))}</span>
        ${me.country ? `<p class="section-text" style="margin:8px 0 0">${esc(d.countryLabel)}: ${esc(me.country)}</p>` : ""}
        ${groupBlock}
      </div>
      ${redeemBlock}
      ${adminBlock}
    </div>`;
}

function renderAdminTools(me, d) {
  const isAdmin = me.role === "admin";
  const isNational = me.role === "national_coordinator";
  const isCoordinator = me.role === "coordinator";

  const codeBlock = state.lastCode ? `
    <div class="card" style="margin-top:var(--space-3)">
      <p class="section-label" style="margin:0 0 4px">${esc(d.codeGenerated)}</p>
      <div class="code-display">
        <span>${esc(state.lastCode)}</span>
        <button data-copy-code="${esc(state.lastCode)}">${esc(d.copyBtn)}</button>
      </div>
      <p class="section-text" style="margin:8px 0 0;font-size:12.5px">${esc(d.codeShareHint)}</p>
    </div>` : "";

  const countryField = isAdmin
    ? `<input type="text" id="newGroupCountry" class="field-input" placeholder="${esc(d.countryPlaceholder)}" />`
    : `<input type="hidden" id="newGroupCountry" value="${esc(me.country || "")}" />`;

  // A national_coordinator is oversight-only (see POST /api/groups on the
  // backend, which 403s them) -- they grow their country by inviting
  // Community Coordinators, who then create and run the actual clubs.
  const createGroupBlock = (isCoordinator || isAdmin) ? `
    <div class="card" style="margin-top:var(--space-3)">
      <h4 style="margin:0 0 4px">${esc(d.createGroupTitle)}</h4>
      <div class="field-stack">
        <input type="text" id="newGroupName" class="field-input" placeholder="${esc(d.groupNamePlaceholder)}" />
        ${countryField}
        <button id="createGroupBtn" class="btn full tg-press">${esc(d.createGroupBtn)}</button>
      </div>
    </div>` : "";

  // A national_coordinator's group list includes every club in their
  // country, not just ones they personally created -- so the per-group
  // "invite a leader" action (which only the club's own coordinator, or
  // admin, may do) is left off for them; it's read-only oversight here.
  const canInviteLeaderPerGroup = isCoordinator || isAdmin;
  const groupsListHtml = state.groups.length
    ? state.groups.map((g) => `
        <div class="group-row">
          <div class="group-row-body"><p><b>${esc(g.name)}</b></p><span>${esc(g.country)}</span></div>
          ${canInviteLeaderPerGroup ? `<button class="btn tg-press" data-invite-leader="${esc(g.id)}">${esc(d.inviteLeaderBtn)}</button>` : ""}
        </div>
      `).join("")
    : `<p class="section-text" style="margin:0">${esc(d.noGroupsYet)}</p>`;

  // Admin can invite a coordinator into any country; a national_coordinator
  // can too, but only ever for their own -- the country field is forced
  // server-side either way (see POST /api/invites/coordinator), so it's
  // shown here as a fixed fact rather than an editable one for that role.
  const coordCountryField = isNational
    ? `<input type="hidden" id="coordCountryInput" value="${esc(me.country || "")}" />
       <p class="section-text" style="margin:0 0 8px">${esc(d.countryLabel)}: <b>${esc(me.country || "")}</b></p>`
    : `<input type="text" id="coordCountryInput" class="field-input" placeholder="${esc(d.countryPlaceholder)}" />`;
  const coordInviteBlock = (isAdmin || isNational) ? `
    <div class="card" style="margin-top:var(--space-3)">
      <h4 style="margin:0 0 4px">${esc(d.inviteCoordinatorTitle)}</h4>
      <div class="field-stack">
        ${coordCountryField}
        <button id="coordInviteBtn" class="btn full tg-press">${esc(d.inviteCoordinatorBtn)}</button>
      </div>
    </div>` : "";

  // Deliberately admin-only, not delegable to a national_coordinator --
  // keeping this one step to a small, human-vetted set of admins is the
  // whole "shrink the blast radius" point of the role (see the backend's
  // POST /api/invites/national-coordinator).
  const ncInviteBlock = isAdmin ? `
    <div class="card" style="margin-top:var(--space-3)">
      <h4 style="margin:0 0 4px">${esc(d.inviteNationalCoordinatorTitle)}</h4>
      <div class="field-stack">
        <input type="text" id="ncCountryInput" class="field-input" placeholder="${esc(d.countryPlaceholder)}" />
        <button id="ncInviteBtn" class="btn full tg-press">${esc(d.inviteNationalCoordinatorBtn)}</button>
      </div>
    </div>` : "";

  return `
    ${codeBlock}
    ${createGroupBlock}
    <div class="card" style="margin-top:var(--space-3)">
      <h4 style="margin:0 0 8px">${esc(isNational ? d.groupsInCountryTitle : d.yourGroupsTitle)}</h4>
      <div id="groupsList">${groupsListHtml}</div>
    </div>
    ${coordInviteBlock}
    ${ncInviteBlock}
    ${renderStatsBlock(me, d)}
  `;
}

// Program-health numbers backed by GET /api/stats — see loadStats() and
// the backend's stats.js for what the schema actually lets us measure.
// One row in a "by group" list -- used both on the top-level stats card and
// on the per-country drill-down page below. data-search-key backs the
// client-side name filter in wireSearchFilter(); everything needed to
// render/filter/open a group is already sitting in the one GET /api/stats
// response, so none of this needs its own network round-trip.
function groupRowHtml(g, s) {
  return `
    <button class="stat-group-row tg-press" type="button" data-search-key="${esc(g.groupName.toLowerCase())}"
      data-group-id="${esc(g.groupId)}" data-group-name="${esc(g.groupName)}" data-group-country="${esc(g.country)}">
      <div class="stat-group-row-top">
        <div class="stat-group-row-head">
          <p><b>${esc(g.groupName)}</b></p>
          <span>${esc(g.country)}</span>
        </div>
        ${ICONS.chevronRight}
      </div>
      <p class="section-text" style="margin:2px 0 0;font-size:12px">${g.leaderName ? esc(g.leaderName) : esc(s.noLeader)}</p>
      <div class="stat-group-nums">
        <span>${esc(s.fiveShort)}: <b>${esc(String(g.fiveCount))}</b></span>
        <span>${esc(s.prayedShort)}: <b>${esc(String(g.prayedCount))}</b></span>
        <span>${esc(s.invitedShort)}: <b>${esc(String(g.invitedCount))}</b></span>
      </div>
    </button>`;
}

// A small text filter over rows already in the DOM (toggling display, never
// re-rendering) -- re-rendering on every keystroke would rebuild the input
// itself and throw away focus/cursor position mid-type.
function searchInputHtml(inputId, emptyId, placeholder) {
  return `
    <div class="five-add" style="margin-bottom:var(--space-2)">
      <input type="text" id="${esc(inputId)}" placeholder="${esc(placeholder)}" />
    </div>
    <p id="${esc(emptyId)}" class="section-text" style="display:none;margin:0 0 8px">—</p>`;
}
function wireSearchFilter(root, inputId, emptyId, rowSelector, emptyText) {
  const input = root.querySelector("#" + inputId);
  const emptyMsg = root.querySelector("#" + emptyId);
  if (!input) return;
  if (emptyMsg) emptyMsg.textContent = emptyText;
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const rows = root.querySelectorAll(rowSelector);
    let anyVisible = false;
    rows.forEach((row) => {
      const match = !q || (row.dataset.searchKey || "").includes(q);
      row.style.display = match ? "" : "none";
      if (match) anyVisible = true;
    });
    if (emptyMsg) emptyMsg.style.display = (rows.length && !anyVisible) ? "" : "none";
  });
}

// Opening a group's drill-down is the same action whether the row is
// sitting in the top-level stats card or inside a country's club list --
// shared so both wiring sites stay in sync.
function wireStatGroupRowClicks(root) {
  root.querySelectorAll("[data-group-id]").forEach((row) => {
    row.addEventListener("click", () => {
      state.statsGroupDetail = {
        groupId: row.dataset.groupId,
        groupName: row.dataset.groupName,
        country: row.dataset.groupCountry,
      };
      state.statsGroupDetailStatus = "idle";
      state.statsGroupDetailData = null;
      pushPage("stats-group-detail");
    });
  });
}

function renderStatsBlock(me, d) {
  const s = d.stats;

  if (state.statsStatus === "idle" || state.statsStatus === "loading") {
    // Five tile-shaped placeholders standing in for the real stat-grid,
    // rather than a plain "Считаем цифры…" line -- see .skeleton in
    // style.css.
    return `
      <div class="card" style="margin-top:var(--space-3)">
        <h4 style="margin:0 0 4px">${esc(s.title)}</h4>
        <div class="stat-grid">
          ${Array(5).fill(0).map(() => `<div class="skeleton" style="height:54px"></div>`).join("")}
        </div>
      </div>`;
  }
  if (state.statsStatus === "error" || !state.stats) {
    return `
      <div class="card" style="margin-top:var(--space-3)">
        <h4 style="margin:0 0 4px">${esc(s.title)}</h4>
        <p class="section-text" style="margin:0">${esc(s.errorNotice)}</p>
        <button class="btn secondary tg-press" id="statsRetryBtn" style="margin-top:var(--space-2)">${esc(d.retryBtn)}</button>
      </div>`;
  }

  const stats = state.stats;
  const t2 = stats.totals;

  // Rotate through the same FISH-cycle accent colors used on the FISH tab
  // (see --focus/--inspire/--share/--hook in style.css) so the stats grid
  // isn't five identical gray boxes -- a small, free way to make the
  // numbers feel like part of the same brand system instead of a generic
  // admin dashboard.
  const TILE_ACCENTS = [
    { bg: "var(--focus)", ink: "var(--focus-ink)" },
    { bg: "var(--inspire)", ink: "var(--inspire-ink)" },
    { bg: "var(--share)", ink: "#fff" },
    { bg: "var(--hook)", ink: "var(--hook-ink)" },
    { bg: "var(--focus)", ink: "var(--focus-ink)" },
  ];
  const tileHtml = (value, label, icon, accent) => `
    <div class="stat-tile">
      <div class="stat-tile-icon" style="background:${accent.bg};color:${accent.ink}">${icon}</div>
      <b>${esc(String(value))}</b><span>${esc(label)}</span>
    </div>`;

  const grid = [
    tileHtml(t2.groups, s.groupsLabel, ICONS.church, TILE_ACCENTS[0]),
    tileHtml(t2.leaders, s.leadersLabel, ICONS.users, TILE_ACCENTS[1]),
    tileHtml(t2.fiveCount, s.fiveLabel, ICONS.hands, TILE_ACCENTS[2]),
    tileHtml(t2.prayedCount, s.prayedLabel, ICONS.praying, TILE_ACCENTS[3]),
    tileHtml(t2.invitedCount, s.invitedLabel, ICONS.invite, TILE_ACCENTS[4]),
  ].join("");

  let roleBlock = "";
  if (stats.roleCounts) {
    const r = stats.roleCounts;
    roleBlock = `
      <div class="stat-role-row">
        <span class="stat-role-chip"><b>${esc(String(r.participant))}</b> ${esc(roleLabel("participant"))}</span>
        <span class="stat-role-chip"><b>${esc(String(r.leader))}</b> ${esc(roleLabel("leader"))}</span>
        <span class="stat-role-chip"><b>${esc(String(r.coordinator))}</b> ${esc(roleLabel("coordinator"))}</span>
        ${typeof r.national_coordinator === "number" ? `<span class="stat-role-chip"><b>${esc(String(r.national_coordinator))}</b> ${esc(roleLabel("national_coordinator"))}</span>` : ""}
        <span class="stat-role-chip"><b>${esc(String(r.admin))}</b> ${esc(roleLabel("admin"))}</span>
      </div>`;
  }

  // Hundreds of clubs across dozens of countries (admin's real long-term
  // scale) makes one flat "by group" list unusable -- once there's more
  // than one country in the rollup, group by country instead: a short list
  // of countries here, each opening to that country's own club list (with
  // its own search) on the "stats-country-detail" page. A coordinator or
  // national_coordinator only ever sees one country (byCountry.length is
  // always 1 for them, by construction on the backend), so they keep the
  // flat list -- just with a search box once it's long enough to need one.
  const showCountries = stats.byCountry.length > 1;

  let listHtml;
  if (showCountries) {
    const countryRows = stats.byCountry.map((c) => `
      <button class="stat-group-row tg-press" type="button" data-search-key="${esc(c.country.toLowerCase())}" data-country-row="${esc(c.country)}">
        <div class="stat-group-row-top">
          <div class="stat-group-row-head">
            <p><b>${esc(c.country)}</b></p>
            <span>${esc(s.groupsLabel)}: ${esc(String(c.groups))} · ${esc(s.leadersLabel)}: ${esc(String(c.leaders))}</span>
          </div>
          ${ICONS.chevronRight}
        </div>
        <div class="stat-group-nums">
          <span>${esc(s.fiveShort)}: <b>${esc(String(c.fiveCount))}</b></span>
          <span>${esc(s.prayedShort)}: <b>${esc(String(c.prayedCount))}</b></span>
          <span>${esc(s.invitedShort)}: <b>${esc(String(c.invitedCount))}</b></span>
        </div>
      </button>`).join("");
    listHtml = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin:var(--space-4) 0 4px;gap:var(--space-2)">
        <p class="section-label" style="margin:0">${esc(s.byCountryTitle)}</p>
        <span style="font-size:11px;color:var(--tg-hint)">${esc(s.openHint)}</span>
      </div>
      ${stats.byCountry.length > 6 ? searchInputHtml("statsSearchInput", "statsSearchEmpty", s.searchCountryPlaceholder) : ""}
      ${countryRows}`;
  } else {
    const groupsHtml = stats.groups.length
      ? stats.groups.map((g) => groupRowHtml(g, s)).join("")
      : `<p class="section-text" style="margin:0">${esc(s.noGroupsYet)}</p>`;
    listHtml = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin:var(--space-4) 0 4px;gap:var(--space-2)">
        <p class="section-label" style="margin:0">${esc(s.byGroupTitle)}</p>
        ${stats.groups.length ? `<span style="font-size:11px;color:var(--tg-hint)">${esc(s.openHint)}</span>` : ""}
      </div>
      ${stats.groups.length > 6 ? searchInputHtml("statsSearchInput", "statsSearchEmpty", s.searchClubPlaceholder) : ""}
      ${groupsHtml}`;
  }

  return `
    <div class="card" style="margin-top:var(--space-3)">
      <h4 style="margin:0 0 4px">${esc(s.title)}</h4>
      <div class="stat-grid">${grid}</div>
      ${roleBlock}
      ${listHtml}
    </div>`;
}

function wireAccountSection(root) {
  const retryBtn = root.querySelector("#meRetryBtn");
  if (retryBtn) retryBtn.addEventListener("click", () => loadMe());

  const statsRetryBtn = root.querySelector("#statsRetryBtn");
  if (statsRetryBtn) statsRetryBtn.addEventListener("click", () => loadStats());

  const redeemBtn = root.querySelector("#redeemBtn");
  const redeemInput = root.querySelector("#redeemInput");
  if (redeemBtn && redeemInput) {
    const doRedeem = async () => {
      const code = redeemInput.value.trim();
      if (!code) return;
      redeemBtn.disabled = true;
      try {
        await window.fpApi.redeemInvite(code);
        toast(t().account.redeemSuccess, ICONS.check);
        window.haptic.notification("success");
        await loadMe();
      } catch (err) {
        const key = err?.data?.error;
        const msg = (key && t().account.redeemErrors[key]) || t().account.redeemErrors.default;
        toast(msg, ICONS.close);
        window.haptic.notification("error");
        redeemBtn.disabled = false;
      }
    };
    redeemBtn.addEventListener("click", doRedeem);
    redeemInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doRedeem(); });
  }

  const createGroupBtn = root.querySelector("#createGroupBtn");
  if (createGroupBtn) {
    createGroupBtn.addEventListener("click", async () => {
      const name = root.querySelector("#newGroupName")?.value.trim();
      const country = root.querySelector("#newGroupCountry")?.value.trim();
      if (!name || !country) return;
      createGroupBtn.disabled = true;
      try {
        await window.fpApi.createGroup(name, country);
        window.haptic.notification("success");
        await refreshGroups();
        renderTeam();
        window.wireUpPressFeedback(el.pages.team);
        toast(t().account.groupCreated, ICONS.check);
      } catch (err) {
        toast(t().account.errorNotice, ICONS.close);
        window.haptic.notification("error");
        createGroupBtn.disabled = false;
      }
    });
  }

  root.querySelectorAll("[data-invite-leader]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const res = await window.fpApi.inviteLeader(btn.dataset.inviteLeader);
        state.lastCode = res.code;
        renderTeam();
        window.wireUpPressFeedback(el.pages.team);
        toast(t().account.codeGenerated, ICONS.check);
        window.haptic.notification("success");
      } catch (err) {
        toast(t().account.errorNotice, ICONS.close);
        window.haptic.notification("error");
        btn.disabled = false;
      }
    });
  });

  const coordInviteBtn = root.querySelector("#coordInviteBtn");
  if (coordInviteBtn) {
    coordInviteBtn.addEventListener("click", async () => {
      const country = root.querySelector("#coordCountryInput")?.value.trim();
      if (!country) return;
      coordInviteBtn.disabled = true;
      try {
        const res = await window.fpApi.inviteCoordinator(country);
        state.lastCode = res.code;
        renderTeam();
        window.wireUpPressFeedback(el.pages.team);
        toast(t().account.codeGenerated, ICONS.check);
        window.haptic.notification("success");
      } catch (err) {
        toast(t().account.errorNotice, ICONS.close);
        window.haptic.notification("error");
        coordInviteBtn.disabled = false;
      }
    });
  }

  const ncInviteBtn = root.querySelector("#ncInviteBtn");
  if (ncInviteBtn) {
    ncInviteBtn.addEventListener("click", async () => {
      const country = root.querySelector("#ncCountryInput")?.value.trim();
      if (!country) return;
      ncInviteBtn.disabled = true;
      try {
        const res = await window.fpApi.inviteNationalCoordinator(country);
        state.lastCode = res.code;
        renderTeam();
        window.wireUpPressFeedback(el.pages.team);
        toast(t().account.codeGenerated, ICONS.check);
        window.haptic.notification("success");
      } catch (err) {
        toast(t().account.errorNotice, ICONS.close);
        window.haptic.notification("error");
        ncInviteBtn.disabled = false;
      }
    });
  }

  root.querySelectorAll("[data-copy-code]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.copyCode;
      const done = () => toast(t().account.copied, ICONS.check);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(done);
      } else {
        done();
      }
    });
  });

  // Tapping a group in the "By group" list drills into that ONE group's
  // real names + statuses (GET /api/stats/group/:id) instead of the
  // aggregate counts already shown here -- see registerTeamSubpages()
  // for the "stats-group-detail" stack page this opens.
  wireStatGroupRowClicks(root);

  // Tapping a country (only rendered once there's more than one -- see
  // renderStatsBlock) opens that country's own club list on its own page,
  // filtered client-side from the stats already loaded here.
  root.querySelectorAll("[data-country-row]").forEach((row) => {
    row.addEventListener("click", () => {
      state.statsCountryDetail = { country: row.dataset.countryRow };
      pushPage("stats-country-detail");
    });
  });

  wireSearchFilter(root, "statsSearchInput", "statsSearchEmpty", "[data-search-key]", t().account.stats.noSearchResults);
}

function registerTeamSubpages() {
  registerStackPage("team-resources", () => t().team.resourcesTitle, (body) => {
    const d = t().team;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <p class="section-text">${esc(d.resourcesText)}</p>
        <div class="stack">
          <div class="resource-card">
            <div class="resource-tag">PDF</div>
            <div class="resource-vacuum">${ICONS.book}</div>
            <div class="resource-body">
              <h4>${esc(d.manualTitle)}</h4>
              <p>${esc(d.manualDesc)}</p>
              <div class="resource-actions">
                <a href="docs/FISH-Training-Manual.pdf" target="_blank" rel="noopener">${ICONS.externalOpen}${esc(t().common.open)}</a>
                <a href="docs/FISH-Training-Manual.pdf" download>${ICONS.download}${esc(t().common.download)}</a>
              </div>
            </div>
          </div>
          <div class="resource-card">
            <div class="resource-tag">PDF</div>
            <div class="resource-vacuum">${ICONS.compass2}</div>
            <div class="resource-body">
              <h4>${esc(d.slidesTitle)}</h4>
              <p>${esc(d.slidesDesc)}</p>
              <div class="resource-actions">
                <a href="docs/FISH-Slides-Training.pdf" target="_blank" rel="noopener">${ICONS.externalOpen}${esc(t().common.open)}</a>
                <a href="docs/FISH-Slides-Training.pdf" download>${ICONS.download}${esc(t().common.download)}</a>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  });

  registerStackPage("team-structure", () => t().team.structureTitle, (body) => {
    const d = t().team;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <div class="stack">
          <div class="card role-card">
            <div class="role-photo"><img src="assets/img/hero-inspire.jpg" alt=""/></div>
            <div class="role-body"><h4>${esc(d.coachTitle)}</h4><p>${esc(d.coachText)}</p></div>
          </div>
          <div class="card role-card">
            <div class="role-photo"><img src="assets/img/hero-team.jpg" alt=""/></div>
            <div class="role-body"><h4>${esc(d.councilTitle)}</h4><p>${esc(d.councilText)}</p></div>
          </div>
        </div>
      </div>`;
  });

  registerStackPage("team-teams", () => t().team.teamsTitle, (body) => {
    const d = t().team;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <p class="section-text">${esc(d.teamsText)}</p>
        <div class="team-pill-row">
          <span class="team-pill pray">Pray</span>
          <span class="team-pill bless">Bless</span>
          <span class="team-pill serve">Serve</span>
          <span class="team-pill tell">Tell</span>
        </div>
        <div class="ribbon-wrap"><div class="ribbon"><span>PRAY TEAM</span><span>BLESS TEAM</span><span>SERVE TEAM</span><span>TELL TEAM</span></div></div>
        <div class="card">
          <p class="section-label" style="margin-bottom:10px">${esc(d.tasksTitle)}</p>
          ${d.tasks.map((s, i) => `
            <div class="list-row"><div class="list-row-num">${i + 1}</div><div class="list-row-body"><p>${esc(s)}</p></div></div>
          `).join("")}
        </div>
      </div>`;
  });

  // "Grow as a leader" -- moved off the Team hub for the same reason as
  // Home's Vision/Mission/Strategy accordion: a title plus a multi-item
  // accordion doesn't need to sit permanently on the hub's scroll.
  registerStackPage("team-grow", () => t().team.growTitle, (body) => {
    const d = t().team;
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <div class="card accordion" style="padding:0 var(--space-4)">
          ${d.growTips.map((g) => accordionItem({ title: g.t, text: g.d })).join("")}
        </div>
      </div>`;
    wireAccordions(body);
  });

  // Per-group statistics drill-down -- pushed from a "By group" row in the
  // stats card (see wireAccountSection's [data-group-id] handler). The
  // title reads state.statsGroupDetail synchronously (set right before
  // pushPage runs), but the actual leader/five data is fetched fresh on
  // every open, same as loadStats() -- names/prayed/invited can change
  // between visits, and this page is cheap to refetch.
  registerStackPage(
    "stats-group-detail",
    () => state.statsGroupDetail?.groupName || t().account.stats.title,
    (body) => loadStatsGroupDetail(body)
  );

  // Per-country club list -- pushed from a country row in the "By country"
  // list (only shown once a scope has more than one country; see
  // renderStatsBlock). Nothing to fetch: it's a client-side filter over the
  // stats already sitting in state.stats from the one GET /api/stats call,
  // same idea as the "already-computed but unused" byCountry rollup this
  // whole feature exists to finally put in front of an admin.
  registerStackPage(
    "stats-country-detail",
    () => state.statsCountryDetail?.country || t().account.stats.title,
    (body) => renderStatsCountryDetail(body)
  );
}

function renderStatsCountryDetail(body) {
  const s = t().account.stats;
  const info = state.statsCountryDetail;
  if (!info || !state.stats) { body.innerHTML = ""; return; }

  const countryTotals = state.stats.byCountry.find((c) => c.country === info.country);
  const countryGroups = state.stats.groups.filter((g) => g.country === info.country);

  const totalsBlock = countryTotals ? `
    <div class="card" style="padding:var(--space-4)">
      <div class="stat-role-row">
        <span class="stat-role-chip"><b>${esc(String(countryTotals.groups))}</b> ${esc(s.groupsLabel)}</span>
        <span class="stat-role-chip"><b>${esc(String(countryTotals.leaders))}</b> ${esc(s.leadersLabel)}</span>
        <span class="stat-role-chip"><b>${esc(String(countryTotals.fiveCount))}</b> ${esc(s.fiveLabel)}</span>
        <span class="stat-role-chip"><b>${esc(String(countryTotals.prayedCount))}</b> ${esc(s.prayedLabel)}</span>
        <span class="stat-role-chip"><b>${esc(String(countryTotals.invitedCount))}</b> ${esc(s.invitedLabel)}</span>
      </div>
    </div>` : "";

  const groupsHtml = countryGroups.length
    ? countryGroups.map((g) => groupRowHtml(g, s)).join("")
    : `<p class="section-text" style="margin:0">${esc(s.noGroupsYet)}</p>`;

  body.innerHTML = `
    <div class="section" style="padding-top:var(--space-4)">
      ${totalsBlock}
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin:var(--space-4) 0 4px;gap:var(--space-2)">
        <p class="section-label" style="margin:0">${esc(s.clubsInCountryTitle)}</p>
        ${countryGroups.length ? `<span style="font-size:11px;color:var(--tg-hint)">${esc(s.openHint)}</span>` : ""}
      </div>
      ${countryGroups.length > 6 ? searchInputHtml("statsCountryClubSearchInput", "statsCountryClubSearchEmpty", s.searchClubPlaceholder) : ""}
      ${groupsHtml}
    </div>`;

  wireStatGroupRowClicks(body);
  wireSearchFilter(body, "statsCountryClubSearchInput", "statsCountryClubSearchEmpty", "[data-search-key]", s.noSearchResults);
}

function renderStatsGroupDetail(body) {
  const s = t().account.stats;
  const info = state.statsGroupDetail;
  if (!info) { body.innerHTML = ""; return; }

  if (state.statsGroupDetailStatus === "idle" || state.statsGroupDetailStatus === "loading") {
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <div class="card" style="padding:var(--space-4)">
          <div class="skeleton" style="width:80px;height:22px;border-radius:999px"></div>
          <div class="skeleton" style="width:60%;height:14px;margin-top:12px"></div>
        </div>
        <div class="card" style="margin-top:var(--space-3)">
          ${[0, 1, 2].map(() => `<div class="skeleton" style="height:56px;margin-bottom:8px;border-radius:var(--radius-md)"></div>`).join("")}
        </div>
      </div>`;
    return;
  }

  if (state.statsGroupDetailStatus === "error" || !state.statsGroupDetailData) {
    body.innerHTML = `
      <div class="section" style="padding-top:var(--space-4)">
        <div class="myfive-mini">
          <p>${esc(s.detailErrorNotice)}</p>
          <button class="btn secondary tg-press" id="statsGroupRetryBtn">${esc(t().account.retryBtn)}</button>
        </div>
      </div>`;
    const retryBtn = body.querySelector("#statsGroupRetryBtn");
    if (retryBtn) retryBtn.addEventListener("click", () => loadStatsGroupDetail(body));
    return;
  }

  const data = state.statsGroupDetailData;
  const leaderBlock = data.leader
    ? `<p class="section-text" style="margin:8px 0 0"><b>${esc(s.detailLeaderTitle)}:</b> ${esc(data.leader.firstName || data.leader.username || "—")}</p>`
    : `<p class="section-text" style="margin:8px 0 0">${esc(s.noLeader)}</p>`;

  const fiveHtml = data.five.length
    ? data.five.map((p) => `
        <div class="five-item stagger-item">
          <div class="five-avatar">${esc(initials(p.name))}</div>
          <div class="five-item-body">
            <div style="font-size:14.5px;font-weight:700">${esc(p.name)}</div>
            <div class="five-toggles">
              <span class="five-toggle pray" data-on="${p.prayed}">${ICONS.praying}${esc(s.prayedShort)}</span>
              <span class="five-toggle invite" data-on="${p.invited}">${ICONS.invite}${esc(s.invitedShort)}</span>
            </div>
          </div>
        </div>
      `).join("")
    : `<p class="section-text" style="margin:0">${esc(s.detailNoFive)}</p>`;

  body.innerHTML = `
    <div class="section" style="padding-top:var(--space-4)">
      <div class="card" style="padding:var(--space-4)">
        <span class="role-badge">${esc(info.country)}</span>
        ${leaderBlock}
      </div>
      <div class="card" style="margin-top:var(--space-3)">
        <h4 style="margin:0 0 4px">${esc(s.detailFiveTitle)}</h4>
        <div class="five-list" style="margin-top:var(--space-3)">${fiveHtml}</div>
      </div>
    </div>`;
}

async function loadStatsGroupDetail(body) {
  const info = state.statsGroupDetail;
  if (!info) return;
  state.statsGroupDetailStatus = "loading";
  renderStatsGroupDetail(body);
  try {
    state.statsGroupDetailData = await window.fpApi.getGroupStats(info.groupId);
    state.statsGroupDetailStatus = "loaded";
  } catch (err) {
    console.error("[first-priority-app] loadStatsGroupDetail failed:", err);
    state.statsGroupDetailStatus = "error";
  }
  renderStatsGroupDetail(body);
}

/* ------------------------------------------------------------------ */
/* PAGE: FIVE — "Мои 5" digital tracker (unique feature)                */
/* ------------------------------------------------------------------ */

function uid() { return Math.random().toString(36).slice(2, 9); }

// "My 5" used to live only in Telegram CloudStorage (or a plain in-memory
// object when CloudStorage wasn't available) — that's why entries could
// silently disappear between sessions. It now lives on the backend, tied
// to the same verified Telegram identity as the rest of the app, so it
// survives reopens, reinstalls, and different devices. The local cache
// below is only a fallback for when the backend can't be reached (offline,
// cold start still warming up, dev preview outside Telegram) — the backend
// is always the source of truth once it answers.
async function loadFive() {
  if (window.__tg?.initData) {
    try {
      const res = await window.fpApi.getFive();
      state.five = res.entries || [];
      window.tgStorage.set("fp_five_list", JSON.stringify(state.five));
      return;
    } catch (err) {
      console.error("[first-priority-app] loadFive: backend unavailable, using local cache:", err);
    }
  }
  const raw = await window.tgStorage.get("fp_five_list");
  if (raw) {
    try { state.five = JSON.parse(raw); } catch (e) { state.five = []; }
  }
}
async function saveFive() {
  // Always cache locally first so nothing is lost even if the network call
  // below fails outright.
  await window.tgStorage.set("fp_five_list", JSON.stringify(state.five));
  if (window.__tg?.initData) {
    try {
      await window.fpApi.saveFive(state.five);
    } catch (err) {
      console.error("[first-priority-app] saveFive: backend unavailable, saved locally only:", err);
      toast(t().five.syncError, ICONS.close);
    }
  }
}

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

function renderFive() {
  const d = t().five;
  const full = state.five.length >= 5;
  el.pages.five.innerHTML = `
    <div class="section fade-in" style="padding-top:var(--space-6)">
      <div class="five-card">
        <h2 class="display" style="text-transform:none">${esc(d.heroTitle)}</h2>
        <p>${esc(d.heroSub)}</p>
        <div class="five-progress">
          ${[0, 1, 2, 3, 4].map(i => `<div class="five-progress-slot ${i < state.five.length ? "filled" : ""}"></div>`).join("")}
        </div>
      </div>

      <div class="five-add ${full ? "disabled" : ""}" id="fiveAddRow">
        <input type="text" id="fiveInput" placeholder="${esc(d.addPlaceholder)}" maxlength="40" ${full ? "disabled" : ""} />
        <button id="fiveAddBtn" aria-label="${esc(t().common.add)}">${ICONS.plus}</button>
      </div>

      <div class="five-list" id="fiveList">
        ${state.five.length === 0
          ? `<div class="five-empty">${esc(d.emptyState)}</div>`
          : state.five.map(p => renderFiveItem(p, d)).join("")}
      </div>
      ${full ? `<p style="text-align:center;font-size:12.5px;color:var(--tg-hint);margin-top:10px">${esc(d.fullState)}</p>` : ""}

      <div class="five-verse">
        <p>${esc(d.verse)}</p>
        <cite>${esc(d.verseRef)}</cite>
      </div>
    </div>
  `;

  const input = document.getElementById("fiveInput");
  const addBtn = document.getElementById("fiveAddBtn");
  const doAdd = () => {
    const name = input.value.trim();
    if (!name || state.five.length >= 5) return;
    state.five.push({ id: uid(), name, prayed: false, invited: false });
    saveFive();
    renderFive();
    toast(t().five.toastAdded, ICONS.check);
    window.haptic.notification("success");
  };
  addBtn.addEventListener("click", doAdd);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); });

  el.pages.five.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { id, field } = btn.dataset;
      const person = state.five.find((p) => p.id === id);
      if (!person) return;
      person[field] = !person[field];
      // Ephemeral flag, same idiom as state.lastCode elsewhere: renderFive()
      // reads it once (to add the "just-toggled" pop animation to only the
      // one badge that actually changed) and it's cleared right after, so
      // an unrelated later re-render never replays the pop.
      state.fiveJustToggled = { id, field };
      saveFive();
      renderFive();
      state.fiveJustToggled = null;
      window.haptic.impact("medium");
      if (person[field]) {
        toast(field === "prayed" ? t().five.toastPrayed : t().five.toastInvited, field === "prayed" ? ICONS.praying : ICONS.invite);
        window.sound?.success();
      }
    });
  });
  el.pages.five.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.five = state.five.filter((p) => p.id !== btn.dataset.remove);
      saveFive();
      renderFive();
      toast(t().five.toastRemoved, ICONS.trash);
      window.haptic.impact("light");
    });
  });

  window.wireUpPressFeedback(el.pages.five);
}

function renderFiveItem(p, d) {
  // Bug found during a design review: this used to be
  // `state.fiveJustToggled?.id === p.id ? state.fiveJustToggled.field : null`.
  // The `?.` only guards the LEFT side of the comparison -- if
  // state.fiveJustToggled is null (its normal idle value, see initial state
  // above) AND a given entry's `p.id` happens to be undefined/null (a stale
  // locally-cached "My 5" entry from before `id` was part of the saved
  // shape, or any future data shape hiccup), `undefined === undefined` is
  // true, and the code then read `.field` off `state.fiveJustToggled`
  // itself -- which is null, not the object it was just compared against --
  // throwing "Cannot read properties of null (reading 'field')". Because
  // renderFive() builds its whole HTML string in one synchronous pass, that
  // throw aborted the update entirely, leaving the "Мои 5" tab frozen on
  // whatever it had rendered last (in practice, its very first paint, before
  // the interface language was even set and before real entries had loaded)
  // -- which is exactly the "always in English, always empty" symptom this
  // was reported as. Requiring state.fiveJustToggled to be truthy before
  // ever touching its .field removes the null-dereference outright.
  const justToggled = (state.fiveJustToggled && state.fiveJustToggled.id === p.id) ? state.fiveJustToggled.field : null;
  const prayPop = justToggled === "prayed" ? " just-toggled" : "";
  const invitePop = justToggled === "invited" ? " just-toggled" : "";
  return `
    <div class="five-item">
      <div class="five-avatar">${esc(initials(p.name))}</div>
      <div class="five-item-body">
        <input type="text" value="${esc(p.name)}" data-name="${p.id}" readonly />
        <div class="five-toggles">
          <button class="five-toggle pray tg-press${prayPop}" data-toggle data-id="${p.id}" data-field="prayed" data-on="${p.prayed}">${ICONS.praying}${esc(d.prayed)}</button>
          <button class="five-toggle invite tg-press${invitePop}" data-toggle data-id="${p.id}" data-field="invited" data-on="${p.invited}">${ICONS.invite}${esc(d.invited)}</button>
        </div>
      </div>
      <button class="five-remove tg-press" data-remove="${p.id}" aria-label="remove">${ICONS.trash}</button>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* Toast                                                                */
/* ------------------------------------------------------------------ */

let toastTimer = null;
function toast(msg, iconSvg) {
  el.toast.innerHTML = `${iconSvg || ICONS.check}<span>${esc(msg)}</span>`;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

/* ------------------------------------------------------------------ */
/* Render all + init                                                    */
/* ------------------------------------------------------------------ */

function renderAll() {
  renderNav();
  renderHome();
  renderFish();
  renderTeam();
  renderFive();
}

function wireChrome() {
  el.langSwitch.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
  el.tabbar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  el.sheetCloseBtn.addEventListener("click", goBack);
  el.sheetBackdrop.addEventListener("click", goBack);
  window.wireUpPressFeedback(document);
  window.addEventListener("popstate", handlePopState);

  if (window.__tg?.BackButton) {
    window.__tg.onEvent("backButtonClicked", goBack);
  }
}

function hideSplash() {
  if (el.splash.classList.contains("leaving")) return;
  el.splash.classList.add("leaving");
  el.app.classList.add("ready");
  window.setTimeout(() => { el.splash.style.display = "none"; }, 560);
}

async function boot() {
  // Schedule the splash reveal FIRST and independently of rendering, so a
  // rendering error below can never leave the user stuck on the loading
  // screen (index.html also carries its own longer failsafe timer).
  window.setTimeout(hideSplash, 4300);

  // Fire these first, and completely independently of the setup steps
  // below: neither depends on subpage registration, language setup, or tab
  // wiring having run. This matters because a single unrelated exception
  // anywhere in those steps must never be able to prevent the Team tab's
  // profile check (or "My 5") from ever starting — that would show
  // "Checking Telegram data…" (which looks identical to the untouched
  // initial state) forever, with the timeout inside loadMe() never even
  // getting a chance to fire since loadMe() itself was never called.
  loadFive()
    .then(() => {
      renderFive();
      window.wireUpPressFeedback(el.pages.five);
    })
    .catch((err) => console.error("[first-priority-app] loadFive chain failed:", err));
  loadMe().catch((err) => console.error("[first-priority-app] loadMe chain failed:", err));

  // Each step runs independently: one throwing (a bad translation key, a
  // missing element, anything) must not prevent the rest — including
  // switchTab("home") — from still running. Previously these all shared one
  // try/catch, so a single failure anywhere could leave the whole app
  // frozen past the splash screen.
  const steps = [
    () => history.replaceState({ depth: 0 }, "", location.pathname + location.search),
    renderTabBg,
    registerHomeSubpages,
    registerFishSubpages,
    registerTeamSubpages,
    () => setLang(CURRENT_LANG, { silent: true }),
    wireChrome,
    // Lets a link (e.g. the bot's own reminder message, "?tab=five") open
    // straight into a specific tab instead of always landing on Home.
    // Falls back to "home" for anything unrecognized, so a normal launch
    // with no query string behaves exactly as before.
    () => {
      const requested = new URLSearchParams(location.search).get("tab");
      const validTabs = ["home", "fish", "team", "five"];
      switchTab(validTabs.includes(requested) ? requested : "home");
    },
  ];
  for (const step of steps) {
    try {
      step();
    } catch (err) {
      console.error("[first-priority-app] boot step failed:", step.name || "(anonymous)", err);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
