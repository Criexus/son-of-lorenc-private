# Son of Lorenc Admin Worker

Dieser Cloudflare Worker speichert neue Aktien dauerhaft im GitHub-Repository.

## Was er macht

POST `/add-stock`

Er schreibt:

- `config/watchlist.json`
- `data/TICKER.json`
- `data/watchlist.json`

Optional triggert er danach den GitHub-Workflow `update-every-30-min.yml`.

## Benötigte Worker-Secrets / Variablen

In Cloudflare Worker Settings > Variables and Secrets setzen:

```text
GITHUB_OWNER=Criexus
GITHUB_REPO=son-of-lorenc-private
GITHUB_BRANCH=main
GITHUB_TOKEN=dein_geheimer_github_token
ADMIN_PIN=optional
ALLOWED_ORIGIN=https://deine-cloudflare-pages-url.pages.dev
```

Wichtig: `GITHUB_TOKEN` niemals ins Frontend schreiben.

## GitHub Token

Empfohlen: Fine-grained Personal Access Token mit Repository-Zugriff auf `son-of-lorenc-private` und mindestens:

- Contents: Read and write
- Actions: Read and write, optional für Workflow-Trigger

Wenn du Classic Token nutzt:

- repo
- workflow optional, falls Workflow-Dateien oder Dispatch relevant sind

## Frontend verbinden

In `config/admin.js` die Worker-URL eintragen:

```js
window.SOL_ADMIN_API_URL = "https://dein-worker.workers.dev";
```
