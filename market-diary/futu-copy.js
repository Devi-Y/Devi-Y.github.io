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
  document.addEventListener('DOMContentLoaded',()=>{
    clean();
    const observer=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>clean(n))));
    observer.observe(document.body,{childList:true,subtree:true});
  });
})();
