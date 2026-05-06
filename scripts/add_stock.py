#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "watchlist.json"
DATA = ROOT / "data"

def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def clean_ticker(ticker: str) -> str:
    ticker = ticker.strip().upper()
    if not re.match(r"^[A-Z0-9.\-]{1,15}$", ticker):
        raise SystemExit("Ticker darf nur A-Z, 0-9, Punkt oder Bindestrich enthalten.")
    return ticker

def template_stock(ticker, name, exchange, theme, query, sec_query):
    return {
        "ticker": ticker,
        "exchange": exchange,
        "name": name,
        "eyebrow": f"Son of Lorenc · Phasenanalyse · {ticker}",
        "headline": f"{name} – Phasenanalyse im Aufbau",
        "thesis": f"Kurzthese: {ticker} wurde neu in das Son-of-Lorenc-System aufgenommen. Der Dossier-Aufbau ist vorbereitet; aktuelle News, Kursdaten und SEC-Filings werden über das Update-Skript geladen.",
        "stand": now_iso()[:10],
        "phase": "A/B · Beobachtung / Story-Aufbau",
        "character": "Research-Wert · Risiko prüfen",
        "metrics": [
            {"label": "Aktueller Kurs", "value": "wird aktualisiert", "note": "aus automatischem Datenabruf", "key": "price"},
            {"label": "52W-Spanne", "value": "offen", "note": "manuell/automatisch ergänzen", "key": "range52"},
            {"label": "Cash & Wertpapiere", "value": "offen", "note": "letzten Bericht prüfen", "key": "cash"},
            {"label": "Cash Runway", "value": "offen", "note": "Finanzierungsreichweite prüfen", "key": "runway"},
            {"label": "Umsatz", "value": "offen", "note": "je nach Entwicklungsphase relevant", "key": "revenue"},
            {"label": "Risikoklasse", "value": "offen", "note": "muss eingeordnet werden", "key": "risk"}
        ],
        "chart_subtitle": "Schematische Einordnung der wichtigsten Kurs- und Nachrichtenpunkte. Dieses Diagramm wird aus hinterlegten Ereignissen plus erwarteten Katalysatoren gezeichnet.",
        "chart_note": "Hinweis: Das Diagramm ist kein exakter Börsenchart, sondern ein Analyse-Overlay zur News-/Katalysatorlogik.",
        "events": [
            {"d": "Start", "p": 1.0, "title": "Dossier angelegt", "phase": "Phase A – Aufbau", "reaction": "Der Wert wurde in die Watchlist aufgenommen.", "details": "Die tiefe Analyse kann nach Recherche ergänzt werden.", "source": "Son of Lorenc", "future": False},
            {"d": "News", "p": 1.2, "title": "Automatische News folgen", "phase": "Phase B – Monitoring", "reaction": "Google-News-/SEC-Daten werden über das Skript geladen.", "details": "Kursrelevanz muss geprüft werden.", "source": "Automatisches Monitoring", "future": False},
            {"d": "Katalysator", "p": 1.35, "title": "Nächsten harten Trigger definieren", "phase": "Nächster Katalysator", "reaction": "Hier sollte der wichtigste Termin eingetragen werden.", "details": "Zum Beispiel Studienreadout, Quartalszahlen, FDA/EMA, Finanzierung oder Partnerschaft.", "source": "manuelle Analyse", "future": True}
        ],
        "pipeline_intro": "Pipeline / Geschäftsmodell wird nach tiefer Recherche ergänzt.",
        "pipeline": [
            {"stage": "Lead Asset / Haupttreiber", "class": "phase3", "name": "Hauptprogramm", "text": "Hier das wichtigste Programm oder Geschäftsmodell eintragen.", "score": 70, "score_label": "hoch"},
            {"stage": "Zweitprogramm / Option", "class": "phase2", "name": "Zweitprogramm", "text": "Zusätzlicher Werttreiber oder zweiter Katalysator.", "score": 50, "score_label": "mittel"},
            {"stage": "Early Stage", "class": "early", "name": "Frühe Pipeline", "text": "Langfristiger Optionswert.", "score": 30, "score_label": "langfristig"}
        ],
        "zones": [
            {"zone": "Pullback", "text": "Interessanter Bereich, wenn keine negative Unternehmensnews dahintersteht."},
            {"zone": "Arbeitszone", "text": "Neutrale Zone für Beobachtung und Tranchendenken."},
            {"zone": "Momentum", "text": "Hier steigt das Rückschlagrisiko, wenn keine harte News folgt."},
            {"zone": "Warnzone", "text": "Prüfen, ob Cash, Daten oder Verwässerung negativ sind."}
        ],
        "catalysts": [
            {"tag": "Kurzfristig", "title": "Nächste News / Quartalszahlen", "text": "Termin oder Katalysator ergänzen."},
            {"tag": "Mittelfristig", "title": "Pipeline-/Projektupdate", "text": "Relevanten operativen Meilenstein ergänzen."},
            {"tag": "Risiko", "title": "Cash / Verwässerung prüfen", "text": "Finanzierungslage und mögliche Kapitalmaßnahmen beobachten."}
        ],
        "scenarios": {
            "bear": {"title": "Bear Case", "text": "Negative Daten, Kapitalmaßnahme oder schwacher Markt können den Kurs drücken."},
            "base": {"title": "Base Case", "text": "Ohne neue harte Katalysatoren bleibt der Wert wahrscheinlich news- und stimmungsgetrieben."},
            "bull": {"title": "Bull Case", "text": "Positive Daten, Finanzierungssicherheit oder Partnerschaften können eine Neubewertung auslösen."}
        },
        "risks": [
            {"title": "Studiendaten-/Projekt-Risiko", "text": "Operative Fortschritte müssen bestätigt werden."},
            {"title": "Verwässerungsrisiko", "text": "Kapitalmaßnahmen können Bestandsaktionäre verwässern."},
            {"title": "Volatilität", "text": "Kleine und mittlere Werte reagieren stark auf News."},
            {"title": "Hype-Risiko", "text": "Schnelle Peaks werden oft wieder abverkauft."}
        ],
        "clear_view": [
            "Diese Analyse ist als Dossier-Vorlage vorbereitet. Für eine echte Einordnung müssen aktuelle News, Cash, Katalysatoren und Kurszonen ergänzt werden.",
            "Keine Kaufempfehlung. Das Ziel ist eine klare Chancen-Risiko-Struktur statt impulsivem Einstieg."
        ],
        "sources": ["Son of Lorenc Mastertemplate", "Automatische Quellen werden nach Update ergänzt."],
        "latest_auto": {"last_update_utc": now_iso(), "price": None, "news": [], "sec_filings": []}
    }

