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

function clean(v=''){return String(v).replace(/https?:\/\/\S+/g,'').replace(/&nbsp;?/gi,' ').replace(/\s+/g,' ').replace(/\s+-\s+(x\.com|TradingView)$/i,'').trim()}
function clip(v='',n=48){const s=clean(v);return s.length>n?`${s.slice(0,n-1)}…`:s}
function sourceName(v=''){if(/HKEX/i.test(v))return '港交所';if(/Federal Reserve/i.test(v))return '美联储';if(/SEC/i.test(v))return 'SEC';if(/BLS/i.test(v))return '美国劳工统计局';return String(v).split('·')[0].trim()||'官方信源'}
function humanSummary(x){
  const t=clean(x.title);if(/[\u3400-\u9fff]/.test(t))return clip(t,56);
  if(/Report on Initial Public Offering Applications, Delisting and Suspensions/i.test(t))return '港交所发布最新IPO申请、除牌及停牌报告';
  if(/Minutes of the Board's discount rate meetings/i.test(t))return '美联储公布贴现率会议纪要';
  const debut=t.match(/HKEX Enhances Product Offering with (.+?) Debut/i);if(debut)return `${debut[1]}上市，港交所更新相关产品安排`;
  if(/Warsh,\s*In Our Time/i.test(t))return 'Warsh杰克逊霍尔讲话：重新审视前瞻指引';
  if(/financial results|earnings/i.test(t))return `${sourceName(x.source)}发布最新业绩信息`;
  if(/global offering|prospectus/i.test(t))return `${sourceName(x.source)}出现新的招股/发售文件`;
  if(x.type==='IPO')return `${sourceName(x.source)}出现新的IPO相关信息`;
  if(x.type==='宏观')return `${sourceName(x.source)}出现新的宏观政策或数据更新`;
  if(x.type==='财报')return `${sourceName(x.source)}出现新的财报或业绩信息`;
  return `${sourceName(x.source)}出现一条新的${x.type||'市场'}信息`;
}
function heuristicWhy(x){
  if(x.signal==='热点')return '这条信息只作为热点发现，用来判断市场正在讨论什么；不能直接发布，必须回到一级信源确认。';
  if(x.type==='IPO')return '这类信息可能影响招股、上市或新股跟踪节奏，适合进入IPO选题池；发布前需要回到港交所或公司原文核验。';
  if(x.type==='宏观'||x.market==='宏观')return '这类信息可能影响利率预期、美元、美债和港美股风险偏好，适合做宏观快讯或解释型内容；关键口径需要核对原文。';
  if(x.type==='财报')return '财报会直接改变公司增长、盈利和估值预期，适合做关键数字快讯和财报解读；关键数字需要回到公司公告核验。';
  if(x.type==='持仓')return '公开持仓变化可用于发现机构或重要人物的资金动作，但需要结合披露时间和原始文件理解，避免把历史持仓当成实时交易。';
  return '这类公司或市场变化可能影响用户预期和后续交易主线，适合进入事件解读候选；发布前需要核对原始公告。';
}
function heuristic(x){
  const p=x.score>=82?'S':x.score>=62?'A':'B';
  return {...x,ai:{priority:p,summary:humanSummary(x),whyImportant:heuristicWhy(x),contentDirection:x.type==='IPO'?['IPO','招股书解析']:x.type==='财报'?['快讯','财报解读']:x.type==='宏观'?['快讯','宏观解读']:['快讯','事件解读'],verificationNeed:x.signal==='热点'?'必须核验：社媒仅用于发现热点':'必须核验关键数字与原始公告',mode:'rule-fallback'}}
}

async function enrichWithAI(items){
  const prompt=`你是港美股财经内容运营编辑。请处理候选资讯，只做内容决策辅助，不把AI当事实来源。\n对每条输出：id、20-40字中文summary、whyImportant、priority(S/A/B)、contentDirection数组、verificationNeed。\n要求：用自然中文，不照抄英文原标题，不写“候选信息已进入编辑池”这类模板话；直接告诉编辑发生什么、为什么值得看。\n评分关注：影响范围30、用户关注25、信息增量20、时效15、内容可转化10。\n社媒/X/小红书只能作为热点发现，必须标注待一级信源核验。\n候选：\n${items.map((x,i)=>`${i+1}. ${x.market}|${x.signal}|${x.type}|${x.title}|source=${x.source}|score=${x.score}`).join('\n')}\n只返回JSON数组。`;
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
