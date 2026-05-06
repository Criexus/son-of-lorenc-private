# Son of Lorenc – Master v1.4 News Analysis & Links

Diese Version ergänzt v1.3 um eine konsequente News-Einordnung und klickbare Quellenlinks.

## Neu in v1.4

- jede automatisch gefundene News bekommt eine Einordnung
- jede News bekommt „Worauf achten“
- jede News bekommt „Möglicher Effekt“
- Quellenlinks sind klickbar:
  - in der Live-News-Sektion
  - in den News-Details rechts am Diagramm
  - in den Datentriggern
- farbliche Trigger-Schwere:
  - high
  - medium
  - low

## Wichtig

Die Einordnung ist in der kostenlosen Version regelbasiert. Sie erkennt Schlüsseltrigger wie FDA, Phase, Readout, Offering, Cash, SEC, Partnerschaft usw.

Für eine echte KI-Einordnung können wir später OpenAI API ergänzen.

## Lokal testen

```bash
cd ~/Downloads/son-of-lorenc-master-v1-4-news-analysis-links
python3 -m pip install -r requirements.txt
python3 scripts/update_data.py
python3 -m http.server 8090
```

Dann öffnen:

```text
http://localhost:8090
```
