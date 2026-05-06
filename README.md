# Son of Lorenc – Master v2.0 Solid Admin + Auto-Dossier Fix

Diese Version behebt zwei Punkte:

## 1. Admin-Menü
- Admin-Menü ist jetzt ein solides, dunkles Panel
- nicht mehr transparent
- liegt über den Analyse-Kacheln
- schließt nach erfolgreichem Speichern/Löschen automatisch

## 2. Auto-Dossier
- neue Aktien werden aggressiver automatisch befüllt
- leere/platzhalterhafte Bereiche werden erkannt
- Woran arbeitet das Unternehmen?
- mögliche Kursbereiche & Einstiegsidee
- nächste wichtige Termine / Auslöser
- guter / normaler / schlechter Fall
- Geldlage, neue Aktien & Risiken
- einfache Zusammenfassung

## Online-Update

Diese Dateien kopieren und pushen:

- index.html
- assets/app.js
- assets/style.css
- scripts/update_data.py
- scripts/delete_stock.py
- worker/worker.js
- README.md

Nicht kopieren:
- data/
- config/watchlist.json

Danach GitHub Action einmal manuell starten.
