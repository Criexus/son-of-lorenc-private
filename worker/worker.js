export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {"Access-Control-Allow-Origin": allowedOrigin === "*" ? "*" : allowedOrigin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
    const url = new URL(request.url);
    if (request.method !== "POST" || !["/add-stock","/delete-stock"].includes(url.pathname)) return json({ok:false,error:"Not found"},404,corsHeaders);
    try{
      const body=await request.json();
      if (env.ADMIN_PIN && body.adminPin !== env.ADMIN_PIN) return json({ok:false,error:"Admin-PIN falsch"},403,corsHeaders);
      const owner=env.GITHUB_OWNER, repo=env.GITHUB_REPO, branch=env.GITHUB_BRANCH||"main", token=env.GITHUB_TOKEN;
      if(!owner||!repo||!token) return json({ok:false,error:"Worker Secrets fehlen: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN"},500,corsHeaders);
      if(url.pathname==="/delete-stock") return await deleteStock({body,owner,repo,branch,token,corsHeaders});
      return await addStock({body,owner,repo,branch,token,corsHeaders});
    }catch(err){return json({ok:false,error:err.message||"Unbekannter Fehler"},500,corsHeaders)}
  }
};
async function addStock({body,owner,repo,branch,token,corsHeaders}){
  const ticker=cleanTicker(body.ticker), name=cleanText(body.name||ticker), exchange=cleanText(body.exchange||"NASDAQ"), theme=cleanText(body.theme||"Research"), query=cleanText(body.query||`${name} ${ticker} stock news`), secQuery=cleanTicker(body.sec_query||ticker);
  const watchPath="config/watchlist.json", watchFile=await githubGetFile(owner,repo,watchPath,branch,token), watchlist=watchFile?JSON.parse(base64ToUtf8(watchFile.content)):[];
  if(watchlist.some(x=>String(x.ticker||"").toUpperCase()===ticker)) return json({ok:false,error:`${ticker} ist bereits in der Watchlist vorhanden.`},409,corsHeaders);
  watchlist.push({ticker,name,exchange,theme,query,sec_query:secQuery,queries:[query,`${name} ${ticker} stock news`,`${ticker} stock news`],clinical_query:`${name} OR ${ticker}`,rss_urls:[],max_news:30});
  await githubPutFile(owner,repo,watchPath,branch,token,{message:`Add ${ticker} to Son of Lorenc watchlist`,content:utf8ToBase64(JSON.stringify(watchlist,null,2)+"\n"),sha:watchFile?.sha});
  const stockPath=`data/${ticker}.json`, existingStock=await githubGetFile(owner,repo,stockPath,branch,token);
  if(!existingStock) await githubPutFile(owner,repo,stockPath,branch,token,{message:`Create Son of Lorenc dossier for ${ticker}`,content:utf8ToBase64(JSON.stringify(createStockTemplate({ticker,name,exchange,theme}),null,2)+"\n")});
  const displayPath="data/watchlist.json", displayFile=await githubGetFile(owner,repo,displayPath,branch,token), display=displayFile?JSON.parse(base64ToUtf8(displayFile.content)):[];
  if(!display.some(x=>String(x.ticker||"").toUpperCase()===ticker)){display.push({ticker,name,exchange,theme});await githubPutFile(owner,repo,displayPath,branch,token,{message:`Update dashboard display watchlist for ${ticker}`,content:utf8ToBase64(JSON.stringify(display,null,2)+"\n"),sha:displayFile?.sha});}
  await tryDispatchWorkflow(owner,repo,branch,token);
  return json({ok:true,ticker,message:`${ticker} wurde gespeichert. GitHub/Cloudflare braucht ggf. kurz zum Deployen.`},200,corsHeaders);
}
async function deleteStock({body,owner,repo,branch,token,corsHeaders}){
  const ticker=cleanTicker(body.ticker);
  const watchPath="config/watchlist.json", watchFile=await githubGetFile(owner,repo,watchPath,branch,token);
  if(!watchFile) return json({ok:false,error:"config/watchlist.json wurde nicht gefunden."},404,corsHeaders);
  const watchlist=JSON.parse(base64ToUtf8(watchFile.content)), nextWatchlist=watchlist.filter(x=>String(x.ticker||"").toUpperCase()!==ticker);
  if(nextWatchlist.length===watchlist.length) return json({ok:false,error:`${ticker} ist nicht in der Watchlist vorhanden.`},404,corsHeaders);
  await githubPutFile(owner,repo,watchPath,branch,token,{message:`Remove ${ticker} from Son of Lorenc watchlist`,content:utf8ToBase64(JSON.stringify(nextWatchlist,null,2)+"\n"),sha:watchFile.sha});
  const displayPath="data/watchlist.json", displayFile=await githubGetFile(owner,repo,displayPath,branch,token);
  if(displayFile){const display=JSON.parse(base64ToUtf8(displayFile.content)).filter(x=>String(x.ticker||"").toUpperCase()!==ticker);await githubPutFile(owner,repo,displayPath,branch,token,{message:`Remove ${ticker} from dashboard display watchlist`,content:utf8ToBase64(JSON.stringify(display,null,2)+"\n"),sha:displayFile.sha});}
  const stockPath=`data/${ticker}.json`, stockFile=await githubGetFile(owner,repo,stockPath,branch,token);
  if(stockFile) await githubDeleteFile(owner,repo,stockPath,branch,token,{message:`Delete Son of Lorenc dossier for ${ticker}`,sha:stockFile.sha});
  await tryDispatchWorkflow(owner,repo,branch,token);
  return json({ok:true,ticker,message:`${ticker} wurde gelöscht. GitHub/Cloudflare braucht ggf. kurz zum Deployen.`},200,corsHeaders);
}
function cleanTicker(v){const t=String(v||"").trim().toUpperCase();if(!/^[A-Z0-9.\-]{1,15}$/.test(t))throw new Error("Ticker ungültig. Erlaubt: A-Z, 0-9, Punkt und Bindestrich.");return t}
function cleanText(v){return String(v||"").trim().slice(0,240)}
function json(payload,status=200,headers={}){return new Response(JSON.stringify(payload),{status,headers})}
async function githubGetFile(owner,repo,path,branch,token){const res=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encPath(path)}?ref=${encodeURIComponent(branch)}`,{headers:gh(token)});if(res.status===404)return null;if(!res.ok)throw new Error(`GitHub GET ${path}: ${res.status} ${await res.text()}`);return res.json()}
async function githubPutFile(owner,repo,path,branch,token,payload){const res=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encPath(path)}`,{method:"PUT",headers:gh(token),body:JSON.stringify({message:payload.message,content:payload.content,branch,...(payload.sha?{sha:payload.sha}:{})})});if(!res.ok)throw new Error(`GitHub PUT ${path}: ${res.status} ${await res.text()}`);return res.json()}
async function githubDeleteFile(owner,repo,path,branch,token,payload){const res=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encPath(path)}`,{method:"DELETE",headers:gh(token),body:JSON.stringify({message:payload.message,sha:payload.sha,branch})});if(!res.ok)throw new Error(`GitHub DELETE ${path}: ${res.status} ${await res.text()}`);return res.json()}
async function tryDispatchWorkflow(owner,repo,branch,token){try{return (await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/update-every-30-min.yml/dispatches`,{method:"POST",headers:gh(token),body:JSON.stringify({ref:branch})})).ok}catch{return false}}
function gh(token){return {Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"Son-of-Lorenc-Admin"}}
function encPath(p){return p.split("/").map(encodeURIComponent).join("/")}
function utf8ToBase64(str){const bytes=new TextEncoder().encode(str);let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin)}
function base64ToUtf8(b64){const bin=atob(String(b64).replace(/\n/g,""));const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder().decode(bytes)}
function createStockTemplate({ticker,name,exchange,theme}){return {ticker,exchange,name,eyebrow:`Son of Lorenc · Phasenanalyse · ${ticker}`,headline:`${name} – Phasenanalyse im Aufbau`,thesis:`Kurzthese: ${ticker} wurde neu in das Son-of-Lorenc-System aufgenommen. Der Dossier-Aufbau ist vorbereitet; aktuelle News, Kursdaten und SEC-Filings werden über das Update-System geladen.`,stand:new Date().toISOString().slice(0,10),phase:"A/B · Beobachtung / Story-Aufbau",character:"Research-Wert · Risiko prüfen",metrics:[{label:"Aktueller Kurs",value:"wird aktualisiert",note:"aus automatischem Datenabruf",key:"price"},{label:"52W-Spanne",value:"offen",note:"manuell/automatisch ergänzen",key:"range52"},{label:"Cash & Wertpapiere",value:"offen",note:"letzten Bericht prüfen",key:"cash"},{label:"Cash Runway",value:"offen",note:"Finanzierungsreichweite prüfen",key:"runway"},{label:"Umsatz",value:"offen",note:"je nach Entwicklungsphase relevant",key:"revenue"},{label:"Risikoklasse",value:"offen",note:"muss eingeordnet werden",key:"risk"}],chart_subtitle:"Schematische Einordnung der wichtigsten Kurs- und Nachrichtenpunkte.",chart_note:"Hinweis: Das Diagramm ist kein exakter Börsenchart.",events:[{d:"Start",p:1,title:"Dossier angelegt",phase:"Phase A – Aufbau",reaction:"Der Wert wurde in die Watchlist aufgenommen.",details:"Die tiefe Analyse kann nach Recherche ergänzt werden.",source:"Son of Lorenc",future:false}],pipeline_intro:"Pipeline / Geschäftsmodell wird nach tiefer Recherche ergänzt.",pipeline:[],zones:[],catalysts:[],scenarios:{bear:{title:"Bear Case",text:"Negative Daten oder schwacher Markt können den Kurs drücken."},base:{title:"Base Case",text:"Ohne harte Katalysatoren bleibt der Wert newsgetrieben."},bull:{title:"Bull Case",text:"Positive Daten oder Partnerschaften können eine Neubewertung auslösen."}},risks:[],clear_view:["Diese Analyse ist als Dossier-Vorlage vorbereitet.","Keine Kaufempfehlung."],sources:["Son of Lorenc Mastertemplate"],latest_auto:{last_update_utc:new Date().toISOString(),price:null,news:[],sec_filings:[]}}}
