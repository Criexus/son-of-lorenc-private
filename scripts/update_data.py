#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import requests

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "watchlist.json"
DATA = ROOT / "data"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 SonOfLorencDashboard/1.3"})
SEC_HEADERS = {
    "User-Agent": "SonOfLorencDashboard/1.3 contact: private-dashboard@example.com",
    "Accept-Encoding": "gzip, deflate",
}

TRIGGER_RULES = [
    ("FDA / Regulatorik", "high", ["fda", "ema", "breakthrough", "fast track", "priority review", "approval", "zulassung", "clinical hold", "crl", "complete response"]),
    ("Studienphase / Readout", "high", ["phase 3", "phase iii", "phase 2", "phase ii", "topline", "readout", "primary endpoint", "endpunkt", "clinical trial", "trial results", "study results"]),
    ("Finanzierung / Verwässerung", "high", ["offering", "registered direct", "atm", "warrants", "dilution", "s-1", "f-3", "424b", "kapitalerhöhung", "reverse split"]),
    ("Partnerschaft / Deal", "medium", ["partnership", "collaboration", "license", "licensing", "merger", "acquisition", "deal", "strategic combination"]),
    ("Quartalszahlen / Cash", "medium", ["quarter", "q1", "q2", "q3", "q4", "earnings", "financial results", "cash runway", "cash", "10-q", "10-k", "20-f"]),
    ("Konferenz / Präsentation", "low", ["conference", "investor", "presentation", "webcast", "fireside chat"]),
    ("Analysten / Kursziel", "low", ["price target", "analyst", "upgrade", "downgrade", "rating"])
]

def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def req_json(url: str, headers=None, params=None, timeout=20):
    try:
        r = SESSION.get(url, headers=headers, params=params, timeout=timeout)
        if r.status_code >= 400:
            print(f"[WARN] HTTP {r.status_code}: {url}")
            return None
        return r.json()
    except Exception as e:
        print(f"[WARN] JSON request failed: {url} -> {e}")
        return None

def req_text(url: str, headers=None, timeout=20):
    try:
        r = SESSION.get(url, headers=headers, timeout=timeout)
        if r.status_code >= 400:
            print(f"[WARN] HTTP {r.status_code}: {url}")
            return None
        return r.text
    except Exception as e:
        print(f"[WARN] Text request failed: {url} -> {e}")
        return None

def yahoo_price(ticker: str) -> dict[str, Any]:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(ticker)}?range=5d&interval=1d"
    data = req_json(url)
    out = {"source": "Yahoo Finance Chart Endpoint", "currency": "USD", "regularMarketPrice": None, "previousClose": None, "change": None, "changePercent": None}
    try:
        meta = data["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice")
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        change = round(float(price) - float(prev), 4) if price is not None and prev else None
        pct = round((change / float(prev)) * 100, 2) if change is not None and prev else None
        out.update({
            "currency": meta.get("currency", "USD"),
            "regularMarketPrice": price,
            "previousClose": prev,
            "change": change,
            "changePercent": pct,
        })
    except Exception:
        pass
    return out

def parse_date(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except Exception:
        return raw

def normalize_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title.lower()).strip()
    title = re.sub(r" - [^-]+$", "", title)
    return title


DEFAULT_NEWS_ALIASES = {
    "ATAI": {
        "strong": ["atai", "atai beckley", "beckley", "bpl-003", "rl-007", "vls-01", "emp-01"],
        "weak": ["psychedelic", "psilocybin"]
    },
    "BDRX": {
        "strong": ["biodexa", "biodexa pharmaceuticals", "mtx110"],
        "weak": []
    },
    "RCKT": {
        "strong": ["rocket pharmaceuticals", "rocket pharma", "rp-a501", "rp-l102", "kresladi"],
        "weak": []
    },
    "CMPS": {
        "strong": ["compass pathways", "comp360"],
        "weak": ["psilocybin"]
    },
    "ALT": {
        "strong": ["altimmune", "pemvidutide"],
        "weak": ["mash", "obesity"]
    },
    "CABA": {
        "strong": ["cabaletta", "cabaletta bio", "caba-201", "caart"],
        "weak": ["autoimmune", "cell therapy"]
    },
    "ENVB": {
        "strong": ["enveric", "enveric biosciences", "eb-003", "eb-002"],
        "weak": ["neuroplastogen", "psychedelic"]
    },
    "GH": {
        "strong": ["guardant health", "guardant", "guardant360", "shield", "reveal"],
        "weak": ["liquid biopsy", "colorectal", "cancer screening"]
    },
    "MAAT.PA": {
        "strong": ["maat pharma", "maat013", "xervyteg", "maat034"],
        "weak": ["microbiome"]
    },
    "MAAT": {
        "strong": ["maat pharma", "maat013", "xervyteg", "maat034"],
        "weak": ["microbiome"]
    },
    "DFTX": {
        "strong": ["definium therapeutics", "definium", "dt120", "dt402", "mm120"],
        "weak": ["psychedelic", "neuropsychiatry"]
    },
    "HAO": {
        "strong": ["haoxi health technology", "haoxi health", "haoxi"],
        "weak": ["marketing technology", "china adr"]
    },
    "RXRX": {
        "strong": ["recursion pharmaceuticals", "recursion", "rxrx", "exscientia"],
        "weak": ["ai drug discovery", "drug discovery"]
    },
    "2B76.DE": {
        "strong": ["ishares automation", "automation & robotics", "robotics ucits etf", "2b76"],
        "weak": ["robotics", "automation", "artificial intelligence"]
    },
    "ELFW.DE": {
        "strong": ["msci world", "elfw", "world etf"],
        "weak": ["global equities", "world stocks"]
    }
}

GENERIC_TICKERS = {"ALT", "GH", "ON", "IT", "AI", "DNA", "USA", "EU", "UK", "SA"}
BAD_NEWS_HINTS = [
    "die besten large caps",
    "für dein portfolio",
    "shares of several",
    "why these stocks",
    "top stocks",
    "hot stocks",
    "premarket movers",
    "market movers",
    "aktien news |",
    "aktien news -",
    "börsen news",
    "stock market today"
]

def _norm_term(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())

