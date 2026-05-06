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

    raw = []
    for q in queries:
        print(f"  [NEWS] {q}")
        raw.extend(google_news(q, limit=20))
        time.sleep(0.4)

    for url in rss_urls:
        print(f"  [RSS] {url}")
        raw.extend(rss_feed(url, limit=20))
        time.sleep(0.4)

    seen, deduped = set(), []
    for n in raw:
        key = normalize_title(n.get("title", ""))
        if not key or key in seen:
            continue
        seen.add(key)
        trigger = classify_text(n.get("title", ""))
        n["trigger_type"] = trigger["type"]
        n["trigger_level"] = trigger["level"]
        n["trigger_reason"] = trigger["reason"]
        n["impact"] = trigger.get("impact", "unklare Kursrelevanz")
        n["assessment"] = trigger.get("assessment", "Diese Meldung sollte inhaltlich geprüft werden.")
        n["watch"] = trigger.get("watch", "Quelle und Inhalt prüfen.")
        n["summary"] = f"{trigger['reason']} Einordnung: {trigger.get('assessment','Bitte prüfen')} Beobachten: {trigger.get('watch','Quelle prüfen')}"
        deduped.append(n)

    deduped.sort(key=lambda x: x.get("published_at") or "", reverse=True)
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

        news = fetch_all_news(item)
        time.sleep(0.7)

        filings = sec_filings(item.get("sec_query", ticker), mp)
        time.sleep(0.7)

        trials = clinical_trials(item.get("clinical_query", ""), limit=15)
        time.sleep(0.7)

        triggers = detected_triggers(news, filings, trials)

        data["latest_auto"] = {
            "last_update_utc": now_iso(),
            "price": price,
            "news": news,
            "sec_filings": filings,
            "clinical_trials": trials,
            "detected_triggers": triggers,
            "queries_used": item.get("queries") or [item.get("query", ticker)],
            "source_note": "Free engine: Google News RSS, SEC EDGAR, ClinicalTrials.gov and optional custom RSS URLs."
        }

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
        "version": "master-v1.3-news-engine",
        "last_update_utc": now_iso(),
        "status": "updated",
        "source_note": "Google News RSS + SEC EDGAR + ClinicalTrials.gov + optional custom RSS URLs"
    })
    print("[OK] Update complete")

if __name__ == "__main__":
    update()
