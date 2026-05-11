#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TICKERS = {"HAO"}

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def main():
    changed = 0
    for ticker in TICKERS:
        path = DATA / f"{ticker}.json"
        if not path.exists():
            continue
        data = read(path)
        data["pipeline"] = []
        data["zones"] = []
        data["catalysts"] = []
        data["risks"] = []
        data["clear_view"] = []
        data["events"] = []
        data["pipeline_intro"] = "Bei HAO geht es nicht um Studien. Es geht um Geschäftsmodell, Finanzierung, Verwässerung, Nasdaq-Compliance und operative Entwicklung."
        write(path, data)
        changed += 1
    print(f"[OK] {changed} Company-Dossier(s) zurückgesetzt.")

if __name__ == "__main__":
    main()
