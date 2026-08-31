import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(process.cwd(),'market-diary');
const out=path.join(root,'data','candidates.json');
const healthOut=path.join(root,'data','source-health.json');
const windowDays=Number(process.env.MARKET_DIARY_WINDOW_DAYS||7);
const cutoff=Date.now()-windowDays*86400000;
const ua='MarketDiaryBot/0.3 market-diary-bot@users.noreply.github.com';
const googleRss=q=>`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-CN&gl=HK&ceid=HK:zh-Hans`;

const finance=/earnings|results|revenue|profit|guidance|quarter|financial|investor|shareholder|placement|offering|ipo|listing|dividend|buyback|repurchase|acquisition|merger|财报|业绩|营收|利润|指引|季度|股东|配售|发售|招股|上市|回购|收购|融资/i;
const macro=/federal reserve|fed\b|inflation|employment|jobs|payroll|cpi|pce|gdp|pmi|rates?|monetary|economy|economic|banking|美联储|通胀|就业|非农|利率|货币|经济|金融|银行/i;
const people=/Kevin Warsh|Jensen Huang|Elon Musk|Warren Buffett|Sam Altman|Jerome Powell|马云|马化腾|雷军|黄仁勋|巴菲特/i;

const directFeeds=[
  {key:'fed-press',name:'Federal Reserve · Press',url:'https://www.federalreserve.gov/feeds/press_all.xml',fallbackQ:`site:federalreserve.gov/newsevents/pressreleases Federal Reserve when:${windowDays}d`,market:'宏观',signal:'事实',trust:'A',mode:'direct-rss',include:macro},
  {key:'fed-speeches',name:'Federal Reserve · Speeches',url:'https://www.federalreserve.gov/feeds/speeches.xml',fallbackQ:`site:federalreserve.gov/newsevents/speech Federal Reserve when:${windowDays}d`,market:'宏观',signal:'人物',trust:'A',mode:'direct-rss'},
  {key:'bls',name:'U.S. Bureau of Labor Statistics',url:'https://www.bls.gov/feed/bls_latest.rss',fallbackQ:`site:bls.gov/news.release CPI employment jobs inflation when:${windowDays}d`,market:'宏观',signal:'事实',trust:'A',mode:'direct-rss',include:macro},
  {key:'nbs-release',name:'国家统计局 · 最新发布',url:'https://www.stats.gov.cn/sj/zxfb/rss.xml',fallbackQ:`site:stats.gov.cn/sj/zxfb 经济 数据 PMI 工业 消费 when:${windowDays}d`,market:'宏观',signal:'事实',trust:'A',mode:'direct-rss'},
  {key:'nbs-analysis',name:'国家统计局 · 数据解读',url:'https://www.stats.gov.cn/sj/sjjd/rss.xml',fallbackQ:`site:stats.gov.cn/sj/sjjd 数据解读 PMI 工业 消费 when:${windowDays}d`,market:'宏观',signal:'事实',trust:'A',mode:'direct-rss'},
  {key:'hkex-news',name:'HKEX · News Releases',url:'https://www.hkex.com.hk/Services/RSS-Feeds/News-Releases?sc_lang=en',fallbackQ:`site:hkex.com.hk/News/News-Release HKEX when:${windowDays}d`,market:'港股',signal:'事实',trust:'A',mode:'direct-rss'},
  {key:'hkex-reg',name:'HKEX · Regulatory Announcements',url:'https://www.hkex.com.hk/Services/RSS-Feeds/regulatory-announcements?sc_lang=en',fallbackQ:`site:hkex.com.hk regulatory announcement when:${windowDays}d`,market:'港股',signal:'事实',trust:'A',mode:'direct-rss'},
  {key:'hkex-market',name:'HKEX · Market Communications',url:'https://www.hkex.com.hk/Services/RSS-Feeds/market-communications?sc_lang=en',fallbackQ:`site:hkex.com.hk market communication when:${windowDays}d`,market:'港股',signal:'事实',trust:'A',mode:'direct-rss'}
];

const secFeeds=[
  ['sec-8k','SEC · 8-K','8-K','公司事件'],['sec-10q','SEC · 10-Q','10-Q','财报'],['sec-form4','SEC · Form 4','4','持仓'],
  ['sec-13f','SEC · 13F-HR','13F-HR','持仓'],['sec-13d','SEC · SC 13D','SC 13D','持仓'],['sec-13g','SEC · SC 13G','SC 13G','持仓']
].map(([key,name,form,type])=>({key,name,form,type,market:'美股',signal:type==='持仓'?'资金':'事实',trust:'A',mode:'sec-atom',fallbackQ:`site:sec.gov/Archives/edgar/data "${form}" filing when:${windowDays}d`}));

