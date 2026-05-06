let data = null;
let active = 0;
let currentTicker = "ATAI";

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
