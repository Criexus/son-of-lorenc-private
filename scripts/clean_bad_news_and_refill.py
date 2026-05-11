#!/usr/bin/env python3
"""
Setzt Platzhalter in allen Daten zurück, damit update_data.py beim nächsten Lauf
Auto-Dossier neu und sauber aufbaut. Entfernt keine Watchlist-Einträge.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def main():
    changed = 0
    for path in DATA.glob("*.json"):
        if path.name in {"watchlist.json", "meta.json"}:
            continue
        data = read(path)
        # Platzhalter/alte Events entfernen, damit Auto-Dossier frisch befüllt.
        data["pipeline"] = []
        data["zones"] = []
        data["catalysts"] = []
        data["risks"] = []
        data["clear_view"] = []
        data["events"] = []
        write(path, data)
        changed += 1
    print(f"[OK] {changed} Dossiers für Neuaufbau vorbereitet.")

if __name__ == "__main__":
    main()
