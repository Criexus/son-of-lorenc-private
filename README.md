# Son of Lorenc – Master v3.6 Portfolio + Timeline Overlay

Diese Version setzt die nächsten Punkte um:

## 1. Fehlende Depotwerte

Neu hinzufügbar über:

```bash
python3 scripts/add_missing_portfolio.py
```

Werte:

- HAO · Haoxi Health Technology
- RXRX · Recursion Pharmaceuticals
- 2B76.DE · iShares Automation & Robotics UCITS ETF
- ELFW.DE · MSCI World ETF

## 2. Timeline besser klickbar

- Punkte haben größere unsichtbare Klickflächen
- Klick irgendwo in der Chartnähe springt zum nächsten Punkt
- aktiver Punkt wird stärker markiert
- News-Liste scrollt zum aktiven Punkt

## 3. Chart + News werden besser abgeglichen

- News werden nicht mehr nur künstlich auf Kurslevel gesetzt
- News erhalten den nächstliegenden Kurs aus `price_history`
- Smart-Chart zeigt News-Marker direkt auf dem Kursverlauf
- Farben unterscheiden News-Typen grob:
  - Studie / Daten
  - FDA / Regulatorik
  - Finanzierung / Verwässerung
  - SEC / Unternehmensmeldung
  - allgemeine News

## 4. ETF-Logik

Bei ETFs wird nicht mehr so getan, als gäbe es eine Pipeline.
Stattdessen wird Fondsfokus, Markttrend und Sektorrisiko erklärt.

## Online-Update

Diese Dateien pushen:

- index.html
- assets/app.js
- assets/style.css
- scripts/update_data.py
- scripts/add_missing_portfolio.py
- README.md

Danach:

```bash
python3 scripts/add_missing_portfolio.py
python3 scripts/update_data.py
git add config/watchlist.json data/ scripts/update_data.py scripts/add_missing_portfolio.py assets/app.js assets/style.css index.html README.md
git commit -m "Add portfolio values and improve timeline overlay"
git push
```