def build_relevance_terms(config: dict[str, Any]) -> dict[str, Any]:
    ticker = str(config.get("ticker", "")).upper().strip()
    name = str(config.get("name", "")).strip()
    query = str(config.get("query", "")).strip()
    queries = config.get("queries") or []

    defaults = DEFAULT_NEWS_ALIASES.get(ticker, {"strong": [], "weak": []})
    strong = list(defaults.get("strong", []))
    weak = list(defaults.get("weak", []))

    strong.extend(config.get("aliases") or [])
    strong.extend(config.get("news_aliases") or [])
    strong.extend(config.get("programs") or [])

    if name:
        strong.append(name)
        parts = [p for p in re.split(r"[^A-Za-z0-9.-]+", name) if len(p) >= 5]
        # Nur sinnvolle Namensbestandteile, nicht generische Wörter.
        for p in parts:
            if p.lower() not in {"pharma", "health", "therapeutics", "biosciences", "inc"}:
                strong.append(p)

    for q in queries + ([query] if query else []):
        # Nur Pipeline-/Produktcodes aus Suchbegriffen übernehmen, keine generischen Wörter wie stock/news.
        strong.extend(re.findall(r"\b[A-Z]{2,8}[- ]?\d{2,4}\b|\bCOMP\d{2,4}\b", str(q)))

    stop = {"stock", "news", "share", "shares", "aktie", "inc", "sa", "plc", "ltd", "corp", "therapeutics", "pharma", "biosciences", "health", "company", "group", "clinical"}
    clean_strong, seen = [], set()
    for a in strong:
        a = _norm_term(a)
        if not a or len(a) < 4 or a in stop:
            continue
        if a not in seen:
            seen.add(a)
            clean_strong.append(a)

    clean_weak, seen_w = [], set()
    for a in weak:
        a = _norm_term(a)
        if not a or len(a) < 5 or a in stop:
            continue
        if a not in seen_w:
            seen_w.add(a)
            clean_weak.append(a)

    return {
        "ticker": ticker,
        "name": _norm_term(name),
        "strong": clean_strong,
        "weak": clean_weak,
        "strict_ticker": ticker in GENERIC_TICKERS or len(ticker) <= 3
    }

def news_relevance_score(item: dict[str, Any], relevance: dict[str, Any]) -> int:
    title = _norm_term(item.get("title", ""))
    source = _norm_term(item.get("source", ""))
    query = _norm_term(item.get("query", ""))
    text = f"{title} {source}"

    if any(bad in title for bad in BAD_NEWS_HINTS):
        return -10

    score = 0

    for term in relevance.get("strong", []):
        if term and term in text:
            score += 6 if len(term) >= 8 else 4

    for term in relevance.get("weak", []):
        if term and term in text:
            score += 1

    ticker = relevance.get("ticker", "")
    if ticker:
        t = ticker.lower().replace(".pa", "")
        if re.search(rf"(?<![a-z0-9]){re.escape(t)}(?![a-z0-9])", text):
            score += 1 if relevance.get("strict_ticker") else 3

    # Bonus, wenn Titel und Query inhaltlich wirklich zusammenpassen.
    q_terms = [x for x in re.findall(r"[a-z0-9-]{5,}", query) if x not in {"stock", "news", "aktie"}]
    if any(q in title for q in q_terms[:6]):
        score += 1

    return score

def is_relevant_news(item: dict[str, Any], relevance: dict[str, Any]) -> bool:
    title = _norm_term(item.get("title", ""))
    # Ohne starken Firmen-/Produktbezug raus.
    strong_hit = any(term in title for term in relevance.get("strong", []))
    if not strong_hit:
        return False

    return news_relevance_score(item, relevance) >= 4


def google_news(query: str, limit: int = 25) -> list[dict[str, Any]]:
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote_plus(query)}&hl=de&gl=DE&ceid=DE:de"
    xml = req_text(url)
    if not xml:
        return []
    out = []
    try:
        root = ET.fromstring(xml)
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            source_el = item.find("source")
            source = source_el.text.strip() if source_el is not None and source_el.text else "Google News"
            out.append({
                "title": title,
                "url": (item.findtext("link") or "").strip(),
                "published_at": parse_date(item.findtext("pubDate")),
                "source": source,
                "query": query,
                "source_type": "google_news_rss"
            })
            if len(out) >= limit:
                break
    except Exception as e:
        print(f"[WARN] RSS parse failed: {e}")
    return out

def rss_feed(url: str, limit: int = 25) -> list[dict[str, Any]]:
    xml = req_text(url)
    if not xml:
        return []
    out = []
    try:
        root = ET.fromstring(xml)
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            out.append({
                "title": title,
                "url": (item.findtext("link") or "").strip(),
                "published_at": parse_date(item.findtext("pubDate") or item.findtext("updated")),
                "source": url,
                "query": "custom_rss",
                "source_type": "custom_rss"
            })
            if len(out) >= limit:
                break
    except Exception as e:
        print(f"[WARN] Custom RSS parse failed: {url} -> {e}")
    return out


def fetch_all_news(config: dict[str, Any]) -> list[dict[str, Any]]:
    queries = config.get("queries") or [config.get("query", config["ticker"])]
    rss_urls = config.get("rss_urls") or []
    max_news = int(config.get("max_news", 40))
    relevance = build_relevance_terms(config)

    raw = []
    for q in queries:
        print(f"  [NEWS] {q}")
        raw.extend(google_news(q, limit=25))
        time.sleep(0.4)

    for url in rss_urls:
        print(f"  [RSS] {url}")
        raw.extend(rss_feed(url, limit=20))
        time.sleep(0.4)

    seen, deduped = set(), []
    filtered_out = 0

    for n in raw:
        key = normalize_title(n.get("title", ""))
        if not key or key in seen:
            continue
        seen.add(key)

        if not is_relevant_news(n, relevance):
            filtered_out += 1
            continue

        trigger = classify_text(n.get("title", ""))
        n["trigger_type"] = trigger["type"]
        n["trigger_level"] = trigger["level"]
        n["trigger_reason"] = trigger["reason"]
        n["impact"] = trigger.get("impact", "unklare Kursrelevanz")
        n["assessment"] = trigger.get("assessment", "Diese Meldung sollte inhaltlich geprüft werden.")
        n["watch"] = trigger.get("watch", "Quelle und Inhalt prüfen.")
        n["summary"] = f"{trigger['reason']} Einordnung: {trigger.get('assessment','Bitte prüfen')} Beobachten: {trigger.get('watch','Quelle prüfen')}"
        n["relevance_score"] = news_relevance_score(n, relevance)
        deduped.append(n)

    if filtered_out:
        print(f"  [FILTER] {filtered_out} unpassende News entfernt")

    deduped.sort(key=lambda x: (x.get("published_at") or "", x.get("relevance_score", 0)), reverse=True)
    return deduped[:max_news]


