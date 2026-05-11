# Son of Lorenc – Master v3.7 Company Type Fix

Diese Version behebt das Problem bei HAO:

## HAO ist kein Biotech

Haoxi Health Technology wird nicht mehr mit Studien, FDA, Pipeline oder Readout behandelt.

Stattdessen:

- Geschäftsmodell
- Online-Marketing für Healthcare-Kunden
- Umsatz / Margen / Cash
- Finanzierung / Verwässerung
- Warrants / Offerings
- Nasdaq-Compliance / Reverse-Split-Risiko
- Partnerschaften / Plattform-News

## Anwendung

```bash
cp ~/Downloads/son-of-lorenc-master-v3-7-company-type-fix/scripts/update_data.py ./scripts/update_data.py
cp ~/Downloads/son-of-lorenc-master-v3-7-company-type-fix/scripts/reset_company_dossiers.py ./scripts/reset_company_dossiers.py
cp ~/Downloads/son-of-lorenc-master-v3-7-company-type-fix/scripts/add_missing_portfolio.py ./scripts/add_missing_portfolio.py
cp ~/Downloads/son-of-lorenc-master-v3-7-company-type-fix/README.md ./README.md

python3 scripts/reset_company_dossiers.py
python3 scripts/update_data.py

git add scripts/update_data.py scripts/reset_company_dossiers.py scripts/add_missing_portfolio.py README.md data/ config/watchlist.json
git commit -m "Fix company type handling for HAO"
git push
```
