const state={data:null,events:[],market:'全部',type:'全部',selected:null,watchlist:null};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const pageNames={radar:'今日雷达',detail:'事件详情',watchlist:'我的关注',daily:'每日精选',workbench:'内容工作台'};
const defaultWatchlist={股票:['NVDA','9988.HK','BABA'],人物:['Kevin Warsh','Jensen Huang'],机构:['Berkshire Hathaway'],主题:['美联储','AI','港股IPO']};

async function loadData(){
  try{const r=await fetch(`./data/events.json?v=${Date.now()}`);state.data=await r.json();state.events=state.data.events||[];state.selected=state.events[0]||null;renderAll();$('#updated-at').textContent=`内容数据更新 ${new Date(state.data.generatedAt).toLocaleString('zh-CN',{hour12:false})}`}
  catch(e){console.error(e);$('#updated-at').textContent='数据加载失败';showToast('数据加载失败，请稍后重试')}
}
function showToast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function esc(v=''){return String(v).replace(/[&<>'\x22]/g,m=>({38:'&amp;',60:'&lt;',62:'&gt;',39:'&#39;',34:'&quot;'}[m.charCodeAt(0)]))}
function route(page){
  page=pageNames[page]?page:'radar';$$('.page').forEach(x=>x.classList.remove('active'));$(`#page-${page}`).classList.add('active');$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#page-title').textContent=pageNames[page];location.hash=page;window.scrollTo({top:0,behavior:'smooth'});if(page==='detail')renderDetail();
}
function initNav(){
  $('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)route(b.dataset.page)});
  window.addEventListener('hashchange',()=>route(location.hash.replace('#','')||'radar'));
  $('#refresh-btn').addEventListener('click',()=>{showToast('正在刷新内容数据');loadData()});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-demo-page]');if(!b)return;route(b.dataset.demoPage)});
}
function getWatchlist(){try{return JSON.parse(localStorage.getItem('marketDiaryWatchlist'))||structuredClone(defaultWatchlist)}catch{return structuredClone(defaultWatchlist)}}
function saveWatchlist(){localStorage.setItem('marketDiaryWatchlist',JSON.stringify(state.watchlist))}
function renderAll(){state.watchlist=getWatchlist();renderHeroOpportunities();renderFilters();renderEvents();renderDetail();renderWatchlist();renderDaily();renderWorkbench()}
function filtered(){return state.events.filter(x=>(state.market==='全部'||x.market===state.market)&&(state.type==='全部'||x.type===state.type)).sort((a,b)=>b.priorityScore-a.priorityScore)}
function humanCheckText(x){return x.verified?'已核验':'待核验'}
function isShein(x){return /shein/i.test(`${x.id||''} ${x.title||''}`)}
function humanCheckFlowHtml(x,compact=false){
  const verified=Boolean(x.verified);const c=compact?' compact':'';
  return `<div class="human-flow${c}"><span class="done">✓ AI已处理</span><i>→</i><span class="${verified?'done':'active'}">${verified?'✓':'●'} Human Check</span><i>→</i><span class="${verified?'done':'pending'}">${verified?'✓':'○'} 已核验</span>${isShein(x)?'<em>纠错案例</em>':''}</div>`
}
function contentTags(items=[]){return items.map(v=>`<span>${esc(v)}</span>`).join('')}
function cardHtml(x){
  return `<article class="event-card editorial-card" data-event="${esc(x.id)}">
    <div class="card-priority"><div class="priority ${esc(x.priority)}">${esc(x.priority)}</div><small>${esc(x.priorityScore)}分</small></div>
    <div class="card-main">
      <div class="event-meta"><span class="tag">${esc(x.market)}</span><span class="tag">${esc(x.type)}</span><span class="tag source">${x.verified?'✓ 一级信源':'待核验'}</span>${isShein(x)?'<span class="tag correction">Human Check纠错</span>':''}</div>
      <h3>${esc(x.title)}</h3>
      <div class="card-block"><b>一句话结论</b><p>${esc(x.conclusion)}</p></div>
      <div class="card-block why"><b>为什么重要</b><p>${esc(x.whyImportant)}</p></div>
      <div class="card-footer-grid">
        <div><b>影响对象</b><div class="inline-tags">${(x.impact||[]).map(v=>`<span>${esc(v)}</span>`).join('')}</div></div>
        <div><b>内容形式</b><div class="inline-tags content">${contentTags(x.contentDirection||[])}</div></div>
        <div class="source-cell"><b>一级信源</b><span>${esc(x.sourceName)}</span></div>
      </div>
      ${humanCheckFlowHtml(x,true)}
    </div>
  </article>`
}
function bindCards(container){if(!container)return;container.onclick=e=>{const c=e.target.closest('[data-event]');if(!c)return;state.selected=state.events.find(x=>x.id===c.dataset.event)||state.selected;renderDetail();route('detail')}}
function renderHeroOpportunities(){
  const top=[...state.events].filter(x=>x.priority==='S'||x.priority==='A').sort((a,b)=>b.priorityScore-a.priorityScore).slice(0,5);
  const s=top.filter(x=>x.priority==='S').length,a=top.filter(x=>x.priority==='A').length;$('#hero-count').textContent=top.length;const host=$('#hero-opportunities');host.innerHTML=top.map(cardHtml).join('')||'<div class="detail-panel">暂无S/A级内容机会</div>';bindCards(host);const count=$('.compact-score small');if(count)count.textContent=`${s}条S级 · ${a}条A级`;
}
function renderFilters(){
  const markets=['全部',...new Set(state.events.map(x=>x.market))],types=['全部',...new Set(state.events.map(x=>x.type))];
  $('#market-filters').innerHTML=markets.map(x=>`<button class="chip ${state.market===x?'active':''}" data-filter-market="${esc(x)}">${esc(x)}</button>`).join('');
  $('#type-filters').innerHTML=types.map(x=>`<button class="chip ${state.type===x?'active':''}" data-filter-type="${esc(x)}">${esc(x)}</button>`).join('');
  $('#market-filters').onclick=e=>{const b=e.target.closest('[data-filter-market]');if(!b)return;state.market=b.dataset.filterMarket;renderFilters();renderEvents()};
  $('#type-filters').onclick=e=>{const b=e.target.closest('[data-filter-type]');if(!b)return;state.type=b.dataset.filterType;renderFilters();renderEvents()};
}
function renderEvents(){const list=filtered();$('#event-list').innerHTML=list.map(cardHtml).join('')||'<div class="detail-panel">暂无匹配事件</div>';bindCards($('#event-list'))}
function aiSteps(x){return String(x.aiAssist||'').replace(/[。；]/g,'、').split('、').map(v=>v.trim()).filter(Boolean).slice(0,5)}
function humanCheckNote(x){
  if(isShein(x))return 'Human Check发现“8月28日交易安排发布日”不能等同于“上市交易日”，回到HKEX后纠正为计划9月1日开始交易。';
  if(x.verified)return `已回到${x.sourceName}核对关键数字、日期与口径；AI只保留加工和内容决策辅助角色。`;
  return `当前仍需回到${x.sourceName||'一级信源'}核对关键数字、日期与原始措辞，核验完成前不进入正式发布。`;
}
function renderDetail(){
  const x=state.selected||state.events[0];if(!x)return;
  const updated=state.data?.generatedAt?new Date(state.data.generatedAt).toLocaleString('zh-CN',{hour12:false}):'—';
  $('#detail-container').innerHTML=`
  <div class="detail-hero editorial-detail"><div class="detail-top"><div><div class="event-meta"><span class="tag">${esc(x.market)}</span><span class="tag">${esc(x.type)}</span><span class="tag source">${x.verified?'✓ 一级信源已核验':'待Human Check'}</span>${isShein(x)?'<span class="tag correction">纠错案例</span>':''}</div><h2>${esc(x.title)}</h2><p>${esc(x.conclusion)}</p></div><div class="priority ${esc(x.priority)} detail-priority">${esc(x.priority)}</div></div></div>
  <section id="human-check-panel" class="human-check-panel"><div class="human-title"><div><span>HUMAN CHECK</span><h3>AI处理完，不等于可以直接发布</h3></div><strong class="${x.verified?'verified-text':'pending-text'}">${humanCheckText(x)}</strong></div>${humanCheckFlowHtml(x)}<p>${esc(humanCheckNote(x))}</p></section>
  <div class="detail-grid editorial-grid">
    <div class="detail-panel"><h3>为什么重要</h3><p>${esc(x.whyImportant)}</p><h3 class="panel-subtitle">影响对象</h3><div class="watch-tags">${(x.impact||[]).map(v=>`<span class="watch-tag">${esc(v)}</span>`).join('')}</div></div>
    <div class="detail-panel"><h3>运营下一步怎么用</h3><p class="action-copy"><b>${esc(x.suggestedAction)}</b></p><div class="content-actions">${contentTags(x.contentDirection||[])}</div><h3 class="panel-subtitle">用户价值</h3><p>${esc(x.userValue)}</p></div>
    <div class="detail-panel"><h3>AI具体做了什么</h3><ol class="ai-step-list">${aiSteps(x).map(v=>`<li>${esc(v)}</li>`).join('')}</ol><p class="tiny-note">AI不补数字、不替代原始信源、不做最终发布判断。</p></div>
    <div class="detail-panel"><h3>一级信源与核心数据</h3><div class="key-number">${esc(x.keyNumber)}</div><ul>${(x.coreData||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul><div class="source-status-line"><span>核验状态：<b>${humanCheckText(x)}</b></span><span>内容数据最后更新：${esc(updated)}</span></div><a class="source-link" target="_blank" rel="noopener" href="${x.sourceUrl}">打开一级信源 ↗</a>${x.secondaryUrl?`<a class="source-link" target="_blank" rel="noopener" href="${x.secondaryUrl}">打开辅助信源 ↗</a>`:''}</div>
  </div>
  <div class="score-box editorial-score">${Object.entries(x.scores||{}).map(([k,v])=>`<div><b>${v}</b><small>${({impact:'影响范围',attention:'用户关注',increment:'信息增量',timeliness:'时效性',conversion:'内容转化'})[k]||k}</small></div>`).join('')}</div>`
}
function renderWatchlist(){
  $('#watch-groups').innerHTML=Object.entries(state.watchlist).map(([group,items])=>`<div class="watch-group"><h3>${esc(group)}</h3><div class="watch-tags">${items.map((v,i)=>`<span class="watch-tag">${esc(v)}<button data-remove="${esc(group)}|${i}">×</button></span>`).join('')}</div></div>`).join('');
  $('#watch-groups').onclick=e=>{const b=e.target.closest('[data-remove]');if(!b)return;const [g,i]=b.dataset.remove.split('|');state.watchlist[g].splice(Number(i),1);saveWatchlist();renderWatchlist()};
  const keys=Object.values(state.watchlist).flat().map(v=>v.toLowerCase());const matched=state.events.filter(x=>{const hay=[x.title,x.conclusion,...(x.impact||[])].join(' ').toLowerCase();return keys.some(k=>hay.includes(k))});
  $('#watch-match-count').textContent=`${matched.length}条变化与演示关注相关`;$('#watch-events').innerHTML=matched.map(cardHtml).join('')||'<div class="detail-panel">暂无匹配事件</div>';bindCards($('#watch-events'));
}
function renderDaily(){const list=[...state.events].sort((a,b)=>b.priorityScore-a.priorityScore).slice(0,10);$('#daily-list').innerHTML=list.map(x=>`<div class="daily-item"><div><h3>${esc(x.title)}</h3><p>${esc(x.conclusion)} <b>为什么重要：</b>${esc(x.whyImportant)}</p></div><div class="next">${esc(x.priority)}级 · ${esc((x.contentDirection||[]).slice(0,2).join(' / '))}</div></div>`).join('')}
function renderWorkbench(){
  const rows=[...state.events].sort((a,b)=>b.priorityScore-a.priorityScore);
  const cols=[['time','时间'],['market','市场'],['title','事件'],['conclusion','一句话结论'],['whyImportant','为什么重要'],['impact','影响对象'],['contentDirection','内容方向'],['sourceName','一级信源'],['humanCheck','Human Check'],['priority','优先级'],['suggestedAction','建议动作'],['aiAssist','AI辅助方式']];
  $('#workbench-table').innerHTML=`<thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(x=>`<tr>${cols.map(([k])=>{let v=x[k];if(k==='humanCheck')v=humanCheckText(x);if(Array.isArray(v))v=v.join(' / ');if(k==='priority')return `<td class="table-priority">${esc(v)} · ${x.priorityScore}</td>`;if(k==='sourceName')return `<td>${x.verified?'✓ ':''}${esc(v)}</td>`;if(k==='humanCheck')return `<td><span class="table-check ${x.verified?'done':'pending'}">${esc(v)}</span>${isShein(x)?'<br><small>含日期纠错</small>':''}</td>`;return `<td>${esc(v)}</td>`}).join('')}</tr>`).join('')}</tbody>`;
  const mobile=$('#workbench-mobile');
  if(mobile){
    mobile.innerHTML=rows.map(x=>`<article class="workbench-mobile-card" data-event="${esc(x.id)}"><div class="wm-top"><div><div class="event-meta"><span class="tag">${esc(x.market)}</span><span class="tag">${esc(x.type)}</span></div><h3>${esc(x.title)}</h3></div><span class="wm-priority">${esc(x.priority)} · ${esc(x.priorityScore)}</span></div><p>${esc(x.conclusion)}</p><div class="wm-meta"><span>${x.verified?'✓ 已核验':'● 待Human Check'}</span><span>${esc((x.contentDirection||[]).slice(0,2).join(' / '))}</span><span>${esc(x.sourceName)}</span></div><div class="wm-action"><b>下一步：</b>${esc(x.suggestedAction)}</div></article>`).join('');
    bindCards(mobile);
  }
}

document.addEventListener('DOMContentLoaded',()=>{initNav();$('#reset-watchlist').addEventListener('click',()=>{state.watchlist=structuredClone(defaultWatchlist);saveWatchlist();renderWatchlist();showToast('已恢复演示关注')});loadData().then(()=>{const p=location.hash.replace('#','')||'radar';route(p)})});