def sec_ticker_map() -> dict[str, Any]:
    data = req_json("https://www.sec.gov/files/company_tickers.json", headers=SEC_HEADERS)
    mp = {}
    if isinstance(data, dict):
        for _, row in data.items():
            t = str(row.get("ticker", "")).upper()
            if t:
                mp[t] = row
    return mp

def sec_filings(ticker: str, mp: dict[str, Any], limit: int = 20) -> list[dict[str, Any]]:
    row = mp.get(ticker.upper())
    if not row:
        return []
    cik = str(row.get("cik_str", "")).zfill(10)
    data = req_json(f"https://data.sec.gov/submissions/CIK{cik}.json", headers=SEC_HEADERS)
    if not data:
        return []
    out = []
    try:
        recent = data["filings"]["recent"]
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        docs = recent.get("primaryDocument", [])
        for i, form in enumerate(forms[:limit]):
            acc = accessions[i].replace("-", "") if i < len(accessions) else ""
            doc = docs[i] if i < len(docs) else ""
            url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/{doc}" if acc and doc else f"https://www.sec.gov/edgar/browse/?CIK={ticker}"
            out.append({"form": form, "filingDate": dates[i] if i < len(dates) else "", "url": url, "source": "SEC EDGAR", "description": "Offizielle SEC-Meldung"})
    except Exception as e:
        print(f"[WARN] SEC parse failed for {ticker}: {e}")
    return out

def clinical_trials(term: str, limit: int = 15) -> list[dict[str, Any]]:
    if not term:
        return []
    url = "https://clinicaltrials.gov/api/v2/studies"
    params = {"query.term": term, "pageSize": min(limit, 100), "format": "json"}
    data = req_json(url, params=params)
    if not data or "studies" not in data:
        return []

    out = []
    for st in data.get("studies", [])[:limit]:
        ps = st.get("protocolSection", {})
        ident = ps.get("identificationModule", {})
        status = ps.get("statusModule", {})
        cond = ps.get("conditionsModule", {})
        design = ps.get("designModule", {})
        nct = ident.get("nctId", "")
        title = ident.get("briefTitle") or ident.get("officialTitle") or nct
        phases = design.get("phases") or []
        conditions = cond.get("conditions") or []
        out.append({
            "nct_id": nct,
            "title": title,
            "status": status.get("overallStatus", ""),
            "phase": ", ".join(phases) if isinstance(phases, list) else str(phases),
            "conditions": ", ".join(conditions[:4]) if isinstance(conditions, list) else str(conditions),
            "last_update": (status.get("lastUpdateSubmitDateStruct") or {}).get("date", ""),
            "start_date": (status.get("startDateStruct") or {}).get("date", ""),
            "url": f"https://clinicaltrials.gov/study/{nct}" if nct else "https://clinicaltrials.gov/"
        })
    return out


ASSESSMENT_TEXTS = {
    "FDA / Regulatorik": {
        "impact": "potenziell hoher Kurshebel",
        "assessment": "Regulatorische Meldungen können bei Biotech-Werten stark kursrelevant sein. Wichtig ist zu prüfen, ob es sich um eine echte Zulassungs-/FDA-Entwicklung handelt oder nur um eine allgemeine Erwähnung.",
        "watch": "Auf offizielle Unternehmensmeldung, FDA/EMA-Kontext, Zeitplan und konkrete Programme achten."
    },
    "Studienphase / Readout": {
        "impact": "potenziell hoher klinischer Trigger",
        "assessment": "Studien- und Readout-Meldungen sind bei Pipeline-Werten oft der zentrale Kurstreiber. Entscheidend ist, ob harte Daten, Endpunkte, Sicherheitsdaten oder nur Ankündigungen kommuniziert wurden.",
        "watch": "Primären Endpunkt, Sicherheitsprofil, Patientenzahl, Phase und nächsten Meilenstein prüfen."
    },
    "Finanzierung / Verwässerung": {
        "impact": "hohes Risiko für Kursdruck",
        "assessment": "Finanzierungs- und Offering-Meldungen können kurzfristig stark belasten, weil sie Verwässerung oder Kapitalbedarf signalisieren können. Gleichzeitig kann frisches Kapital den Runway verlängern.",
        "watch": "Volumen, Preis je Aktie, Warrants, ATM/Shelf-Struktur und Cash Runway prüfen."
    },
    "Partnerschaft / Deal": {
        "impact": "möglicher Validierungs-Trigger",
        "assessment": "Partnerschaften, Lizenzdeals oder strategische Kombinationen können die Pipeline validieren. Entscheidend ist, ob echtes Kapital, Meilensteinzahlungen oder nur eine unverbindliche Kooperation dahinterstehen.",
        "watch": "Upfront-Zahlungen, Meilensteine, Exklusivität, Rechteverteilung und betroffene Programme prüfen."
    },
    "Quartalszahlen / Cash": {
        "impact": "fundamentaler Risiko-Trigger",
        "assessment": "Quartalszahlen sind bei Entwicklungsfirmen vor allem wegen Cashbestand, Burn Rate und Runway wichtig. Umsatz ist bei frühen Biotechs oft weniger entscheidend als Finanzierungssicherheit.",
        "watch": "Cash, Burn Rate, Runway, operative Kosten, neue Aktien und Guidance prüfen."
    },
    "Konferenz / Präsentation": {
        "impact": "meist niedriger bis mittlerer Trigger",
        "assessment": "Konferenz- oder Präsentationsmeldungen sind oft eher Sichtbarkeits-Events als harte Kurstreiber. Kursrelevant wird es erst, wenn dort neue Daten, Guidance oder strategische Aussagen kommen.",
        "watch": "Ob neue Daten angekündigt werden oder nur eine Standard-Präsentation stattfindet."
    },
    "Analysten / Kursziel": {
        "impact": "Stimmungs- und Momentum-Trigger",
        "assessment": "Analystenratings können kurzfristig Momentum erzeugen, ersetzen aber keine fundamentalen Daten. Wichtig ist, ob die Begründung auf neuen Fakten oder nur Bewertungsannahmen basiert.",
        "watch": "Kurszieländerung, Ratingänderung, Begründung und Abweichung zum aktuellen Kurs prüfen."
    },
    "Allgemeine News": {
        "impact": "unklare Kursrelevanz",
        "assessment": "Diese Meldung enthält keinen eindeutigen harten Trigger. Sie sollte trotzdem geprüft werden, wenn sie häufig auftaucht oder von einer wichtigen Quelle kommt.",
        "watch": "Quelle, Inhalt und Zusammenhang mit Pipeline, Cash oder Kursbewegung prüfen."
    }
}

