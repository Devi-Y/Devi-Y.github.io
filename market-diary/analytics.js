(()=>{
  const ENDPOINT='https://marketdiary-ywl-4f8c9e21.requestcatcher.com/track';
  const BASE='https://devi-y.github.io/market-diary/';
  const safe=s=>String(s??'').trim().slice(0,80);
  const now=()=>new Date().toISOString();
  const device=()=>window.innerWidth<=640?'mobile':window.innerWidth<=1024?'tablet':'desktop';
  const getRefHost=()=>{try{return document.referrer?new URL(document.referrer).hostname:''}catch{return ''}};
  const uuid=()=>{try{return crypto.randomUUID()}catch{return `md-${Date.now()}-${Math.random().toString(36).slice(2,10)}`}};

  function identity(){
    const q=new URLSearchParams(location.search);const incoming=safe(q.get('viewer'));
    if(incoming)localStorage.setItem('md_viewer_label',incoming);
    let vid=localStorage.getItem('md_visitor_id');if(!vid){vid=uuid();localStorage.setItem('md_visitor_id',vid)}
    const first=localStorage.getItem('md_first_seen')||now();localStorage.setItem('md_first_seen',first);
    const visits=Number(localStorage.getItem('md_visit_count')||0)+1;localStorage.setItem('md_visit_count',String(visits));
    return {viewer:safe(localStorage.getItem('md_viewer_label')||'anonymous'),visitorId:vid,firstSeen:first,visitCount:visits};
  }

  const id=identity();
  function emit(event,extra={}){
    const data={event,ts:now(),viewer:id.viewer,visitor_id:id.visitorId,visit_count:id.visitCount,page:(location.hash||'#radar').replace('#',''),path:location.pathname,device:device(),viewport:`${window.innerWidth}x${window.innerHeight}`,referrer:getRefHost(),...extra};
    const qs=new URLSearchParams();Object.entries(data).forEach(([k,v])=>qs.set(k,safe(v)));
    const img=new Image();img.referrerPolicy='no-referrer';img.src=`${ENDPOINT}?${qs.toString()}&_=${Date.now()}`;
    try{const local=JSON.parse(localStorage.getItem('md_local_analytics')||'[]');local.push(data);localStorage.setItem('md_local_analytics',JSON.stringify(local.slice(-100)))}catch{}
  }

  document.addEventListener('DOMContentLoaded',()=>emit('page_view',{title:document.title}));
  window.addEventListener('hashchange',()=>emit('route_view'));
  document.addEventListener('click',e=>{
    const eventCard=e.target.closest('[data-event]');if(eventCard)emit('event_open',{event_id:safe(eventCard.dataset.event)});
    const source=e.target.closest('.source-link');if(source)emit('source_open',{source_host:(()=>{try{return new URL(source.href).hostname}catch{return ''}})()});
    const nav=e.target.closest('[data-page]');if(nav)emit('nav_click',{target_page:safe(nav.dataset.page)});
  },true);

  window.MarketDiaryAnalytics={
    visitor:id,
    makeViewerLink(label){const u=new URL(BASE);u.searchParams.set('viewer',safe(label));return u.toString()},
    localHistory(){try{return JSON.parse(localStorage.getItem('md_local_analytics')||'[]')}catch{return []}},
    endpoint:ENDPOINT
  };
})();
