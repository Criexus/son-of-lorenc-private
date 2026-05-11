# Son of Lorenc – Master v3.8 Smart Chart + News Timeline

Diese Version macht den Smart-Chart deutlich sinnvoller.

## Neu

- Smart-Chart nutzt zuerst den aktuellen 1-Tages-Verlauf aus Yahoo (`1d/5m`)
- wenn kein Intraday verfügbar ist, nutzt er den 1-Monats-Verlauf
- kein Livechart: Daten werden nur beim Update gespeichert
- News-Marker werden direkt im Chart angezeigt
- unter dem Chart erscheint immer eine News-Zeitlinie
- wenn keine passende News gefunden wird, steht dort ein klarer Hinweis
- `latest_auto.price_history_1d` wird beim Update gespeichert

## Dateien

Pushen:

- index.html
- assets/app.js
- assets/style.css
- scripts/update_data.py
- README.md

Danach:

```bash
python3 scripts/update_data.py
git add index.html assets/app.js assets/style.css scripts/update_data.py README.md data/
git commit -m "Add smart chart news timeline"
git push
```
