import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.cwd(),'market-diary');
const out=path.join(root,'data','sec-watchlist.json');
const ua='MarketDiaryBot/0.3 market-diary-bot@users.noreply.github.com';
const days=Number(process.env.MARKET_DIARY_SEC_WINDOW_DAYS||60);
const cutoff=Date.now()-days*86400000;

const watch=[
  {name:'NVIDIA',ticker:'NVDA',cik:'0001045810'},
  {name:'Tesla',ticker:'TSLA',cik:'0001318605'},
  {name:'Apple',ticker:'AAPL',cik:'0000320193'},
  {name:'Alibaba',ticker:'BABA / 9988.HK',cik:'0001577552'},
  {name:'Meta Platforms',ticker:'META',cik:'0001326801'},
  {name:'Amazon',ticker:'AMZN',cik:'0001018724'},
  {name:'Microsoft',ticker:'MSFT',cik:'0000789019'},
  {name:'Alphabet',ticker:'GOOGL',cik:'0001652044'},
  {name:'Berkshire Hathaway',ticker:'BRK.B / institution',cik:'0001067983'}
];
const wanted=new Set(['8-K','10-Q','10-K','6-K','20-F','13F-HR','13F-HR/A','SC 13D','SC 13D/A','SC 13G','SC 13G/A']);

async function fetchJson(url){const r=await fetch(url,{headers:{'user-agent':ua,'accept-encoding':'gzip, deflate','host':'data.sec.gov'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
function filingsFrom(j,w){const f=j.filings?.recent||{};const n=f.form?.length||0;const rows=[];for(let i=0;i<n;i++){const form=f.form[i];if(!wanted.has(form))continue;const filingDate=f.filingDate?.[i]||'';const t=Date.parse(filingDate);if(Number.isFinite(t)&&t<cutoff)continue;const accession=f.accessionNumber?.[i]||'';const primary=f.primaryDocument?.[i]||'';const cikNum=String(Number(w.cik));const acc=accession.replace(/-/g,'');const link=accession&&primary?`https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc}/${primary}`:`https://www.sec.gov/edgar/browse/?CIK=${cikNum}`;rows.push({company:w.name,ticker:w.ticker,cik:w.cik,form,filingDate,reportDate:f.reportDate?.[i]||'',acceptanceDateTime:f.acceptanceDateTime?.[i]||'',accessionNumber:accession,primaryDocument:primary,link,type:/13F|13D|13G/.test(form)?'公开持仓/权益':'公司披露',lagNote:/13F/.test(form)?'13F为季度持仓披露，存在法定披露时滞，不代表实时仓位。':/13D|13G/.test(form)?'13D/13G反映重要股东权益披露，需结合修订文件判断最新状态。':''})}return rows}

const health=[];const filings=[];
for(const w of watch){const started=Date.now();try{const j=await fetchJson(`https://data.sec.gov/submissions/CIK${w.cik}.json`);const rows=filingsFrom(j,w);filings.push(...rows);health.push({name:w.name,ticker:w.ticker,status:'ok',count:rows.length,latencyMs:Date.now()-started})}catch(e){health.push({name:w.name,ticker:w.ticker,status:'error',count:0,latencyMs:Date.now()-started,error:String(e.message||e).slice(0,120)})}}
filings.sort((a,b)=>(b.acceptanceDateTime||b.filingDate).localeCompare(a.acceptanceDateTime||a.filingDate));
const holdingSignals=filings.filter(x=>x.type==='公开持仓/权益');
await fs.writeFile(out,JSON.stringify({generatedAt:new Date().toISOString(),windowDays:days,note:'SEC官方重点标的披露监控。13F不是实时持仓；所有持仓结论需继续打开原始申报文件核验。',summary:{watchEntities:watch.length,healthy:health.filter(x=>x.status==='ok').length,errors:health.filter(x=>x.status==='error').length,filings:filings.length,holdingSignals:holdingSignals.length},health,holdingSignals,filings:filings.slice(0,80)},null,2)+'\n');
console.log(`SEC watchlist healthy=${health.filter(x=>x.status==='ok').length}/${watch.length} filings=${filings.length} holdings=${holdingSignals.length}`);
