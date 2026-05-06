#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; CONFIG=ROOT/'config'/'watchlist.json'; DATA=ROOT/'data'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write_json(p,d): p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def clean(t):
    t=t.strip().upper()
    if not re.match(r'^[A-Z0-9.\-]{1,15}$',t): raise SystemExit('Ungültiger Ticker')
    return t
def remove(items,t): return [x for x in items if str(x.get('ticker','')).upper()!=t]
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('ticker'); a=ap.parse_args(); t=clean(a.ticker)
    wl=read(CONFIG); nwl=remove(wl,t)
    if len(nwl)==len(wl): raise SystemExit(f'{t} wurde nicht gefunden.')
    write_json(CONFIG,nwl)
    dp=DATA/'watchlist.json'
    if dp.exists(): write_json(dp,remove(read(dp),t))
    sp=DATA/f'{t}.json'
    if sp.exists(): sp.unlink()
    print(f'[OK] {t} wurde lokal entfernt.')
if __name__=='__main__': main()
