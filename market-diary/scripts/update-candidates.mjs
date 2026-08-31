import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.cwd(),'market-diary');
const out=path.join(root,'data','candidates.json');

const feeds=[
  {market:'美股',signal:'事实',q:'site:sec.gov OR site:investor.nvidia.com earnings stock'},
  {market:'港股',signal:'事实',q:'site:hkexnews.hk OR site:hkex.com.hk 港股 公告 招股 IPO'},
  {market:'宏观',signal:'事实',q:'site:federalreserve.gov OR site:bls.gov Federal Reserve inflation jobs'},
  {market:'宏观',signal:'事实',q:'site:pbc.gov.cn OR site:stats.gov.cn 金融 经济 数据'},
  {market:'港股',signal:'人物',q:'香港 港股 CEO 投资者 财报 讲话'},
  {market:'美股',signal:'人物',q:'US stocks CEO investor speech markets'},
  {market:'美股',signal:'热点',q:'site:x.com NVDA TSLA BABA stock market'},
  {market:'港股',signal:'热点',q:'site:xiaohongshu.com 港股 美股 股票 财经'}
];

function rssUrl(q){return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-CN&gl=HK&ceid=HK:zh-Hans`}
function decode(s=''){return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim()}
function tag(xml,name){const m=xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`,'i'));return m?decode(m[1]):''}
function domainFromTitle(title=''){const m=title.match(/ - ([^-]+)$/);return m?m[1].trim():''}
function inferType(title=''){
  const t=title.toLowerCase();
  if(/ipo|招股|上市|新股/.test(t)) return 'IPO';
  if(/earnings|results|财报|业绩/.test(t)) return '财报';
  if(/fed|inflation|jobs|employment|cpi|pce|美联储|通胀|就业/.test(t)) return '宏观';
  if(/13f|form 4|insider|holding|持仓|增持|减持/.test(t)) return '持仓';
  return '公司事件';
}
function score(item){
  let s=35;const t=item.title.toLowerCase();
  if(item.signal==='事实') s+=18;if(item.signal==='热点') s+=5;
  if(/sec|hkex|federal reserve|bls|pbc|stats/.test((item.source||'').toLowerCase())) s+=18;
  if(/nvidia|nvda|alibaba|baba|tesla|tsla|fed|美联储|ipo|英伟达|阿里/.test(t)) s+=12;
  if(item.type==='宏观'||item.type==='财报') s+=8;
  return Math.min(100,s);
}
function credibility(item){const s=(item.source||'').toLowerCase();return /sec|hkex|federal reserve|bls|pbc|stats|government/.test(s)?'A':'C'}

async function getFeed(meta){
  try{
    const r=await fetch(rssUrl(meta.q),{headers:{'user-agent':'MarketDiaryBot/0.1 (+https://devi-y.github.io/market-diary/)'}});
    if(!r.ok) throw new Error(String(r.status));
    const xml=await r.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,18).map(m=>{
      const raw=m[1],title=tag(raw,'title'),link=tag(raw,'link'),pubDate=tag(raw,'pubDate'),source=tag(raw,'source')||domainFromTitle(title);
      const item={market:meta.market,signal:meta.signal,type:inferType(title),title,link,pubDate,source,verification:meta.signal==='热点'?'热点候选，必须二次核验':'候选信息，需回到一级信源核验'};
      item.score=score(item);item.confidence=credibility(item);return item;
    })
  }catch(e){console.error('feed failed',meta.q,e.message);return []}
}

const groups=await Promise.all(feeds.map(getFeed));
const seen=new Set();const items=groups.flat().filter(x=>x.title&&x.link).filter(x=>{const k=x.title.toLowerCase().replace(/\s+/g,' ').replace(/[^\p{L}\p{N}]+/gu,'').slice(0,90);if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>b.score-a.score).slice(0,80);
const payload={generatedAt:new Date().toISOString(),count:items.length,note:'自动抓取的候选池。X/小红书仅作为热点发现入口，不作为事实来源；候选信息进入正式雷达前必须回到一级信源核验。',items};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(payload,null,2)+'\n','utf8');
console.log(`wrote ${items.length} candidates`);
