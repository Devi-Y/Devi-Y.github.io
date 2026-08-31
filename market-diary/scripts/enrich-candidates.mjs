import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.cwd(),'market-diary');
const input=path.join(root,'data','candidates.json');
const output=path.join(root,'data','ai-candidates.json');
const raw=JSON.parse(await fs.readFile(input,'utf8'));
const top=(raw.items||[]).slice(0,24);

const apiKey=process.env.MARKET_DIARY_AI_KEY||'';
const apiBase=(process.env.MARKET_DIARY_AI_BASE||'https://api.openai.com/v1').replace(/\/$/,'');
const model=process.env.MARKET_DIARY_AI_MODEL||'gpt-5-mini';

function heuristic(x){
  const p=x.score>=82?'S':x.score>=62?'A':'B';
  return {...x,ai:{priority:p,summary:x.title,whyImportant:'候选信息已进入编辑池；发布前需回到一级信源核验关键事实与数字。',contentDirection:x.type==='IPO'?['IPO','招股书解析']:x.type==='财报'?['快讯','财报解读']:x.type==='宏观'?['快讯','宏观解读']:['快讯','事件解读'],verificationNeed:x.signal==='热点'?'必须核验：社媒仅用于发现热点':'必须核验关键数字与原始公告',mode:'rule-fallback'}}
}

async function enrichWithAI(items){
  const prompt=`你是港美股财经内容运营编辑。请处理候选资讯，只做内容决策辅助，不把AI当事实来源。\n对每条输出：id、20-40字summary、whyImportant、priority(S/A/B)、contentDirection数组、verificationNeed。\n评分关注：影响范围30、用户关注25、信息增量20、时效15、内容可转化10。\n社媒/X/小红书只能作为热点发现，必须标注待一级信源核验。\n候选：\n${items.map((x,i)=>`${i+1}. ${x.market}|${x.signal}|${x.type}|${x.title}|source=${x.source}|score=${x.score}`).join('\n')}\n只返回JSON数组。`;
  const r=await fetch(`${apiBase}/chat/completions`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${apiKey}`},body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:0.1,response_format:{type:'json_object'}})});
  if(!r.ok) throw new Error(`AI ${r.status}`);
  const j=await r.json();
  const text=j.choices?.[0]?.message?.content||'';
  let parsed=JSON.parse(text);if(!Array.isArray(parsed))parsed=parsed.items||parsed.results||[];
  return items.map((x,i)=>({...x,ai:{...(parsed[i]||{}),mode:'ai'}}));
}

let items;
if(apiKey){try{items=await enrichWithAI(top)}catch(e){console.error(e.message);items=top.map(heuristic)}}else{items=top.map(heuristic)}
await fs.writeFile(output,JSON.stringify({generatedAt:new Date().toISOString(),aiConfigured:Boolean(apiKey),model:apiKey?model:'rule-fallback',note:'AI只做聚合、摘要、结构化和优先级建议；事实发布前必须回到一级信源核验。',items},null,2)+'\n','utf8');
console.log(`enriched ${items.length} candidates, ai=${Boolean(apiKey)}`);
