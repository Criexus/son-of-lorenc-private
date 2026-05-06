export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin === "*" ? "*" : allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/add-stock") {
      return json({ ok: false, error: "Not found" }, 404, corsHeaders);
    }

    try {
      const body = await request.json();

      if (env.ADMIN_PIN && body.adminPin !== env.ADMIN_PIN) {
        return json({ ok: false, error: "Admin-PIN falsch" }, 403, corsHeaders);
      }

      const ticker = cleanTicker(body.ticker);
      const name = cleanText(body.name || ticker);
      const exchange = cleanText(body.exchange || "NASDAQ");
      const theme = cleanText(body.theme || "Research");
      const query = cleanText(body.query || `${name} ${ticker} stock news`);
      const secQuery = cleanTicker(body.sec_query || ticker);

      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
      const branch = env.GITHUB_BRANCH || "main";
      const token = env.GITHUB_TOKEN;

      if (!owner || !repo || !token) {
        return json({ ok: false, error: "Worker Secrets fehlen: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN" }, 500, corsHeaders);
      }

      const watchPath = "config/watchlist.json";
      const watchFile = await githubGetFile(owner, repo, watchPath, branch, token);
      const watchlist = watchFile ? JSON.parse(base64ToUtf8(watchFile.content)) : [];

      if (watchlist.some((x) => String(x.ticker || "").toUpperCase() === ticker)) {
        return json({ ok: false, error: `${ticker} ist bereits in der Watchlist vorhanden.` }, 409, corsHeaders);
      }

      watchlist.push({ ticker, name, exchange, theme, query, sec_query: secQuery });

      await githubPutFile(owner, repo, watchPath, branch, token, {
        message: `Add ${ticker} to Son of Lorenc watchlist`,
        content: utf8ToBase64(JSON.stringify(watchlist, null, 2) + "\n"),
        sha: watchFile?.sha
      });

      const stockPath = `data/${ticker}.json`;
      const existingStock = await githubGetFile(owner, repo, stockPath, branch, token);
      if (!existingStock) {
        const stockTemplate = createStockTemplate({ ticker, name, exchange, theme });
        await githubPutFile(owner, repo, stockPath, branch, token, {
          message: `Create Son of Lorenc dossier for ${ticker}`,
          content: utf8ToBase64(JSON.stringify(stockTemplate, null, 2) + "\n")
        });
      }

      // Optional: data/watchlist.json direkt aktualisieren, damit die Anzeige nach Deploy sofort passt.
      const displayPath = "data/watchlist.json";
      const displayFile = await githubGetFile(owner, repo, displayPath, branch, token);
      const display = displayFile ? JSON.parse(base64ToUtf8(displayFile.content)) : [];
      if (!display.some((x) => String(x.ticker || "").toUpperCase() === ticker)) {
        display.push({ ticker, name, exchange, theme });
        await githubPutFile(owner, repo, displayPath, branch, token, {
          message: `Update dashboard display watchlist for ${ticker}`,
          content: utf8ToBase64(JSON.stringify(display, null, 2) + "\n"),
          sha: displayFile?.sha
        });
      }

      // Optional: Workflow triggern. Wenn Rechte fehlen, wird der Fehler ignoriert.
      await tryDispatchWorkflow(owner, repo, branch, token);

      return json({
        ok: true,
        ticker,
        message: `${ticker} wurde gespeichert. GitHub/Cloudflare braucht ggf. kurz zum Deployen.`
      }, 200, corsHeaders);
    } catch (err) {
      return json({ ok: false, error: err.message || "Unbekannter Fehler" }, 500, corsHeaders);
    }
  }
};

function cleanTicker(value) {
  const ticker = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,15}$/.test(ticker)) {
    throw new Error("Ticker ungültig. Erlaubt: A-Z, 0-9, Punkt und Bindestrich.");
  }
  return ticker;
}

function cleanText(value) {
  return String(value || "").trim().slice(0, 240);
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers });
}

async function githubGetFile(owner, repo, path, branch, token) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token)
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function githubPutFile(owner, repo, path, branch, token, payload) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}`, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: payload.message,
      content: payload.content,
      branch,
      ...(payload.sha ? { sha: payload.sha } : {})
    })
  });

  if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function tryDispatchWorkflow(owner, repo, branch, token) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/update-every-30-min.yml/dispatches`, {
      method: "POST",
      headers: githubHeaders(token),
      body: JSON.stringify({ ref: branch })
    });
    // 204 = gestartet. Andere Fehler ignorieren, weil Speichern wichtiger ist.
    return res.ok;
  } catch {
    return false;
  }
}

function githubHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Son-of-Lorenc-Admin"
  };
}

function encodeURIComponentPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(String(b64).replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function createStockTemplate({ ticker, name, exchange, theme }) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ticker,
    exchange,
    name,
    eyebrow: `Son of Lorenc · Phasenanalyse · ${ticker}`,
    headline: `${name} – Phasenanalyse im Aufbau`,
    thesis: `Kurzthese: ${ticker} wurde neu in das Son-of-Lorenc-System aufgenommen. Der Dossier-Aufbau ist vorbereitet; aktuelle News, Kursdaten und SEC-Filings werden über das Update-System geladen.`,
    stand: today,
    phase: "A/B · Beobachtung / Story-Aufbau",
    character: "Research-Wert · Risiko prüfen",
    metrics: [
      { label: "Aktueller Kurs", value: "wird aktualisiert", note: "aus automatischem Datenabruf", key: "price" },
      { label: "52W-Spanne", value: "offen", note: "manuell/automatisch ergänzen", key: "range52" },
      { label: "Cash & Wertpapiere", value: "offen", note: "letzten Bericht prüfen", key: "cash" },
      { label: "Cash Runway", value: "offen", note: "Finanzierungsreichweite prüfen", key: "runway" },
      { label: "Umsatz", value: "offen", note: "je nach Entwicklungsphase relevant", key: "revenue" },
      { label: "Risikoklasse", value: "offen", note: "muss eingeordnet werden", key: "risk" }
    ],
    chart_subtitle: "Schematische Einordnung der wichtigsten Kurs- und Nachrichtenpunkte. Dieses Diagramm wird aus hinterlegten Ereignissen plus erwarteten Katalysatoren gezeichnet.",
    chart_note: "Hinweis: Das Diagramm ist kein exakter Börsenchart, sondern ein Analyse-Overlay zur News-/Katalysatorlogik.",
    events: [
      { d: "Start", p: 1.0, title: "Dossier angelegt", phase: "Phase A – Aufbau", reaction: "Der Wert wurde in die Watchlist aufgenommen.", details: "Die tiefe Analyse kann nach Recherche ergänzt werden.", source: "Son of Lorenc", future: false },
      { d: "News", p: 1.2, title: "Automatische News folgen", phase: "Phase B – Monitoring", reaction: "Google-News-/SEC-Daten werden über das Skript geladen.", details: "Kursrelevanz muss geprüft werden.", source: "Automatisches Monitoring", future: false },
      { d: "Katalysator", p: 1.35, title: "Nächsten harten Trigger definieren", phase: "Nächster Katalysator", reaction: "Hier sollte der wichtigste Termin eingetragen werden.", details: "Zum Beispiel Studienreadout, Quartalszahlen, FDA/EMA, Finanzierung oder Partnerschaft.", source: "manuelle Analyse", future: true }
    ],
    pipeline_intro: "Pipeline / Geschäftsmodell wird nach tiefer Recherche ergänzt.",
    pipeline: [
      { stage: "Lead Asset / Haupttreiber", class: "phase3", name: "Hauptprogramm", text: "Hier das wichtigste Programm oder Geschäftsmodell eintragen.", score: 70, score_label: "hoch" },
      { stage: "Zweitprogramm / Option", class: "phase2", name: "Zweitprogramm", text: "Zusätzlicher Werttreiber oder zweiter Katalysator.", score: 50, score_label: "mittel" },
      { stage: "Early Stage", class: "early", name: "Frühe Pipeline", text: "Langfristiger Optionswert.", score: 30, score_label: "langfristig" }
    ],
    zones: [
      { zone: "Pullback", text: "Interessanter Bereich, wenn keine negative Unternehmensnews dahintersteht." },
      { zone: "Arbeitszone", text: "Neutrale Zone für Beobachtung und Tranchendenken." },
      { zone: "Momentum", text: "Hier steigt das Rückschlagrisiko, wenn keine harte News folgt." },
      { zone: "Warnzone", text: "Prüfen, ob Cash, Daten oder Verwässerung negativ sind." }
    ],
    catalysts: [
      { tag: "Kurzfristig", title: "Nächste News / Quartalszahlen", text: "Termin oder Katalysator ergänzen." },
      { tag: "Mittelfristig", title: "Pipeline-/Projektupdate", text: "Relevanten operativen Meilenstein ergänzen." },
      { tag: "Risiko", title: "Cash / Verwässerung prüfen", text: "Finanzierungslage und mögliche Kapitalmaßnahmen beobachten." }
    ],
    scenarios: {
      bear: { title: "Bear Case", text: "Negative Daten, Kapitalmaßnahme oder schwacher Markt können den Kurs drücken." },
      base: { title: "Base Case", text: "Ohne neue harte Katalysatoren bleibt der Wert wahrscheinlich news- und stimmungsgetrieben." },
      bull: { title: "Bull Case", text: "Positive Daten, Finanzierungssicherheit oder Partnerschaften können eine Neubewertung auslösen." }
    },
    risks: [
      { title: "Studiendaten-/Projekt-Risiko", text: "Operative Fortschritte müssen bestätigt werden." },
      { title: "Verwässerungsrisiko", text: "Kapitalmaßnahmen können Bestandsaktionäre verwässern." },
      { title: "Volatilität", text: "Kleine und mittlere Werte reagieren stark auf News." },
      { title: "Hype-Risiko", text: "Schnelle Peaks werden oft wieder abverkauft." }
    ],
    clear_view: [
      "Diese Analyse ist als Dossier-Vorlage vorbereitet. Für eine echte Einordnung müssen aktuelle News, Cash, Katalysatoren und Kurszonen ergänzt werden.",
      "Keine Kaufempfehlung. Das Ziel ist eine klare Chancen-Risiko-Struktur statt impulsivem Einstieg."
    ],
    sources: ["Son of Lorenc Mastertemplate", "Automatische Quellen werden nach Update ergänzt."],
    latest_auto: { last_update_utc: new Date().toISOString(), price: null, news: [], sec_filings: [] }
  };
}
