#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "watchlist.json"
DATA = ROOT / "data"

ADDITIONS = [
    {
        "ticker": "HAO",
        "name": "Haoxi Health Technology",
        "exchange": "NASDAQ",
        "theme": "Small Cap / Marketing Technology / China ADR",
        "query": '"Haoxi Health Technology" HAO stock news',
        "queries": [
            '"Haoxi Health Technology" HAO stock news',
            '"Haoxi Health" HAO Nasdaq',
            '"HAO" "Haoxi Health Technology"'
        ],
        "sec_query": "HAO",
        "aliases": ["haoxi health", "haoxi health technology", "haoxi", "hao"],
        "max_news": 25
    },
    {
        "ticker": "RXRX",
        "name": "Recursion Pharmaceuticals",
        "exchange": "NASDAQ",
        "theme": "Biotech / KI Drug Discovery / Pharma-Plattform",
        "query": '"Recursion Pharmaceuticals" RXRX stock news',
        "queries": [
            '"Recursion Pharmaceuticals" RXRX stock news',
            '"Recursion" RXRX Nvidia Exscientia',
            '"Recursion Pharmaceuticals" clinical trial'
        ],
        "sec_query": "RXRX",
        "aliases": ["recursion pharmaceuticals", "recursion", "rxrx", "exscientia"],
        "max_news": 30
    },
    {
        "ticker": "2B76.DE",
        "name": "iShares Automation & Robotics UCITS ETF",
        "exchange": "Xetra",
        "theme": "ETF / Automation / Robotics / KI",
        "type": "ETF",
        "query": '"iShares Automation & Robotics UCITS ETF" 2B76.DE ETF news',
        "queries": [
            '"iShares Automation & Robotics UCITS ETF" news',
            '"2B76.DE" ETF',
            '"Automation & Robotics UCITS ETF" iShares'
        ],
        "sec_query": "",
        "aliases": ["ishares automation", "automation & robotics", "robotics ucits etf", "2b76"],
        "max_news": 20
    },
    {
        "ticker": "ELFW.DE",
        "name": "MSCI World ETF",
        "exchange": "Xetra",
        "theme": "ETF / MSCI World / globale Aktien",
        "type": "ETF",
        "query": '"MSCI World ETF" ELFW.DE ETF news',
        "queries": [
            '"ELFW.DE" MSCI World ETF',
            '"MSCI World ETF" news',
            '"MSCI World" ETF market news'
        ],
        "sec_query": "",
        "aliases": ["msci world", "elfw", "world etf"],
        "max_news": 20
    }
]

def read_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def template(item):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    is_etf = item.get("type") == "ETF"
    ticker = item["ticker"]
    name = item["name"]

    if is_etf:
        thesis = f"{name} wurde als ETF in das Son-of-Lorenc-System aufgenommen. Nach dem nächsten Update werden Kursverlauf, Marktumfeld und passende ETF-/Sektor-News ergänzt."
        character = "ETF · markt- und sektorabhängig"
        phase = "ETF-Überblick"
        pipeline_intro = "Bei ETFs geht es nicht um eine Pipeline, sondern um Fondsfokus, Markttrend, Sektor und die wichtigsten Einflussfaktoren."
        clear = ["ETF neu angelegt. Nach dem nächsten Update werden Kursverlauf, Marktumfeld, Sektor-News und eine einfache Einordnung ergänzt."]
    else:
        thesis = f"{name} wurde neu in das Son-of-Lorenc-System aufgenommen. Nach dem nächsten Update werden News, Kursdaten, Unternehmensmeldungen und erste Einschätzung automatisch ergänzt."
        character = "spekulativ · stark nachrichtenabhängig"
        phase = "Automatische Grundanalyse"
        pipeline_intro = "Wird nach dem nächsten Update anhand von News, Alias-Begriffen und Unternehmensdaten ergänzt."
        clear = ["Dieses Dossier wurde neu angelegt. Nach dem nächsten Update werden aktuelle News, Kursverlauf, wichtige Hinweise und eine einfache Ersteinschätzung ergänzt."]

    return {
        "ticker": ticker,
        "exchange": item["exchange"],
        "name": name,
        "eyebrow": f"Son of Lorenc · {'ETF-Analyse' if is_etf else 'Phasenanalyse'} · {ticker}",
        "headline": f"{name} – {'ETF-Überblick' if is_etf else 'einfache Phasenanalyse'}",
        "thesis": thesis,
        "stand": now[:10],
        "phase": phase,
        "character": character,
        "metrics": [
            {"label": "Aktueller Kurs", "value": "wird aktualisiert", "note": "nach nächstem Update", "key": "price"},
            {"label": "52W-Spanne", "value": "offen", "note": "nach nächstem Update", "key": "range52"},
            {"label": "Risikoklasse", "value": "mittel" if is_etf else "hoch", "note": "keine Kaufempfehlung", "key": "risk"}
        ],
        "chart_subtitle": "Diese Zeitlinie wird nach dem nächsten Update mit Kurs- und Nachrichtendaten befüllt.",
        "chart_note": "Kein Livechart. Der Kursverlauf wird beim Update gespeichert.",
        "events": [],
        "pipeline_intro": pipeline_intro,
        "pipeline": [],
        "zones": [],
        "catalysts": [],
        "scenarios": {
            "bear": {"title": "Schlechter Fall", "text": "Wird nach dem nächsten Update automatisch ergänzt."},
            "base": {"title": "Normaler Fall", "text": "Wird nach dem nächsten Update automatisch ergänzt."},
            "bull": {"title": "Guter Fall", "text": "Wird nach dem nächsten Update automatisch ergänzt."}
        },
        "risks": [],
        "clear_view": clear,
        "sources": ["Son of Lorenc"],
        "latest_auto": {
            "last_update_utc": now,
            "price": None,
            "price_history": [],
            "news": [],
            "sec_filings": [],
            "clinical_trials": [],
            "detected_triggers": []
        }
    }

def main():
    DATA.mkdir(exist_ok=True)
    watchlist = read_json(CONFIG, [])
    existing = {str(x.get("ticker", "")).upper() for x in watchlist}
    added = []

    for item in ADDITIONS:
        if item["ticker"].upper() not in existing:
            watchlist.append(item)
            existing.add(item["ticker"].upper())
            added.append(item["ticker"])

    write_json(CONFIG, watchlist)

    display_path = DATA / "watchlist.json"
    display = read_json(display_path, [])
    display_existing = {str(x.get("ticker", "")).upper() for x in display}

    for item in ADDITIONS:
        if item["ticker"].upper() not in display_existing:
            display.append({
                "ticker": item["ticker"],
                "name": item["name"],
                "exchange": item["exchange"],
                "theme": item["theme"],
                "type": item.get("type", "Aktie")
            })
            display_existing.add(item["ticker"].upper())

        stock_path = DATA / f"{item['ticker']}.json"
        if not stock_path.exists():
            write_json(stock_path, template(item))

    write_json(display_path, display)
    print("[OK] Hinzugefügt:", ", ".join(added) if added else "keine, bereits vorhanden")

if __name__ == "__main__":
    main()
