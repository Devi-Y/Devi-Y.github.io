const state={data:null,events:[],live:null,selected:null,watchlist:null,returnPage:'radar',ideaFilter:'全部',query:''};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const pageNames={radar:'今日',detail:'这篇怎么写',workbench:'选题',watchlist:'我的关注'};
const defaultWatchlist={股票:['NVDA','9988.HK','BABA'],人物:['Kevin Warsh','Jensen Huang'],机构:['Berkshire Hathaway'],主题:['美联储','AI','港股IPO']};
const ideaFilters=['全部','港股','美股','宏观','IPO','财报'];

async function loadData(){
  try{
    const [eventsRes,liveRes]=await Promise.allSettled([
      fetch(`./data/events.json?v=${Date.now()}`).then(r=>{if(!r.ok)throw new Error('events');return r.json()}),
      fetch(`./data/ai-candidates.json?v=${Date.now()}`).then(r=>{if(!r.ok)throw new Error('live');return r.json()})
    ]);
    if(eventsRes.status!=='fulfilled')throw new Error('events unavailable');
    state.data=eventsRes.value;
    state.events=state.data.events||[];
    state.live=liveRes.status==='fulfilled'?liveRes.value:null;
    state.selected=dailySorted()[0]||state.events[0]||null;
    updateFreshness();renderAll();document.documentElement.classList.add('app-ready');
  }catch(e){
    console.error(e);$('#updated-at').textContent='加载失败';$('#freshness-note').textContent='数据暂时无法加载，请稍后刷新';showToast('数据加载失败，请稍后重试');
  }
}

function showToast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function esc(v=''){return String(v).replace(/[&<>'\x22]/g,m=>({38:'&amp;',60:'&lt;',62:'&gt;',39:'&#39;',34:'&quot;'}[m.charCodeAt(0)]))}
function trimText(v='',n=32){const s=String(v).trim();return s.length>n?`${s.slice(0,n)}…`:s}
function currentPage(){return document.querySelector('.page.active')?.id?.replace('page-','')||'radar'}

function route(page){
  page=pageNames[page]?page:'radar';
  $$('.page').forEach(x=>x.classList.remove('active'));$(`#page-${page}`)?.classList.add('active');
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  $('#page-title')?.replaceChildren(document.createTextNode(pageNames[page]));
  if(location.hash!==`#${page}`)history.pushState(null,'',`#${page}`);
  window.scrollTo({top:0,behavior:'smooth'});
  if(page==='detail')renderDetail();
}

function initNav(){
  $('#nav')?.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)route(b.dataset.page)});
  document.addEventListener('click',e=>{
    const jump=e.target.closest('[data-jump]');if(jump){e.preventDefault();route(jump.dataset.jump);return}
    if(e.target.closest('[data-copy-package]')){copyWritingPackage();return}
  });
  window.addEventListener('popstate',()=>route(location.hash.replace('#','')||'radar'));
  $('#refresh-btn')?.addEventListener('click',()=>{showToast('正在刷新');loadData()});
  $('#back-btn')?.addEventListener('click',()=>route(state.returnPage||'radar'));
}

function updateFreshness(){
  const candidates=[state.data?.generatedAt,state.live?.generatedAt].filter(Boolean).map(v=>new Date(v)).filter(d=>!Number.isNaN(d.getTime()));
  const latest=candidates.sort((a,b)=>b-a)[0];if(!latest)return;
  const now=new Date(),sameDay=latest.toDateString()===now.toDateString();
  const time=latest.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  $('#updated-at').textContent=sameDay?`更新 ${time}`:`${latest.getMonth()+1}/${latest.getDate()} ${time}`;
  $('#freshness-note').textContent=sameDay?`信息更新至 ${time}`:`最近更新：${latest.getMonth()+1}月${latest.getDate()}日 ${time}`;
  $('#today-date').textContent=now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
}

function getWatchlist(){try{return JSON.parse(localStorage.getItem('marketDiaryWatchlist'))||structuredClone(defaultWatchlist)}catch{return structuredClone(defaultWatchlist)}}
function saveWatchlist(){localStorage.setItem('marketDiaryWatchlist',JSON.stringify(state.watchlist))}
function cleanAction(v=''){return String(v).replace(/^[SAB]级\s*[｜|]\s*/,'').trim()}
function contentLabels(x){return (x.contentDirection||[]).slice(0,3)}
function firstContentLabel(x){return contentLabels(x)[0]||'继续观察'}
function impactText(x){return (x.impact||[]).slice(0,4).join('、')||'相关市场用户'}
function eventDate(x){if(!x?.date)return null;const d=new Date(`${x.date}T00:00:00`);return Number.isNaN(d.getTime())?null:d}

