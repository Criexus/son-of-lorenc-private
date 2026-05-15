/* ════════════════════════════════════════════════════════
   Son of Lorenc – app.js
   Cockpit · Alerts · Pre-Markt · Smart · Max · Rechner
   ════════════════════════════════════════════════════════ */

"use strict";

// ══════════════════════════════════════════════════════
// SWITCH MODE + DRAWER
// ══════════════════════════════════════════════════════
function switchMode(mode) {
  if (!['smart','cockpit','max'].includes(mode)) return;
  viewMode = mode;
  localStorage.setItem('solViewMode', mode);

  // Body-Klasse
  document.body.classList.remove('smart-mode','cockpit-mode','max-mode');
  document.body.classList.add(mode + '-mode');

  // Alle Buttons mit data-mode syncen
  document.querySelectorAll('[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );
  // Drawer-Modus-Buttons extra
  document.querySelectorAll('.dModeBtn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );
  // Bottom Nav syncen
  document.querySelectorAll('.bnBtn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );

  // Inhalt rendern
  if (mode === 'cockpit') { renderCockpit?.(); renderPreMarketOverview?.(); }
  if (mode === 'smart')   renderSmart?.();

  closeDrawer();
  window.scrollTo({top:0, behavior:'smooth'});
}

function openDrawer() {
  const drawer  = document.getElementById('rightDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (!drawer) return;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden','false');
  overlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Update-Zeit
  const du = document.getElementById('drawerUpdate');
  const gu = document.getElementById('globalUpdate');
  if (du && gu) du.textContent = gu.textContent;
  // Ticker-Liste füllen
  const ts = document.getElementById('tickerSelect');
  const ds = document.getElementById('drawerTickerSelect');
  if (ts && ds) { ds.innerHTML = ts.innerHTML; ds.value = currentTicker; }
  // Aktiven Mode im Drawer markieren
  document.querySelectorAll('.dModeBtn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === viewMode)
  );
}

function closeDrawer() {
  const drawer  = document.getElementById('rightDrawer');
  const overlay = document.getElementById('drawerOverlay');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden','true');
  overlay?.classList.remove('open');
  document.body.style.overflow = '';
}

// ════════════════════════════════════════════════
function switchMode(mode) {
  if (!mode) return;
  viewMode = mode;
  localStorage.setItem("solViewMode", mode);

  // Body-Klassen
  document.body.classList.remove("smart-mode","cockpit-mode","max-mode");
  document.body.classList.add(mode + "-mode");

  // Alle data-mode Buttons syncen
  document.querySelectorAll("[data-mode]").forEach(b =>
    b.classList.toggle("active", b.dataset.mode === mode)
  );

  // Drawer-Modus-Buttons syncen
  document.querySelectorAll(".drawerModeBtn").forEach(b =>
    b.classList.toggle("active", b.dataset.mode === mode)
  );

  // Inhalt rendern
  if (mode === "cockpit") { renderCockpit?.(); renderPreMarketOverview?.(); }
  if (mode === "smart")   { renderSmart?.(); }

  // Drawer schließen
  closeDrawer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDrawer() {
  document.getElementById("rightDrawer")?.classList.add("open");
  document.getElementById("drawerOverlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
  const du = document.getElementById("drawerUpdate");
  const gu = document.getElementById("globalUpdate");
  if (du && gu) du.textContent = gu.textContent;
  // Aktien in Drawer-Select füllen
  const ds = document.getElementById("drawerTickerSelect");
  const ts = document.getElementById("tickerSelect");
  if (ds && ts) { ds.innerHTML = ts.innerHTML; ds.value = ts.value; }
}

function closeDrawer() {
  document.getElementById("rightDrawer")?.classList.remove("open");
  document.getElementById("drawerOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
}


// ── State ─────────────────────────────────────────────────
let data         = null;
let allData      = {};          // { ticker: jsonData }
let watchlist    = [];
let active       = 0;
let currentTicker = "ATAI";
let viewMode     = localStorage.getItem("solViewMode") || "smart";
let dismissedAlerts = JSON.parse(localStorage.getItem("solDismissed") || "[]");

const $ = id => document.getElementById(id);

// ── Hilfsfunktionen ───────────────────────────────────────
function esc(v = "") {
  return String(v)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function fmtDate(v) {
  if (!v) return "–";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(v));
  } catch { return String(v).slice(0,16); }
}

function fmtDateShort(v) {
  if (!v) return "–";
  try {
    return new Intl.DateTimeFormat("de-DE", { day:"2-digit", month:"2-digit" }).format(new Date(v));
  } catch { return ""; }
}

function dateMs(v) {
  if (!v) return 0;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : 0;
}

function hoursAgo(iso) {
  const ms = dateMs(iso);
  if (!ms) return Infinity;
  return (Date.now() - ms) / 3600000;
}

async function getJson(path) {
  const r = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Konnte ${path} nicht laden`);
  return r.json();
}

function formatMoney(value, currency = "$") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return `${currency}${n.toLocaleString("de-DE", { maximumFractionDigits: 4, minimumFractionDigits: n < 10 ? 2 : 2 })}`;
}

function simplifyText(text = "") {
  return String(text)
    .replaceAll("Katalysator","wichtiger Auslöser").replaceAll("Readout","Studienergebnisse")
    .replaceAll("Topline","erste Studienergebnisse").replaceAll("Cash Runway","wie lange das Geld reicht")
    .replaceAll("Bear Case","schlechter Fall").replaceAll("Base Case","normaler Fall")
    .replaceAll("Bull Case","guter Fall").replaceAll("Q1","1. Quartal").replaceAll("Q2","2. Quartal")
    .replaceAll("Q3","3. Quartal").replaceAll("Q4","4. Quartal");
}

// ── Markt-Status ──────────────────────────────────────────
function marketStateLabel(state) {
  const map = {
    PRE:      { label:"Vorbörse",    cls:"market-pre",     icon:"🌅" },
    PREPRE:   { label:"Früh-Vorbörse", cls:"market-pre",   icon:"🌅" },
    REGULAR:  { label:"Regulärer Handel", cls:"market-open", icon:"🟢" },
    POST:     { label:"Nachbörse",   cls:"market-post",    icon:"🌆" },
    POSTPOST: { label:"Spät-Nachbörse", cls:"market-post", icon:"🌆" },
    CLOSED:   { label:"Geschlossen", cls:"market-closed",  icon:"🔴" },
  };
  return map[state] || { label: state || "Unbekannt", cls:"market-closed", icon:"⚫" };
}

function pctClass(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return "";
  return n >= 0 ? "gainText" : "lossText";
}

function pctArrow(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return "";
  return n >= 0 ? "↑" : "↓";
}

function formatPct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return "–";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

// ── Wichtigkeits-Scoring ──────────────────────────────────
function importanceScore(tickerData) {
  if (!tickerData) return 0;
  const la = tickerData.latest_auto || {};
  const news    = la.news    || [];
  const triggers = la.detected_triggers || [];
  const price   = la.price   || {};
  let score = 0;

  // High-Trigger in letzten 48h
  const highTriggers = triggers.filter(t => t.level === "high" && hoursAgo(t.date) < 48);
  score += highTriggers.length * 30;

  // Medium-Trigger in letzten 48h
  score += triggers.filter(t => t.level === "medium" && hoursAgo(t.date) < 48).length * 15;

  // Relevante News in letzten 24h
  const recentNews = news.filter(n => hoursAgo(n.published_at) < 24);
  score += recentNews.filter(n => n.trigger_level === "high").length * 25;
  score += recentNews.filter(n => n.trigger_level === "medium").length * 10;
  score += Math.min(recentNews.length, 3) * 5;

  // Vorbörsen-/Nachbörsen-Bewegung
  const pre  = Math.abs(Number(price.preMarketChangePercent  || 0));
  const post = Math.abs(Number(price.postMarketChangePercent || 0));
  const reg  = Math.abs(Number(price.changePercent           || 0));
  if (pre  >= 10) score += 35;
  else if (pre  >= 5) score += 20;
  else if (pre  >= 2) score += 8;
  if (post >= 10) score += 25;
  else if (post >= 5) score += 15;
  if (reg  >= 10) score += 20;
  else if (reg  >= 5) score += 10;

  return score;
}

function importanceLabel(score) {
  if (score >= 60) return { text:"🔴 Sehr wichtig heute",    cls:"imp-high",   short:"Sehr wichtig" };
  if (score >= 30) return { text:"🟠 Heute beobachten",      cls:"imp-medium", short:"Beobachten" };
  if (score >= 10) return { text:"🟡 Im Blick behalten",     cls:"imp-low",    short:"Im Blick" };
  return              { text:"⚪ Kein neuer Impuls",         cls:"imp-none",   short:"Kein Impuls" };
}

function preMarketSignal(price) {
  if (!price) return null;
  const pct = Number(price.preMarketChangePercent || price.postMarketChangePercent || 0);
  const hasData = price.preMarketPrice || price.postMarketPrice;
  if (!hasData) return null;
  const isPost  = !!price.postMarketPrice && !price.preMarketPrice;
  const label   = isPost ? "Nachbörse" : "Vorbörse";
  const p       = isPost ? price.postMarketPrice : price.preMarketPrice;
  const chg     = isPost ? price.postMarketChange : price.preMarketChange;

  let signal, cls;
  if (pct >=  10) { signal = "stark positiv";                cls = "pre-strong-up"; }
  else if (pct >=  3) { signal = "leicht positiv";           cls = "pre-up"; }
  else if (pct >  -3) { signal = "neutral";                  cls = "pre-neutral"; }
  else if (pct > -10) { signal = "leicht negativ";           cls = "pre-down"; }
  else                { signal = "stark negativ";             cls = "pre-strong-down"; }

  return { label, price: p, change: chg, changePct: pct, signal, cls, isPost };
}

// ── News-Kategorisierung ──────────────────────────────────
function newsCategory(item) {
  const text = ((item.trigger_type || "") + " " + (item.title || "")).toLowerCase();
  if (/fda|ema|approval|zulassung|breakthrough|crl|fast.track|priority.review/.test(text)) return "FDA / Regulatorisch";
  if (/phase.3|phase.iii|phase.2|phase.ii|topline|readout|studien|clinical.trial|endpoint/.test(text)) return "Studiendaten";
  if (/offering|dilution|reverse.split|kapitalerhöhung|atm|s-1|424b|verwässer/.test(text)) return "Kapitalerhöhung";
  if (/earnings|quarter|cash|10-q|10-k|20-f|umsatz|financial.result/.test(text)) return "Quartalszahlen";
  if (/partnership|collaboration|license|deal|merger|acquisition/.test(text)) return "Partnerschaft / Deal";
  if (/analyst|price.target|upgrade|downgrade|rating/.test(text)) return "Analystenmeldung";
  if (/ceo|cfo|management|executive|strategy|strategie/.test(text)) return "Management / Strategie";
  return "Allgemeine Meldung";
}

function newsExplain(item) {
  const cat = newsCategory(item);
  const explanations = {
    "Studiendaten":         "Studienergebnisse sind oft der wichtigste Kursauslöser bei Biotech-Aktien. Entscheidend: Wie stark sind die Daten? Gibt es Nebenwirkungen? Ist der Effekt klinisch relevant?",
    "FDA / Regulatorisch":  "Behördenentscheide können den Kurs extrem bewegen – positiv wie negativ. Wichtig: Wurde eine Zulassung erteilt, abgelehnt oder gibt es neue Anforderungen?",
    "Kapitalerhöhung":      "Neue Aktien verwässern den Wert der bestehenden Aktien. Das ist oft ein kurzfristiger Belastungsfaktor. Frage: Wie hoch ist die Verwässerung und wofür wird das Geld verwendet?",
    "Quartalszahlen":       "Zeigt die finanzielle Gesundheit des Unternehmens – besonders Cash-Bestand und Runway (wie lange das Geld noch reicht).",
    "Partnerschaft / Deal": "Kooperationen können den Kurs stark steigen lassen, wenn sie als strategisch wertvoll eingestuft werden. Details prüfen: Wer zahlt? Wie viel? Was genau?",
    "Analystenmeldung":     "Analysten-Einschätzungen haben kurzfristigen Einfluss, sollten aber nicht überbewertet werden. Quelle und Interessenkonflikte prüfen.",
    "Management / Strategie":"Führungswechsel oder Strategieanpassungen können Unsicherheit erzeugen oder Vertrauen stärken – je nach Kontext.",
  };
  return explanations[cat] || "Bitte die Originalquelle prüfen und selbst einordnen. Die App kann nicht alle Meldungen sicher bewerten.";
}

// ── Boot ──────────────────────────────────────────────────
async function boot() {
  await loadMeta();
  watchlist = await getJson("/data/watchlist.json");
  buildTickerSelect();
  populateDeleteDropdown(watchlist);

  // refreshBtn → initMobileNav()

  initViewMode();
  initDropdownBehavior();
  initAdminForm();
  initDeleteForm();
  initMobileNav();

  // Alle Daten für Cockpit laden
  await loadAllData();
  await loadTicker(watchlist[0]?.ticker || "ATAI");
}

function buildTickerSelect() {
  const opts = watchlist.map(x =>
    `<option value="${esc(x.ticker)}">${esc(x.ticker)} · ${esc(x.name)}</option>`
  ).join("");
  if ($("tickerSelect")) $("tickerSelect").innerHTML = opts;
}

async function loadMeta() {
  try {
    const meta = await getJson("/data/meta.json");
    $("globalUpdate").textContent = `Update: ${fmtDate(meta.last_update_utc)}`;
  } catch {
    $("globalUpdate").textContent = "Update: –";
  }
}

async function loadAllData() {
  const results = await Promise.allSettled(
    watchlist.map(async x => {
      try {
        const d = await getJson(`/data/${x.ticker}.json`);
        allData[x.ticker] = d;
      } catch { /* keep old if available */ }
    })
  );
  renderCockpit();
  renderAlertBanner();
  renderNotificationCenter();
  renderPreMarketOverview();
}

async function loadTicker(ticker) {
  currentTicker = ticker;
  if ($("tickerSelect")) $("tickerSelect").value = ticker;
  data = allData[ticker] || await getJson(`/data/${ticker}.json`);
  allData[ticker] = data;
  active = 0;
  render();
}

// ── Mode Switching ────────────────────────────────────────
function initViewMode() {
  switchMode(viewMode);
  initTradeCalculator();
}

// ══════════════════════════════════════════════════════════
// ALERT BANNER
// ══════════════════════════════════════════════════════════
function renderAlertBanner() {
  const banner = $("alertBanner");
  if (!banner) return;

  const alerts = collectAlerts();
  const visible = alerts.filter(a => !dismissedAlerts.includes(a.id));
  if (!visible.length) {
    banner.innerHTML = "";
    banner.classList.remove("has-alerts");
    document.body.classList.remove("has-alerts");
    return;
  }

  banner.classList.add("has-alerts");
  document.body.classList.add("has-alerts");
  banner.innerHTML = visible.slice(0, 3).map(a => `
    <div class="alertCard alertCard--${a.level}" role="alert">
      <div class="alertCardBody">
        <span class="alertLevel">${a.levelIcon} ${a.levelLabel}</span>
        <div class="alertMain">
          <strong class="alertTicker">${esc(a.ticker)}</strong>
          <span class="alertCategory">${esc(a.category)}</span>
          <p class="alertTitle">${esc(a.title)}</p>
          <p class="alertExplain">${esc(a.explain)}</p>
          <span class="alertMeta">${esc(a.source)} · ${esc(fmtDate(a.date))}</span>
        </div>
      </div>
      <div class="alertActions">
        ${a.url ? `<a class="btnPrimary btnSmall" href="${esc(a.url)}" target="_blank" rel="noopener">Quelle öffnen →</a>` : ""}
        <button class="btnGhost btnSmall" onclick="switchToTicker('${esc(a.ticker)}','smart')">Im Detail ansehen</button>
        <button class="btnGhost btnSmall" onclick="dismissAlert('${esc(a.id)}')">✓ Gelesen</button>
      </div>
    </div>
  `).join("");
}

function collectAlerts() {
  const alerts = [];
  const cutoff = 48; // Stunden
  watchlist.forEach(item => {
    const d = allData[item.ticker];
    if (!d) return;
    const la = d.latest_auto || {};
    const price = la.price || {};

    // High/Medium News-Trigger
    (la.detected_triggers || []).forEach((t, i) => {
      if (!["high","medium"].includes(t.level)) return;
      if (hoursAgo(t.date) > cutoff) return;
      const id = `trigger-${item.ticker}-${i}`;
      alerts.push({
        id, ticker: item.ticker,
        level:      t.level,
        levelIcon:  t.level === "high" ? "🔴" : "🟠",
        levelLabel: t.level === "high" ? "Hoch" : "Mittel",
        title:      t.title || t.reason || "Wichtiger Hinweis",
        category:   t.type || "Signal",
        explain:    t.assessment || t.watch || "Bitte Originalquelle prüfen.",
        date:       t.date,
        source:     t.source || "Erkannte Signal",
        url:        t.url || null,
      });
    });

    // High-Level News
    (la.news || []).filter(n => n.trigger_level === "high" && hoursAgo(n.published_at) < cutoff)
      .slice(0, 2).forEach((n, i) => {
        const id = `news-${item.ticker}-${i}`;
        alerts.push({
          id, ticker: item.ticker,
          level: "high", levelIcon: "🔴", levelLabel: "Wichtige News",
          title:    n.title || "Wichtige Meldung",
          category: newsCategory(n),
          explain:  newsExplain(n),
          date:     n.published_at,
          source:   n.source || "News",
          url:      n.url || null,
        });
      });

    // Starke Vorbörsenbewegung
    const pre = Math.abs(Number(price.preMarketChangePercent || 0));
    if (pre >= 8 && price.preMarketPrice) {
      alerts.push({
        id: `pre-${item.ticker}`,
        ticker: item.ticker,
        level: pre >= 15 ? "high" : "medium",
        levelIcon: pre >= 15 ? "🔴" : "🟠",
        levelLabel: "Vorbörsliche Bewegung",
        title: `${item.ticker} bewegt sich vorbörslich ${formatPct(pre)} ${pre > 0 ? "aufwärts" : "abwärts"}`,
        category: "Vorbörsliche Bewegung",
        explain: "Starke Vorbörsenbewegung erkannt. Die Richtung kann sich zur regulären Eröffnung noch ändern – Volumen und News nach Eröffnung prüfen.",
        date: price.preMarketTime || la.last_update_utc,
        source: "Yahoo Finance",
        url: null,
      });
    }
  });

  // Sortiere: high zuerst, dann nach Datum
  alerts.sort((a,b) => {
    if (a.level === "high" && b.level !== "high") return -1;
    if (b.level === "high" && a.level !== "high") return 1;
    return dateMs(b.date) - dateMs(a.date);
  });
  return alerts;
}

window.dismissAlert = id => {
  if (!dismissedAlerts.includes(id)) dismissedAlerts.push(id);
  localStorage.setItem("solDismissed", JSON.stringify(dismissedAlerts));
  renderAlertBanner();
};

window.switchToTicker = (ticker, mode) => {
  loadTicker(ticker).then(() => {
    viewMode = mode;
    const btn = mode === "smart" ? $("smartModeBtn") : $("maxModeBtn");
    btn?.click();
  });
};

// ══════════════════════════════════════════════════════════
// COCKPIT – alle Ticker
// ══════════════════════════════════════════════════════════
function renderCockpit() {
  const grid = $("cockpitGrid");
  if (!grid) return;

  const scored = watchlist.map(item => ({
    item,
    d: allData[item.ticker],
    score: importanceScore(allData[item.ticker]),
  })).sort((a, b) => b.score - a.score);

  grid.innerHTML = scored.map(({ item, d, score }) => {
    if (!d) return `<div class="cockpitCard cockpitCard--empty"><span class="tickerBadge">${esc(item.ticker)}</span><p>Daten werden geladen…</p></div>`;

    const la     = d.latest_auto || {};
    const price  = la.price || {};
    const imp    = importanceLabel(score);
    const mState = marketStateLabel(price.marketState);
    const pre    = preMarketSignal(price);
    const news   = (la.news || []).filter(n => hoursAgo(n.published_at) < 48).slice(0,1)[0];
    const cat    = (la.detected_triggers || []).filter(t => t.level === "high").slice(0,1)[0];

    const p         = price.regularMarketPrice;
    const chgPct    = price.changePercent;
    const currency  = price.currency === "EUR" ? "€" : "$";

    return `
      <div class="cockpitCard ${imp.cls}" onclick="switchToTicker('${esc(item.ticker)}','smart')" role="button" tabindex="0"
           aria-label="${esc(item.ticker)} – ${esc(imp.short)}">
        <div class="cockpitCardTop">
          <span class="tickerBadge">${esc(item.ticker)}</span>
          <span class="marketState ${mState.cls}">${mState.icon} ${esc(mState.label)}</span>
        </div>

        <div class="cockpitCardPrice">
          <span class="cockpitPrice">${formatMoney(p, currency)}</span>
          <span class="cockpitChg ${pctClass(chgPct)}">${pctArrow(chgPct)} ${formatPct(chgPct)}</span>
        </div>

        ${pre ? `<div class="cockpitPre ${pre.cls}">
          ${pre.label}: ${formatMoney(pre.price, currency)}
          <span class="${pctClass(pre.changePct)}">${formatPct(pre.changePct)}</span>
          <em>${esc(pre.signal)}</em>
        </div>` : ""}

        <div class="cockpitImp ${imp.cls}">${imp.text}</div>

        ${news ? `<div class="cockpitNews">
          <span class="cockpitNewsCat">${esc(newsCategory(news))}</span>
          <span class="cockpitNewsTitle">${esc(news.title || "").slice(0,80)}${(news.title||"").length > 80 ? "…" : ""}</span>
        </div>` : ""}

        ${cat ? `<div class="cockpitTrigger">⚠ ${esc(cat.title || "").slice(0,70)}</div>` : ""}

        <div class="cockpitFooter">
          <span>Update: ${esc(fmtDate(la.last_update_utc))}</span>
          <span class="cockpitDetail">Details →</span>
        </div>
      </div>
    `;
  }).join("");
}

// ══════════════════════════════════════════════════════════
// VORBÖRSE – Übersicht aller Ticker
// ══════════════════════════════════════════════════════════
function renderPreMarketOverview() {
  const grid = $("preMarketGrid");
  if (!grid) return;

  const items = watchlist.map(item => {
    const d = allData[item.ticker];
    if (!d) return null;
    const price = d.latest_auto?.price || {};
    const pre   = preMarketSignal(price);
    return { item, price, pre };
  }).filter(Boolean);

  const withData = items.filter(x => x.pre);
  if (!withData.length) {
    grid.innerHTML = `<p class="mutedBox">Keine Vor-/Nachbörsendaten vorhanden. Werden beim nächsten Update um Vorbörsendaten von Yahoo Finance ergänzt.</p>`;
    return;
  }

  grid.innerHTML = withData.map(({ item, price, pre }) => {
    const currency = price.currency === "EUR" ? "€" : "$";
    return `
      <div class="preMarketCard ${pre.cls}" onclick="switchToTicker('${esc(item.ticker)}','smart')" role="button" tabindex="0">
        <div class="preMarketTop">
          <span class="tickerBadge">${esc(item.ticker)}</span>
          <span class="preMarketLabel">${esc(pre.label)}</span>
        </div>
        <div class="preMarketPrice">
          ${formatMoney(pre.price, currency)}
          <span class="${pctClass(pre.changePct)}">${pctArrow(pre.changePct)} ${formatPct(pre.changePct)}</span>
        </div>
        <div class="preMarketSignalBadge">${esc(pre.signal)}</div>
        <div class="preMarketBase">Schluss: ${formatMoney(price.regularMarketPrice, currency)}</div>
        <div class="preMarketTime">${esc(fmtDate(pre.isPost ? price.postMarketTime : price.preMarketTime))}</div>
      </div>
    `;
  }).join("");
}

// Vorbörse für aktive Aktie (Smart-Modus)
function renderSmartPreMarket() {
  const el = $("smartPreMarket");
  if (!el || !data) return;
  const price = data.latest_auto?.price || {};
  const pre   = preMarketSignal(price);
  const currency = price.currency === "EUR" ? "€" : "$";

  // Kein marketState und keine Pre/Post-Daten → Card ausblenden
  if (!pre && !price.marketState) {
    el.innerHTML = ""; el.style.display = "none"; return;
  }
  el.style.display = "";
  const mState = marketStateLabel(price.marketState);

  if (!pre) {
    if (!price.marketState || price.marketState === "CLOSED") {
      el.innerHTML = ""; el.style.display = "none"; return;
    }
    el.innerHTML = `<div class="cardHead"><span class="kicker">📊 Börsenstatus</span>
      <h2>${mState.icon} ${esc(mState.label)}</h2>
      <p>Letzter Kurs: <strong>${formatMoney(price.regularMarketPrice, currency)}</strong></p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="cardHead">
      <span class="kicker">🌅 ${esc(pre.label)}</span>
      <h2>${mState.icon} ${esc(mState.label)}</h2>
    </div>
    <div class="preMarketDetail">
      <div class="pmStat"><span>${esc(pre.label)}kurs</span><strong>${formatMoney(pre.price, currency)}</strong></div>
      <div class="pmStat"><span>Veränderung</span><strong class="${pctClass(pre.changePct)}">${pctArrow(pre.changePct)} ${formatPct(pre.changePct)}</strong></div>
      <div class="pmStat"><span>Letzter Schluss</span><strong>${formatMoney(price.regularMarketPrice, currency)}</strong></div>
      <div class="pmStat"><span>Signal</span><strong>${esc(pre.signal)}</strong></div>
    </div>
    <p class="pmNote">⚠ ${pre.label}-Daten haben geringe Liquidität. Kurse können sich zur Eröffnung stark ändern.</p>
  `;
}

// ══════════════════════════════════════════════════════════
// BENACHRICHTIGUNGSZENTRALE
// ══════════════════════════════════════════════════════════
function renderNotificationCenter() {
  const list    = $("notifList");
  const counter = $("notifCount");
  if (!list) return;

  const alerts = collectAlerts();
  if (counter) counter.textContent = `${alerts.length} Meldungen`;

  if (!alerts.length) {
    list.innerHTML = `<p class="mutedBox">Keine aktuellen Meldungen. Beim nächsten Update werden neue Signale erscheinen.</p>`;
    return;
  }

  list.innerHTML = alerts.map(a => `
    <div class="notifItem notifItem--${a.level} ${dismissedAlerts.includes(a.id) ? "notifRead" : ""}">
      <div class="notifLeft">
        <span class="notifIcon">${a.levelIcon}</span>
      </div>
      <div class="notifBody">
        <div class="notifMeta">
          <strong>${esc(a.ticker)}</strong>
          <span>${esc(a.category)}</span>
          <span class="notifTime">${esc(fmtDate(a.date))}</span>
          ${dismissedAlerts.includes(a.id) ? '<span class="notifReadBadge">Gelesen</span>' : ""}
        </div>
        <p class="notifTitle">${esc(a.title)}</p>
        <p class="notifExplain">${esc(a.explain)}</p>
      </div>
      <div class="notifActions">
        <button class="btnGhost btnSmall" onclick="switchToTicker('${esc(a.ticker)}','smart')">Ansehen</button>
        ${!dismissedAlerts.includes(a.id)
          ? `<button class="btnGhost btnSmall" onclick="dismissAlert('${esc(a.id)}')">✓</button>`
          : ""}
      </div>
    </div>
  `).join("");
}

// ══════════════════════════════════════════════════════════
// PUSH-BENACHRICHTIGUNGEN (vorbereitet)
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// SMART-ANSICHT – einzelne Aktie
// ══════════════════════════════════════════════════════════
function renderSmart() {
  if (!data || !$("smartHome")) return;

  const la    = data.latest_auto || {};
  const price = la.price || {};
  const p     = price.regularMarketPrice;
  const currency = price.currency === "EUR" ? "€" : "$";
  const chgPct = price.changePercent;

  $("smartHeadline").textContent = `${data.ticker} · ${data.name || data.ticker}`;
  $("smartThesis").textContent   = simplifyText(data.thesis || "Kompakte Analyse.");

  $("smartPriceGrid").innerHTML = `
    <div class="smartMetric">
      <span>Aktueller Kurs</span>
      <b>${formatMoney(p, currency)}</b>
      <small class="${pctClass(chgPct)}">${pctArrow(chgPct)} ${formatPct(chgPct)} vs. Vortag</small>
    </div>
    <div class="smartMetric">
      <span>52-Wochen-Spanne</span>
      <b style="font-size:18px">${esc(price.fiftyTwoWeekRange || "–")}</b>
      <small>Tief – Hoch</small>
    </div>
    <div class="smartMetric">
      <span>Risiko-Einordnung</span>
      <b style="font-size:18px">${esc(data.character || "spekulativ")}</b>
      <small>Keine Empfehlung</small>
    </div>
  `;

  renderSmartPreMarket();
  renderSmartNews();
  renderSmartUpcoming();
  renderSmartAssessment();
  renderSmartChart();
  updateTradeCalc();
}

function getAutoNews() { return (data?.latest_auto?.news || []).filter(Boolean); }

function recentNews(days = 14) {
  const cutoff = Date.now() - days * 86400000;
  return getAutoNews()
    .filter(n => { const ms = dateMs(n.published_at); return ms && ms >= cutoff; })
    .sort((a, b) => dateMs(b.published_at) - dateMs(a.published_at));
}

function renderSmartNews() {
  const target = $("smartNews");
  if (!target) return;
  let news = recentNews(14);
  const label14 = true;
  if (!news.length) {
    news = getAutoNews().sort((a,b) => dateMs(b.published_at) - dateMs(a.published_at)).slice(0, 5);
  }
  if (!news.length) {
    target.innerHTML = `<p class="mutedBox">Noch keine News geladen. Warte auf das nächste automatische Update.</p>`;
    return;
  }
  const showOldNote = !label14 || recentNews(14).length === 0;

  target.innerHTML = (showOldNote ? `<p class="mutedBox">Keine News der letzten 14 Tage – ältere Meldungen:</p>` : "") +
    news.slice(0, 8).map(n => `
      <div class="smartNewsItem ${esc(n.trigger_level || "")}">
        <div class="newsItemLeft"></div>
        <div class="newsItemBody">
          <div class="smartNewsMeta">
            <span class="newsCatBadge">${esc(newsCategory(n))}</span>
            ${esc(fmtDate(n.published_at))} · ${esc(n.source || "–")}
          </div>
          <h3>${esc(n.title || "Ohne Titel")}</h3>
          <details class="newsExplainAccordion">
            <summary>Einordnung &amp; Was beachten?</summary>
            <div class="newsExplainBody">
              <p><strong>Was ist passiert?</strong> ${esc(n.assessment || n.summary || "Bitte Quelle prüfen.")}</p>
              <p><strong>Was könnte es bedeuten?</strong> ${esc(newsExplain(n))}</p>
              ${n.watch ? `<p><strong>Heute beobachten:</strong> ${esc(simplifyText(n.watch))}</p>` : ""}
              ${n.impact ? `<p><strong>Möglicher Kurseinfluss:</strong> ${esc(n.impact)}</p>` : ""}
            </div>
          </details>
          ${n.url ? `<a class="sourceLink" href="${esc(n.url)}" target="_blank" rel="noopener">Quelle öffnen →</a>` : ""}
        </div>
      </div>
    `).join("");
}

function renderSmartUpcoming() {
  const target = $("smartUpcoming");
  if (!target) return;
  const catalysts = (data.catalysts || []).slice(0, 3);
  const triggers  = (data.latest_auto?.detected_triggers || []).slice(0, 3);
  const cards = [
    ...catalysts.map(c => ({ tag: c.tag || "Termin", title: c.title, text: c.text })),
    ...triggers.map(t  => ({ tag: t.type || "Signal", title: t.title || t.reason, text: t.assessment || t.watch })),
  ].slice(0, 5);

  if (!cards.length) {
    target.innerHTML = `<p class="mutedBox">Keine bevorstehenden Termine erkannt. Achte auf Studienupdates, Quartalszahlen und Behördenmeldungen.</p>`;
    return;
  }
  target.innerHTML = cards.map(c => `
    <div class="smartUpcomingItem">
      <span class="tag">${esc(simplifyText(c.tag))}</span>
      <b>${esc(simplifyText(c.title || "Wichtiges Ereignis"))}</b>
      <p>${esc(simplifyText(c.text || ""))}</p>
    </div>
  `).join("");
}

function renderSmartAssessment() {
  const target = $("smartAssessment");
  if (!target) return;
  const clear  = (data.clear_view || []).slice(0, 3);
  const zones  = (data.zones || []).slice(0, 3);
  const recent = recentNews(14);
  const high   = recent.filter(n => n.trigger_level === "high").length;
  let html = "";

  if (clear.length) {
    html += clear.map(p => `<p>${esc(simplifyText(p))}</p>`).join("");
  } else {
    html += `<p>Diese Aktie ist aktuell stark von News abhängig. Kurs, Volumen, Finanzierung und mögliche Studien- oder Behördenmeldungen beobachten.</p>`;
  }

  html += `<div class="smartSignal ${high ? "hot" : ""}">
    <b>${high ? "⚠ Achtung: Wichtige Meldungen erkannt" : "✓ Aktueller Status"}</b>
    <span>${high
      ? `${high} stark kursrelevante Meldung(en) in den letzten 14 Tagen. News- und Kursreaktion genau beobachten.`
      : "Keine extremen Trigger in den letzten 14 Tagen. Trotzdem regelmäßig prüfen."}</span>
    <em class="disclaimer">Keine Kaufempfehlung – nur Beobachtungs- und Risikoeinordnung.</em>
  </div>`;

  if (zones.length) {
    html += `<div class="smartZones">${zones.map(z => `
      <div><b>${esc(simplifyText(z.zone))}</b><span>${esc(simplifyText(z.text))}</span></div>
    `).join("")}</div>`;
  }
  target.innerHTML = html;
}

// ══════════════════════════════════════════════════════════
// SMART-CHART
// ══════════════════════════════════════════════════════════
function getSmartChartHistory() {
  const intraday = (data?.latest_auto?.price_history_1d || [])
    .map(x => ({ t: dateMs(x.t), price: Number(x.price) }))
    .filter(x => x.t && Number.isFinite(x.price) && x.price > 0)
    .sort((a,b) => a.t - b.t);
  if (intraday.length >= 2) return { history: intraday.slice(-120), label: "Tagesverlauf (gespeichert)", mode:"1D" };

  const month = (data?.latest_auto?.price_history || [])
    .map(x => ({ t: dateMs(x.t), price: Number(x.price) }))
    .filter(x => x.t && Number.isFinite(x.price) && x.price > 0)
    .sort((a,b) => a.t - b.t);
  if (month.length >= 2) return { history: month.slice(-40), label: "1-Monats-Verlauf (gespeichert)", mode:"1M" };

  return { history: [], label: "Noch zu wenig Kursdaten", mode:"leer" };
}

function newsTypeColor(kind = "") {
  const k = String(kind).toLowerCase();
  if (/fda|regulat/.test(k)) return "#f4b45c";
  if (/studie|phase|readout/.test(k)) return "#82d4ff";
  if (/finanz|verwässer|offering|kapital/.test(k)) return "#ff8c8c";
  if (/sec/.test(k)) return "#c8a2ff";
  return "#9ff0c0";
}

function renderSmartChart() {
  const svg  = $("smartChart");
  const note = $("smartChartNote");
  if (!svg) return;

  const selected = getSmartChartHistory();
  const history  = selected.history;
  const price    = data?.latest_auto?.price || {};
  const currentP = Number(price.regularMarketPrice);

  if (history.length < 2) {
    svg.innerHTML = `
      <rect x="0" y="0" width="720" height="260" rx="18" fill="rgba(255,255,255,.03)"/>
      <text x="360" y="118" text-anchor="middle" fill="rgba(255,255,255,.8)" font-size="18" font-weight="800">Noch zu wenig Kursdaten</text>
      <text x="360" y="148" text-anchor="middle" fill="rgba(255,255,255,.45)" font-size="13">Wird beim nächsten Update automatisch gefüllt.</text>
    `;
    if (note) note.textContent = "Chart wird beim nächsten Datenupdate automatisch gefüllt.";
    renderSmartChartNewsTimeline([]);
    return;
  }

  const w = 720, h = 260, padL = 52, padR = 18, padT = 32, padB = 28;
  const prices = history.map(x => x.price);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  // Aktuellen Kurs in Range einbeziehen
  if (Number.isFinite(currentP) && currentP > 0) {
    min = Math.min(min, currentP);
    max = Math.max(max, currentP);
  }
  const spread = max - min || max * 0.04;
  min -= spread * 0.05;
  max += spread * 0.1;

  const minT = history[0].t, maxT = history[history.length-1].t;
  const xTime = t => padL + ((t - minT) / (maxT - minT || 1)) * (w - padL - padR);
  const yAt   = p => h - padB - ((p - min) / (max - min)) * (h - padT - padB);

  const pts = history.map(x => `${xTime(x.t).toFixed(1)},${yAt(x.price).toFixed(1)}`).join(" ");
  const first = history[0].price, last = history[history.length-1].price;
  const diff  = last - first, pct = first ? (diff/first)*100 : 0;
  const stroke = diff >= 0 ? "#3cd694" : "#ff5757";

  // Grid Lines
  const grid = [0,1,2,3].map(i => {
    const y = padT + i * ((h-padT-padB)/3);
    const pVal = max - i*((max-min)/3);
    return `
      <line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="rgba(255,255,255,.07)" stroke-dasharray="4 4"/>
      <text x="${padL-4}" y="${y+4}" text-anchor="end" fill="rgba(255,255,255,.45)" font-size="10">${pVal.toFixed(2)}</text>`;
  }).join("");

  // Aktueller Kurs – gestrichelte Linie
  let currentLine = "";
  if (Number.isFinite(currentP) && currentP > 0) {
    const cy = yAt(currentP);
    const lineColor = diff >= 0 ? "#3cd694" : "#ff5757";
    currentLine = `
      <line x1="${padL}" y1="${cy}" x2="${w-padR}" y2="${cy}"
            stroke="${lineColor}" stroke-width="1.5" stroke-dasharray="6 4" opacity=".75"/>
      <rect x="${w-padR-52}" y="${cy-9}" width="52" height="16" rx="6" fill="${lineColor}" opacity=".18"/>
      <text x="${w-padR-26}" y="${cy+4}" text-anchor="middle" fill="${lineColor}" font-size="10" font-weight="800">
        ${formatMoney(currentP)} akt.
      </text>`;
  }

  // News-Marker
  const allNews = (data?.latest_auto?.news || [])
    .filter(n => { const t = dateMs(n.published_at); return t >= minT - 86400000 && t <= maxT + 86400000; })
    .sort((a,b) => dateMs(a.published_at) - dateMs(b.published_at))
    .slice(0, 10);

  const markers = allNews.map((n, idx) => {
    const t = dateMs(n.published_at);
    if (!t) return "";
    const cx = xTime(t);
    const cy = yAt(history.reduce((best, h) => Math.abs(h.t-t) < Math.abs(best.t-t) ? h : best, history[0]).price);
    const color = newsTypeColor(n.trigger_type || "");
    return `
      <g class="newsMarkerGroup" style="cursor:pointer">
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="14" fill="${color}" opacity=".15"/>
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6"  fill="${color}" stroke="rgba(0,0,0,.5)" stroke-width="2"/>
        <text   x="${cx.toFixed(1)}"  y="${(cy-10).toFixed(1)}" text-anchor="middle" fill="${color}" font-size="10" font-weight="900">${idx+1}</text>
      </g>`;
  }).join("");

  // Start/End Labels
  const fmt = selected.mode === "1D"
    ? t => new Date(t).toLocaleTimeString("de-DE", {hour:"2-digit",minute:"2-digit"})
    : t => new Date(t).toLocaleDateString("de-DE",  {day:"2-digit",month:"2-digit"});

  svg.innerHTML = `
    <rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="rgba(0,0,0,.22)"/>
    ${grid}
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${xTime(minT).toFixed(1)}" cy="${yAt(first).toFixed(1)}" r="4" fill="${stroke}" stroke="rgba(0,0,0,.45)" stroke-width="2"/>
    <circle cx="${xTime(maxT).toFixed(1)}" cy="${yAt(last).toFixed(1)}"  r="5" fill="${stroke}" stroke="rgba(0,0,0,.45)" stroke-width="2"/>
    ${currentLine}
    ${markers}
    <text x="${padL}"  y="${h-6}" fill="rgba(255,255,255,.45)" font-size="10">${fmt(minT)}</text>
    <text x="${w-padR}" y="${h-6}" text-anchor="end" fill="rgba(255,255,255,.45)" font-size="10">${fmt(maxT)}</text>
  `;

  if (note) {
    const currency = price.currency === "EUR" ? "€" : "$";
    note.innerHTML = `${selected.label} · Letzter Kurs: <b>${formatMoney(last, currency)}</b> · Veränderung: <b class="${pctClass(pct)}">${diff>=0?"+":""}${formatMoney(diff, currency)} (${pct.toFixed(1)}%)</b>`;
  }

  renderSmartChartNewsTimeline(allNews);
}

function renderSmartChartNewsTimeline(newsList = []) {
  const el = $("smartChartNewsTimeline");
  if (!el) return;
  if (!newsList.length) {
    el.innerHTML = `<div class="timelineEmpty"><b>Keine passenden News im Chartbereich.</b> <span>Der Chart bleibt aktuell.</span></div>`;
    return;
  }
  el.innerHTML = `
    <div class="timelineTitle">News-Zeitlinie</div>
    ${newsList.map((n, i) => `
      <button class="timelineItem" type="button">
        <span class="dotMini" style="background:${newsTypeColor(n.trigger_type||"")}"></span>
        <span>
          <b>${esc(fmtDate(n.published_at))} · ${esc(newsCategory(n))}</b>
          <small>${esc((n.title||"").slice(0,80))}</small>
        </span>
      </button>
    `).join("")}
  `;
}

// ══════════════════════════════════════════════════════════
// MAX-ANSICHT
// ══════════════════════════════════════════════════════════
function render() {
  if (!data) return;
  document.title = `Son of Lorenc – ${data.ticker}`;

  $("eyebrow").textContent  = data.eyebrow  || `${data.ticker} · Phasenanalyse`;
  $("headline").textContent = data.headline || `${data.ticker} – Analyse`;
  $("thesis").textContent   = data.thesis   || "";

  const la = data.latest_auto || {};
  const p  = la.price || {};
  const currency = p.currency === "EUR" ? "€" : "$";

  $("status").innerHTML = `
    <span class="pill"><strong>Stand:</strong> ${esc(data.stand || "offen")}</span>
    <span class="pill"><strong>Ticker:</strong> ${esc(data.exchange||"")}:${esc(data.ticker)}</span>
    <span class="pill"><strong>Phase:</strong> ${esc(data.phase || "offen")}</span>
    <span class="pill ${pctClass(p.changePercent)}"><strong>Kurs:</strong> ${formatMoney(p.regularMarketPrice, currency)} (${formatPct(p.changePercent)})</span>
  `;

  $("scoreGrid").innerHTML = (data.metrics || []).map(m => `
    <div class="metric">
      <div class="label">${esc(m.label)}</div>
      <div class="value">${esc(m.value)}</div>
      <div class="note">${esc(m.note)}</div>
    </div>`).join("");

  $("chartSubtitle").textContent = data.chart_subtitle || "";
  $("chartNote").textContent     = data.chart_note     || "";
  draw();
  renderList();
  renderDetail();

  $("pipelineIntro").textContent = data.pipeline_intro || "";
  $("pipeline").innerHTML = (data.pipeline || []).map(p => `
    <div class="pipeCard">
      <span class="stage ${esc(p.class||"early")}">${esc(simplifyText(p.stage))}</span>
      <h3>${esc(simplifyText(p.name))}</h3>
      <p>${esc(simplifyText(p.text))}</p>
      <div class="rank"><i style="width:${Number(p.score||0)}%"></i></div>
    </div>`).join("");

  $("zones").innerHTML = (data.zones || []).map(z => `
    <div class="zone"><b>${esc(simplifyText(z.zone))}</b><span>${esc(simplifyText(z.text))}</span></div>`).join("");

  $("catalysts").innerHTML = (data.catalysts || []).map(c => `
    <div class="catalystItem">
      <span class="tag">${esc(simplifyText(c.tag))}</span>
      <h3>${esc(simplifyText(c.title))}</h3>
      <p>${esc(simplifyText(c.text))}</p>
    </div>`).join("");

  const s = data.scenarios || {};
  $("bearTitle").textContent = simplifyText(s.bear?.title || "Schlechtester Fall");
  $("bearText").textContent  = simplifyText(s.bear?.text  || "");
  $("baseTitle").textContent = simplifyText(s.base?.title || "Wahrscheinlichster Fall");
  $("baseText").textContent  = simplifyText(s.base?.text  || "");
  $("bullTitle").textContent = simplifyText(s.bull?.title || "Bester Fall");
  $("bullText").textContent  = simplifyText(s.bull?.text  || "");

  $("risks").innerHTML = (data.risks || []).map(r => `
    <div class="riskItem"><b>${esc(simplifyText(r.title))}:</b> ${esc(simplifyText(r.text))}</div>`).join("");

  renderLiveNews();
  renderTriggers();
  renderSecFilings();
  renderSmart();

  $("clearView").innerHTML = (data.clear_view || []).map(p => `<p>${esc(simplifyText(p))}</p>`).join("");
  $("sources").innerHTML   = (data.sources || []).map(src => {
    if (typeof src === "string") return `<li>${esc(src)}</li>`;
    return `<li><a href="${esc(src.url||"#")}" target="_blank" rel="noopener">${esc(src.title||src.url||"Quelle")}</a></li>`;
  }).join("");
}

function renderLiveNews() {
  const news = data.latest_auto?.news || [];
  $("liveNewsCount").textContent = `${news.length} Artikel`;
  if (!news.length) { $("liveNews").innerHTML = `<p class="emptyLive">Noch keine News gespeichert.</p>`; return; }
  $("liveNews").innerHTML = news.slice(0,30).map(n => `
    <div class="liveItem ${esc(n.trigger_level||"")}">
      <div class="newsItemLeft"></div>
      <div>
        <a href="${esc(n.url||"#")}" target="_blank" rel="noopener">${esc(n.title||"Ohne Titel")}</a>
        <div class="meta">${esc(n.source||"–")} · ${esc(fmtDate(n.published_at))} · ${esc(n.trigger_type||"News")}</div>
        <p><strong>Einordnung:</strong> ${esc(n.assessment||n.summary||"Bitte Quelle prüfen.")}</p>
        ${n.watch ? `<p><strong>Beobachten:</strong> ${esc(simplifyText(n.watch))}</p>` : ""}
        <a class="sourceLink" href="${esc(n.url||"#")}" target="_blank" rel="noopener">Quelle →</a>
      </div>
    </div>`).join("");
}

function renderSecFilings() {
  const f = data.latest_auto?.sec_filings || [];
  $("secCount").textContent = `${f.length} Meldungen`;
  if (!f.length) { $("secFilings").innerHTML = `<p class="emptyLive">Keine SEC-Filings gefunden.</p>`; return; }
  $("secFilings").innerHTML = f.slice(0,20).map(x => `
    <div class="liveItem">
      <a href="${esc(x.url||"#")}" target="_blank" rel="noopener">${esc(x.form||"Filing")} · ${esc(x.filingDate||"")}</a>
      <div class="meta">SEC EDGAR</div>
      <p>Besonders bei S-1, F-3, 424B, 8-K auf Cash und Verwässerung prüfen.</p>
      <a class="sourceLink" href="${esc(x.url||"#")}" target="_blank" rel="noopener">EDGAR öffnen →</a>
    </div>`).join("");
}

function renderTriggers() {
  const t = data.latest_auto?.detected_triggers || [];
  $("triggerCount").textContent = `${t.length} Signale`;
  if (!t.length) { $("detectedTriggers").innerHTML = `<p class="emptyLive">Noch keine Signale erkannt.</p>`; return; }
  $("detectedTriggers").innerHTML = t.slice(0,18).map(x => `
    <div class="triggerItem ${esc(x.level||"low")}">
      <b>${esc(x.type||"Signal")}</b>
      <p>${esc(x.title||x.reason||"")}</p>
      ${x.assessment ? `<p><strong>Einordnung:</strong> ${esc(x.assessment)}</p>` : ""}
      ${x.watch ? `<p><strong>Beobachten:</strong> ${esc(x.watch)}</p>` : ""}
      <small>${esc(x.source||"–")} · ${esc(x.date||"")}</small>
      ${x.url ? `<a class="sourceLink" href="${esc(x.url)}" target="_blank" rel="noopener">Quelle →</a>` : ""}
    </div>`).join("");
}

// ── Timeline Chart (Max) ──────────────────────────────────
function combinedEvents() {
  const manual = Array.isArray(data.events) ? data.events : [];
  const la     = data.latest_auto || {};
  const news   = (la.news || []).slice(0,14).map((n,i) => ({
    d: fmtDateShort(n.published_at)||`News ${i+1}`, p: autoPriceLevel(i),
    published_at: n.published_at, title: n.title||`News ${i+1}`,
    phase: n.trigger_type||"News", reaction: n.trigger_reason||"",
    details: n.assessment||n.summary||"", watch: n.watch||"", impact: n.impact||"",
    source: n.source||"News", url: n.url||"#", future:false, auto:true,
  }));
  const filings = (la.sec_filings||[]).slice(0,5).map((f,i)=>({
    d:f.filingDate||`SEC ${i+1}`, p:autoPriceLevel(i+14),
    published_at:f.filingDate, title:`${f.form||"SEC"} · ${f.filingDate||""}`,
    phase:"SEC Filing", reaction:"Offizielle SEC-Meldung.", details:f.description||"",
    source:"SEC EDGAR", url:f.url||"#", future:false, auto:true,
  }));
  const all = manual.length > 3 ? [...manual,...news.slice(0,8)] : [...news,...filings];
  return all.sort((a,b) => dateMs(a.published_at||a.d) - dateMs(b.published_at||b.d)).slice(0,28);
}

function autoPriceLevel(i) {
  const base = Number(data.latest_auto?.price?.regularMarketPrice||1);
  return (base > 0 ? base : 1) * (0.9 + (i%8)*0.03);
}

function yScale(p,min,max){ return 360-((p-min)/(max-min||1))*285; }
function xScale(i,n){ return 70+i*((1040-70)/Math.max(n-1,1)); }

function draw() {
  const events = combinedEvents();
  const chart  = $("chart");
  chart.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";
  const el = (name, attrs) => {
    const e = document.createElementNS(ns, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    chart.appendChild(e);
    return e;
  };
  const prices = events.map(e=>Number(e.p)).filter(n=>!isNaN(n));
  const min = prices.length ? Math.min(...prices)*0.86 : 0;
  const max = prices.length ? Math.max(...prices)*1.12 : 10;

  for (let y=0;y<=5;y++){
    const yy=75+y*57;
    el("line",{x1:60,y1:yy,x2:1055,y2:yy,stroke:"rgba(255,255,255,.07)","stroke-width":1});
    const t=el("text",{x:18,y:yy+4,fill:"#7f8b9c","font-size":11});
    t.textContent="$"+((max-y*((max-min)/5)).toFixed(1));
  }

  const hist=events.filter(e=>!e.future);
  if(hist.length){
    const pts=hist.map((e,i)=>`${xScale(i,events.length)},${yScale(Number(e.p),min,max)}`).join(" ");
    el("polyline",{points:pts,fill:"none",stroke:"#ff5757","stroke-width":3,"stroke-linecap":"round"});
  }

  for(let i=0;i<events.length;i++){
    const e=events[i],x=xScale(i,events.length),y=yScale(Number(e.p),min,max);
    const hit=el("circle",{cx:x,cy:y,r:22,fill:"rgba(0,0,0,0)",class:"dotHit","data-index":i});
    hit.style.cursor="pointer";
    hit.addEventListener("click",ev=>{ev.stopPropagation();select(i);});
    const fill=i===active?"#ff5757":(e.future?"#f4b45c":newsTypeColor(e.phase||""));
    const c=el("circle",{cx:x,cy:y,r:i===active?11:7,fill,stroke:"#0b0f15","stroke-width":3,class:"dot"});
    c.style.cursor="pointer";
    c.addEventListener("click",()=>select(i));
    const t=el("text",{x,y:392,fill:i===active?"#fff":"#8893a5","font-size":10,"text-anchor":"middle"});
    t.textContent=events[i].d;
  }
}

function renderList() {
  const events=combinedEvents();
  $("eventList").innerHTML=events.map((e,i)=>`
    <button class="eventBtn${i===active?" active":""}" onclick="select(${i})">
      <b>${esc(e.d)} · ${esc(e.title)}</b><span>${esc(simplifyText(e.phase))}</span>
    </button>`).join("");
}

function renderDetail() {
  const e=combinedEvents()[active];
  if(!e){$("detail").innerHTML="";return;}
  const link=e.url&&e.url!=="#"?`<a class="sourceLink" href="${esc(e.url)}" target="_blank" rel="noopener">Quelle öffnen →</a>`:"";
  $("detail").innerHTML=`
    <span class="phaseTag">${esc(simplifyText(e.phase))}</span>
    <h3>${esc(simplifyText(e.title))}</h3>
    <p><strong>Einordnung:</strong> ${esc(simplifyText(e.reaction||e.details))}</p>
    ${e.watch?`<p><strong>Beobachten:</strong> ${esc(e.watch)}</p>`:""}
    ${e.impact?`<p><strong>Kurseinfluss:</strong> ${esc(e.impact)}</p>`:""}
    <p class="small"><strong>Quelle:</strong> ${esc(e.source)}</p>${link}`;
}

window.select = i => {
  active=i; draw(); renderList(); renderDetail();
  document.querySelector(`.eventBtn:nth-child(${i+1})`)?.scrollIntoView({block:"nearest",behavior:"smooth"});
};

// ── Rechner ───────────────────────────────────────────────
function initTradeCalculator() {
  $("calcBuyPrice")?.addEventListener("input", ()=>{syncSellFromPct();updateTradeCalc();});
  $("calcInvest")?.addEventListener("input", updateTradeCalc);
  $("calcSellPrice")?.addEventListener("input", ()=>{syncPctFromSell();updateTradeCalc();});
  $("calcTargetPct")?.addEventListener("input", ()=>{syncSellFromPct();updateTradeCalc();});
}

function syncSellFromPct() {
  const buy=Number($("calcBuyPrice")?.value||0), pct=Number($("calcTargetPct")?.value||0), sell=$("calcSellPrice");
  if(buy&&sell){const t=buy*(1+pct/100);sell.value=t>0?t.toFixed(2):"";}
}
function syncPctFromSell() {
  const buy=Number($("calcBuyPrice")?.value||0),sell=Number($("calcSellPrice")?.value||0),pct=$("calcTargetPct");
  if(buy&&sell&&pct)pct.value=(((sell/buy)-1)*100).toFixed(1);
}

function updateTradeCalc() {
  const el=$("tradeResult"); if(!el)return;
  const cur=Number(data?.latest_auto?.price?.regularMarketPrice);
  const buyI=$("calcBuyPrice"); if(cur&&buyI&&!buyI.value)buyI.value=cur.toFixed(2);
  const buy=Number($("calcBuyPrice")?.value||0),invest=Number($("calcInvest")?.value||0);
  if(buy&&$("calcTargetPct")&&$("calcSellPrice")&&!$("calcSellPrice").value)
    $("calcSellPrice").value=(buy*(1+Number($("calcTargetPct").value||0)/100)).toFixed(2);
  const sell=Number($("calcSellPrice")?.value||0);
  if(!buy||!invest||!sell){el.innerHTML="Einstieg, Einsatz und Ziel eingeben.";return;}
  const shares=invest/buy,value=shares*sell,profit=value-invest,ppct=(profit/invest)*100;
  el.innerHTML=`
    <div><span>Einstieg</span><b>${formatMoney(buy)}</b></div>
    <div><span>Verkauf</span><b>${formatMoney(sell)}</b></div>
    <div><span>Stückzahl ca.</span><b>${shares.toLocaleString("de-DE",{maximumFractionDigits:2})}</b></div>
    <div><span>Endwert</span><b>${formatMoney(value)}</b></div>
    <div class="${profit>=0?"gain":"loss"}"><span>${profit>=0?"Gewinn":"Verlust"}</span><b>${formatMoney(profit)} (${ppct.toFixed(1)}%)</b></div>`;
}

// ── Admin ─────────────────────────────────────────────────
function initDropdownBehavior() {
  document.addEventListener("click", e => {
    const a=document.querySelector(".adminDropdown");
    if(a?.open&&!a.contains(e.target))a.open=false;
  });
}

function initPreMarketInfo() {
  $("preMarketInfoBtn")?.addEventListener("click", ()=>{
    $("preMarketInfo")?.classList.toggle("hidden");
  });
}

function populateDeleteDropdown(wl) {
  const sel=$("deleteTickerSelect"); if(!sel)return;
  sel.innerHTML=(wl||[]).map(x=>`<option value="${esc(x.ticker)}">${esc(x.ticker)} · ${esc(x.name||"")}</option>`).join("");
}

// ── Auto-Lookup: Yahoo Finance aus dem Browser ────────────
async function autoLookupTicker(ticker) {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;

  // Versuche Yahoo Finance direkt (funktioniert im Browser des Users)
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1d&interval=1d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1d&interval=1d`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta) continue;

      const name     = meta.longName || meta.shortName || t;
      const exchange = meta.exchangeName || meta.fullExchangeName || detectExchangeFromTicker(t);
      const type     = detectTypeFromMeta(meta, name);
      const queries  = buildAutoQueries(t, name, type);
      const secQuery = t.replace(/\.[A-Z]+$/i, ""); // ohne .DE etc.
      const theme    = buildAutoTheme(type, name);

      return { ticker: t, name, exchange, type, theme, queries, secQuery };
    } catch { continue; }
  }
  return null;
}

function detectExchangeFromTicker(t) {
  if (/\.DE$/i.test(t)) return "XETRA";
  if (/\.PA$/i.test(t)) return "Euronext Paris";
  if (/\.AS$/i.test(t)) return "Euronext Amsterdam";
  if (/\.L$/i.test(t))  return "London Stock Exchange";
  if (/\.TO$/i.test(t)) return "Toronto Stock Exchange";
  return "NASDAQ";
}

function detectTypeFromMeta(meta, name) {
  const inst = (meta.instrumentType || "").toUpperCase();
  const nl   = name.toLowerCase();
  if (inst === "ETF" || /etf|ucits|ishares|vanguard|invesco|xtrackers|amundi/.test(nl)) return "ETF";
  if (/bioscience|biotech|therapeutics|pharma|biopharma|oncology|genomic|gene therapy/.test(nl)) return "Biotech / Pharma";
  if (/semiconductor|software|systems|technologies|tech|digital|cyber|cloud|intelligence/.test(nl)) return "Tech";
  if (/bank|financial|capital|insurance|asset management/.test(nl)) return "Finance";
  return "Allgemein";
}

function buildAutoTheme(type, name) {
  if (type === "ETF") {
    const stop = new Set(["etf","ucits","fund","the","of","and","acc","dis","usd","eur","ishares","vanguard"]);
    return name.split(/\s+/).filter(w => w.length > 2 && !stop.has(w.toLowerCase())).slice(0,4).join(" / ");
  }
  return type;
}

function buildAutoQueries(ticker, name, type) {
  const n = name, t = ticker;
  const base = [`"${n}" ${t} stock news`, `${t} stock news`];
  if (type === "ETF") {
    const short = name.replace(/\s*(UCITS|ETF|USD|EUR|Acc|Dis|Hedged)\s*/gi, " ").trim();
    return [...base, `"${short}" ETF performance`, `${t} ETF`];
  }
  if (type === "Biotech / Pharma") {
    return [...base, `"${n}" FDA clinical trial`, `"${n}" phase 3`, `"${n}" offering reverse split`];
  }
  if (type === "Tech") {
    return [...base, `"${n}" earnings revenue`, `"${n}" product launch AI`];
  }
  return [...base, `"${n}" earnings quarterly`];
}

function renderStockPreview(info) {
  const el = $("stockPreview");
  if (!el) return;
  const typeColors = {
    "ETF": "#6aa8ff",
    "Biotech / Pharma": "#9ff0c0",
    "Tech": "#f4b45c",
    "Finance": "#c8a2ff",
    "Allgemein": "#c7d0dc",
  };
  const color = typeColors[info.type] || "#c7d0dc";
  el.innerHTML = `
    <div class="previewCard">
      <div class="previewHeader">
        <span class="tickerBadge">${esc(info.ticker)}</span>
        <span class="previewType" style="color:${color}">${esc(info.type)}</span>
      </div>
      <h3 class="previewName">${esc(info.name)}</h3>
      <div class="previewMeta">
        <span>📍 ${esc(info.exchange)}</span>
        <span>🏷 ${esc(info.theme)}</span>
      </div>
      <details class="previewQueries">
        <summary>${info.queries.length} Suchbegriffe werden automatisch gesetzt</summary>
        <ul>${info.queries.map(q => `<li>${esc(q)}</li>`).join("")}</ul>
      </details>
    </div>
  `;
}

function initAdminForm() {
  const form=$("addStockForm"),status=$("adminStatus");
  if(!form)return;

  let lookupResult = null;

  // Auto-Lookup Button
  $("autoLookupBtn")?.addEventListener("click", async () => {
    const ticker = $("newTicker")?.value?.trim().toUpperCase();
    if (!ticker) {
      const ls = $("lookupStatus");
      if(ls){ls.className="adminStatus err";ls.textContent="Bitte zuerst einen Ticker eingeben.";}
      return;
    }
    const ls = $("lookupStatus");
    if(ls){ls.className="adminStatus";ls.textContent=`🔍 Suche Infos für ${ticker}…`;}

    const info = await autoLookupTicker(ticker);

    if (!info) {
      if(ls){ls.className="adminStatus err";ls.textContent=`Ticker "${ticker}" nicht gefunden. Name manuell eingeben?`;}
      // Trotzdem Schritt 2 zeigen mit leerem Formular
      lookupResult = { ticker, name: ticker, exchange: detectExchangeFromTicker(ticker),
                       type: "Allgemein", theme: "Research",
                       queries: [`${ticker} stock news`], secQuery: ticker.replace(/\.[A-Z]+$/i,"") };
    } else {
      lookupResult = info;
      if(ls){ls.className="adminStatus ok";ls.textContent=`✅ Gefunden: ${info.name} (${info.exchange})`;}
    }

    // Felder füllen
    if($("newName"))     $("newName").value     = lookupResult.name;
    if($("newExchange")) $("newExchange").value  = lookupResult.exchange;
    if($("newTheme"))    $("newTheme").value     = lookupResult.theme;
    if($("newQuery"))    $("newQuery").value     = lookupResult.queries[0] || "";
    if($("newSecQuery")) $("newSecQuery").value  = lookupResult.secQuery;

    // Vorschau rendern und Schritt 2 zeigen
    renderStockPreview(lookupResult);
    $("addStep1")?.classList.add("hidden");
    $("addStep2")?.classList.remove("hidden");
  });

  // Enter-Taste im Ticker-Input = Auto-Lookup
  $("newTicker")?.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("autoLookupBtn")?.click(); }
  });

  // Zurück-Button
  $("addResetBtn")?.addEventListener("click", () => {
    $("addStep2")?.classList.add("hidden");
    $("addStep1")?.classList.remove("hidden");
    const ls = $("lookupStatus");
    if(ls){ls.className="adminStatus";ls.textContent="";}
    lookupResult = null;
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const apiUrl=(window.SOL_ADMIN_API_URL||"").trim().replace(/\/$/,"");
    const payload={
      ticker:$("newTicker").value.trim().toUpperCase(),
      name:$("newName").value.trim(),
      exchange:$("newExchange").value.trim()||"NASDAQ",
      theme:$("newTheme").value.trim()||"Research",
      query:$("newQuery").value.trim(),
      sec_query:$("newSecQuery").value.trim().toUpperCase(),
      adminPin:$("adminPin").value,
    };
    if(!payload.query)payload.query=`${payload.name||payload.ticker} ${payload.ticker} stock news`;
    if(!payload.sec_query)payload.sec_query=payload.ticker;
    if(!apiUrl){
      status.className="adminStatus err";
      status.innerHTML=`Kein Admin-Worker verbunden. Lokal: <code>python3 scripts/add_stock.py ${esc(payload.ticker)} "${esc(payload.name)}"</code>`;
      return;
    }
    status.className="adminStatus"; status.textContent="Wird gespeichert…";
    try{
      const res=await fetch(`${apiUrl}/add-stock`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await res.json().catch(()=>({}));
      if(!res.ok||!result.ok)throw new Error(result.error||`Fehler ${res.status}`);
      status.className="adminStatus ok";
      status.textContent=`${payload.ticker} gespeichert. Seite in ~1 Min. neu laden.`;
      form.reset(); $("newExchange").value="NASDAQ";
      setTimeout(()=>{document.querySelector(".adminDropdown").open=false;},1500);
    }catch(err){status.className="adminStatus err";status.textContent=`Fehler: ${err.message}`;}
  });
}

function initDeleteForm() {
  const form=$("deleteStockForm"),status=$("deleteStatus"); if(!form)return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const apiUrl=(window.SOL_ADMIN_API_URL||"").trim().replace(/\/$/,"");
    const ticker=$("deleteTickerSelect").value.trim().toUpperCase();
    const confirm=$("deleteConfirm").value.trim();
    const pin=$("deleteAdminPin").value;
    if(confirm!=="LÖSCHEN"){status.className="adminStatus err";status.textContent='Bitte exakt "LÖSCHEN" eingeben.';return;}
    if(!apiUrl){status.className="adminStatus err";status.innerHTML=`Kein Admin-Worker. Lokal: <code>python3 scripts/delete_stock.py ${esc(ticker)}</code>`;return;}
    status.className="adminStatus";status.textContent=`Lösche ${ticker}…`;
    try{
      const res=await fetch(`${apiUrl}/delete-stock`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ticker,adminPin:pin})});
      const result=await res.json().catch(()=>({}));
      if(!res.ok||!result.ok)throw new Error(result.error||`Fehler ${res.status}`);
      status.className="adminStatus ok";status.textContent=`${ticker} gelöscht.`;
      $("deleteConfirm").value="";
    }catch(err){status.className="adminStatus err";status.textContent=`Fehler: ${err.message}`;}
  });
}


// ══════════════════════════════════════════════════════════
// MOBILE NAVIGATION
// ══════════════════════════════════════════════════════════
function initMobileNav() {
  // Zipfel → Drawer öffnen
  document.getElementById('drawerTrigger')?.addEventListener('click', openDrawer);
  document.getElementById('drawerClose')?.addEventListener('click',   closeDrawer);
  document.getElementById('drawerOverlay')?.addEventListener('click', closeDrawer);

  // Aktie aus Drawer-Select
  document.getElementById('drawerTickerSelect')?.addEventListener('change', e => {
    loadTicker(e.target.value).then(closeDrawer);
  });

  // Desktop Ticker
  document.getElementById('tickerSelect')?.addEventListener('change', e => {
    loadTicker(e.target.value);
  });

  // Desktop Refresh
  document.getElementById('refreshBtnDesktop')?.addEventListener('click', async () => {
    document.getElementById('refreshBtnDesktop').textContent = '…';
    await loadMeta(); await loadAllData(); await loadTicker(currentTicker);
    document.getElementById('refreshBtnDesktop').textContent = '↻ Neu laden';
  });

  // Drawer Refresh
  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    await loadMeta(); await loadAllData(); await loadTicker(currentTicker);
    closeDrawer();
  });

  // Alle [data-mode] Buttons via Event Delegation
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    switchMode(btn.dataset.mode);
  });

  // Mitteilungen-Button → Cockpit + scrolle zu Notification Center
  document.getElementById('bottomNotifyBtn')?.addEventListener('click', () => {
    switchMode('cockpit');
    setTimeout(() => document.getElementById('notificationCenter')
      ?.scrollIntoView({behavior:'smooth', block:'start'}), 350);
  });

  // Desktop Admin Ticker-Lookup
  document.getElementById('autoLookupBtnDesktop')?.addEventListener('click', async () => {
    const input = document.getElementById('newTickerDesktop');
    const status = document.getElementById('lookupStatusDesktop');
    const ticker = input?.value?.trim().toUpperCase();
    if (!ticker) return;
    if (status) { status.className='adminStatus'; status.textContent=`🔍 Suche ${ticker}…`; }
    const info = await autoLookupTicker(ticker);
    if (info && status) {
      status.className='adminStatus ok';
      status.innerHTML=`✅ <strong>${info.name}</strong> · ${info.exchange} · ${info.type}`;
    } else if (status) {
      status.className='adminStatus err';
      status.textContent=`Nicht gefunden. Bitte über das Mobile-Menü hinzufügen.`;
    }
  });

  // Premarket Info Toggle
  document.getElementById('preMarketInfoBtn')?.addEventListener('click', () => {
    const el = document.getElementById('preMarketInfo');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  });
}

// ── Start ─────────────────────────────────────────────────
boot().catch(err => {
  document.body.innerHTML = `<div style="color:#fff;padding:40px;font-family:monospace">
    <h2>Fehler beim Laden</h2>
    <pre>${esc(err.message)}</pre>
    <p>Diese Seite muss über einen lokalen Server laufen:<br>
    <code>cd ~/son-of-lorenc && python3 -m http.server 8090</code></p>
  </div>`;
});