const discovery=[
  {key:'pbc',name:'中国人民银行',q:`site:pbc.gov.cn 货币政策 金融 利率 when:${windowDays}d`,market:'宏观',signal:'事实',trust:'A',mode:'official-domain-discovery',include:macro},
  {key:'csrc',name:'中国证监会',q:`site:csrc.gov.cn 证券 市场 监管 when:${windowDays}d`,market:'宏观',signal:'事实',trust:'A',mode:'official-domain-discovery'},
  {key:'hkma',name:'香港金管局',q:`site:hkma.gov.hk monetary banking market economy when:${windowDays}d`,market:'港股',signal:'事实',trust:'A',mode:'official-domain-discovery',include:macro},
  {key:'hk-gov',name:'香港政府',q:`site:info.gov.hk finance economy market when:${windowDays}d`,market:'港股',signal:'事实',trust:'A',mode:'official-domain-discovery',include:macro},
  {key:'ir-nvidia',name:'NVIDIA IR',q:`site:investor.nvidia.com earnings results revenue financial when:${windowDays}d`,market:'美股',signal:'事实',trust:'A',mode:'official-domain-discovery',include:finance},
  {key:'ir-tesla',name:'Tesla IR',q:`site:ir.tesla.com results quarter financial earnings when:${windowDays}d`,market:'美股',signal:'事实',trust:'A',mode:'official-domain-discovery',include:finance},
  {key:'ir-apple',name:'Apple Newsroom',q:`site:apple.com/newsroom quarter results revenue earnings when:${windowDays}d`,market:'美股',signal:'事实',trust:'A',mode:'official-domain-discovery',include:finance},
  {key:'ir-alibaba',name:'Alibaba IR',q:`site:alibabagroup.com results announcement placement offering AI when:${windowDays}d`,market:'港股',signal:'事实',trust:'A',mode:'official-domain-discovery',include:finance},
  {key:'reuters',name:'Reuters',q:`site:reuters.com markets stocks earnings IPO when:${windowDays}d`,market:'全球',signal:'媒体',trust:'B',mode:'media-discovery',include:new RegExp(`${finance.source}|${macro.source}`,'i')},
  {key:'cnbc',name:'CNBC',q:`site:cnbc.com stocks earnings Fed IPO when:${windowDays}d`,market:'美股',signal:'媒体',trust:'B',mode:'media-discovery',include:new RegExp(`${finance.source}|${macro.source}`,'i')},
  {key:'yicai',name:'第一财经',q:`site:yicai.com 港股 美股 AI 财报 IPO when:${windowDays}d`,market:'全球',signal:'媒体',trust:'B',mode:'media-discovery'},
  {key:'aastocks',name:'AASTOCKS',q:`site:aastocks.com 港股 IPO 業績 公告 when:${windowDays}d`,market:'港股',signal:'媒体',trust:'B',mode:'media-discovery'},
  {key:'people',name:'重要人物',q:`("Kevin Warsh" OR "Jensen Huang" OR "Elon Musk" OR "Warren Buffett" OR "Sam Altman" OR "马云" OR "马化腾" OR "雷军") markets AI stocks when:${windowDays}d`,market:'全球',signal:'人物',trust:'B',mode:'people-discovery',include:people},
  {key:'x-fallback',name:'X · 热点发现',q:`site:x.com (NVDA OR TSLA OR BABA OR "Hong Kong stocks" OR "Federal Reserve" OR SHEIN) when:${windowDays}d`,market:'全球',signal:'热点',trust:'C',mode:'social-discovery'},
  {key:'xiaohongshu',name:'小红书 · 热点发现',q:`site:xiaohongshu.com (港股 OR 美股 OR 英伟达 OR 阿里 OR 特斯拉 OR IPO) when:${windowDays}d`,market:'全球',signal:'热点',trust:'C',mode:'social-discovery'},
  {key:'us-house',name:'U.S. House Financial Disclosure',q:`site:disclosures-clerk.house.gov "Periodic Transaction Report" stock when:${windowDays}d`,market:'美股',signal:'资金',trust:'A',mode:'official-domain-discovery'}
];