def classify_text(text: str) -> dict[str, str]:
    low = (text or "").lower()
    for trigger_type, level, words in TRIGGER_RULES:
        if any(w in low for w in words):
            a = ASSESSMENT_TEXTS.get(trigger_type, ASSESSMENT_TEXTS["Allgemeine News"])
            return {
                "type": trigger_type,
                "level": level,
                "reason": f"Trigger erkannt: {trigger_type}.",
                "impact": a["impact"],
                "assessment": a["assessment"],
                "watch": a["watch"]
            }
    a = ASSESSMENT_TEXTS["Allgemeine News"]
    return {
        "type": "Allgemeine News",
        "level": "low",
        "reason": "Allgemeine Meldung ohne harten Schlüsseltrigger.",
        "impact": a["impact"],
        "assessment": a["assessment"],
        "watch": a["watch"]
    }


def detected_triggers(news: list[dict[str, Any]], filings: list[dict[str, Any]], trials: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []

    for n in news:
        if n.get("trigger_type") != "Allgemeine News":
            out.append({
                "type": n.get("trigger_type"),
                "level": n.get("trigger_level", "low"),
                "title": n.get("title"),
                "reason": n.get("trigger_reason"),
                "impact": n.get("impact"),
                "assessment": n.get("assessment"),
                "watch": n.get("watch"),
                "source": n.get("source"),
                "date": n.get("published_at"),
                "url": n.get("url")
            })

    for f in filings:
        form = str(f.get("form", "")).upper()
        if any(x in form for x in ["S-1", "F-3", "S-3", "424B", "F-1"]):
            typ, lvl = "SEC · Finanzierung/Verwässerung", "high"
        elif any(x in form for x in ["10-Q", "10-K", "20-F", "6-K"]):
            typ, lvl = "SEC · Finanzbericht", "medium"
        elif "8-K" in form:
            typ, lvl = "SEC · Unternehmensereignis", "medium"
        else:
            typ, lvl = "SEC Filing", "low"
        out.append({
            "type": typ,
            "level": lvl,
            "title": f"{form} · {f.get('filingDate','')}",
            "reason": "Offizielle SEC-Meldung gefunden.",
            "source": "SEC EDGAR",
            "date": f.get("filingDate", "")
        })

    for tr in trials:
        out.append({
            "type": "ClinicalTrials.gov",
            "level": "medium" if tr.get("phase") else "low",
            "title": tr.get("title"),
            "reason": f"Studienregister-Treffer: {tr.get('status','Status offen')} {tr.get('phase','')}",
            "source": tr.get("nct_id", "ClinicalTrials.gov"),
            "date": tr.get("last_update") or tr.get("start_date")
        })

    # Sort high first, then medium, then low
    order = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda x: (order.get(x.get("level", "low"), 2), str(x.get("date", ""))), reverse=False)
    return out[:30]

def update_metrics(data: dict[str, Any], price: dict[str, Any]) -> None:
    if not price.get("regularMarketPrice") or not data.get("metrics"):
        return
    for m in data["metrics"]:
        if m.get("key") == "price" or m.get("label", "").lower().startswith("aktueller kurs"):
            m["value"] = f"${float(price['regularMarketPrice']):.2f}"
            if price.get("changePercent") is not None:
                m["note"] = f"Auto-Update: {price['changePercent']}% vs. vorheriger Schlusskurs"
            return



def is_placeholder_text(text: str) -> bool:
    low = (text or "").lower()
    return any(x in low for x in [
        "im aufbau",
        "vorlage",
        "ergänzt",
        "hauptprogramm",
        "zweitprogramm",
        "frühe pipeline",
        "dossier angelegt",
        "automatische news folgen",
        "nach dem nächsten update",
        "wird nach dem nächsten update",
        "wird nach tiefer recherche",
        "keine news-datenpunkte",
        "struktur entspricht exakt",
        "kann später per ki"
    ])


def find_program_names(news, trials):
    text = " ".join([n.get("title", "") for n in news] + [t.get("title", "") for t in trials])
    candidates = re.findall(r"\b[A-Z]{1,6}[- ]?\d{2,4}\b|\bCOMP\d{2,4}\b", text)
    out, seen = [], set()
    for c in candidates:
        c = c.replace(" ", "-").upper()
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out[:4]

def summarize_news_theme(news, trials, ticker):
    text = " ".join(n.get("title", "") for n in news).lower()
    text += " " + " ".join((t.get("conditions", "") + " " + t.get("title", "")) for t in trials).lower()
    if any(w in text for w in ["obesity", "mash", "metabolic", "pemvidutide"]):
        return "Stoffwechsel / Adipositas / Lebererkrankungen"
    if any(w in text for w in ["depression", "ptsd", "anxiety", "psychedelic", "mental", "neuro"]):
        return "psychische / neurologische Erkrankungen"
    if any(w in text for w in ["oncology", "cancer", "tumor", "glioblastoma"]):
        return "Onkologie / Krebsmedizin"
    if any(w in text for w in ["gene therapy", "rare disease", "lentiviral", "aav"]):
        return "Gentherapie / seltene Erkrankungen"
    if any(w in text for w in ["autoimmune", "autoimmun", "cell therapy", "car-t", "cart"]):
        return "Autoimmunerkrankungen / Zelltherapie"
    return "Biotech / klinische Entwicklung"


def is_etf_config(data: dict[str, Any]) -> bool:
    blob = " ".join([
        str(data.get("ticker", "")),
        str(data.get("name", "")),
        str(data.get("exchange", "")),
        str(data.get("character", "")),
        str(data.get("phase", "")),
    ]).lower()
    return "etf" in blob or data.get("ticker", "").endswith(".DE") and any(x in blob for x in ["msci", "ishares", "ucits"])


