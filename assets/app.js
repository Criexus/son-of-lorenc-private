let data = null;
let active = 0;
let currentTicker = "ATAI";
let viewMode = localStorage.getItem("solViewMode") || "smart";

const $ = (id) => document.getElementById(id);

function esc(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(v) {
  if (!v) return "offen";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(v));
  } catch {
    return String(v);
  }
}

async function getJson(path) {
  const r = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Konnte ${path} nicht laden`);
  return r.json();
}

async function boot() {
  await loadMeta();
  const wl = await getJson("/data/watchlist.json");
  $("tickerSelect").innerHTML = wl.map(x => `<option value="${esc(x.ticker)}">${esc(x.ticker)} · ${esc(x.name)}</option>`).join("");
  populateDeleteDropdown(wl);
  $("tickerSelect").addEventListener("change", e => loadTicker(e.target.value));
  $("refreshBtn").addEventListener("click", async () => {
    $("refreshBtn").textContent = "Lade…";
    await loadMeta();
    await loadTicker(currentTicker);
    $("refreshBtn").textContent = "Daten neu laden";
  });
  initViewMode();
  initDropdownBehavior();
  initAdminForm();
  initDeleteForm();
  await loadTicker(wl[0]?.ticker || "ATAI");
}

async function loadMeta() {
  try {
    const meta = await getJson("/data/meta.json");
    $("globalUpdate").textContent = `Letztes Auto-Update: ${fmtDate(meta.last_update_utc)}`;
  } catch {
    $("globalUpdate").textContent = "Letztes Auto-Update: lokal nicht verfügbar";
  }
}

async function loadTicker(ticker) {
  currentTicker = ticker;
  data = await getJson(`/data/${ticker}.json`);
  active = Math.max(0, combinedEvents().findIndex(e => !e.future));
  if (active < 0) active = 0;
  render();
}

function render() {
  document.title = `Son of Lorenc – ${data.ticker} Phasenanalyse`;

  $("eyebrow").textContent = data.eyebrow || `Son of Lorenc · Phasenanalyse · ${data.ticker}`;
  $("headline").textContent = data.headline || `${data.ticker} – Phasenanalyse`;
  $("thesis").textContent = data.thesis || "";

  const latest = data.latest_auto || {};
  const latestText = latest.last_update_utc ? ` · Live-Daten: ${fmtDate(latest.last_update_utc)}` : "";

  $("status").innerHTML = `
    <span class="pill"><strong>Stand:</strong> ${esc(data.stand || "offen")}</span>
    <span class="pill"><strong>Ticker:</strong> ${esc(data.exchange || "")}: ${esc(data.ticker)}</span>
    <span class="pill"><strong>Phase:</strong> ${esc(data.phase || "offen")}</span>
    <span class="pill"><strong>Charakter:</strong> ${esc(data.character || "spekulativ")}${esc(latestText)}</span>
  `;

  $("scoreGrid").innerHTML = (data.metrics || []).map(m => `
    <div class="metric">
      <div class="label">${esc(m.label)}</div>
      <div class="value">${esc(m.value)}</div>
      <div class="note">${esc(m.note)}</div>
    </div>
  `).join("");

  $("chartSubtitle").textContent = data.chart_subtitle || "";
  $("chartNote").textContent = data.chart_note || "";

  draw();
  renderList();
  renderDetail();

  $("pipelineIntro").textContent = data.pipeline_intro || "";
  $("pipeline").innerHTML = (data.pipeline || []).map(p => `
    <div class="pipeCard">
      <span class="stage ${esc(p.class || "early")}">${esc(simplePhaseLabel(p.stage))}</span>
      <h3>${esc(simplifyText(p.name))}</h3>
      <p>${esc(simplifyText(p.text))}</p>
      <div class="rank"><i style="width:${Number(p.score || 0)}%"></i></div>
      <p class="small"><strong>Warum wichtig?</strong> ${esc(simpleDriverLabel(p.score))}</p>
      <p class="small">Heißt einfach: Je stärker dieses Programm ist, desto eher kann es die Aktie positiv oder negativ bewegen.</p>
    </div>
  `).join("");

  $("zones").innerHTML = (data.zones || []).map(z => `
    <div class="zone"><b>${esc(simplifyText(z.zone))}</b><span>${esc(simplifyText(z.text))}</span></div>
  `).join("");

  $("catalysts").innerHTML = (data.catalysts || []).map(c => `
    <div class="scenario base">
      <span class="tag">${esc(simplifyText(c.tag))}</span>
      <h3>${esc(simplifyText(c.title))}</h3>
      <p>${esc(simplifyText(c.text))}</p>
    </div><br>
  `).join("");

  const s = data.scenarios || {};
  $("bearTitle").textContent = simplifyText(s.bear?.title || "schlechter Fall");
  $("bearText").textContent = simplifyText(s.bear?.text || "");
  $("baseTitle").textContent = simplifyText(s.base?.title || "normaler Fall");
  $("baseText").textContent = simplifyText(s.base?.text || "");
  $("bullTitle").textContent = simplifyText(s.bull?.title || "guter Fall");
  $("bullText").textContent = simplifyText(s.bull?.text || "");

  $("risks").innerHTML = (data.risks || []).map(r => `
    <div class="riskItem"><b>${esc(simplifyText(r.title))}:</b> ${esc(simplifyText(r.text))}</div>
  `).join("");

  renderLiveNews();
  renderTriggers();
  renderSecFilings();
  renderSmart();

  $("clearView").innerHTML = (data.clear_view || []).map(p => `<p>${esc(simplifyText(p))}</p>`).join("");

  $("sources").innerHTML = (data.sources || []).map(src => {
    if (typeof src === "string") return `<li>${esc(src)}</li>`;
    return `<li><a href="${esc(src.url || "#")}" target="_blank" rel="noopener noreferrer">${esc(src.title || src.url || "Quelle")}</a></li>`;
  }).join("");
}

