const state={data:null,events:[],live:null,selected:null,watchlist:null,returnPage:'radar',ideaFilter:'全部',query:''};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const pageNames={radar:'今日',detail:'详情',watchlist:'关注',workbench:'选题'};
const defaultWatchlist={股票:['NVDA','9988.HK','BABA'],人物:['Kevin Warsh','Jensen Huang'],机构:['Berkshire Hathaway'],主题:['美联储','AI','港股IPO']};
const ideaFilters=['全部','港股','美股','宏观','IPO','财报'];

async function loadData(){
  try{
    const [eventsRes,liveRes]=await Promise.allSettled([
      fetch(`./data/events.json?v=${Date.now()}`).then(r=>{if(!r.ok)throw new Error('events');return r.json()}),
      fetch(`./data/ai-candidates.json?v=${Date.now()}`).then(r=>{if(!r.ok)throw new Error('live');return r.json()})
    ]);
    if(eventsRes.status!=='fulfilled')throw new Error('events unavailable');
    state.data=eventsRes.value;state.events=state.data.events||[];state.live=liveRes.status==='fulfilled'?liveRes.value:null;state.selected=dailySorted()[0]||state.events[0]||null;
    updateFreshness();renderAll();document.documentElement.classList.add('app-ready');
  }catch(e){
    console.error(e);$('#updated-at').textContent='加载失败';$('#freshness-note').textContent='数据暂时无法加载，请稍后刷新';showToast('数据加载失败，请稍后重试');
  }
}
function showToast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function esc(v=''){return String(v).replace(/[&<>'\x22]/g,m=>({38:'&amp;',60:'&lt;',62:'&gt;',39:'&#39;',34:'&quot;'}[m.charCodeAt(0)]))}
function currentPage(){return document.querySelector('.page.active')?.id?.replace('page-','')||'radar'}
function route(page){
  page=pageNames[page]?page:'radar';$$('.page').forEach(x=>x.classList.remove('active'));$(`#page-${page}`)?.classList.add('active');
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#page-title')?.replaceChildren(document.createTextNode(pageNames[page]));
  if(location.hash!==`#${page}`)history.pushState(null,'',`#${page}`);window.scrollTo({top:0,behavior:'smooth'});if(page==='detail')renderDetail();
}
function initNav(){
  $('#nav')?.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)route(b.dataset.page)});
  document.addEventListener('click',e=>{
    const jump=e.target.closest('[data-jump]');if(jump){e.preventDefault();route(jump.dataset.jump);return}
    const copy=e.target.closest('[data-copy-card]');if(copy){copyWritingCard();return}
  });
  window.addEventListener('popstate',()=>route(location.hash.replace('#','')||'radar'));
  $('#refresh-btn')?.addEventListener('click',()=>{showToast('正在刷新');loadData()});
  $('#back-btn')?.addEventListener('click',()=>route(state.returnPage||'radar'));
}
function updateFreshness(){
  const candidates=[state.data?.generatedAt,state.live?.generatedAt].filter(Boolean).map(v=>new Date(v)).filter(d=>!Number.isNaN(d.getTime()));
  const latest=candidates.sort((a,b)=>b-a)[0];if(!latest)return;
  const now=new Date(),sameDay=latest.toDateString()===now.toDateString();const time=latest.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  $('#updated-at').textContent=sameDay?`更新 ${time}`:`${latest.getMonth()+1}/${latest.getDate()} ${time}`;
  $('#freshness-note').textContent=sameDay?`最新信息更新至 ${time}`:`最近更新：${latest.getMonth()+1}月${latest.getDate()}日 ${time}`;
  const dateEl=$('#today-date');if(dateEl)dateEl.textContent=now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
}
function getWatchlist(){try{return JSON.parse(localStorage.getItem('marketDiaryWatchlist'))||structuredClone(defaultWatchlist)}catch{return structuredClone(defaultWatchlist)}}
function saveWatchlist(){localStorage.setItem('marketDiaryWatchlist',JSON.stringify(state.watchlist))}
function cleanAction(v=''){return String(v).replace(/^[SAB]级\s*[｜|]\s*/,'').trim()}
function contentLabels(x){return (x.contentDirection||[]).slice(0,3)}
function firstContentLabel(x){return contentLabels(x)[0]||'继续观察'}
function eventDate(x){if(!x?.date)return null;const d=new Date(`${x.date}T00:00:00`);return Number.isNaN(d.getTime())?null:d}
function dailyRankScore(x){
  let score=Number(x.priorityScore||0);const d=eventDate(x);if(!d)return score;
  const today=new Date();today.setHours(0,0,0,0);const delta=Math.round((d-today)/86400000);
  if(delta===0)score+=32;else if(delta===1)score+=18;else if(delta===2||delta===3)score+=10;else if(delta===-1)score+=18;else if(delta>=-3)score+=8;else if(delta<=-6)score-=18;else score-=6;
  if(x.heat==='高')score+=2;return score;
}
function dailySorted(){return [...state.events].sort((a,b)=>dailyRankScore(b)-dailyRankScore(a)||(b.priorityScore||0)-(a.priorityScore||0))}
function prioritySorted(){return [...state.events].sort((a,b)=>(b.priorityScore||0)-(a.priorityScore||0))}
function renderAll(){state.watchlist=getWatchlist();renderToday();renderLiveDiscoveries();renderIdeaFilters();renderIdeas();renderDetail();renderWatchlist()}