def is_biotech_config(data: dict[str, Any]) -> bool:
    blob = " ".join([
        str(data.get("ticker", "")),
        str(data.get("name", "")),
        str(data.get("exchange", "")),
        str(data.get("character", "")),
        str(data.get("phase", "")),
        str(data.get("theme", "")),
        str(data.get("thesis", "")),
    ]).lower()

    biotech_words = [
        "biotech", "pharma", "therapeutics", "biosciences", "clinical", "phase",
        "fda", "drug", "pipeline", "onkologie", "zns", "psychedelic", "medicine",
        "gentherapie", "cell therapy", "autoimmun", "adipositas", "mash"
    ]

    non_biotech_words = [
        "marketing technology", "china adr", "online marketing", "advertising",
        "healthcare advertising", "small cap / marketing", "haoxi"
    ]

    if any(w in blob for w in non_biotech_words):
        return False

    return any(w in blob for w in biotech_words)

def build_auto_company_focus(data: dict[str, Any], news: list[dict[str, Any]]) -> list[dict[str, Any]]:
    name = data.get("name", data.get("ticker", "Unternehmen"))
    ticker = data.get("ticker", "")

    if ticker == "HAO" or "haoxi" in name.lower():
        return [
            {
                "stage": "Geschäftsmodell",
                "class": "phase2",
                "name": "Online-Marketing für Healthcare-Kunden",
                "text": f"{name} ist kein Biotech mit klinischen Studien. Das Unternehmen bietet Online-Marketing-Lösungen an, vor allem für Kunden aus dem Gesundheitsbereich. Wichtig sind Umsatzentwicklung, Kundenwachstum, Margen und ob das Geschäftsmodell nachhaltig profitabel bleibt.",
                "score": 62,
                "score_label": "Geschäftsbasis"
            },
            {
                "stage": "Kapitalmarkt",
                "class": "phase3",
                "name": "Finanzierung, Verwässerung und Nasdaq-Themen",
                "text": "Bei HAO sind Kapitalmaßnahmen, neue Aktien, Warrants, Reverse Splits und Nasdaq-Compliance besonders wichtig. Solche Meldungen können den Kurs kurzfristig stark bewegen.",
                "score": 78,
                "score_label": "sehr kursrelevant"
            },
            {
                "stage": "Operative Entwicklung",
                "class": "early",
                "name": "Partnerschaften und Plattform-News",
                "text": "Partnerschaften oder neue Plattform-/AI-/Marketing-Angebote können Aufmerksamkeit erzeugen. Entscheidend ist aber, ob daraus echter Umsatz und Gewinn entstehen.",
                "score": 48,
                "score_label": "prüfen"
            }
        ]

    return [
        {
            "stage": "Geschäftsmodell",
            "class": "phase2",
            "name": "Umsatz, Wachstum und Profitabilität",
            "text": f"{name} wird als normales Unternehmen eingeordnet. Wichtig sind Umsatzwachstum, Margen, Cashbestand, Kapitalmaßnahmen und operative Fortschritte.",
            "score": 60,
            "score_label": "wichtig"
        },
        {
            "stage": "Kapitalmarkt",
            "class": "early",
            "name": "Finanzierung und Kursstruktur",
            "text": "Bei Small Caps sind neue Aktien, Warrants, Reverse Splits und Börsen-Compliance oft wichtige Kurstreiber.",
            "score": 65,
            "score_label": "kursrelevant"
        }
    ]

def build_auto_company_catalysts(news: list[dict[str, Any]], filings: list[dict[str, Any]]) -> list[dict[str, str]]:
    items = []

    if any(n.get("trigger_type") == "Finanzierung / Verwässerung" for n in news) or any(str(f.get("form", "")).upper() in ["F-1", "F-3", "S-1", "S-3", "424B", "424B5", "6-K"] for f in filings):
        items.append({
            "tag": "Kapitalmaßnahme",
            "title": "Finanzierung, neue Aktien oder Warrants",
            "text": "Bei Small Caps können Kapitalerhöhungen oder Warrants stark verwässern. Wichtig ist der Preis je Aktie und wie viel neues Kapital wirklich zufließt."
        })

    items.append({
        "tag": "Zahlen",
        "title": "Umsatz, Gewinn und Cashbestand",
        "text": "Bei HAO zählen vor allem Umsatzentwicklung, Margen, Cashbestand und ob das Unternehmen profitabel bzw. finanzierbar bleibt."
    })

    items.append({
        "tag": "Börsenstatus",
        "title": "Nasdaq-Compliance / Reverse-Split-Risiko",
        "text": "Wenn der Kurs zu lange niedrig bleibt, können Nasdaq-Regeln, Reverse Splits oder Compliance-Meldungen wichtig werden."
    })

    items.append({
        "tag": "Geschäft",
        "title": "Partnerschaften und neue Plattformangebote",
        "text": "Partnerschaften oder neue Angebote sind nur dann stark, wenn daraus messbarer Umsatz oder eine bessere Marktposition entsteht."
    })

    return items[:4]

def build_auto_company_scenarios(name: str) -> dict[str, dict[str, str]]:
    return {
        "bear": {
            "title": "Schlechter Fall",
            "text": "Neue Aktien, Warrants, schwache Zahlen oder Nasdaq-/Reverse-Split-Themen drücken den Kurs. Dann kann die Aktie trotz optisch niedrigem Kurs weiter fallen."
        },
        "base": {
            "title": "Normaler Fall",
            "text": "Die Aktie bleibt stark news- und kapitalmarktgetrieben. Ohne klare operative Fortschritte sind schnelle Anstiege oft nur kurzfristig."
        },
        "bull": {
            "title": "Guter Fall",
            "text": "Das Unternehmen zeigt Wachstum, verbessert Profitabilität oder meldet eine glaubwürdige Partnerschaft. Dann kann der Markt die Aktie kurzfristig neu bewerten."
        }
    }

def build_auto_company_risks(news: list[dict[str, Any]], filings: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "title": "Verwässerung durch neue Aktien",
            "text": "Kapitalerhöhungen, Warrants oder ATM-/Offering-Strukturen können bestehende Aktionäre stark verwässern."
        },
        {
            "title": "Small-Cap-Volatilität",
            "text": "Kleine Aktien können stark schwanken. Kurse können auch ohne fundamentale Änderung schnell steigen oder fallen."
        },
        {
            "title": "Geschäftsmodell-Risiko",
            "text": "Entscheidend ist, ob Umsatz und Gewinn nachhaltig wachsen. Reine Ankündigungen reichen langfristig nicht."
        },
        {
            "title": "Nasdaq-/Reverse-Split-Risiko",
            "text": "Bei sehr niedrigen Kursen können Börsenregeln, Reverse Splits oder Compliance-Meldungen wichtig werden."
        }
    ]


