(()=>{
  const exact=new Map([
    ['AI已处理','AI初筛'],
    ['Human Check','人工核验'],
    ['Human Check纠错','人工纠错'],
    ['待Human Check','待人工核验'],
    ['AI处理完，不等于可以直接发布','关键事实必须人工确认'],
    ['AI具体做了什么','前置处理'],
    ['AI辅助方式','前置处理'],
    ['4条真实样例：AI处理后，Human Check怎么把关','4条真实样例：从原始信息到内容判断'],
    ['Human Check纠错案例','人工纠错案例'],
    ['② AI已处理','② 前置处理'],
    ['③ Human Check','③ 人工核验'],
    ['Source Health / 系统状态','数据状态（技术信息）'],
    ['技术信息下沉，不影响首页内容判断','默认收起，面试无需展开']
  ]);
  const partial=[
    ['Human Check发现','人工核验发现'],
    ['正式内容仍需Human Check','正式内容仍需人工核验'],
    ['AI只保留加工和内容决策辅助角色。','AI只做前置整理，不替代事实判断。'],
    ['AI不补数字、不替代原始信源、不做最终发布判断。','AI只负责整理和初筛，不补数字，也不替代一级信源。'],
    ['待Human Check','待人工核验'],
    ['Human Check','人工核验']
  ];
  const eventMap=new Map();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function cleanText(node){
    const raw=node.nodeValue;if(!raw||!raw.trim())return;
    const trimmed=raw.trim();
    if(exact.has(trimmed)){node.nodeValue=raw.replace(trimmed,exact.get(trimmed));return}
    let next=raw;partial.forEach(([a,b])=>{next=next.split(a).join(b)});if(next!==raw)node.nodeValue=next;
  }
  function clean(root=document.body){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){cleanText(root);return}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode()))cleanText(n);
  }

  function simplifyCard(card){
    if(!card||card.dataset.futuSimple==='1')return;
    const x=eventMap.get(card.dataset.event);if(!x)return;
    const blocks=card.querySelectorAll('.card-block');
    if(blocks[0]){const b=blocks[0].querySelector('b');if(b)b.textContent='发生什么'}
    const footer=card.querySelector('.card-footer-grid');if(footer)footer.remove();
    const flow=card.querySelector('.human-flow');if(flow)flow.remove();
    const main=card.querySelector('.card-main');
    if(main){
      const action=document.createElement('div');action.className='editorial-next-action';
      const forms=(x.contentDirection||[]).slice(0,2).map(v=>`<span>${esc(v)}</span>`).join('');
      action.innerHTML=`<b>建议怎么做</b><p>${esc(x.suggestedAction||'进入详情后判断内容动作')}</p>${forms?`<div>${forms}</div>`:''}<small>${x.verified?'✓ 已人工核验':'● 待人工核验'} · ${esc(x.sourceName||'一级信源')}</small>`;
      main.appendChild(action);
    }
    const sourceTag=[...card.querySelectorAll('.event-meta .tag')].find(v=>/信源|核验/.test(v.textContent||''));
    if(sourceTag)sourceTag.textContent=x.verified?'✓ 已人工核验':'待人工核验';
    card.dataset.futuSimple='1';
  }

  function simplifyTable(table){
    if(!table)return;
    const head=table.querySelector('thead tr');
    if(!head||head.children.length<=6)return;
    const keep=new Set([2,3,4,6,8,10]);
    table.querySelectorAll('tr').forEach(row=>{
      [...row.children].forEach((cell,i)=>{if(!keep.has(i))cell.remove()});
    });
    const labels=['事件','一句话结论','为什么重要','内容方向','人工核验','下一步动作'];
    [...table.querySelectorAll('thead th')].forEach((th,i)=>{if(labels[i])th.textContent=labels[i]});
  }

  function simplify(root=document){
    const scope=root.querySelectorAll?root:document;
    scope.querySelectorAll?.('.editorial-card').forEach(simplifyCard);
    const table=document.querySelector('#workbench-table');simplifyTable(table);
  }

  async function loadEvents(){
    try{
      const r=await fetch(`./data/events.json?v=${Date.now()}`);if(!r.ok)return;
      const d=await r.json();(d.events||[]).forEach(x=>eventMap.set(String(x.id),x));
      simplify();
    }catch{}
  }

  document.addEventListener('DOMContentLoaded',()=>{
    clean();loadEvents();
    const observer=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{clean(n);if(n.nodeType===Node.ELEMENT_NODE){simplify(n);if(n.matches?.('.editorial-card'))simplifyCard(n)}})));
    observer.observe(document.body,{childList:true,subtree:true});
  });
})();