function renderLiveNews() {
  const news = data.latest_auto?.news || [];
  $("liveNewsCount").textContent = `${news.length} Treffer`;

  if (!news.length) {
    $("liveNews").innerHTML = `<div class="emptyLive">Noch keine Live-News gespeichert. Lokal ausführen: <code>python3 scripts/update_data.py</code></div>`;
    return;
  }

  $("liveNews").innerHTML = news.slice(0, 30).map(n => `
    <article class="liveItem ${esc(n.trigger_level || "")}">
      <a href="${esc(n.url || "#")}" target="_blank" rel="noopener noreferrer">${esc(n.title || "Ohne Titel")}</a>
      <div class="meta">${esc(n.source || "Quelle offen")} · ${esc(fmtDate(n.published_at))} · ${esc(n.trigger_type || "News")}</div>
      <p><strong>Einordnung:</strong> ${esc(n.assessment || n.summary || "Diese Meldung sollte inhaltlich geprüft werden.")}</p>
      <p><strong>Worauf achten:</strong> ${esc(n.watch || "Quelle, Inhalt und Zusammenhang mit Kursbewegung prüfen.")}</p>
      <p><strong>Möglicher Effekt:</strong> ${esc(n.impact || "unklar")}</p>
      <a class="sourceLink" href="${esc(n.url || "#")}" target="_blank" rel="noopener noreferrer">Artikel / Quelle öffnen →</a>
    </article>
  `).join("");
}

function renderSecFilings() {
  const filings = data.latest_auto?.sec_filings || [];
  $("secCount").textContent = `${filings.length} Filings`;

  if (!filings.length) {
    $("secFilings").innerHTML = `<div class="emptyLive">Keine aktuellen SEC-Filings gespeichert oder kein SEC-Ticker gefunden.</div>`;
    return;
  }

  $("secFilings").innerHTML = filings.slice(0, 20).map(f => `
    <article class="liveItem">
      <a href="${esc(f.url || "#")}" target="_blank" rel="noopener noreferrer">${esc(f.form || "Filing")} · ${esc(f.filingDate || "")}</a>
      <div class="meta">${esc(f.source || "SEC EDGAR")}</div>
      <p>Offizielle Meldung. Besonders bei S-1, F-3, 424B, 8-K, 10-Q/20-F auf Cash und Verwässerung prüfen.</p>
    </article>
  `).join("");
}



function simplifyText(text = "") {
  return String(text)
    .replaceAll("Katalysator", "wichtiger Auslöser")
    .replaceAll("katalysator", "wichtiger Auslöser")
    .replaceAll("Readout", "Studienergebnisse")
    .replaceAll("readout", "Studienergebnisse")
    .replaceAll("Topline", "erste Studienergebnisse")
    .replaceAll("topline", "erste Studienergebnisse")
    .replaceAll("H2 2026", "zweite Jahreshälfte 2026")
    .replaceAll("Q1", "1. Quartal")
    .replaceAll("Q2", "2. Quartal")
    .replaceAll("Q3", "3. Quartal")
    .replaceAll("Q4", "4. Quartal")
    .replaceAll("Bear Case", "schlechter Fall")
    .replaceAll("Base Case", "normaler Fall")
    .replaceAll("Bull Case", "guter Fall")
    .replaceAll("Verwässerung", "neue Aktien / Verwässerung")
    .replaceAll("Cash Runway", "wie lange das Geld reicht")
    .replaceAll("Phase‑3", "Phase 3")
    .replaceAll("Phase‑2", "Phase 2");
}

function simplePhaseLabel(text = "") {
  const s = simplifyText(text);
  if (/phase\s*3/i.test(s)) return `${s} · sehr wichtig, weil späte Studienphase`;
  if (/phase\s*2/i.test(s)) return `${s} · wichtig, aber noch nicht endgültig`;
  if (/early|preclinical|discovery/i.test(s)) return `${s} · frühe Forschung, eher langfristig`;
  return s;
}

function simpleDriverLabel(score) {
  const n = Number(score || 0);
  if (n >= 85) return "sehr wichtig für den Kurs";
  if (n >= 65) return "kann den Kurs deutlich bewegen";
  if (n >= 40) return "mittlerer Einfluss";
  return "eher langfristig / kleiner Einfluss";
}