def build_auto_etf_focus(data: dict[str, Any], news: list[dict[str, Any]]) -> list[dict[str, Any]]:
    name = data.get("name", data.get("ticker", "ETF"))
    text = " ".join(n.get("title", "") for n in news).lower()

    theme = "breit gestreute globale Aktien"
    if "robot" in text or "automation" in text or "ishares automation" in name.lower():
        theme = "Automation, Robotik und KI-nahe Industrie-/Technologietrends"
    elif "msci world" in name.lower():
        theme = "breit gestreute Industrieländer-Aktien weltweit"

    return [
        {
            "stage": "ETF-Fokus",
            "class": "phase2",
            "name": theme,
            "text": f"{name} ist kein Einzelunternehmen. Wichtig ist hier der Markt- und Sektortrend: {theme}. Kursbewegungen entstehen vor allem durch Gesamtmarkt, Zinserwartungen, Tech-/Industrie-Sentiment und Währungseffekte.",
            "score": 65,
            "score_label": "wichtig"
        },
        {
            "stage": "Marktlogik",
            "class": "early",
            "name": "Kein Pipeline-Risiko",
            "text": "Bei ETFs gibt es keine einzelne Studie oder FDA-Entscheidung. Das Risiko verteilt sich breiter, dafür hängt der Wert stärker an Marktphasen und den größten Positionen im Fonds.",
            "score": 48,
            "score_label": "Grundlage"
        }
    ]

def build_auto_etf_scenarios(name: str) -> dict[str, dict[str, str]]:
    return {
        "bear": {
            "title": "Schlechter Fall",
            "text": "Schwacher Gesamtmarkt, steigende Zinsen oder Druck auf Technologie-/Wachstumswerte können den ETF belasten."
        },
        "base": {
            "title": "Normaler Fall",
            "text": "Der ETF bewegt sich hauptsächlich mit dem breiten Markt oder seinem Sektor. Einzelne News sind meist weniger wichtig als der allgemeine Trend."
        },
        "bull": {
            "title": "Guter Fall",
            "text": "Starker Gesamtmarkt, sinkende Zinsen oder positiver Sektortrend können den ETF nach oben treiben."
        }
    }


def build_auto_pipeline(data, news, trials):
    ticker = data.get("ticker", "")
    name = data.get("name", ticker)
    programs = find_program_names(news, trials)
    theme = summarize_news_theme(news, trials, ticker)
    cards = []

    for i, prog in enumerate(programs[:3]):
        score = 76 if i == 0 else 62 if i == 1 else 48
        cards.append({
            "stage": "Programm / Wirkstoffkandidat",
            "class": "phase3" if score >= 70 else "phase2",
            "name": prog,
            "text": f"{prog} taucht in aktuellen Meldungen oder Studienhinweisen auf. Das kann für die Aktie wichtig sein. Entscheidend ist, ob echte Studiendaten, Behörden-Schritte oder Finanzierungsmeldungen folgen.",
            "score": score,
            "score_label": "sehr wichtig" if score >= 70 else "wichtig"
        })

    if trials:
        first = trials[0]
        cards.append({
            "stage": first.get("phase") or "Studienregister",
            "class": "phase2",
            "name": "Studienregister-Treffer",
            "text": f"Zu {name} wurden Treffer im Studienregister gefunden. Das ist wichtig, weil Studienstatus, Patientengruppe und Updates zeigen können, ob ein Programm vorankommt.",
            "score": 58,
            "score_label": "prüfen"
        })

    cards.append({
        "stage": "Geschäft / Forschungsschwerpunkt",
        "class": "early",
        "name": theme,
        "text": f"{name} wird anhand der gefundenen Daten als Unternehmen im Bereich {theme} eingeordnet. Für die Aktie zählt, ob aus Forschung echte klinische Fortschritte und ausreichend Finanzierung entstehen.",
        "score": 45,
        "score_label": "Grundlage"
    })
    return cards[:4]

def build_auto_zones(price):
    val = price.get("regularMarketPrice")
    if isinstance(val, (int, float)) and val > 0:
        low = round(val * 0.82, 2)
        pull = round(val * 0.9, 2)
        work_low = round(val * 0.95, 2)
        work_high = round(val * 1.08, 2)
        high = round(val * 1.18, 2)
        return [
            {"zone": f"Rücksetzer: ca. ${low}–${pull}", "text": "Interessanter nur dann, wenn keine schlechte Unternehmensmeldung dahintersteht. Bei kleinen Biotech-Werten können Rücksetzer auch Warnsignale sein."},
            {"zone": f"Arbeitsbereich: ca. ${work_low}–${work_high}", "text": "Hier beobachtet man eher, ob neue gute Nachrichten kommen. Kein Bereich für blinden Einstieg, sondern für ruhige Prüfung."},
            {"zone": f"Momentum: über ca. ${high}", "text": "Wenn der Kurs stark steigt, kann kurzfristig Fantasie entstehen. Gleichzeitig steigt das Risiko, zu spät hinterherzulaufen."},
            {"zone": "Warnbereich", "text": "Bei Kapitalerhöhungen, Reverse Split, schwachen Studiendaten oder fehlendem Cash vorsichtig bleiben – auch wenn der Kurs optisch billig wirkt."}
        ]
    return [
        {"zone": "Rücksetzer", "text": "Interessant nur, wenn keine schlechte Unternehmensmeldung dahintersteht."},
        {"zone": "Beobachten", "text": "Erst News, Finanzierung und Studienstand prüfen."},
        {"zone": "Momentum", "text": "Nach starken Anstiegen steigt das Rückschlagrisiko."},
        {"zone": "Warnbereich", "text": "Bei Verwässerung, schwachen Daten oder knapper Finanzierung vorsichtig bleiben."}
    ]

