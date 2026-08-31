const state={data:null,events:[],market:'全部',type:'全部',selected:null,watchlist:null,returnPage:'radar'};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const pageNames={radar:'今日',detail:'事件详情',watchlist:'我的关注',workbench:'内容池'};
const defaultWatchlist={股票:['NVDA','9988.HK','BABA'],人物:['Kevin Warsh','Jensen Huang'],机构:['Berkshire Hathaway'],主题:['美联储','AI','港股IPO']};

async function loadData(){
  try{
    const r=await fetch(`./data/events.json?v=${Date.now()}`);state.data=await r.json();state.events=state.data.events||[];state.selected=state.events[0]||null;renderAll();
    $('#updated-at').textContent=`更新 ${new Date(state.data.generatedAt).toLocaleString('zh-CN',{hour12:false})}`;
  }catch(e){console.error(e);$('#updated-at').textContent='数据加载失败';showToast('数据加载失败，请稍后重试')}
}
function showToast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function esc(v=''){return String(v).replace(/[&<>'\x22]/g,m=>({38:'&amp;',60:'&lt;',62:'&gt;',39:'&#39;',34:'&quot;'}[m.charCodeAt(0)]))}
function currentPage(){return document.querySelector('.page.active')?.id?.replace('page-','')||'radar'}
function route(page){
  if(page==='daily')page='radar';page=pageNames[page]?page:'radar';
  $$('.page').forEach(x=>x.classList.remove('active'));const target=$(`#page-${page}`);if(target)target.classList.add('active');
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#page-title').textContent=pageNames[page];
  if(location.hash!==`#${page}`)history.pushState(null,'',`#${page}`);window.scrollTo({top:0,behavior:'smooth'});if(page==='detail')renderDetail();
}
function initNav(){
  $('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)route(b.dataset.page)});
  window.addEventListener('popstate',()=>route(location.hash.replace('#','')||'radar'));
  $('#refresh-btn').addEventListener('click',()=>{showToast('正在刷新');loadData()});
  $('#back-btn')?.addEventListener('click',()=>route(state.returnPage||'radar'));
}
function getWatchlist(){try{return JSON.parse(localStorage.getItem('marketDiaryWatchlist'))||structuredClone(defaultWatchlist)}catch{return structuredClone(defaultWatchlist)}}
function saveWatchlist(){localStorage.setItem('marketDiaryWatchlist',JSON.stringify(state.watchlist))}
function renderAll(){state.watchlist=getWatchlist();renderToday();renderFilters();renderContentPool();renderDetail();renderWatchlist()}
function sorted(){return [...state.events].sort((a,b)=>(b.priorityScore||0)-(a.priorityScore||0))}
function filtered(){return sorted().filter(x=>(state.market==='全部'||x.market===state.market)&&(state.type==='全部'||x.type===state.type))}
function isShein(x){return /shein/i.test(`${x.id||''} ${x.title||''}`)}
function contentLabel(x){return (x.contentDirection||[]).slice(0,3).join(' / ')||'继续观察'}
function sourceStatus(x){return x.verified?'已核验':'待核验'}
function simpleCardHtml(x){
  return `<article class="simple-card" data-event="${esc(x.id)}">
    <div class="simple-meta"><span>${esc(x.market)}</span><span>${esc(x.type)}</span><span class="${x.verified?'checked':'pending'}">${x.verified?'✓ 已核验':'● 待核验'}</span></div>
    <h3>${esc(x.title)}</h3>
    <div class="simple-row"><b>发生什么</b><p>${esc(x.conclusion)}</p></div>
    <div class="simple-row"><b>为什么重要</b><p>${esc(x.whyImportant)}</p></div>
    <div class="simple-row action-row"><b>适合怎么写</b><p>${esc(contentLabel(x))}</p></div>
    <div class="simple-source">来源：${esc(x.sourceName||'待补充')}</div>
  </article>`
}
function bindCards(container){
  if(!container)return;container.onclick=e=>{const c=e.target.closest('[data-event]');if(!c)return;state.returnPage=currentPage()==='detail'?'radar':currentPage();state.selected=state.events.find(x=>x.id===c.dataset.event)||state.selected;renderDetail();route('detail')}
}
function renderToday(){
  const all=sorted(),top=all.slice(0,5),more=all.slice(5,11);$('#hero-count').textContent=top.length;
  const host=$('#hero-opportunities');host.innerHTML=top.map(simpleCardHtml).join('')||'<div class="empty-state">今天暂时没有重点事件</div>';bindCards(host);
  const moreHost=$('#more-headlines');moreHost.innerHTML=more.map(x=>`<button class="headline-item" data-event="${esc(x.id)}"><span class="headline-market">${esc(x.market)}</span><b>${esc(x.title)}</b><small>${esc(contentLabel(x).split(' / ')[0])}</small></button>`).join('')||'<div class="empty-state">暂无其他事件</div>';bindCards(moreHost);
}
function renderFilters(){
  const markets=['全部',...new Set(state.events.map(x=>x.market))],types=['全部',...new Set(state.events.map(x=>x.type))];
  $('#market-filters').innerHTML=markets.map(x=>`<button class="chip ${state.market===x?'active':''}" data-filter-market="${esc(x)}">${esc(x)}</button>`).join('');
  $('#type-filters').innerHTML=types.map(x=>`<button class="chip ${state.type===x?'active':''}" data-filter-type="${esc(x)}">${esc(x)}</button>`).join('');
  $('#market-filters').onclick=e=>{const b=e.target.closest('[data-filter-market]');if(!b)return;state.market=b.dataset.filterMarket;renderFilters();renderContentPool()};
  $('#type-filters').onclick=e=>{const b=e.target.closest('[data-filter-type]');if(!b)return;state.type=b.dataset.filterType;renderFilters();renderContentPool()};
}
function renderContentPool(){const host=$('#event-list');const list=filtered();host.innerHTML=list.map(simpleCardHtml).join('')||'<div class="empty-state">暂无匹配内容</div>';bindCards(host)}
function aiSteps(x){return String(x.aiAssist||'').replace(/[。；]/g,'、').split('、').map(v=>v.trim()).filter(Boolean).slice(0,4)}
function correctionNote(x){return isShein(x)?'<div class="correction-note"><b>曾做过一次日期纠错</b><p>最初把“8月28日交易安排发布日”理解成“上市交易日”，回到HKEX核验后改为计划9月1日开始交易。</p></div>':''}
function renderDetail(){
  const x=state.selected||state.events[0];if(!x)return;const updated=state.data?.generatedAt?new Date(state.data.generatedAt).toLocaleString('zh-CN',{hour12:false}):'—';
  $('#detail-container').innerHTML=`
    <article class="reader-detail">
      <div class="reader-meta"><span>${esc(x.market)}</span><span>${esc(x.type)}</span><span class="${x.verified?'checked':'pending'}">${x.verified?'✓ 已核验':'● 待核验'}</span></div>
      <h2>${esc(x.title)}</h2>
      <p class="reader-lead">${esc(x.conclusion)}</p>
      ${correctionNote(x)}
      <div class="reader-grid">
        <section><h3>为什么重要</h3><p>${esc(x.whyImportant)}</p><div class="reader-tags">${(x.impact||[]).map(v=>`<span>${esc(v)}</span>`).join('')}</div></section>
        <section><h3>适合怎么写</h3><div class="content-actions">${(x.contentDirection||[]).map(v=>`<span>${esc(v)}</span>`).join('')}</div><p class="next-action">${esc(x.suggestedAction||'')}</p><p class="muted-copy">${esc(x.userValue||'')}</p></section>
        <section class="source-section"><h3>关键数据与来源</h3><div class="key-number">${esc(x.keyNumber||'')}</div><ul>${(x.coreData||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul><div class="source-line"><span>${esc(sourceStatus(x))}</span><span>数据更新：${esc(updated)}</span></div><a class="source-link" target="_blank" rel="noopener" href="${esc(x.sourceUrl||'#')}">查看一级信源 ↗</a>${x.secondaryUrl?`<a class="source-link" target="_blank" rel="noopener" href="${esc(x.secondaryUrl)}">查看辅助信源 ↗</a>`:''}</section>
      </div>
      <details class="process-note"><summary>这条信息怎么处理的</summary><p>系统先做聚合、去重和整理；关键数字、日期和原始措辞需要回到一级信源确认。</p>${aiSteps(x).length?`<ul>${aiSteps(x).map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:''}</details>
    </article>`
}
function renderWatchlist(){
  $('#watch-groups').innerHTML=Object.entries(state.watchlist).map(([group,items])=>`<div class="watch-group"><h3>${esc(group)}</h3><div class="watch-tags">${items.map((v,i)=>`<span class="watch-tag">${esc(v)}<button data-remove="${esc(group)}|${i}">×</button></span>`).join('')}</div></div>`).join('');
  $('#watch-groups').onclick=e=>{const b=e.target.closest('[data-remove]');if(!b)return;const [g,i]=b.dataset.remove.split('|');state.watchlist[g].splice(Number(i),1);saveWatchlist();renderWatchlist()};
  const keys=Object.values(state.watchlist).flat().map(v=>v.toLowerCase());const matched=sorted().filter(x=>{const hay=[x.title,x.conclusion,x.whyImportant,...(x.impact||[])].join(' ').toLowerCase();return keys.some(k=>hay.includes(k))});
  $('#watch-match-count').textContent=`${matched.length}条与你的关注相关`;const host=$('#watch-events');host.innerHTML=matched.map(simpleCardHtml).join('')||'<div class="empty-state">暂无相关变化</div>';bindCards(host);
}

document.addEventListener('DOMContentLoaded',()=>{
  initNav();$('#reset-watchlist').addEventListener('click',()=>{state.watchlist=structuredClone(defaultWatchlist);saveWatchlist();renderWatchlist();showToast('已恢复示例关注')});
  loadData().then(()=>{const p=location.hash.replace('#','')||'radar';route(p)});
});