const decode=s=>(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
const strip=s=>decode((s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' '));
function tag(xml,name){const m=xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));return m?decode(m[1]):''}
function atomLink(xml){const m=xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);return m?decode(m[1]):tag(xml,'link')}
function parseTime(v=''){const n=Date.parse(v);return Number.isFinite(n)?n:null}
function inWindow(v=''){const n=parseTime(v);return n===null||n>=cutoff}
function relevant(meta,title,desc=''){return !meta.include||meta.include.test(`${title} ${desc}`)}
function inferType(title='',preset=''){if(preset)return preset;const t=title.toLowerCase();if(/ipo|招股|上市|新股|global offering|listing/.test(t))return'IPO';if(/earnings|results|财报|业绩|10-q|10-k/.test(t))return'财报';if(macro.test(t))return'宏观';if(/13f|form 4|13d|13g|insider|holding|持仓|增持|减持|shareholding/.test(t))return'持仓';return'公司事件'}
function norm(s=''){return s.toLowerCase().replace(/\s+/g,' ').replace(/[^\p{L}\p{N}]+/gu,'').slice(0,120)}
function keywordBonus(t=''){t=t.toLowerCase();let b=0;if(/nvidia|nvda|alibaba|baba|tesla|tsla|apple|aapl|shein|腾讯|tencent|英伟达|阿里|特斯拉/.test(t))b+=10;if(macro.test(t))b+=8;if(/ipo|listing|招股|上市|13f|form 4|13d|13g/.test(t))b+=6;return b}
function priority(s){return s>=82?'S':s>=62?'A':'B'}
function score(x){let s=26+(x.trustTier==='A'?28:x.trustTier==='B'?15:4);if(x.signal==='热点')s-=10;if(x.signal==='人物'||x.signal==='资金')s+=5;if(['宏观','财报','IPO','持仓'].includes(x.type))s+=8;s+=keywordBonus(x.title);const d=parseTime(x.pubDate);if(d){const h=(Date.now()-d)/36e5;if(h<=24)s+=9;else if(h<=72)s+=6;else if(h<=168)s+=3}if(x.sourceMode.includes('fallback'))s-=3;return Math.max(0,Math.min(100,s))}
function makeItem(meta,title,link,pubDate='',description='',source=''){const x={market:meta.market||'全球',signal:meta.signal||'事实',type:inferType(title,meta.type||''),title,link,pubDate,description:description.slice(0,500),source:source||meta.name,sourceKey:meta.key,sourceMode:meta.mode,trustTier:meta.trust||'B',confidence:meta.trust||'B'};x.verification=x.signal==='热点'?'热点发现：不得直接发布，必须回到一级信源核验':x.trustTier==='A'?'一级/官方信源候选：发布前核对原文关键数字与日期':'权威媒体候选：需匹配公司公告、监管文件或政府原文';x.score=score(x);x.priority=priority(x.score);x.id=crypto.createHash('sha1').update(`${x.sourceKey}|${x.title}|${x.link}`).digest('hex').slice(0,16);return x}
async function fetchText(url,headers={}){const r=await fetch(url,{headers:{'user-agent':ua,'accept':'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',...headers},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()}
function parseFeed(xml,meta){const rss=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);const atom=[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(m=>m[1]);const blocks=rss.length?rss:atom;return blocks.slice(0,40).map(raw=>{const title=strip(tag(raw,'title'));const link=rss.length?tag(raw,'link'):atomLink(raw);const pub=tag(raw,'pubDate')||tag(raw,'updated')||tag(raw,'published');const desc=strip(tag(raw,'description')||tag(raw,'summary')||tag(raw,'content'));const source=strip(tag(raw,'source'))||meta.name;return{title,link,pub,desc,source}}).filter(v=>v.title&&v.link&&inWindow(v.pub)&&relevant(meta,v.title,v.desc)).map(v=>makeItem(meta,v.title,v.link,v.pub,v.desc,v.source))}
async function rawCollect(meta,url){const t=Date.now();try{const xml=await fetchText(url);const items=parseFeed(xml,meta);return{ok:true,items,latencyMs:Date.now()-t}}catch(e){return{ok:false,items:[],latencyMs:Date.now()-t,error:String(e.message||e).slice(0,160)}}}
async function collect(meta,url,fbQ=''){const primary=await rawCollect(meta,url);if(primary.ok)return{items:primary.items,health:{key:meta.key,name:meta.name,mode:meta.mode,trust:meta.trust,status:'ok',route:'direct',count:primary.items.length,checkedAt:new Date().toISOString(),latencyMs:primary.latencyMs}};if(fbQ){const fbMeta={...meta,mode:`${meta.mode}->google-fallback`};const fb=await rawCollect(fbMeta,googleRss(fbQ));if(fb.ok)return{items:fb.items,health:{key:meta.key,name:meta.name,mode:meta.mode,trust:meta.trust,status:'fallback-ok',route:'fallback',count:fb.items.length,checkedAt:new Date().toISOString(),latencyMs:primary.latencyMs+fb.latencyMs,directError:primary.error}}}return{items:[],health:{key:meta.key,name:meta.name,mode:meta.mode,trust:meta.trust,status:'error',count:0,checkedAt:new Date().toISOString(),latencyMs:primary.latencyMs,error:primary.error}}}
async function collectX(){const token=process.env.X_BEARER_TOKEN||'';const meta={key:'x-api',name:'X Recent Search',market:'全球',signal:'热点',trust:'C',mode:'x-api'};const t=Date.now();if(!token)return{items:[],health:{...meta,status:'not-configured',count:0,checkedAt:new Date().toISOString(),note:'配置 X_BEARER_TOKEN 后启用官方 Recent Search'}};try{const q='($NVDA OR $TSLA OR $BABA OR "Hong Kong stocks" OR "Federal Reserve" OR SHEIN) -is:retweet lang:en';const url=`https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=100&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username,verified`;const r=await fetch(url,{headers:{authorization:`Bearer ${token}`,'user-agent':ua},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();const users=new Map((j.includes?.users||[]).map(u=>[u.id,u]));const items=(j.data||[]).map(v=>{const u=users.get(v.author_id)||{};const x=makeItem(meta,`@${u.username||'user'}: ${v.text}`.slice(0,220),`https://x.com/${u.username||'i'}/status/${v.id}`,v.created_at,'',`X @${u.username||'user'}`);const m=v.public_metrics||{};x.socialMetrics={like:m.like_count||0,repost:m.retweet_count||0,reply:m.reply_count||0,quote:m.quote_count||0};x.heatScore=Math.min(100,Math.round(Math.log10(1+(m.like_count||0)+(m.retweet_count||0)*3+(m.reply_count||0)*2)*25));x.score=Math.min(72,x.score+Math.round(x.heatScore/10));x.priority=priority(x.score);return x}).filter(x=>inWindow(x.pubDate));return{items,health:{key:meta.key,name:meta.name,mode:meta.mode,trust:meta.trust,status:'ok',count:items.length,checkedAt:new Date().toISOString(),latencyMs:Date.now()-t}}}catch(e){return{items:[],health:{key:meta.key,name:meta.name,mode:meta.mode,trust:meta.trust,status:'error',count:0,checkedAt:new Date().toISOString(),latencyMs:Date.now()-t,error:String(e.message||e).slice(0,160)}}}}

const jobs=[...directFeeds.map(x=>collect(x,x.url,x.fallbackQ)),...secFeeds.map(x=>collect(x,`https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encodeURIComponent(x.form)}&company=&dateb=&owner=include&start=0&count=40&output=atom`,x.fallbackQ)),...discovery.map(x=>collect(x,googleRss(x.q))),collectX()];
const results=await Promise.all(jobs);const health=results.map(x=>x.health);const seen=new Set();const items=results.flatMap(x=>x.items).filter(x=>{const k=norm(x.title);if(!k||seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>b.score-a.score).slice(0,160);
const summary={total:items.length,bySignal:Object.fromEntries(['事实','媒体','人物','资金','热点'].map(k=>[k,items.filter(x=>x.signal===k).length])),byTrust:Object.fromEntries(['A','B','C'].map(k=>[k,items.filter(x=>x.trustTier===k).length])),s:items.filter(x=>x.priority==='S').length,a:items.filter(x=>x.priority==='A').length,b:items.filter(x=>x.priority==='B').length};
const healthSummary={ok:health.filter(x=>x.status==='ok').length,fallback:health.filter(x=>x.status==='fallback-ok').length,error:health.filter(x=>x.status==='error').length,notConfigured:health.filter(x=>x.status==='not-configured').length,total:health.length};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify({generatedAt:new Date().toISOString(),windowDays,summary,note:'自动候选池。官方/一级信源优先；直连受限时使用官方域名发现作为降级路径；权威媒体用于补充；X/小红书只做热点发现。正式发布前必须回到原始来源核验。',items},null,2)+'\n');await fs.writeFile(healthOut,JSON.stringify({generatedAt:new Date().toISOString(),summary:healthSummary,sources:health},null,2)+'\n');console.log(`wrote ${items.length} candidates | direct=${healthSummary.ok} fallback=${healthSummary.fallback} error=${healthSummary.error}`);