function parseTimelineDate(value = "", fallbackIndex = 0, future = false) {
  const raw = String(value || "").trim();

  // ISO / normal Date
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return iso;

  // dd.mm.yyyy
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return Date.UTC(Number(de[3]), Number(de[2]) - 1, Number(de[1]));

  // mm/yyyy or dd.mm without year -> current year fallback
  const deShort = raw.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (deShort) {
    const year = new Date().getFullYear();
    return Date.UTC(year, Number(deShort[2]) - 1, Number(deShort[1]));
  }

  // Q1/Q2/Q3/Q4 2026
  const q = raw.match(/Q([1-4])\s*(\d{4})/i);
  if (q) {
    const quarter = Number(q[1]);
    const month = (quarter - 1) * 3 + 1; // middle-ish month of quarter
    return Date.UTC(Number(q[2]), month, 15);
  }

  // H1/H2 2026
  const h = raw.match(/H([12])\s*(\d{4})/i);
  if (h) {
    const month = Number(h[1]) === 1 ? 2 : 8;
    return Date.UTC(Number(h[2]), month, 15);
  }

  // German descriptions
  if (/zweite jahreshälfte/i.test(raw)) {
    const year = Number((raw.match(/(\d{4})/) || [null, new Date().getFullYear()])[1]);
    return Date.UTC(year, 8, 15);
  }
  if (/erste jahreshälfte/i.test(raw)) {
    const year = Number((raw.match(/(\d{4})/) || [null, new Date().getFullYear()])[1]);
    return Date.UTC(year, 2, 15);
  }

  // placeholders: keep at beginning if not future, otherwise at end
  const base = future ? Date.UTC(2099, 0, 1) : Date.UTC(1970, 0, 1);
  return base + fallbackIndex;
}

function sortEventsChronologically(events) {
  return [...events].map((e, i) => ({
    ...e,
    _order: i,
    _sort: parseTimelineDate(e.sort_date || e.published_at || e.d || e.filingDate || e.last_update || e.start_date, i, e.future)
  })).sort((a, b) => {
    if (a._sort !== b._sort) return a._sort - b._sort;
    return a._order - b._order;
  });
}


function combinedEvents() {
  const manual = Array.isArray(data.events) ? data.events : [];
  const latest = data.latest_auto || {};
  const news = Array.isArray(latest.news) ? latest.news : [];
  const filings = Array.isArray(latest.sec_filings) ? latest.sec_filings : [];
  const trials = Array.isArray(latest.clinical_trials) ? latest.clinical_trials : [];

  const manualLooksPlaceholder = manual.length <= 3 && manual.some(e => String(e.title || "").toLowerCase().includes("automatische news"));

  const autoNewsEvents = news.slice(0, 14).map((n, i) => ({
    d: shortDate(n.published_at) || `News ${i + 1}`,
    p: autoPriceLevel(i),
    title: n.title || `News ${i + 1}`,
    phase: n.trigger_type || "Live-News",
    reaction: n.trigger_reason || "Automatisch gefundene News. Kursrelevanz prüfen.",
    details: n.assessment || n.summary || `Quelle: ${n.source || "offen"}. Diese Meldung wurde über die News-Engine gefunden.`,
    watch: n.watch || "Quelle und Inhalt prüfen.",
    impact: n.impact || "unklare Kursrelevanz",
    source: n.source || "News",
    url: n.url || "#",
    future: false,
    auto: true
  }));

  const filingEvents = filings.slice(0, 5).map((f, i) => ({
    d: f.filingDate || `SEC ${i + 1}`,
    p: autoPriceLevel(i + 14),
    title: `${f.form || "SEC Filing"} · ${f.filingDate || ""}`,
    phase: classifyFilingPhase(f.form),
    reaction: "Offizielle SEC-Meldung. Besonders auf Cash, Verwässerung, Quartalsbericht und Kapitalmaßnahmen prüfen.",
    details: f.description || "SEC Filing wurde automatisch gefunden.",
    source: f.source || "SEC EDGAR",
    url: f.url || "#",
    future: false,
    auto: true
  }));

  const trialEvents = trials.slice(0, 5).map((tr, i) => ({
    d: tr.last_update || tr.start_date || `Trial ${i + 1}`,
    p: autoPriceLevel(i + 19),
    title: tr.title || tr.nct_id || "ClinicalTrials.gov Studie",
    phase: tr.status || "ClinicalTrials.gov",
    reaction: "Studienregister-Treffer. Relevanz zur Pipeline prüfen.",
    details: `${tr.nct_id || ""} ${tr.conditions ? "· " + tr.conditions : ""}`,
    source: "ClinicalTrials.gov",
    url: tr.url || "#",
    future: false,
    auto: true
  }));

  const auto = [...autoNewsEvents, ...filingEvents, ...trialEvents];

  if (manualLooksPlaceholder && auto.length) return sortEventsChronologically(auto.slice(0, 24));
  if (!manual.length && auto.length) return sortEventsChronologically(auto.slice(0, 24));

  // Für kuratierte Dossiers bleiben manuelle Daten vorne; Live-Treffer werden angehängt.
  return sortEventsChronologically([...manual, ...auto.slice(0, 10)].slice(0, 28));
}

function shortDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(d);
  } catch {
    return String(value).slice(0, 10);
  }
}

function autoPriceLevel(i) {
  const base = Number(data.latest_auto?.price?.regularMarketPrice || 1);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 1;
  return safeBase * (0.92 + (i % 8) * 0.025);
}

function classifyFilingPhase(form) {
  const f = String(form || "").toUpperCase();
  if (["S-1", "F-1", "F-3", "S-3", "424B", "424B5"].some(x => f.includes(x))) return "SEC · Verwässerung/Finanzierung prüfen";
  if (["10-Q", "10-K", "20-F", "6-K"].some(x => f.includes(x))) return "SEC · Finanzbericht";
  if (f.includes("8-K")) return "SEC · Unternehmensereignis";
  return "SEC Filing";
}

function renderTriggers() {
  const triggers = data.latest_auto?.detected_triggers || [];
  $("triggerCount").textContent = `${triggers.length} Trigger`;

  if (!triggers.length) {
    $("detectedTriggers").innerHTML = `<div class="emptyLive">Noch keine Trigger erkannt. Nach dem nächsten Update werden FDA, Phase, Offering, SEC, Studien- und Readout-Signale hier angezeigt.</div>`;
    return;
  }

  $("detectedTriggers").innerHTML = triggers.slice(0, 18).map(t => `
    <article class="triggerItem ${esc(t.level || "low")}">
      <b>${esc(t.type || "Trigger")}</b>
      <p>${esc(t.title || t.reason || "")}</p>
      ${t.assessment ? `<p><strong>Einordnung:</strong> ${esc(t.assessment)}</p>` : ""}
      ${t.watch ? `<p><strong>Worauf achten:</strong> ${esc(t.watch)}</p>` : ""}
      <small>${esc(t.source || "Quelle offen")} · ${esc(t.date || "")}</small>
      ${t.url ? `<a class="sourceLink" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Quelle öffnen →</a>` : ""}
    </article>
  `).join("");
}


function yScale(p, min, max) {
  return 360 - ((p - min) / (max - min || 1)) * 285;
}

function xScale(i, total) {
  return 70 + i * ((1040 - 70) / Math.max(total - 1, 1));
}