function verdictInfo(x){
  const score=Number(x.priorityScore||0);
  if(score>=80||x.priority==='S')return {text:'值得写',cls:'worth'};
  if(score>=70||x.priority==='A')return {text:'可以写',cls:'maybe'};
  return {text:'先观察',cls:'watch'};
}

function dailyRankScore(x){
  let score=Number(x.priorityScore||0);const d=eventDate(x);if(!d)return score;
  const today=new Date();today.setHours(0,0,0,0);const delta=Math.round((d-today)/86400000);
  if(delta===0)score+=32;else if(delta===1)score+=18;else if(delta===2||delta===3)score+=10;else if(delta===-1)score+=18;else if(delta>=-3)score+=8;else if(delta<=-6)score-=18;else score-=6;
  if(x.heat==='高')score+=2;return score;
}
function dailySorted(){return [...state.events].sort((a,b)=>dailyRankScore(b)-dailyRankScore(a)||(b.priorityScore||0)-(a.priorityScore||0))}
function prioritySorted(){return [...state.events].sort((a,b)=>(b.priorityScore||0)-(a.priorityScore||0))}
function renderAll(){state.watchlist=getWatchlist();renderToday();renderIdeaFilters();renderIdeas();renderDetail();renderWatchlist()}

function storyCardHtml(x,index){
  const verdict=verdictInfo(x);
  return `<article class="story-card" data-event="${esc(x.id)}" role="button" tabindex="0" aria-label="写 ${esc(x.title)}">
    <div class="story-top"><span class="story-rank">${index+1}</span><div class="story-meta"><span>${esc(x.market)}</span><span>${esc(x.type)}</span></div></div>
    <h3>${esc(x.title)}</h3>
    <div class="plain-lines">
      <div class="plain-line"><b>发生什么</b><p>${esc(x.conclusion)}</p></div>
      <div class="plain-line"><b>影响谁</b><p>${esc(impactText(x))}</p></div>
      <div class="plain-line"><b>内容判断</b><p><span class="verdict ${verdict.cls}">${verdict.text}</span><span class="format-note">${esc(contentLabels(x).join(' / ')||'继续观察')}</span></p></div>
    </div>
    <div class="write-cta">写这条 <span>→</span></div>
  </article>`
}

function compactItemHtml(x){
  const verdict=verdictInfo(x);
  return `<article class="feed-item" data-event="${esc(x.id)}" role="button" tabindex="0" aria-label="写 ${esc(x.title)}">
    <div class="feed-copy"><div class="feed-meta"><span>${esc(x.market)}</span><span>${esc(x.type)}</span><span class="feed-verdict ${verdict.cls}">${verdict.text}</span></div><h4>${esc(x.title)}</h4><p>${esc(x.conclusion)}</p></div>
    <span class="feed-arrow">›</span>
  </article>`
}

function bindCards(container){
  if(!container)return;
  const open=target=>{const c=target.closest('[data-event]');if(!c)return;const page=currentPage();state.returnPage=page==='detail'?'radar':page;state.selected=state.events.find(x=>x.id===c.dataset.event)||state.selected;renderDetail();route('detail')};
  container.onclick=e=>open(e.target);
  container.onkeydown=e=>{if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest('[data-event]');if(!c)return;e.preventDefault();open(c)};
}

function liveItems(){
  const curatedSources=new Set(state.events.map(x=>x.sourceUrl).filter(Boolean));
  return (state.live?.items||[]).filter(x=>x.trustTier==='A'&&x.signal!=='热点'&&!curatedSources.has(x.link)).sort((a,b)=>Date.parse(b.pubDate||0)-Date.parse(a.pubDate||0)).slice(0,3);
}
function timeAgo(v){const t=Date.parse(v);if(!Number.isFinite(t))return '';const h=Math.max(0,Math.round((Date.now()-t)/36e5));if(h<1)return '刚刚';if(h<24)return `${h}小时前`;const d=Math.round(h/24);return `${d}天前`}
function renderLive(){
  const section=$('#live-section'),host=$('#live-headlines'),items=liveItems();if(!section||!host)return;
  if(!items.length){section.hidden=true;host.innerHTML='';return}
  section.hidden=false;
  host.innerHTML=items.map(x=>`<a class="live-link" href="${esc(x.link)}" target="_blank" rel="noopener"><div><div class="live-meta"><span>${esc(x.market)}</span><span>${esc(timeAgo(x.pubDate))}</span><span>${esc(x.source||'官方信源')}</span></div><b>${esc(x.ai?.summary||x.title)}</b></div><span>↗</span></a>`).join('');
}