def build_auto_catalysts(news, filings, trials):
    out = []
    if any(n.get("trigger_type") == "Studienphase / Readout" for n in news) or trials:
        out.append({"tag": "Studien", "title": "Neue Studienergebnisse oder Studienstart", "text": "Bei Biotech-Aktien sind Studienmeldungen oft der wichtigste Kurstreiber. Wichtig ist: Sind es echte Daten oder nur eine Ankündigung?"})
    if any(n.get("trigger_type") == "FDA / Regulatorik" for n in news):
        out.append({"tag": "Behörde", "title": "FDA-/Zulassungs- oder Behördenmeldung", "text": "Solche Meldungen können stark bewegen. Entscheidend ist, ob die Behörde wirklich etwas bestätigt oder ob nur ein Plan kommuniziert wurde."})
    if any(n.get("trigger_type") == "Finanzierung / Verwässerung" for n in news) or any(str(f.get("form","")).upper() in ["S-1","F-3","S-3","424B5","424B"] for f in filings):
        out.append({"tag": "Geld / neue Aktien", "title": "Finanzierung oder mögliche Verwässerung", "text": "Wenn das Unternehmen neue Aktien ausgibt, kann das den Kurs drücken. Gleichzeitig braucht ein kleines Biotech-Unternehmen oft frisches Geld."})
    out.append({"tag": "Regelmäßig prüfen", "title": "Quartalszahlen, Cashbestand und Unternehmensupdates", "text": "Bei frühen Biotech-Werten ist wichtig, wie lange das Geld reicht und ob das Unternehmen seine nächsten Schritte finanzieren kann."})
    return out[:4]

def build_auto_scenarios(name):
    return {
        "bear": {"title": "Schlechter Fall", "text": "Das Unternehmen braucht Geld, gibt neue Aktien aus, Studien verzögern sich oder Daten enttäuschen. Dann kann der Kurs deutlich fallen."},
        "base": {"title": "Normaler Fall", "text": "Die Aktie bleibt stark von Nachrichten abhängig. Gute Meldungen können schnelle Anstiege bringen, aber ohne harte Fortschritte werden Anstiege oft wieder verkauft."},
        "bull": {"title": "Guter Fall", "text": "Studien, Behördenmeldungen oder Partnerschaften fallen positiv aus. Dann kann die Aktie stark steigen, besonders wenn vorher wenig Vertrauen eingepreist war."}
    }

def build_auto_risks(news, filings):
    risks = [
        {"title": "Biotech-Risiko", "text": "Der Kurs hängt stark davon ab, ob Forschung und Studien wirklich funktionieren. Ein negatives Ergebnis kann schnell viel Wert zerstören."},
        {"title": "Finanzierungsrisiko", "text": "Viele kleine Biotech-Unternehmen verdienen noch kaum Geld und müssen sich über neue Aktien oder Investoren finanzieren."},
        {"title": "Starke Kursschwankungen", "text": "Solche Aktien können an einem Tag stark steigen und kurz danach wieder deutlich fallen."}
    ]
    if any(n.get("trigger_type") == "Finanzierung / Verwässerung" for n in news) or any(str(f.get("form","")).upper() in ["S-1","F-3","S-3","424B","424B5"] for f in filings):
        risks.insert(0, {"title": "Neue Aktien / Verwässerung", "text": "Es gibt Hinweise auf Finanzierungsthemen. Das kann bedeuten, dass bestehende Aktionäre durch neue Aktien verwässert werden."})
    if any(n.get("trigger_type") == "FDA / Regulatorik" for n in news):
        risks.append({"title": "Behördenrisiko", "text": "Wenn FDA oder andere Behörden anders entscheiden als erwartet, kann das den Kurs stark beeinflussen."})
    return risks[:6]

def build_auto_clear_view(data, news):
    name = data.get("name", data.get("ticker", "Diese Aktie"))
    ticker = data.get("ticker", "")
    hard = [n for n in news if n.get("trigger_level") == "high"]
    p1 = f"{name} ({ticker}) ist ein spekulativer Wert. Das System hat Kursdaten, Nachrichten, offizielle SEC-Meldungen und Studienregister-Treffer geprüft. Wichtig ist nicht nur, ob die Aktie billig aussieht, sondern ob es echte Fortschritte bei Studien, Finanzierung oder Behördenmeldungen gibt."
    p2 = "Es wurden wichtige Hinweise gefunden, die man genauer lesen sollte. Besonders relevant sind Meldungen zu Studien, Behörden, Finanzierung oder möglichen neuen Aktien." if hard else "Aktuell wurden eher allgemeine Meldungen oder noch keine harten Auslöser erkannt. Ohne starke neue Nachrichten bleibt die Aktie wahrscheinlich stark spekulativ und schwankungsanfällig."
    p3 = "Keine Kaufempfehlung. Sinnvoll ist eine ruhige Prüfung: Was macht das Unternehmen, wie lange reicht das Geld, gibt es echte Studienfortschritte und ist der Kurs gerade überhitzt oder nach einem Rücksetzer interessanter?"
    return [p1, p2, p3]


def should_autofill(data):
    pipeline = data.get("pipeline") or []
    zones = data.get("zones") or []
    catalysts = data.get("catalysts") or []
    risks = data.get("risks") or []
    clear = " ".join(data.get("clear_view") or [])
    headline = data.get("headline", "")
    thesis = data.get("thesis", "")
    events_text = " ".join((e.get("title","") + " " + e.get("details","")) for e in (data.get("events") or []))
    placeholder_blob = " ".join([headline, thesis, clear, events_text, data.get("pipeline_intro","")])
    return (
        not pipeline
        or not zones
        or not catalysts
        or not risks
        or not clear.strip()
        or is_placeholder_text(placeholder_blob)
        or "nach dem nächsten update" in placeholder_blob.lower()
        or "wird nach" in placeholder_blob.lower()
        or "dossier angelegt" in placeholder_blob.lower()
        or any(is_placeholder_text((p.get("name","") + " " + p.get("text",""))) for p in pipeline)
    )


