import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.cwd(),'market-diary');
const file=path.join(root,'data','candidates.json');
const data=JSON.parse(await fs.readFile(file,'utf8'));

const high=/FOMC|monetary policy|interest rate|discount rate|inflation|CPI|PCE|employment|payroll|nonfarm|GDP|PMI|earnings|financial results|revenue|profit|guidance|IPO|listing|global offering|placement|buyback|repurchase|merger|acquisition|13F|13D|13G|Form 4|insider|shareholding|AI|NVIDIA|NVDA|Alibaba|BABA|Tesla|TSLA|SHEIN|美联储|货币政策|利率|通胀|就业|非农|财报|业绩|营收|利润|指引|招股|上市|配售|回购|增持|减持|持仓|人工智能/i;
const medium=/market|economy|economic|banking|capital|cloud|semiconductor|robot|technology|stocks?|bonds?|dollar|港股|美股|市场|经济|银行|资本|云计算|半导体|机器人|科技|股票|债券|美元/i;
const noise=/enforcement action with former employee|prohibition order against former employee|Thai Lotto|Workout Tracker|App Store|game|horoscope|lottery/i;

function ageBonus(date=''){
  const t=Date.parse(date);if(!Number.isFinite(t))return 0;
  const h=(Date.now()-t)/36e5;
  if(h<=24)return 10;if(h<=72)return 7;if(h<=168)return 4;return 0;
}
function rerank(x){
  const text=`${x.title||''} ${x.description||''}`;
  let score=x.trustTier==='A'?34:x.trustTier==='B'?24:10;
  const reasons=[];
  if(x.trustTier==='A')reasons.push('一级/官方信源');
  if(high.test(text)){score+=30;reasons.push('高影响事件词');}
  else if(medium.test(text)){score+=14;reasons.push('市场相关');}
  if(x.signal==='人物'){score+=5;reasons.push('关键人物');}
  if(x.signal==='资金'||x.type==='持仓'){score+=8;reasons.push('公开资金信号');}
  if(x.type==='财报'||x.type==='IPO'){score+=6;reasons.push('高转化内容类型');}
  score+=ageBonus(x.pubDate);
  if((x.sourceMode||'').includes('fallback')){score-=4;reasons.push('降级发现待回原文');}
  if(x.signal==='热点'){score=Math.min(score,55);reasons.push('社媒只做热点发现');}
  if(noise.test(text)){score=Math.min(score,30);reasons.push('低内容价值/噪音');}
  score=Math.max(0,Math.min(100,score));
  return {...x,score,priority:score>=82?'S':score>=65?'A':'B',rankReason:reasons.join('；')||'进入素材池'};
}

const items=(data.items||[]).filter(x=>!noise.test(`${x.title||''} ${x.description||''}`)).map(rerank).sort((a,b)=>b.score-a.score);
const summary={
  total:items.length,
  bySignal:Object.fromEntries(['事实','媒体','人物','资金','热点'].map(k=>[k,items.filter(x=>x.signal===k).length])),
  byTrust:Object.fromEntries(['A','B','C'].map(k=>[k,items.filter(x=>x.trustTier===k).length])),
  s:items.filter(x=>x.priority==='S').length,
  a:items.filter(x=>x.priority==='A').length,
  b:items.filter(x=>x.priority==='B').length
};
await fs.writeFile(file,JSON.stringify({...data,rankedAt:new Date().toISOString(),summary,note:`${data.note||''} 编辑排序器再次按市场影响、用户关注和内容可转化性收口：信源权威不等于事件重要。` ,items},null,2)+'\n');
console.log(`ranked ${items.length} candidates | S=${summary.s} A=${summary.a} B=${summary.b}`);