function renderToday(){
  const all=dailySorted(),top=all.slice(0,3),more=all.slice(3,10);$('#hero-count').textContent=top.length;
  const host=$('#hero-opportunities');host.innerHTML=top.map((x,i)=>storyCardHtml(x,i)).join('')||'<div class="empty-state">今天暂时没有重点事件</div>';bindCards(host);
  $('#more-count').textContent=`${more.length} 条`;
  const moreHost=$('#more-headlines');moreHost.innerHTML=more.map(compactItemHtml).join('')||'<div class="empty-state">暂无更多资讯</div>';bindCards(moreHost);
  renderLive();
}

function matchIdeaFilter(x,filter){
  if(filter==='全部')return true;if(filter==='港股'||filter==='美股')return x.market===filter;if(filter==='宏观')return x.market==='宏观'||x.type==='宏观';if(filter==='IPO')return x.type==='IPO';if(filter==='财报')return x.type==='财报';return true;
}
function filteredIdeas(){
  const q=state.query.trim().toLowerCase();return prioritySorted().filter(x=>matchIdeaFilter(x,state.ideaFilter)).filter(x=>{
    if(!q)return true;const hay=[x.title,x.conclusion,x.whyImportant,x.sourceName,...(x.impact||[]),...(x.contentDirection||[])].join(' ').toLowerCase();return hay.includes(q)
  });
}
function renderIdeaFilters(){
  const host=$('#idea-filters');if(!host)return;host.innerHTML=ideaFilters.map(v=>`<button type="button" class="filter-pill ${state.ideaFilter===v?'active':''}" data-idea-filter="${esc(v)}">${esc(v)}</button>`).join('');
  host.onclick=e=>{const b=e.target.closest('[data-idea-filter]');if(!b)return;state.ideaFilter=b.dataset.ideaFilter;renderIdeaFilters();renderIdeas()};
}
function renderIdeas(){const list=filteredIdeas();$('#idea-count').textContent=`${list.length} 条`;const host=$('#event-list');host.innerHTML=list.map(compactItemHtml).join('')||'<div class="empty-state">没有找到相关选题</div>';bindCards(host)}

function angleLabel(x){const map={财报:'增长与估值',IPO:'申购与上市逻辑',宏观:'利率与资产价格','公司事件':'公司与产业链影响',日历:'市场预期与时间节点'};return map[x.type]||'市场影响'}
function titleSuggestions(x){
  const impact=(x.impact||[])[0]||x.market;
  const short=trimText(x.title,24);
  const list=[trimText(x.title,42),`${short}，对${impact}意味着什么？`,`别只看标题：${trimText(x.title,20)}背后的${angleLabel(x)}`];
  return [...new Set(list)].slice(0,3);
}
function openingDraft(x){
  const who=impactText(x);const user=x.userValue||`真正需要看的，是这件事会如何影响${who}。`;
  return `先说结论：${x.conclusion} 对投资者来说，真正值得关注的不是标题本身，而是它接下来会如何影响${who}。${user}`;
}
function nextFocus(x){
  const action=cleanAction(x.suggestedAction||'');
  const parts=action.split(/[；;]/).map(s=>s.trim()).filter(Boolean);
  const found=parts.find(p=>/继续|跟踪|关注|开盘后|上市后|后续|等待|观察/.test(p));
  if(found)return found.replace(/^继续跟踪/,'接下来关注').replace(/^继续关注/,'接下来关注');
  const targets=(x.impact||[]).slice(0,2).join('、')||'相关资产';
  return `接下来关注${targets}的市场反应，以及一级信源是否有新增披露。`;
}
function outlineSteps(x){return [
  {n:'01',title:'先把事实说清楚',text:x.conclusion},
  {n:'02',title:'再解释为什么重要',text:x.whyImportant},
  {n:'03',title:'落到用户身上',text:x.userValue||`重点看它会如何影响${impactText(x)}。`},
  {n:'04',title:'最后看下一步',text:nextFocus(x)}
]}
function correctionNote(x){return /shein/i.test(`${x.id||''} ${x.title||''}`)?'<div class="correction-note"><b>核验备注</b><p>这条信息曾把“交易安排发布日”误读为“上市交易日”，回到HKEX原文后已纠正为计划9月1日开始交易。</p></div>':''}