function draw() {
  const events = combinedEvents();
  const chart = $("chart");
  chart.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    const e = document.createElementNS(ns, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    chart.appendChild(e);
    return e;
  }

  const prices = events.map(e => Number(e.p)).filter(n => !Number.isNaN(n));
  const min = prices.length ? Math.min(...prices) * 0.86 : 0;
  const max = prices.length ? Math.max(...prices) * 1.12 : 10;

  for (let y = 0; y <= 5; y++) {
    const yy = 75 + y * 57;
    el("line", { x1: 60, y1: yy, x2: 1055, y2: yy, stroke: "rgba(255,255,255,.08)", "stroke-width": 1 });
    const price = (max - y * ((max - min) / 5)).toFixed(1);
    const t = el("text", { x: 18, y: yy + 4, fill: "#7f8b9c", "font-size": 12 });
    t.textContent = "$" + price;
  }

  for (let i = 0; i < events.length; i++) {
    const x = xScale(i, events.length);
    el("line", { x1: x, y1: 70, x2: x, y2: 365, stroke: events[i].future ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.035)", "stroke-width": 1 });
  }

  const historical = events.filter(e => !e.future);
  if (historical.length) {
    const historicalPoints = historical.map((e, i) => `${xScale(i, events.length)},${yScale(Number(e.p), min, max)}`).join(" ");
    el("polyline", { points: historicalPoints, fill: "none", stroke: "#ff5757", "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" });
  }

  const firstFutureIndex = events.findIndex(e => e.future);
  if (firstFutureIndex >= 0) {
    const start = Math.max(0, firstFutureIndex - 1);
    const futurePoints = events.slice(start).map((e, i) => `${xScale(i + start, events.length)},${yScale(Number(e.p), min, max)}`).join(" ");
    el("polyline", { points: futurePoints, fill: "none", stroke: "#f4b45c", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": "7 8" });
  }

  for (let i = 0; i < events.length; i++) {
    const e = events[i], x = xScale(i, events.length), y = yScale(Number(e.p), min, max);
    const c = el("circle", { cx: x, cy: y, r: i === active ? 10 : 7, fill: i === active ? "#ff5757" : (e.future ? "#f4b45c" : "#cbd5e1"), stroke: "#0b0f15", "stroke-width": 3, class: "dot" });
    c.addEventListener("click", () => select(i));
    const t = el("text", { x: x, y: 392, fill: i === active ? "#fff" : "#8893a5", "font-size": 11, "text-anchor": "middle" });
    t.textContent = e.d;
  }

  const label = el("text", { x: 72, y: 35, fill: "#c7d0dc", "font-size": 13 });
  label.textContent = "Chronologische Zeitlinie · von links nach rechts: ältere bis neuere Nachrichten / Termine";
}

function renderList() {
  const events = combinedEvents();
  $("eventList").innerHTML = events.map((e, i) => `
    <button class="eventBtn${i === active ? " active" : ""}" onclick="select(${i})">
      <b>${esc(e.d)} · ${esc(e.title)}</b><span>${esc(simplifyText(e.phase))}</span>
    </button>
  `).join("");
}

function renderDetail() {
  const e = combinedEvents()[active];
  if (!e) {
    $("detail").innerHTML = "";
    return;
  }
  const link = e.url && e.url !== "#" ? `<p><a class="sourceLink" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Artikel / Quelle öffnen →</a></p>` : "";
  $("detail").innerHTML = `
    <span class="phaseTag">${esc(simplifyText(e.phase))}</span>
    <h3>${esc(simplifyText(e.title))}</h3>
    <p><strong>Kurs-/Newsreaktion:</strong> ${esc(simplifyText(e.reaction))}</p>
    <p><strong>Einordnung:</strong> ${esc(simplifyText(e.details))}</p>
    ${e.watch ? `<p><strong>Worauf achten:</strong> ${esc(e.watch)}</p>` : ""}
    ${e.impact ? `<p><strong>Möglicher Effekt:</strong> ${esc(e.impact)}</p>` : ""}
    <p class="small"><strong>Quelle:</strong> ${esc(e.source)}</p>
    ${link}
  `;
}

window.select = function(i) {
  active = i;
  draw();
  renderList();
  renderDetail();
};





function initViewMode() {
  const smartBtn = $("smartModeBtn");
  const maxBtn = $("maxModeBtn");
  const setMode = (mode) => {
    viewMode = mode;
    localStorage.setItem("solViewMode", mode);
    document.body.classList.toggle("smart-mode", mode === "smart");
    document.body.classList.toggle("max-mode", mode === "max");
    smartBtn?.classList.toggle("active", mode === "smart");
    maxBtn?.classList.toggle("active", mode === "max");
    renderSmart();
  };
  smartBtn?.addEventListener("click", () => setMode("smart"));
  maxBtn?.addEventListener("click", () => setMode("max"));
  setMode(viewMode);
  initTradeCalculator();
}

function getAutoNews() {
  return (data?.latest_auto?.news || []).filter(Boolean);
}

function dateMs(value) {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function recentNews(days = 14) {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return getAutoNews()
    .filter(n => {
      const ms = dateMs(n.published_at || n.date);
      return ms && ms >= cutoff;
    })
    .sort((a, b) => dateMs(b.published_at || b.date) - dateMs(a.published_at || a.date));
}

function currentPriceNumber() {
  const price = data?.latest_auto?.price || {};
  const val = price.regularMarketPrice ?? price.price ?? price.currentPrice;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value, currency = "$") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "offen";
  return `${currency}${n.toLocaleString("de-DE", { maximumFractionDigits: 2, minimumFractionDigits: n < 10 ? 2 : 0 })}`;
}

function renderSmart() {
  if (!data || !$("smartHome")) return;

  $("smartHeadline").textContent = `${data.ticker} · ${data.name || data.ticker}`;
  $("smartThesis").textContent = simplifyText(data.thesis || "Kompakte Smart-Ansicht mit den wichtigsten News, Einschätzungen und Kursbereichen.");

  const price = data.latest_auto?.price || {};
  const p = currentPriceNumber();
  $("smartPriceGrid").innerHTML = `
    <div class="smartMetric"><span>Aktueller Kurs</span><b>${formatMoney(p)}</b><small>${esc(price.regularMarketChangePercent ? `${price.regularMarketChangePercent}% vs. vorheriger Schluss` : "Live-/Auto-Daten")}</small></div>
    <div class="smartMetric"><span>52W-Spanne</span><b>${esc(price.fiftyTwoWeekRange || price.range52 || "offen")}</b><small>zur Einordnung der Schwankung</small></div>
    <div class="smartMetric"><span>Risiko</span><b>${esc(data.character || "spekulativ")}</b><small>keine Kaufempfehlung</small></div>
  `;

  renderSmartNews();
  renderSmartUpcoming();
  renderSmartAssessment();
  renderSmartChart();
  updateTradeCalc();
}

function renderSmartNews() {
  const target = $("smartNews");
  if (!target) return;

  let news = recentNews(14);
  if (!news.length) {
    news = getAutoNews()
      .sort((a, b) => dateMs(b.published_at || b.date) - dateMs(a.published_at || a.date))
      .slice(0, 6);
  }

  if (!news.length) {
    target.innerHTML = `<p class="mutedBox">Noch keine aktuellen News geladen. Starte den Workflow oder warte auf das nächste Auto-Update.</p>`;
    return;
  }

  target.innerHTML = news.slice(0, 10).map(n => `
    <article class="smartNewsItem ${esc(n.trigger_level || "")}">
      <div class="smartNewsMeta">${esc(fmtDate(n.published_at))} · ${esc(n.source || "Quelle offen")} · ${esc(n.trigger_type || "News")}</div>
      <h3>${esc(simplifyText(n.title || "Ohne Titel"))}</h3>
      <p><strong>Einordnung:</strong> ${esc(simplifyText(n.assessment || n.summary || "Diese Meldung sollte geprüft werden."))}</p>
      ${n.watch ? `<p><strong>Worauf achten:</strong> ${esc(simplifyText(n.watch))}</p>` : ""}
      ${n.url ? `<a class="sourceLink" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">Quelle öffnen →</a>` : ""}
    </article>
  `).join("");
}

function renderSmartUpcoming() {
  const target = $("smartUpcoming");
  if (!target) return;

  const catalysts = (data.catalysts || []).slice(0, 4);
  const triggers = (data.latest_auto?.detected_triggers || []).slice(0, 4);

  const cards = [
    ...catalysts.map(c => ({
      tag: c.tag || "Termin",
      title: c.title || "Wichtiger Auslöser",
      text: c.text || "Prüfen, ob dieser Punkt den Kurs bewegen kann."
    })),
    ...triggers.map(t => ({
      tag: t.type || "Hinweis",
      title: t.title || t.reason || "Automatisch erkannter Hinweis",
      text: t.assessment || t.watch || "Diese Meldung sollte genauer geprüft werden."
    }))
  ].slice(0, 5);

  if (!cards.length) {
    target.innerHTML = `<p class="mutedBox">Noch keine klaren nächsten Termine erkannt. Achte auf Studienupdates, Finanzierungen, Quartalszahlen oder Behördenmeldungen.</p>`;
    return;
  }

  target.innerHTML = cards.map(c => `
    <div class="smartUpcomingItem">
      <span>${esc(simplifyText(c.tag))}</span>
      <b>${esc(simplifyText(c.title))}</b>
      <p>${esc(simplifyText(c.text))}</p>
    </div>
  `).join("");
}

function renderSmartAssessment() {
  const target = $("smartAssessment");
  if (!target) return;

  const clear = (data.clear_view || []).slice(0, 3);
  const zones = (data.zones || []).slice(0, 3);
  const recent = recentNews(14);
  const high = recent.filter(n => n.trigger_level === "high").length;

  let html = "";
  if (clear.length) {
    html += clear.map(p => `<p>${esc(simplifyText(p))}</p>`).join("");
  } else {
    html += `<p>Diese Aktie ist aktuell stark von News abhängig. Wichtig sind Kurs, News der letzten Tage, Finanzierung und mögliche Studien- oder Behördenmeldungen.</p>`;
  }

  html += `<div class="smartSignal ${high ? "hot" : ""}">
    <b>${high ? "Achtung: starke Trigger gefunden" : "Aktueller Smart-Status"}</b>
    <span>${high ? `${high} stark kursrelevante Meldung(en) in den letzten 14 Tagen erkannt.` : "Keine extremen Trigger in den letzten 14 Tagen erkannt. Trotzdem News genau lesen."}</span>
  </div>`;

  if (zones.length) {
    html += `<div class="smartZones">` + zones.map(z => `
      <div><b>${esc(simplifyText(z.zone))}</b><span>${esc(simplifyText(z.text))}</span></div>
    `).join("") + `</div>`;
  }

  target.innerHTML = html;
}


function renderSmartChart() {
  const svg = $("smartChart");
  const note = $("smartChartNote");
  if (!svg) return;

  const history = ((data?.latest_auto?.price_history || [])
    .map(x => ({
      t: dateMs(x.t || x.time || x.date),
      price: Number(x.price)
    }))
    .filter(x => x.t && Number.isFinite(x.price) && x.price > 0)
    .sort((a,b) => a.t - b.t)
  ).slice(-40);

  const current = currentPriceNumber();
  if (history.length < 2 && current) {
    const now = Date.now();
    history.push({ t: now - 24*60*60*1000, price: current });
    history.push({ t: now, price: current });
  }

  if (history.length < 2) {
    svg.innerHTML = `
      <rect x="0" y="0" width="720" height="260" rx="22" fill="rgba(255,255,255,.035)"></rect>
      <text x="360" y="126" text-anchor="middle" fill="rgba(255,255,255,.78)" font-size="20" font-weight="800">Noch zu wenig Kursdaten</text>
      <text x="360" y="158" text-anchor="middle" fill="rgba(255,255,255,.48)" font-size="14">Nach mehreren Updates entsteht hier der Kursverlauf.</text>
    `;
    if (note) note.textContent = "Der Smart-Chart baut sich automatisch mit jedem Update auf.";
    return;
  }

  const w = 720, h = 260, pad = 34;
  const prices = history.map(x => x.price);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (min === max) {
    min *= 0.96;
    max *= 1.04;
  }
  const xAt = (i) => pad + (i / (history.length - 1)) * (w - pad*2);
  const yAt = (p) => h - pad - ((p - min) / (max - min)) * (h - pad*2);

  const pts = history.map((x,i) => `${xAt(i).toFixed(1)},${yAt(x.price).toFixed(1)}`).join(" ");
  const first = history[0].price;
  const last = history[history.length - 1].price;
  const diff = last - first;
  const pct = first ? (diff / first) * 100 : 0;
  const stroke = diff >= 0 ? "#9ff0c0" : "#ffb0b0";

  const grid = [0,1,2,3].map(i => {
    const y = pad + i * ((h - pad*2)/3);
    return `<line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" stroke="rgba(255,255,255,.08)" />`;
  }).join("");

  const circles = history.map((x,i) => {
    if (i !== history.length - 1 && i !== 0) return "";
    return `<circle cx="${xAt(i)}" cy="${yAt(x.price)}" r="5" fill="${stroke}" stroke="rgba(0,0,0,.45)" stroke-width="2" />`;
  }).join("");

  svg.innerHTML = `
    <rect x="0" y="0" width="720" height="260" rx="22" fill="rgba(255,255,255,.035)"></rect>
    ${grid}
    <text x="${pad}" y="24" fill="rgba(255,255,255,.72)" font-size="13">Hoch: ${formatMoney(max)}</text>
    <text x="${w-pad}" y="24" text-anchor="end" fill="rgba(255,255,255,.72)" font-size="13">Tief: ${formatMoney(min)}</text>
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${circles}
    <text x="${pad}" y="${h-10}" fill="rgba(255,255,255,.55)" font-size="13">${new Date(history[0].t).toLocaleDateString("de-DE")}</text>
    <text x="${w-pad}" y="${h-10}" text-anchor="end" fill="rgba(255,255,255,.55)" font-size="13">${new Date(history[history.length-1].t).toLocaleDateString("de-DE")}</text>
  `;

  if (note) {
    note.innerHTML = `Letzter gespeicherter Kurs: <b>${formatMoney(last)}</b> · Veränderung seit erstem gespeicherten Punkt: <b class="${diff >= 0 ? "gainText" : "lossText"}">${diff >= 0 ? "+" : ""}${formatMoney(diff)} (${pct.toFixed(1)}%)</b>`;
  }
}


function initTradeCalculator() {
  const buy = $("calcBuyPrice");
  const invest = $("calcInvest");
  const sell = $("calcSellPrice");
  const pct = $("calcTargetPct");

  buy?.addEventListener("input", () => {
    syncSellFromPct();
    updateTradeCalc();
  });
  invest?.addEventListener("input", updateTradeCalc);

  sell?.addEventListener("input", () => {
    syncPctFromSell();
    updateTradeCalc();
  });

  pct?.addEventListener("input", () => {
    syncSellFromPct();
    updateTradeCalc();
  });
}

function syncSellFromPct() {
  const buy = Number($("calcBuyPrice")?.value || 0);
  const pct = Number($("calcTargetPct")?.value || 0);
  const sell = $("calcSellPrice");
  if (!buy || !sell) return;
  const target = buy * (1 + pct / 100);
  sell.value = target > 0 ? target.toFixed(2) : "";
}

function syncPctFromSell() {
  const buy = Number($("calcBuyPrice")?.value || 0);
  const sell = Number($("calcSellPrice")?.value || 0);
  const pct = $("calcTargetPct");
  if (!buy || !sell || !pct) return;
  pct.value = (((sell / buy) - 1) * 100).toFixed(1);
}

function updateTradeCalc() {
  if (!$("tradeResult")) return;

  const current = currentPriceNumber();
  const buyInput = $("calcBuyPrice");
  const investInput = $("calcInvest");
  const sellInput = $("calcSellPrice");
  const pctInput = $("calcTargetPct");

  if (current && buyInput && !buyInput.value) {
    buyInput.value = current.toFixed(2);
  }

  const buy = Number(buyInput?.value || 0);
  const invest = Number(investInput?.value || 0);

  if (buy && pctInput && sellInput && !sellInput.value) {
    const pct = Number(pctInput.value || 0);
    sellInput.value = (buy * (1 + pct / 100)).toFixed(2);
  }

  const sell = Number(sellInput?.value || 0);

  if (!buy || !invest || !sell) {
    $("tradeResult").innerHTML = "Einstiegskurs, Einsatz und Verkaufskurs eingeben.";
    return;
  }

  const shares = invest / buy;
  const value = shares * sell;
  const profit = value - invest;
  const profitPct = (profit / invest) * 100;

  $("tradeResult").innerHTML = `
    <div><span>Einstieg</span><b>${formatMoney(buy)}</b></div>
    <div><span>Verkauf</span><b>${formatMoney(sell)}</b></div>
    <div><span>Stückzahl ca.</span><b>${shares.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</b></div>
    <div><span>Endwert</span><b>${formatMoney(value)}</b></div>
    <div class="${profit >= 0 ? "gain" : "loss"}"><span>${profit >= 0 ? "Gewinn" : "Verlust"}</span><b>${formatMoney(profit)} (${profitPct.toFixed(1)}%)</b></div>
  `;
}


function closeAdminDropdownSoon() {
  setTimeout(() => {
    const admin = document.querySelector(".adminDropdown");
    if (admin) admin.open = false;
  }, 1200);
}


function initDropdownBehavior() {
  document.addEventListener("click", (event) => {
    const admin = document.querySelector(".adminDropdown");
    if (!admin || !admin.open) return;
    if (!admin.contains(event.target)) {
      admin.open = false;
    }
  });
}


function initAdminForm() {
  const form = $("addStockForm");
  const status = $("adminStatus");
  const fillBtn = $("fillQueryBtn");

  if (!form) return;

  fillBtn?.addEventListener("click", () => {
    const ticker = $("newTicker").value.trim().toUpperCase();
    const name = $("newName").value.trim();
    if (!$("newSecQuery").value.trim()) $("newSecQuery").value = ticker;
    if (!$("newQuery").value.trim()) $("newQuery").value = `${name || ticker} ${ticker} stock news`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const apiUrl = (window.SOL_ADMIN_API_URL || "").trim().replace(/\/$/, "");
    const payload = {
      ticker: $("newTicker").value.trim().toUpperCase(),
      name: $("newName").value.trim(),
      exchange: $("newExchange").value.trim() || "NASDAQ",
      theme: $("newTheme").value.trim() || "Research",
      query: $("newQuery").value.trim(),
      sec_query: $("newSecQuery").value.trim().toUpperCase(),
      adminPin: $("adminPin").value
    };

    if (!payload.query) payload.query = `${payload.name || payload.ticker} ${payload.ticker} stock news`;
    if (!payload.sec_query) payload.sec_query = payload.ticker;

    if (!apiUrl) {
      status.className = "adminStatus err";
      status.innerHTML = `Admin-Worker ist noch nicht verbunden. Lokal nutze: <code>python3 scripts/add_stock.py ${esc(payload.ticker)} "${esc(payload.name)}"</code>`;
      return;
    }

    status.className = "adminStatus";
    status.textContent = "Speichere Aktie im GitHub-Repository…";

    try {
      const res = await fetch(`${apiUrl}/add-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.ok) {
        throw new Error(result.error || result.message || `Fehler ${res.status}`);
      }

      status.className = "adminStatus ok";
      status.textContent = `Gespeichert: ${payload.ticker}. GitHub/Cloudflare braucht ggf. kurz zum Deployen. Danach Daten neu laden.`;
      closeAdminDropdownSoon();

      form.reset();
      $("newExchange").value = "NASDAQ";
      await loadMeta();
    } catch (err) {
      status.className = "adminStatus err";
      status.textContent = `Fehler beim Speichern: ${err.message}`;
    }
  });
}



function populateDeleteDropdown(watchlist) {
  const sel = $("deleteTickerSelect");
  if (!sel) return;
  sel.innerHTML = (watchlist || []).map(x => `<option value="${esc(x.ticker)}">${esc(x.ticker)} · ${esc(x.name || "")}</option>`).join("");
}

function initDeleteForm() {
  const form = $("deleteStockForm");
  const status = $("deleteStatus");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const apiUrl = (window.SOL_ADMIN_API_URL || "").trim().replace(/\/$/, "");
    const ticker = $("deleteTickerSelect").value.trim().toUpperCase();
    const confirmText = $("deleteConfirm").value.trim();
    const adminPin = $("deleteAdminPin").value;
    if (confirmText !== "LÖSCHEN") {
      status.className = "adminStatus err";
      status.textContent = 'Bitte exakt "LÖSCHEN" eingeben, damit nichts versehentlich entfernt wird.';
      return;
    }
    if (!apiUrl) {
      status.className = "adminStatus err";
      status.innerHTML = `Admin-Worker ist noch nicht verbunden. Lokal nutze: <code>python3 scripts/delete_stock.py ${esc(ticker)}</code>`;
      return;
    }
    status.className = "adminStatus";
    status.textContent = `Lösche ${ticker} aus GitHub…`;
    try {
      const res = await fetch(`${apiUrl}/delete-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, adminPin })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) throw new Error(result.error || result.message || `Fehler ${res.status}`);
      status.className = "adminStatus ok";
      status.textContent = `${ticker} wurde gelöscht. GitHub/Cloudflare braucht ggf. kurz zum Deployen. Danach Seite hart neu laden.`;
      closeAdminDropdownSoon();
      $("deleteConfirm").value = "";
      await loadMeta();
    } catch (err) {
      status.className = "adminStatus err";
      status.textContent = `Fehler beim Löschen: ${err.message}`;
    }
  });
}

boot().catch(err => {
  document.body.innerHTML = `<pre style="color:white;padding:30px">Fehler: ${esc(err.message)}

Wichtig: Diese Seite muss über den lokalen Server laufen, nicht per Doppelklick.
Beispiel:
cd ~/Downloads/son-of-lorenc-master-v1-1
python3 -m http.server 8090
http://localhost:8090
</pre>`;
});
