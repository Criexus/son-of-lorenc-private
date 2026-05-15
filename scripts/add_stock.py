#!/usr/bin/env python3
"""
Son of Lorenc – Aktie/ETF auto-hinzufügen
Nutzung: python3 scripts/add_stock.py TICKER
         python3 scripts/add_stock.py AAPL
         python3 scripts/add_stock.py 2B76.DE
Holt automatisch: Name, Börse, Typ, Sektor, Industrie
und generiert alle Suchbegriffe intelligent.
"""
from __future__ import annotations
import json, sys, time, urllib.parse, re
from pathlib import Path
from typing import Any
import requests

ROOT   = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "watchlist.json"
DATA   = ROOT / "data"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 SonOfLorencDashboard/1.3",
    "Accept": "application/json",
})


# ── Yahoo Finance Abruf ───────────────────────────────────
def fetch_yahoo_info(ticker: str) -> dict[str, Any]:
    """Holt Unternehmensinfos von Yahoo Finance."""
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.parse.quote(ticker)
        + "?range=1d&interval=1d"
    )
    try:
        r = SESSION.get(url, timeout=20)
        if not r.ok:
            # Fallback: query2
            url2 = url.replace("query1", "query2")
            r = SESSION.get(url2, timeout=20)
        if not r.ok:
            return {}
        meta = r.json()["chart"]["result"][0]["meta"]
        return meta
    except Exception as e:
        print(f"[WARN] Yahoo Finance fetch failed: {e}")
        return {}


def detect_type(meta: dict, ticker: str, name: str) -> str:
    """Erkennt den Typ: ETF, Biotech, Pharma, Tech, Finance, oder Allgemein."""
    instrument = str(meta.get("instrumentType", "")).upper()
    name_l      = name.lower()
    ticker_l    = ticker.lower()

    if instrument == "ETF" or any(x in name_l for x in ["etf", "ucits", "index fund", "ishares", "vanguard", "invesco", "xtrackers", "amundi"]):
        return "ETF"
    if any(x in name_l for x in ["bioscience", "biotech", "therapeutics", "pharma", "biopharma", "genomic", "oncology", "clinical", "gene therapy"]):
        return "Biotech / Pharma"
    if any(x in name_l for x in ["semiconductor", "software", "systems", "technologies", "tech", "digital", "cyber", "cloud", "ai", "intelligence"]):
        return "Tech"
    if any(x in name_l for x in ["bank", "financial", "capital", "insurance", "asset", "investment"]):
        return "Finance"
    return "Allgemein"


def detect_exchange(meta: dict, ticker: str) -> str:
    """Erkennt die Börse."""
    ex = meta.get("exchangeName") or meta.get("fullExchangeName") or ""
    # Aus Ticker ableiten falls leer
    if not ex:
        t = ticker.upper()
        if t.endswith(".DE"):  return "XETRA"
        if t.endswith(".PA"):  return "Euronext Paris"
        if t.endswith(".AS"):  return "Euronext Amsterdam"
        if t.endswith(".L"):   return "London Stock Exchange"
        if t.endswith(".TO"):  return "Toronto Stock Exchange"
        if t.endswith(".HK"):  return "Hong Kong Stock Exchange"
        return "NASDAQ"
    # Yahoo-Namen vereinheitlichen
    mapping = {
        "NMS": "NASDAQ", "NGM": "NASDAQ", "NCM": "NASDAQ",
        "NYQ": "NYSE", "ASE": "NYSE American",
        "GER": "XETRA", "FRA": "Frankfurt",
        "PAR": "Euronext Paris", "AMS": "Euronext Amsterdam",
        "LSE": "London Stock Exchange",
    }
    return mapping.get(ex, ex)


# ── Intelligente Query-Generierung ───────────────────────
def build_smart_queries(ticker: str, name: str, stock_type: str, meta: dict) -> dict[str, Any]:
    """
    Generiert alle Suchbegriffe automatisch basierend auf Typ und Name.
    """
    t    = ticker.upper()
    n    = name.strip()
    nl   = n.lower()
    base = f'"{n}" {t}'

    queries      = []
    clinical_q   = None
    aliases      = [n.lower(), t.lower()]

    # ── ETF ──────────────────────────────────────────────
    if stock_type == "ETF":
        short_name = re.sub(r'\s*(UCITS|ETF|USD|EUR|Acc|Dis|Hedged)\s*', ' ', n, flags=re.I).strip()
        queries = [
            f'"{short_name}" ETF',
            f'"{t}" ETF performance',
            f'"{short_name}" index fund',
            f'{t} ETF news',
        ]
        # Keywords aus dem ETF-Namen extrahieren
        words = [w for w in short_name.split() if len(w) > 3 and w.lower() not in
                 ["with","from","the","and","for","etf","fund","ucits","ishares","vanguard"]]
        if words:
            queries.append(" ".join(words[:3]) + " ETF")
        aliases += [w.lower() for w in words[:4]]

    # ── Biotech / Pharma ─────────────────────────────────
    elif stock_type == "Biotech / Pharma":
        queries = [
            f'"{n}" {t} stock news',
            f'"{n}" FDA clinical trial',
            f'{t} stock news',
            f'"{n}" phase 3',
            f'"{n}" phase 2',
        ]
        # Programmnamen aus dem Namen ableiten (z.B. COMP360, EB-003, BPL-003)
        prog_candidates = re.findall(r'\b[A-Z]{2,}-\d{3,}\b|\b[A-Z]{2,}\d{3,}\b', n)
        for p in prog_candidates:
            queries.append(f'"{p}" {t}')
            aliases.append(p.lower())
        # Clinical Query für clinicaltrials.gov
        clinical_terms = [f'"{n}"', t] + [f'"{p}"' for p in prog_candidates[:3]]
        clinical_q = " OR ".join(clinical_terms)
        queries.append(f'"{n}" offering reverse split')
        queries.append(f'"{n}" earnings cash runway')

    # ── Tech ─────────────────────────────────────────────
    elif stock_type == "Tech":
        queries = [
            f'"{n}" {t} stock news',
            f'"{n}" earnings revenue',
            f'{t} stock news',
            f'"{n}" product launch',
            f'"{n}" AI revenue growth',
        ]
        aliases += [n.lower().split()[0]]  # Kurzname

    # ── Finance ──────────────────────────────────────────
    elif stock_type == "Finance":
        queries = [
            f'"{n}" {t} stock news',
            f'"{n}" earnings dividend',
            f'{t} stock news',
        ]

    # ── Allgemein ─────────────────────────────────────────
    else:
        queries = [
            f'"{n}" {t} stock news',
            f'{t} stock news',
            f'"{n}" earnings quarterly',
            f'"{n}" news',
        ]

    return {
        "query":          queries[0],
        "queries":        queries,
        "clinical_query": clinical_q,
        "aliases":        list(dict.fromkeys(aliases)),  # dedupliziert
        "sec_query":      re.sub(r'\.[A-Z]+$', '', t),  # TICKER ohne .DE etc.
        "rss_urls":       [],
        "max_news":       30,
    }


