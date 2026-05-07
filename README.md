# Son of Lorenc – Master v3.1 Mobile Admin + Smart Börsenchart

Diese Version korrigiert zwei Punkte:

## 1. Admin-Menü auf Mobile
- Admin-Menü ist auf iPhone nicht mehr als Fixed-Overlay eingeblendet
- es klappt im Seitenfluss unter dem Admin-Button auf
- dadurch ist es komplett sichtbar
- kein Abschneiden mehr am oberen oder unteren Rand

## 2. Smart Börsenchart
- Smart bekommt einen gespeicherten Kursverlauf
- kein Livechart
- der Chart wächst mit jedem Update
- `scripts/update_data.py` speichert dafür `latest_auto.price_history`

## Online-Update

Diese Dateien pushen:

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

Danach GitHub Action einmal manuell starten, damit `price_history` entsteht.
