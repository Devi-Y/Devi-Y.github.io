(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  async function get(url){try{const r=await fetch(`${url}?v=${Date.now()}`);return r.ok?await r.json():null}catch{return null}}
  const fmt=t=>{try{return new Date(t).toLocaleString('zh-CN',{hour12:false})}catch{return'—'}};
  const label=s=>s==='ok'?'正常':s==='fallback-ok'?'降级可用':s==='error'?'失败':s==='not-configured'?'未配置':s||'—';
  async function render(){
    const page=document.querySelector('#page-workbench');if(!page||document.querySelector('.source-health-panel'))return;
    const [health,candidates,sec]=await Promise.all([get('./data/source-health.json'),get('./data/candidates.json'),get('./data/sec-watchlist.json')]);
    const sources=health?.sources||[];const items=candidates?.items||[];const sum=health?.summary||{};const csum=candidates?.summary||{};
    const secHealthy=sec?.summary?.healthy??0;const secEntities=sec?.summary?.watchEntities??0;const secLabel=secEntities&&secHealthy===0?'源受限':`${sec?.summary?.holdingSignals??0}条`;
    const panel=document.createElement('details');panel.className='source-health-panel';
    panel.innerHTML=`<summary><div><b>Source Health / 系统状态</b><span>技术信息下沉，不影响首页内容判断</span></div><span>${esc(sum.total??sources.length)}来源 · ${esc(sum.ok??0)}正常 · ${esc(sum.fallback??0)}降级 · ${esc(sum.error??0)}硬失败 · 更新 ${esc(fmt(health?.generatedAt))}</span></summary>
      <div class="source-health-body">
        <p class="source-health-meta">这里只回答“系统有没有正常跑”。信源权威度与内容优先级分开：来源正常不代表事件值得做；社媒只负责发现热点，正式内容仍需Human Check。</p>
        <div class="source-health-tech">
          <div><span>近7天自动候选</span><strong>${esc(csum.total??items.length)}</strong><small>抓取 / 去重 / 编辑排序</small></div>
          <div><span>直接成功</span><strong>${esc(sum.ok??0)}</strong><small>按当前源状态</small></div>
          <div><span>自动降级</span><strong>${esc(sum.fallback??0)}</strong><small>直连受限时启用</small></div>
          <div><span>SEC公开持仓</span><strong>${esc(secLabel)}</strong><small>${secEntities&&secHealthy===0?'GitHub出口403，明确展示':'Form 4 / 13F / 13D-G'}</small></div>
        </div>
        <div class="source-health-list">${sources.map(v=>`<div class="source-health-row"><strong>${esc(v.name)}</strong><span>${esc(v.trust||'')}</span><span class="source-health-status ${esc(v.status)}">${esc(label(v.status))}</span><span>${esc(fmt(v.checkedAt))}</span></div>`).join('')}</div>
        <div class="source-health-candidates"><h4>自动候选 Top 6</h4>${items.slice(0,6).map(v=>`<div class="source-health-candidate"><b>${esc(v.priority)}</b><span>${esc(v.signal)}</span><span>${esc(v.title)}</span><span>${esc(v.score)}分</span></div>`).join('')||'<p class="source-health-meta">当前无自动候选。</p>'}</div>
      </div>`;
    page.appendChild(panel);
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,260));
})();