def build_theme(stock_type: str, meta: dict, name: str) -> str:
    """Erstellt ein lesbares Theme-Label."""
    sector   = meta.get("sector",   "")
    industry = meta.get("industry", "")
    if stock_type == "ETF":
        # Schlüsselwörter aus dem Name extrahieren
        words = [w for w in name.split()
                 if w.lower() not in {"etf","ucits","fund","the","of","and","acc","dis","usd","eur"}
                 and len(w) > 2]
        theme = " / ".join(words[:4]) if words else "ETF"
        return theme
    parts = [p for p in [sector, industry] if p]
    if parts:
        return " / ".join(parts)
    return stock_type


# ── Hauptfunktion ─────────────────────────────────────────
def add_stock(ticker: str, name_override: str | None = None) -> None:
    ticker = ticker.strip().upper()
    print(f"\n🔍 Suche Informationen für: {ticker}")

    # Prüfen ob bereits vorhanden
    config_list: list[dict] = json.loads(CONFIG.read_text(encoding="utf-8")) if CONFIG.exists() else []
    if any(x["ticker"] == ticker for x in config_list):
        print(f"⚠️  {ticker} ist bereits in der Watchlist.")
        answer = input("   Trotzdem überschreiben? [j/N]: ").strip().lower()
        if answer != "j":
            print("Abgebrochen.")
            return
        config_list = [x for x in config_list if x["ticker"] != ticker]

    # Yahoo Finance abrufen
    meta   = fetch_yahoo_info(ticker)
    name   = name_override or meta.get("longName") or meta.get("shortName") or ticker
    exchange = detect_exchange(meta, ticker)
    stype  = detect_type(meta, ticker, name)
    theme  = build_theme(stype, meta, name)
    queries = build_smart_queries(ticker, name, stype, meta)

    # Vorschau anzeigen
    print(f"\n{'─'*55}")
    print(f"  Ticker:    {ticker}")
    print(f"  Name:      {name}")
    print(f"  Börse:     {exchange}")
    print(f"  Typ:       {stype}")
    print(f"  Thema:     {theme}")
    print(f"  Suchbegriffe ({len(queries['queries'])}×):")
    for q in queries["queries"]:
        print(f"    · {q}")
    if queries["clinical_query"]:
        print(f"  Clinical:  {queries['clinical_query']}")
    print(f"{'─'*55}")

    answer = input("\n✅ Alles korrekt? [J/n]: ").strip().lower()
    if answer == "n":
        print("Abgebrochen. Starte erneut mit korrektem Ticker.")
        return

    # Eintrag zusammenbauen
    entry: dict[str, Any] = {
        "ticker":   ticker,
        "name":     name,
        "exchange": exchange,
        "theme":    theme,
        **queries,
    }

    # In config/watchlist.json speichern
    config_list.append(entry)
    CONFIG.write_text(json.dumps(config_list, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✅ {ticker} – {name} gespeichert in config/watchlist.json")

    # Leere JSON-Datei anlegen (damit der nächste Update-Lauf sofort läuft)
    data_path = DATA / f"{ticker}.json"
    if not data_path.exists():
        data_path.write_text(json.dumps({
            "ticker":   ticker,
            "exchange": exchange,
            "name":     name,
            "theme":    theme,
            "eyebrow":  f"Son of Lorenc · {ticker}",
            "headline": name,
            "thesis":   f"Wird beim nächsten Update automatisch befüllt.",
            "stand":    "neu hinzugefügt",
            "phase":    "–",
            "character": "spekulativ",
            "metrics":  [],
            "events":   [],
            "pipeline": [],
            "zones":    [],
            "catalysts":[],
            "scenarios": {"bear":{},"base":{},"bull":{}},
            "risks":    [],
            "clear_view":[],
            "sources":  [],
            "latest_auto": {}
        }, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"📄 Leere Datendatei angelegt: data/{ticker}.json")

    print(f"\n🚀 Jetzt ausführen:")
    print(f"   python3 scripts/update_data.py")
    print(f"   git add data/ config/ && git commit -m 'Add {ticker}' && git push\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Nutzung: python3 scripts/add_stock.py TICKER")
        print("Beispiel: python3 scripts/add_stock.py AAPL")
        print("          python3 scripts/add_stock.py 2B76.DE")
        sys.exit(1)
    ticker      = sys.argv[1]
    name_override = sys.argv[2] if len(sys.argv) > 2 else None
    add_stock(ticker, name_override)