function storyCardHtml(x,index){
  return `<article class="story-card" data-event="${esc(x.id)}" role="button" tabindex="0" aria-label="查看 ${esc(x.title)}">
    <div class="story-top"><span class="story-rank">${index+1}</span><div class="story-meta"><span>${esc(x.market)}</span><span>${esc(x.type)}</span>${x.verified?'<span class="verified-mini">已核验</span>':''}</div><span class="story-arrow">›</span></div>
    <h3>${esc(x.title)}</h3>
    <p class="story-summary">${esc(x.conclusion)}</p>
    <div class="story-why"><b>为什么重要</b><p>${esc(x.whyImportant)}</p></div>
    <div class="story-write"><b>适合写</b><div>${contentLabels(x).map(v=>`<span>${esc(v)}</span>`).join('')}</div></div>
  </article>`
}
function compactItemHtml(x){
  return `<article class="feed-item" data-event="${esc(x.id)}" role="button" tabindex="0" aria-label="查看 ${esc(x.title)}">
    <div class="feed-copy"><div class="feed-meta"><span>${esc(x.market)}</span><span>${esc(x.type)}</span></div><h4>${esc(x.title)}</h4><p>${esc(x.conclusion)}</p></div>
    <div class="feed-side"><span class="feed-angle">${esc(firstContentLabel(x))}</span><span class="feed-arrow">›</span></div>
  </article>`
}
function bindCards(container){
  if(!container)return;
  const open=target=>{const c=target.closest('[data-event]');if(!c)return;const page=currentPage();state.returnPage=page==='detail'?'radar':page;state.selected=state.events.find(x=>x.id===c.dataset.event)||state.selected;renderDetail();route('detail')};
  container.onclick=e=>open(e.target);
  container.onkeydown=e=>{if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest('[data-event]');if(!c)return;e.preventDefault();open(c)};
}
function renderToday(){
  const all=dailySorted(),top=all.slice(0,3),more=all.slice(3,10);$('#hero-count').textContent=top.length;
  const host=$('#hero-opportunities');host.innerHTML=top.map((x,i)=>storyCardHtml(x,i)).join('')||'<div class="empty-state">今天暂时没有重点事件</div>';bindCards(host);
  const moreHost=$('#more-headlines');moreHost.innerHTML=more.map(compactItemHtml).join('')||'<div class="empty-state">暂无其他事件</div>';bindCards(moreHost);
}

