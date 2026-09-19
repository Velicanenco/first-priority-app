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
  updateBackButton();
}

function actuallyPopPage() {
  const pages = el.stackRoot.querySelectorAll(".stack-page");
  const top = pages[pages.length - 1];
  if (!top) return;
  top.classList.remove("active");
  if (pages.length > 1) pages[pages.length - 2].classList.remove("behind");
  window.setTimeout(() => top.remove(), 340);
}

function openSheetTracked() {
  el.sheetBackdrop.classList.add("open");
  requestAnimationFrame(() => el.sheet.classList.add("open"));
  window.haptic.impact("light");
  state.navStack.push({ type: "sheet" });
  history.pushState({ depth: state.navStack.length }, "", "#sheet");
  updateBackButton();
}
function actuallyCloseSheet() {
  el.sheet.classList.remove("open");
  el.sheetBackdrop.classList.remove("open");
  state.sheetMode = null;
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
  if (el.pages[tab]) {
    el.pages[tab].querySelectorAll(".fade-in").forEach((n) => {
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

function renderNav() {
  const c = t().common.tabs;
  document.getElementById("navHomeBtn").innerHTML = `${ICONS.navHome}<span>${esc(c.home)}</span>`;
  document.getElementById("navFishBtn").innerHTML = `${ICONS.navFish}<span>FISH</span>`;
  document.getElementById("navTeamBtn").innerHTML = `${ICONS.navTeam}<span>${esc(c.team)}</span>`;
  document.getElementById("navFiveBtn").innerHTML = `${ICONS.navFive}<span>${esc(c.five)}</span>`;
  el.sheetCloseBtn.innerHTML = ICONS.close;
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

function renderHome() {
  const d = t().home;
  el.pages.home.innerHTML = `
    <div class="hero fade-in">
      <img src="assets/img/hero-focus.jpg" alt="" />
      <div class="hero-inner">
        <span class="hero-ribbon">${esc(d.heroRibbon)}</span>
        <h1 class="display hero-title">${esc(d.heroTitle)}</h1>
        <p class="hero-sub">${esc(d.heroSub)}</p>
      </div>
    </div>

    <div class="section fade-in">
      <div class="quote-card">
        <p>${esc(d.quote)}</p>
        <cite>— ${esc(d.quoteAuthor)}</cite>
      </div>
    </div>

    <div class="section fade-in">
      <p class="section-label">${esc(d.aboutLabel)}</p>
      <h2 class="display section-title">${esc(d.aboutTitle)}</h2>
      <p class="section-text">${esc(d.aboutText)}</p>
      <div class="card accordion" style="padding:0 var(--space-4);margin-top:var(--space-3)">
        ${accordionItem({ title: d.visionLabel, text: d.visionText })}
        ${accordionItem({ title: d.missionLabel, text: d.missionText })}
        ${accordionItem({ title: d.strategyLabel, text: d.strategyText })}
      </div>
    </div>

    <div class="section fade-in">
      <div class="ribbon-wrap"><div class="ribbon"><span>${esc(d.beliefQuote)}</span><span>${esc(d.beliefQuote)}</span></div></div>
      <p class="section-label">${esc(d.battleLabel)}</p>
      <h2 class="display section-title">${esc(d.battleTitle)}</h2>
      <p class="section-text">${esc(d.battleText)}</p>
    </div>

    <div class="section fade-in">
      <div class="card" style="padding:0 var(--space-4)">
        ${navRow({ icon: ICONS.hands, title: d.pillarsTitle, desc: d.pillarsLabel, key: "home-pillars" })}
      </div>
    </div>

    <div class="section fade-in">
      <p class="section-label">${esc(d.whereLabel)}</p>
      <h2 class="display section-title">${esc(d.whereTitle)}</h2>
      <div class="card accordion" style="padding:0 var(--space-4)">
        ${d.where.map((w) => accordionItem({ title: w.title, text: w.text })).join("")}
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
  wireAccordions(el.pages.home);
  window.wireUpPressFeedback(el.pages.home);
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
        <h1 class="display hero-title">${esc(d.heroTitle)}</h1>
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
            <div class="cycle-icon">${ICONS[WEEK_ICON[wk]].replace('class="week-icon-glyph"', 'style="width:16px;height:16px" fill="white"')}</div>
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
      </div>
    </div>

    <div class="section fade-in">
      <p class="section-label">${esc(d.connectLabel)}</p>
      <h2 class="display section-title">${esc(d.connectTitle)}</h2>
      <p class="section-text">${esc(d.connectText)}</p>
      <div class="card accordion" style="padding:0 var(--space-4);margin-top:var(--space-3)">
        ${d.connectSteps.map((s, i) => accordionItem({ title: `${t().common.step} ${i + 1}`, text: s })).join("")}
      </div>
    </div>

    <div class="section fade-in">
      <div class="five-card tg-press" id="fishFiveCta" style="cursor:pointer">
        <h2>${esc(d.fiveCardTitle)}</h2>
        <p>${esc(d.fiveCardText)}</p>
        <div style="margin-top:16px"><span class="btn" style="background:#fff;color:var(--ink)">${esc(d.fiveCardBtn)} ${ICONS.arrowUpRight}</span></div>
      </div>
    </div>
  `;
  document.getElementById("fishFiveCta").addEventListener("click", () => switchTab("five"));

  el.pages.fish.querySelectorAll("[data-open-week]").forEach((btn) => {
    btn.addEventListener("click", () => openWeekSheet(btn.dataset.openWeek));
  });
  wirePushRows(el.pages.fish);
  wireAccordions(el.pages.fish);
  window.wireUpPressFeedback(el.pages.fish);
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
    <span class="sheet-band" style="background:var(--ink);color:#fff">${esc(d.sheetLabel)}</span>
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
        <h1 class="display hero-title">${esc(d.heroTitle)}</h1>
        <p class="hero-sub">${esc(d.heroSub)}</p>
      </div>
    </div>

    <div class="section fade-in">
      <div class="card" style="padding:0 var(--space-4)">
        ${navRow({ icon: ICONS.book, title: d.resourcesTitle, desc: d.resourcesLabel, key: "team-resources" })}
        ${navRow({ icon: ICONS.users, title: d.structureTitle, desc: d.structureLabel, key: "team-structure" })}
        ${navRow({ icon: ICONS.fish, title: d.teamsTitle, desc: d.teamsLabel, key: "team-teams" })}
      </div>
    </div>

    <div class="section fade-in">
      <p class="section-label">${esc(d.growLabel)}</p>
      <h2 class="display section-title">${esc(d.growTitle)}</h2>
      <div class="card accordion" style="padding:0 var(--space-4);margin-top:var(--space-3)">
        ${d.growTips.map((g) => accordionItem({ title: g.t, text: g.d })).join("")}
      </div>
    </div>
  `;
  wirePushRows(el.pages.team);
  wireAccordions(el.pages.team);
  window.wireUpPressFeedback(el.pages.team);
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
}

/* ------------------------------------------------------------------ */
/* PAGE: FIVE — "Мои 5" digital tracker (unique feature)                */
/* ------------------------------------------------------------------ */

function uid() { return Math.random().toString(36).slice(2, 9); }

async function loadFive() {
  const raw = await window.tgStorage.get("fp_five_list");
  if (raw) {
    try { state.five = JSON.parse(raw); } catch (e) { state.five = []; }
  }
}
async function saveFive() {
  await window.tgStorage.set("fp_five_list", JSON.stringify(state.five));
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
      saveFive();
      renderFive();
      window.haptic.impact("medium");
      if (person[field]) {
        toast(field === "prayed" ? t().five.toastPrayed : t().five.toastInvited, field === "prayed" ? ICONS.praying : ICONS.invite);
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
  return `
    <div class="five-item">
      <div class="five-avatar">${esc(initials(p.name))}</div>
      <div class="five-item-body">
        <input type="text" value="${esc(p.name)}" data-name="${p.id}" readonly />
        <div class="five-toggles">
          <button class="five-toggle pray" data-toggle data-id="${p.id}" data-field="prayed" data-on="${p.prayed}">${ICONS.praying}${esc(d.prayed)}</button>
          <button class="five-toggle invite" data-toggle data-id="${p.id}" data-field="invited" data-on="${p.invited}">${ICONS.invite}${esc(d.invited)}</button>
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

  try {
    // Baseline history entry: depth 0 = "at a tab root", nothing to pop.
    history.replaceState({ depth: 0 }, "", location.pathname + location.search);

    registerHomeSubpages();
    registerFishSubpages();
    registerTeamSubpages();

    await loadFive();
    setLang(CURRENT_LANG, { silent: true });
    wireChrome();
    switchTab("home");
  } catch (err) {
    console.error("[first-priority-app] boot() failed:", err);
    hideSplash();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