def autofill_dossier(data, news, filings, trials, price):
    if not should_autofill(data):
        return
    ticker = data.get("ticker", "")
    name = data.get("name", ticker)
    data["headline"] = f"{name} – einfache Phasenanalyse"
    data["thesis"] = f"Kurzthese: {name} wird automatisch beobachtet. Das Dossier fasst zusammen, was das Unternehmen macht, welche Nachrichten wichtig sein könnten, welche Risiken bestehen und welche Kursbereiche nur als Orientierung dienen. Keine Kaufempfehlung."
    data["phase"] = "Automatische Grundanalyse"
    data["character"] = "spekulativ · stark nachrichtenabhängig"
    data["chart_subtitle"] = "Diese Zeitlinie ordnet Nachrichten, Kursbewegungen und wichtige Termine chronologisch ein – von links nach rechts."
    data["chart_note"] = "Hinweis: Die Linie ist eine einfache Orientierung. Entscheidend sind die Nachrichtenpunkte und ihre Einordnung."
    data["pipeline_intro"] = "Hier wird einfach erklärt, woran das Unternehmen arbeitet und welche Themen den Kurs bewegen können."
    if is_etf_config(data):
        data["pipeline"] = build_auto_etf_focus(data, news)
    elif not is_biotech_config(data):
        data["pipeline"] = build_auto_company_focus(data, news)
    else:
        data["pipeline"] = build_auto_pipeline(data, news, trials)
    data["zones"] = build_auto_zones(price)
    if is_etf_config(data):
        data["catalysts"] = build_auto_catalysts(news, filings, trials)
    elif not is_biotech_config(data):
        data["catalysts"] = build_auto_company_catalysts(news, filings)
    else:
        data["catalysts"] = build_auto_catalysts(news, filings, trials)
    if is_etf_config(data):
        data["scenarios"] = build_auto_etf_scenarios(name)
    elif not is_biotech_config(data):
        data["scenarios"] = build_auto_company_scenarios(name)
    else:
        data["scenarios"] = build_auto_scenarios(name)
    if is_etf_config(data):
        data["risks"] = build_auto_risks(news, filings)
    elif not is_biotech_config(data):
        data["risks"] = build_auto_company_risks(news, filings)
    else:
        data["risks"] = build_auto_risks(news, filings)
    data["clear_view"] = build_auto_clear_view(data, news)
    existing_events = data.get("events") or []
    if not existing_events or any(is_placeholder_text(e.get("title","")) for e in existing_events):
        events = []
        for n in news[:8]:
            events.append({
                "d": n.get("published_at") or "News",
                "p": price.get("regularMarketPrice") or 1.0,
                "title": n.get("title", "News"),
                "phase": n.get("trigger_type", "Nachricht"),
                "reaction": n.get("impact", "Kursrelevanz prüfen"),
                "details": n.get("assessment", "Diese Meldung sollte geprüft werden."),
                "watch": n.get("watch", "Quelle lesen und Zusammenhang prüfen."),
                "impact": n.get("impact", "unklar"),
                "source": n.get("source", "News"),
                "url": n.get("url", "#"),
                "future": False
            })
        for f in filings[:3]:
            events.append({
                "d": f.get("filingDate") or "SEC",
                "p": price.get("regularMarketPrice") or 1.0,
                "title": f"{f.get('form','SEC Filing')} · offizielle Meldung",
                "phase": "Offizielle Unternehmensmeldung",
                "reaction": "SEC-Meldung gefunden. Auf Finanzierung, neue Aktien, Quartalszahlen oder Unternehmensereignisse prüfen.",
                "details": f.get("description", "Offizielle SEC-Meldung."),
                "source": "SEC EDGAR",
                "url": f.get("url", "#"),
                "future": False
            })
        data["events"] = events[:12] if events else [{
            "d": "Start", "p": price.get("regularMarketPrice") or 1.0, "title": "Automatische Grundanalyse angelegt",
            "phase": "Start", "reaction": "Es wurden noch keine starken Nachrichten gefunden.",
            "details": "Das System beobachtet die Aktie weiter automatisch.", "source": "Son of Lorenc", "url": "#", "future": False
        }]



def build_price_history(data: dict[str, Any], price: dict[str, Any], yahoo_history: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Smart-Chart: bevorzugt echter 1-Monats-Tageskursverlauf.
    Fallback: gespeicherte Snapshots aus bisherigen Updates.
    """
    if yahoo_history and len(yahoo_history) >= 2:
        return yahoo_history[-40:]

    history = []
    try:
        history = list((data.get("latest_auto") or {}).get("price_history") or [])
    except Exception:
        history = []

    current = price.get("regularMarketPrice") or price.get("price") or price.get("currentPrice")
    try:
        current = float(current)
    except Exception:
        current = None

    if current and current > 0:
        stamp = now_iso()
        if not history or history[-1].get("price") != current:
            history.append({"t": stamp, "price": current})

    return history[-80:]


def update():
    watchlist = read_json(CONFIG)
    mp = sec_ticker_map()
    updated_watchlist = []

    for item in watchlist:
        ticker = item["ticker"]
        path = DATA / f"{ticker}.json"
        if not path.exists():
            print(f"[WARN] {path} fehlt, überspringe.")
            continue

        data = read_json(path)
        print(f"[INFO] Updating {ticker}...")

        price = yahoo_price(ticker)
        time.sleep(0.7)

        yahoo_history = yahoo_price_history(ticker, range_="1mo", interval="1d")
        time.sleep(0.7)

        news = fetch_all_news(item)
        time.sleep(0.7)

        filings = sec_filings(item.get("sec_query", ticker), mp)
        time.sleep(0.7)

        trials = clinical_trials(item.get("clinical_query", ""), limit=15)
        time.sleep(0.7)

        triggers = detected_triggers(news, filings, trials)

        price_history = build_price_history(data, price, yahoo_history)

        data["latest_auto"] = {
            "last_update_utc": now_iso(),
            "price": price,
            "price_history": price_history,
            "price_history_range": "1mo",
            "news": news,
            "sec_filings": filings,
            "clinical_trials": trials,
            "detected_triggers": triggers,
            "queries_used": item.get("queries") or [item.get("query", ticker)],
            "source_note": "Free engine: Google News RSS, SEC EDGAR, ClinicalTrials.gov and optional custom RSS URLs."
        }

        autofill_dossier(data, news, filings, trials, price)
        update_metrics(data, price)
        write_json(path, data)

        updated_watchlist.append({
            "ticker": ticker,
            "name": item.get("name", ticker),
            "exchange": item.get("exchange", ""),
            "theme": item.get("theme", ""),
        })

    write_json(DATA / "watchlist.json", updated_watchlist)
    write_json(DATA / "meta.json", {
        "app": "Son of Lorenc",
        "version": "master-v3.7-company-type-fix",
        "last_update_utc": now_iso(),
        "status": "updated",
        "source_note": "Google News RSS + SEC EDGAR + ClinicalTrials.gov + optional custom RSS URLs"
    })
    print("[OK] Update complete")

if __name__ == "__main__":
    update()
