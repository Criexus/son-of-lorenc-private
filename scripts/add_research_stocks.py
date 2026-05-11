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
        "ticker": "GH",
        "name": "Guardant Health",
        "exchange": "NASDAQ",
        "theme": "Onkologie / Liquid Biopsy / Krebsdiagnostik",
        "query": '"Guardant Health" GH Shield Guardant360 Reveal stock news',
        "queries": [
            '"Guardant Health" GH stock news',
            '"Guardant Health" Shield blood test news',
            '"Guardant360" Reveal Guardant Health news'
        ],
        "sec_query": "GH",
        "aliases": ["guardant", "guardant health", "shield", "guardant360", "reveal", "liquid biopsy"],
        "max_news": 30
    },
    {
        "ticker": "MAAT.PA",
        "name": "MaaT Pharma",
        "exchange": "Euronext Paris",
        "theme": "Biotech / Mikrobiom / Onkologie / GvHD",
        "query": '"MaaT Pharma" MAAT.PA MaaT013 Xervyteg MaaT034 stock news',
        "queries": [
            '"MaaT Pharma" stock news',
            '"MaaT013" Xervyteg MaaT Pharma',
            '"MaaT034" MaaT Pharma'
        ],
        "sec_query": "MAAT.PA",
        "aliases": ["maat pharma", "maat013", "xervyteg", "maat034", "gvhd", "microbiome"],
        "max_news": 30
    },
    {
        "ticker": "DFTX",
        "name": "Definium Therapeutics",
        "exchange": "NASDAQ",
        "theme": "Biotech / Neuropsychiatrie / Psychedelic Medicine",
        "query": '"Definium Therapeutics" DFTX DT120 DT402 MM120 stock news',
        "queries": [
            '"Definium Therapeutics" DFTX stock news',
            '"Definium Therapeutics" DT120 topline',
            '"Definium Therapeutics" DT402 MM120'
        ],
        "sec_query": "DFTX",
        "aliases": ["definium", "definium therapeutics", "dt120", "dt402", "mm120", "mindmed"],
        "max_news": 30
    }
]

def read_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def create_stock_template(item):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    ticker = item["ticker"]
    name = item["name"]

    return {
        "ticker": ticker,
        "exchange": item["exchange"],
        "name": name,
        "eyebrow": f"Son of Lorenc · Phasenanalyse · {ticker}",
        "headline": f"{name} – einfache Phasenanalyse",
        "thesis": f"Kurzthese: {name} wurde neu in das Son-of-Lorenc-System aufgenommen. Nach dem nächsten Update werden News, Kursdaten, SEC-/Unternehmensmeldungen und die erste Einschätzung automatisch ergänzt.",
        "stand": now[:10],
        "phase": "Automatische Grundanalyse",
        "character": "spekulativ · stark nachrichtenabhängig",
        "metrics": [
            {"label": "Aktueller Kurs", "value": "wird aktualisiert", "note": "nach nächstem Update", "key": "price"},
            {"label": "52W-Spanne", "value": "offen", "note": "nach nächstem Update", "key": "range52"},
            {"label": "Risikoklasse", "value": "hoch", "note": "Research-Wert", "key": "risk"}
        ],
        "chart_subtitle": "Diese Zeitlinie wird nach dem nächsten Update mit Kurs- und Nachrichtendaten befüllt.",
        "chart_note": "Kein Livechart. Der Kursverlauf wird beim Update gespeichert.",
        "events": [
            {
                "d": "Start",
                "p": 1,
                "title": "Dossier angelegt",
                "phase": "Start",
                "reaction": "Der Wert wurde in die Watchlist aufgenommen.",
                "details": "Nach dem nächsten Update werden News, Kursdaten und Hinweise automatisch ergänzt.",
                "source": "Son of Lorenc",
                "future": False
            }
        ],
        "pipeline_intro": "Wird nach dem nächsten Update automatisch anhand von News, Alias-Begriffen und Studien-/Produktnamen ergänzt.",
        "pipeline": [],
        "zones": [],
        "catalysts": [],
        "scenarios": {
            "bear": {"title": "Schlechter Fall", "text": "Wird nach dem nächsten Update automatisch ergänzt."},
            "base": {"title": "Normaler Fall", "text": "Wird nach dem nächsten Update automatisch ergänzt."},
            "bull": {"title": "Guter Fall", "text": "Wird nach dem nächsten Update automatisch ergänzt."}
        },
        "risks": [],
        "clear_view": [
            "Dieses Dossier wurde neu angelegt. Nach dem nächsten Update werden aktuelle News, Kursverlauf, wichtige Hinweise und eine einfache Ersteinschätzung ergänzt."
        ],
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
            added.append(item["ticker"])
            existing.add(item["ticker"].upper())

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
                "theme": item["theme"]
            })
            display_existing.add(item["ticker"].upper())

        stock_path = DATA / f"{item['ticker']}.json"
        if not stock_path.exists():
            write_json(stock_path, create_stock_template(item))

    write_json(display_path, display)

    print("[OK] Hinzugefügt:", ", ".join(added) if added else "keine, bereits vorhanden")
    print("[OK] data/GH.json, data/MAAT.PA.json und data/DFTX.json geprüft/angelegt")

if __name__ == "__main__":
    main()