function buildCopyText(x){
  const titles=titleSuggestions(x),steps=outlineSteps(x);
  return [`【标题建议】\n${titles.map((v,i)=>`${i+1}. ${v}`).join('\n')}`,`【开头】\n${openingDraft(x)}`,`【文章逻辑】\n${steps.map(s=>`${s.n} ${s.title}\n${s.text}`).join('\n\n')}`,(x.coreData||[]).length?`【关键数据】\n${x.coreData.map(v=>`- ${v}`).join('\n')}`:'',`【一级信源】\n${x.sourceName||''}\n${x.sourceUrl||''}`].filter(Boolean).join('\n\n')
}
async function copyWritingPackage(){
  const x=state.selected;if(!x)return;const text=buildCopyText(x);
  try{await navigator.clipboard.writeText(text);showToast('整套写作内容已复制')}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();showToast('整套写作内容已复制')}
}

function renderDetail(){
  const x=state.selected||state.events[0];if(!x)return;
  const titles=titleSuggestions(x),steps=outlineSteps(x);
  $('#detail-container').innerHTML=`<article class="reader-detail">
    <div class="detail-kicker">这篇怎么写</div>
    <h2>${esc(x.title)}</h2>
    <p class="reader-lead">${esc(x.conclusion)}</p>
    <div class="detail-actions"><button type="button" class="copy-btn" data-copy-package>复制整套</button><span>标题、开头、提纲、数据、信源一起复制</span></div>

    <section class="writing-section first-writing"><h3>标题建议</h3><div class="title-options">${titles.map((v,i)=>`<div class="title-option"><span>${i+1}</span><p>${esc(v)}</p></div>`).join('')}</div></section>
    <section class="writing-section"><h3>开头怎么写</h3><div class="opening-draft">${esc(openingDraft(x))}</div></section>
    <section class="writing-section"><h3>文章逻辑</h3><div class="outline-list">${steps.map(s=>`<div class="outline-step"><span>${s.n}</span><div><b>${esc(s.title)}</b><p>${esc(s.text)}</p></div></div>`).join('')}</div></section>
    <section class="writing-section data-section"><h3>关键数据</h3>${x.keyNumber?`<div class="key-number">${esc(x.keyNumber)}</div>`:''}<ul>${(x.coreData||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>
    <section class="writing-section source-section"><h3>一级信源</h3><div class="source-name">${esc(x.sourceName||'')}</div><div class="source-status">${x.verified?'关键事实已核验':'正式发布前仍需核验'}</div><a class="source-link" target="_blank" rel="noopener" href="${esc(x.sourceUrl||'#')}">打开原文 ↗</a>${x.secondaryUrl?`<a class="source-link secondary-source" target="_blank" rel="noopener" href="${esc(x.secondaryUrl)}">辅助信源 ↗</a>`:''}</section>
    ${correctionNote(x)}
  </article>`
}

function renderWatchlist(){
  const groups=$('#watch-groups');groups.innerHTML=Object.entries(state.watchlist).map(([group,items])=>`<div class="watch-group"><h3>${esc(group)}</h3><div class="watch-tags">${items.map((v,i)=>`<span class="watch-tag">${esc(v)}<button data-remove="${esc(group)}|${i}" aria-label="删除 ${esc(v)}">×</button></span>`).join('')}</div></div>`).join('');
  groups.onclick=e=>{const b=e.target.closest('[data-remove]');if(!b)return;const [g,i]=b.dataset.remove.split('|');state.watchlist[g].splice(Number(i),1);saveWatchlist();renderWatchlist()};
  const keys=Object.values(state.watchlist).flat().map(v=>v.toLowerCase());const matched=dailySorted().filter(x=>{const hay=[x.title,x.conclusion,x.whyImportant,...(x.impact||[])].join(' ').toLowerCase();return keys.some(k=>hay.includes(k))});
  $('#watch-match-count').textContent=`${matched.length} 条`;const host=$('#watch-events');host.innerHTML=matched.map(compactItemHtml).join('')||'<div class="empty-state">暂无相关变化</div>';bindCards(host)
}
function initSearchAndWatch(){
  $('#search-input')?.addEventListener('input',e=>{state.query=e.target.value;renderIdeas()});
  $('#watch-add-form')?.addEventListener('submit',e=>{e.preventDefault();const type=$('#watch-add-type').value,input=$('#watch-add-input'),value=input.value.trim();if(!value)return;state.watchlist[type]=state.watchlist[type]||[];if(!state.watchlist[type].some(v=>v.toLowerCase()===value.toLowerCase()))state.watchlist[type].push(value);saveWatchlist();input.value='';renderWatchlist();showToast('已添加关注')});
  $('#reset-watchlist')?.addEventListener('click',()=>{state.watchlist=structuredClone(defaultWatchlist);saveWatchlist();renderWatchlist();showToast('已恢复示例关注')});
}

document.addEventListener('DOMContentLoaded',()=>{initNav();initSearchAndWatch();loadData().then(()=>{if(state.data)route(location.hash.replace('#','')||'radar')})});
