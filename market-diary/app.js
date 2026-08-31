const state={data:null,events:[],market:'全部',type:'全部',selected:null,watchlist:null};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const pageNames={radar:'今日雷达',detail:'事件详情',watchlist:'我的关注',daily:'每日精选',workbench:'内容工作台'};
const defaultWatchlist={股票:['NVDA','9988.HK','BABA'],人物:['Kevin Warsh','Jensen Huang'],主题:['美联储','AI','港股IPO']};

async function loadData(){
  try{const r=await fetch(`./data/events.json?v=${Date.now()}`);state.data=await r.json();state.events=state.data.events||[];state.selected=state.events[0]||null;renderAll();$('#updated-at').textContent=`数据更新 ${new Date(state.data.generatedAt).toLocaleString('zh-CN',{hour12:false})}`}
  catch(e){console.error(e);$('#updated-at').textContent='数据加载失败';showToast('数据加载失败，请稍后重试')}
}
function showToast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function esc(v=''){return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function route(page){
  page=pageNames[page]?page:'radar';$$('.page').forEach(x=>x.classList.remove('active'));$(`#page-${page}`).classList.add('active');$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#page-title').textContent=pageNames[page];location.hash=page;window.scrollTo({top:0,behavior:'smooth'});if(page==='detail')renderDetail();
}
function initNav(){
  $('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)route(b.dataset.page)});
  window.addEventListener('hashchange',()=>route(location.hash.replace('#','')||'radar'));
  $('#refresh-btn').addEventListener('click',()=>{showToast('正在刷新数据');loadData()});
}
function getWatchlist(){try{return JSON.parse(localStorage.getItem('marketDiaryWatchlist'))||structuredClone(defaultWatchlist)}catch{return structuredClone(defaultWatchlist)}}
function saveWatchlist(){localStorage.setItem('marketDiaryWatchlist',JSON.stringify(state.watchlist))}
function renderAll(){state.watchlist=getWatchlist();renderStats();renderFilters();renderEvents();renderDetail();renderWatchlist();renderDaily();renderWorkbench()}
function renderStats(){
  const e=state.events,s=e.filter(x=>x.priority==='S').length,a=e.filter(x=>x.priority==='A').length,verified=e.filter(x=>x.verified).length,ipo=e.filter(x=>x.type==='IPO').length;
  $('#hero-count').textContent=s+a;$('#stats').innerHTML=[['S级事件',s,'今天必须做'],['A级事件',a,'值得做'],['一级信源核验',verified,'可回溯原文'],['IPO信号',ipo,'招股/上市']].map(x=>`<div class="stat-card"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('')
}
function renderFilters(){
  const markets=['全部',...new Set(state.events.map(x=>x.market))],types=['全部',...new Set(state.events.map(x=>x.type))];
  $('#market-filters').innerHTML=markets.map(x=>`<button class="chip ${state.market===x?'active':''}" data-filter-market="${esc(x)}">${esc(x)}</button>`).join('');
  $('#type-filters').innerHTML=types.map(x=>`<button class="chip ${state.type===x?'active':''}" data-filter-type="${esc(x)}">${esc(x)}</button>`).join('');
  $('#market-filters').onclick=e=>{const b=e.target.closest('[data-filter-market]');if(!b)return;state.market=b.dataset.filterMarket;renderFilters();renderEvents()};
  $('#type-filters').onclick=e=>{const b=e.target.closest('[data-filter-type]');if(!b)return;state.type=b.dataset.filterType;renderFilters();renderEvents()};
}
function filtered(){return state.events.filter(x=>(state.market==='全部'||x.market===state.market)&&(state.type==='全部'||x.type===state.type)).sort((a,b)=>b.priorityScore-a.priorityScore)}
function cardHtml(x){return `<article class="event-card" data-event="${x.id}"><div class="priority ${x.priority}">${x.priority}</div><div><div class="event-meta"><span class="tag">${esc(x.market)}</span><span class="tag">${esc(x.type)}</span><span class="tag">${esc(x.signal)}</span><span class="tag source">${x.verified?'✓ 一级信源':'待核验'}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.conclusion)}</p></div><div class="event-side"><b>${esc(x.keyNumber)}</b><small>热度 ${esc(x.heat)} · 可信度 ${esc(x.confidence)}</small><span class="action-pill">${esc((x.suggestedAction||'').split('｜').slice(-1)[0])}</span></div></article>`}
function bindCards(container){container.onclick=e=>{const c=e.target.closest('[data-event]');if(!c)return;state.selected=state.events.find(x=>x.id===c.dataset.event)||state.selected;renderDetail();route('detail')}}
function renderEvents(){const list=filtered();$('#event-list').innerHTML=list.map(cardHtml).join('')||'<div class="detail-panel">暂无匹配事件</div>';bindCards($('#event-list'))}
function renderDetail(){const x=state.selected||state.events[0];if(!x)return;$('#detail-container').innerHTML=`<div class="detail-hero"><div class="detail-top"><div><div class="event-meta"><span class="tag">${esc(x.market)}</span><span class="tag">${esc(x.type)}</span><span class="tag source">${x.verified?'✓ 一级信源已核验':'待核验'}</span></div><h2>${esc(x.title)}</h2><p>${esc(x.conclusion)}</p></div><div class="priority ${x.priority}" style="width:58px;height:58px;font-size:20px">${x.priority}</div></div><div class="score-box">${Object.entries(x.scores||{}).map(([k,v])=>`<div><b>${v}</b><small>${({impact:'影响范围',attention:'用户关注',increment:'信息增量',timeliness:'时效性',conversion:'内容转化'})[k]||k}</small></div>`).join('')}</div></div>
  <div class="detail-grid"><div class="detail-panel"><h3>核心数据</h3><div class="key-number">${esc(x.keyNumber)}</div><ul>${x.coreData.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div><div class="detail-panel"><h3>为什么重要</h3><p>${esc(x.whyImportant)}</p></div><div class="detail-panel"><h3>影响对象</h3><div class="watch-tags">${x.impact.map(v=>`<span class="watch-tag">${esc(v)}</span>`).join('')}</div><h3 style="margin-top:16px">用户价值</h3><p>${esc(x.userValue)}</p></div><div class="detail-panel"><h3>运营下一步怎么用</h3><p><b>${esc(x.suggestedAction)}</b></p><div class="content-actions">${x.contentDirection.map(v=>`<span>${esc(v)}</span>`).join('')}</div></div><div class="detail-panel"><h3>AI 辅助方式</h3><p>${esc(x.aiAssist)}</p><p style="font-size:10px;color:#8a958f">AI只负责加工与决策辅助，不作为事实来源。</p></div><div class="detail-panel"><h3>信源</h3><p>${esc(x.sourceName)} · 可信度 ${esc(x.confidence)}</p><a class="source-link" target="_blank" rel="noopener" href="${x.sourceUrl}">打开一级信源 ↗</a>${x.secondaryUrl?`<a class="source-link" target="_blank" rel="noopener" href="${x.secondaryUrl}">打开辅助信源 ↗</a>`:''}</div></div>`}
function renderWatchlist(){
  $('#watch-groups').innerHTML=Object.entries(state.watchlist).map(([group,items])=>`<div class="watch-group"><h3>${esc(group)}</h3><div class="watch-tags">${items.map((v,i)=>`<span class="watch-tag">${esc(v)}<button data-remove="${esc(group)}|${i}">×</button></span>`).join('')}</div></div>`).join('');
  $('#watch-groups').onclick=e=>{const b=e.target.closest('[data-remove]');if(!b)return;const [g,i]=b.dataset.remove.split('|');state.watchlist[g].splice(Number(i),1);saveWatchlist();renderWatchlist()};
  const keys=Object.values(state.watchlist).flat().map(v=>v.toLowerCase());const matched=state.events.filter(x=>{const hay=[x.title,x.conclusion,...x.impact].join(' ').toLowerCase();return keys.some(k=>hay.includes(k))});
  $('#watch-match-count').textContent=`${matched.length} 条变化与关注相关`;$('#watch-events').innerHTML=matched.map(cardHtml).join('')||'<div class="detail-panel">暂无匹配事件</div>';bindCards($('#watch-events'));
}
function renderDaily(){const list=[...state.events].sort((a,b)=>b.priorityScore-a.priorityScore).slice(0,10);$('#daily-list').innerHTML=list.map(x=>`<div class="daily-item"><div><h3>${esc(x.title)}</h3><p>${esc(x.conclusion)} <b>为什么重要：</b>${esc(x.whyImportant)}</p></div><div class="next">下一步：${esc((x.suggestedAction||'').split('｜').slice(-1)[0])}</div></div>`).join('')}
function renderWorkbench(){
  const cols=[['time','时间'],['market','市场'],['type','类型'],['title','事件'],['conclusion','一句话结论'],['keyNumber','核心数据'],['heat','热度'],['confidence','可信度'],['sourceName','信源'],['whyImportant','为什么重要'],['impact','影响对象'],['userValue','用户价值'],['priority','优先级'],['suggestedAction','建议动作'],['contentDirection','内容方向'],['aiAssist','AI辅助方式']];
  $('#workbench-table').innerHTML=`<thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${[...state.events].sort((a,b)=>b.priorityScore-a.priorityScore).map(x=>`<tr>${cols.map(([k])=>{let v=x[k];if(Array.isArray(v))v=v.join(' / ');if(k==='priority')return `<td class="table-priority">${esc(v)} · ${x.priorityScore}</td>`;if(k==='sourceName')return `<td>${x.verified?'✓ ':''}${esc(v)}</td>`;return `<td>${esc(v)}</td>`}).join('')}</tr>`).join('')}</tbody>`
}

document.addEventListener('DOMContentLoaded',()=>{initNav();$('#reset-watchlist').addEventListener('click',()=>{state.watchlist=structuredClone(defaultWatchlist);saveWatchlist();renderWatchlist();showToast('已恢复默认关注')});loadData().then(()=>{const p=location.hash.replace('#','')||'radar';route(p)})});