def main():
    parser = argparse.ArgumentParser(description="Neue Aktie lokal zu Son of Lorenc hinzufügen")
    parser.add_argument("ticker")
    parser.add_argument("name")
    parser.add_argument("--exchange", default="NASDAQ")
    parser.add_argument("--theme", default="Research")
    parser.add_argument("--query", default="")
    parser.add_argument("--sec-query", default="")
    args = parser.parse_args()

    ticker = clean_ticker(args.ticker)
    name = args.name.strip()
    query = args.query.strip() or f"{name} {ticker} stock news"
    sec_query = (args.sec_query.strip() or ticker).upper()

    watchlist = read_json(CONFIG)
    if any(x["ticker"].upper() == ticker for x in watchlist):
        raise SystemExit(f"{ticker} ist bereits in config/watchlist.json vorhanden.")

    watchlist.append({
        "ticker": ticker,
        "name": name,
        "exchange": args.exchange,
        "theme": args.theme,
        "query": query,
        "sec_query": sec_query,
        "queries": [query, f"{name} {ticker} stock news", f"{ticker} stock news"],
        "clinical_query": f"{name} OR {ticker}",
        "rss_urls": [],
        "max_news": 30
    })
    write_json(CONFIG, watchlist)

    stock_path = DATA / f"{ticker}.json"
    if stock_path.exists():
        raise SystemExit(f"{stock_path} existiert bereits.")

    write_json(stock_path, template_stock(ticker, name, args.exchange, args.theme, query, sec_query))

    # data/watchlist.json für lokale Ansicht sofort ergänzen
    display_path = DATA / "watchlist.json"
    display = read_json(display_path) if display_path.exists() else []
    display.append({"ticker": ticker, "name": name, "exchange": args.exchange, "theme": args.theme})
    write_json(display_path, display)

    print(f"[OK] {ticker} wurde lokal hinzugefügt.")
    print("Jetzt ausführen:")
    print("python3 scripts/update_data.py")
    print("Dann Browser neu laden.")

if __name__ == "__main__":
    main()