function clipText(v='',n=62){const s=String(v).replace(/https?:\/\/\S+/g,'').replace(/&nbsp;?/gi,' ').replace(/\s+/g,' ').trim();return s.length>n?`${s.slice(0,n-1)}…`:s}
function sourceShort(v=''){if(/HKEX/i.test(v))return '港交所';if(/Federal Reserve/i.test(v))return '美联储';if(/SEC/i.test(v))return 'SEC';return String(v).split('·')[0].trim()||'官方信源'}
function humanLiveTitle(x){
  const raw=clipText(x.ai?.summary||x.title||'',90);if(/[\u3400-\u9fff]/.test(raw))return raw;
  if(/Report on Initial Public Offering Applications, Delisting and Suspensions/i.test(raw))return '港交所发布最新IPO申请、除牌及停牌报告';
  if(/Minutes of the Board's discount rate meetings/i.test(raw))return '美联储公布贴现率会议纪要';
  const debut=raw.match(/HKEX Enhances Product Offering with (.+?) Debut/i);if(debut)return `${debut[1]}上市，港交所更新相关产品安排`;
  if(/Warsh,\s*In Our Time/i.test(raw))return 'Warsh杰克逊霍尔讲话：重新审视前瞻指引';
  if(/financial results|earnings/i.test(raw))return `${sourceShort(x.source)}发布最新业绩`;return `${sourceShort(x.source)}：${clipText(raw,56)}`;
}
function liveAge(v=''){const t=Date.parse(v);if(!Number.isFinite(t))return '';const h=Math.max(0,(Date.now()-t)/36e5);if(h<1)return '刚刚';if(h<24)return `${Math.round(h)}小时前`;if(h<48)return '昨天';return `${Math.round(h/24)}天前`}
function duplicateWithCurated(x){
  const raw=`${x.title||''} ${x.ai?.summary||''}`.toLowerCase();const stop=new Set(['report','initial','public','offering','applications','market','financial','results','latest','news','release','board','meetings','product','with','from','august','september']);
  const keys=(raw.match(/[a-z][a-z0-9.-]{4,}/g)||[]).filter(k=>!stop.has(k));if(!keys.length)return false;
  return state.events.some(e=>{const t=`${e.title||''} ${e.conclusion||''}`.toLowerCase();return keys.some(k=>t.includes(k))});
}
function recentLiveItems(){
  const cutoff=Date.now()-8*86400000;
  return (state.live?.items||[]).filter(x=>x.trustTier==='A'&&x.signal!=='热点').filter(x=>{const t=Date.parse(x.pubDate);return Number.isFinite(t)&&t>=cutoff}).filter(x=>!duplicateWithCurated(x)).sort((a,b)=>Date.parse(b.pubDate)-Date.parse(a.pubDate)||(b.score||0)-(a.score||0)).slice(0,3)
}
function renderLiveDiscoveries(){
  const wrap=$('#live-discovery-wrap'),host=$('#live-discoveries');if(!wrap||!host)return;const items=recentLiveItems();
  if(!items.length){wrap.hidden=true;host.innerHTML='';return}wrap.hidden=false;
  host.innerHTML=items.map(x=>`<a class="live-item" href="${esc(x.link||'#')}" target="_blank" rel="noopener"><div class="live-copy"><div><span>${esc(x.market||'市场')}</span><em>新</em></div><b>${esc(humanLiveTitle(x))}</b></div><div class="live-side"><span>${esc(liveAge(x.pubDate))}</span><small>${esc(sourceShort(x.source))}</small><i>待核验</i></div></a>`).join('')
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
function renderIdeas(){
  const list=filteredIdeas();$('#idea-count').textContent=`${list.length} 条`;const host=$('#event-list');host.innerHTML=list.map(compactItemHtml).join('')||'<div class="empty-state">没有找到相关选题</div>';bindCards(host)
}
function correctionNote(x){return /shein/i.test(`${x.id||''} ${x.title||''}`)?'<div class="correction-note"><b>这条信息做过一次日期纠错</b><p>最初把“8月28日交易安排发布日”理解成“上市交易日”，回到HKEX核验后改为计划9月1日开始交易。</p></div>':''}
function outlineData(x){return (x.coreData||[]).slice(0,3).join('；')}
function buildCopyText(x){
  return [`【标题建议】\n${x.title}`,`【开头】\n${x.conclusion}`,`【核心解释】\n${x.whyImportant}`,outlineData(x)?`【数据支撑】\n${(x.coreData||[]).slice(0,4).map(v=>`- ${v}`).join('\n')}`:'',`【内容形式】\n${contentLabels(x).join(' / ')||'继续观察'}`,cleanAction(x.suggestedAction)?`【收束与下一步】\n${cleanAction(x.suggestedAction)}`:'',x.userValue?`【用户关心】\n${x.userValue}`:'',`【一级信源】\n${x.sourceName||''}\n${x.sourceUrl||''}`].filter(Boolean).join('\n\n')
}
async function copyWritingCard(){
  const x=state.selected;if(!x)return;const text=buildCopyText(x);
  try{await navigator.clipboard.writeText(text);showToast('成文提纲已复制')}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();showToast('成文提纲已复制')}
}
function renderDetail(){
  const x=state.selected||state.events[0];if(!x)return;const action=cleanAction(x.suggestedAction),dataText=outlineData(x);
  $('#detail-container').innerHTML=`<article class="reader-detail">
    <div class="reader-meta"><span>${esc(x.market)}</span><span>${esc(x.type)}</span><span class="${x.verified?'checked':'pending'}">${x.verified?'已核验':'待核验'}</span></div>
    <h2>${esc(x.title)}</h2>
    <p class="reader-lead">${esc(x.conclusion)}</p>
    <div class="detail-actions"><button type="button" class="copy-btn" data-copy-card>复制并继续写</button><span>直接粘贴到任意写作工具继续成文</span></div>
    ${correctionNote(x)}
    <section class="writing-card"><div class="writing-card-title"><span>成文提纲</span><small>已经替你排好顺序</small></div>
      <div class="writing-row"><b>内容形式</b><div class="content-actions">${contentLabels(x).map(v=>`<span>${esc(v)}</span>`).join('')}</div></div>
      <div class="writing-outline">
        <div><span>1</span><p><b>开头</b>${esc(x.conclusion)}</p></div>
        <div><span>2</span><p><b>展开</b>${esc(x.whyImportant)}</p></div>
        ${dataText?`<div><span>3</span><p><b>数据</b>${esc(dataText)}</p></div>`:''}
        ${action?`<div><span>${dataText?'4':'3'}</span><p><b>收束</b>${esc(action)}</p></div>`:''}
      </div>
      ${x.userValue?`<div class="writing-user"><b>用户真正关心</b><p>${esc(x.userValue)}</p></div>`:''}
      ${(x.impact||[]).length?`<div class="reader-tags">${x.impact.map(v=>`<span>${esc(v)}</span>`).join('')}</div>`:''}
    </section>
    <section class="reader-block fact-block"><h3>关键数据</h3>${x.keyNumber?`<div class="key-number">${esc(x.keyNumber)}</div>`:''}<ul>${(x.coreData||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>
    <section class="reader-block source-block"><h3>来源</h3><div class="source-name">${esc(x.sourceName||'')}</div><div class="source-status">${x.verified?'关键事实已核验':'发布前仍需核验'}</div><a class="source-link" target="_blank" rel="noopener" href="${esc(x.sourceUrl||'#')}">一级信源 ↗</a>${x.secondaryUrl?`<a class="source-link" target="_blank" rel="noopener" href="${esc(x.secondaryUrl)}">辅助信源 ↗</a>`:''}</section>
    <details class="process-note"><summary>信息说明</summary><p>系统先做聚合、去重和整理；关键数字、日期和原始措辞仍以一级信源为准。</p></details>
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
