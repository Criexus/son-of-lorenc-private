# Son of Lorenc – Master v3.5 Proper News + Auto-Dossier

Diese Version repariert zwei Hauptprobleme:

## 1. Fremde News werden stärker entfernt

Beispiele, die jetzt rausfliegen sollten:

- allgemeine Sharedeals-/Portfolio-Artikel ohne Firmenbezug
- Cathie-Wood/Roku-Artikel bei Guardant
- Bauch-/Graft-versus-Host-Artikel ohne MaaT Pharma Bezug
- CLINIGEN-/fremde Pharma-News bei MaaT
- generische News, die nur wegen einem kurzen Ticker wie GH oder ALT gefunden wurden

Neue Logik:
- News müssen einen starken Treffer enthalten:
  - Firmenname
  - Produkt-/Pipeline-Name
  - eindeutige Alias-Begriffe
- kurze Ticker allein reichen nicht mehr

## 2. Auto-Dossier wird wirklich geschrieben

Vorher wurden Platzhalter wie „Dossier angelegt“ oder „wird nach dem nächsten Update ergänzt“ teilweise nicht überschrieben.

Jetzt wird vor dem Speichern ausgeführt:

```python
autofill_dossier(data, news, filings, trials, price)
```

Dadurch werden automatisch gefüllt:

- Woran arbeitet das Unternehmen?
- mögliche Kursbereiche
- wichtige Termine / Auslöser
- schlechter / normaler / guter Fall
- Geldlage, neue Aktien & Risiken
- einfache Zusammenfassung
- Zeitlinie aus News/SEC

## Optionaler Reset

Wenn alte Platzhalter hängen bleiben:

```bash
python3 scripts/clean_bad_news_and_refill.py
python3 scripts/update_data.py
```

Dann committen/pushen.

## Online-Update

Diese Dateien pushen:

- scripts/update_data.py
- scripts/clean_bad_news_and_refill.py
- README.md

Danach lokal oder über Actions:

```bash
python3 scripts/clean_bad_news_and_refill.py
python3 scripts/update_data.py
git add data/
git commit -m "Refresh all dossiers with stricter news filter"
git push
```
