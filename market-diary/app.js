'use strict';

const STORAGE = {
  watchlist: 'marketDiaryWatchlist',
  drafts: 'marketDiaryDraftsV2',
  eventsCache: 'marketDiaryEventsCacheV2'
};

const pageNames = {
  radar: '今日',
  workbench: '问一下',
  market: '市场',
  my: '我的',
  detail: '事件详情'
};

const routeAliases = {
  watchlist: 'my',
  daily: 'radar',
  library: 'market',
  content: 'market'
};

const emptyWatchlist = { 股票: [], 人物: [], 机构: [], 主题: [] };
const exampleWatchlist = {
  股票: ['NVDA', '9988.HK'],
  人物: ['Kevin Warsh'],
  机构: [],
  主题: ['美联储', '港股IPO']
};

const aliasGroups = [
  { pattern: /nvda|nvidia|英伟达/i, terms: ['nvda', 'nvidia', '英伟达'] },
  { pattern: /baba|9988|alibaba|阿里巴巴|阿里/i, terms: ['baba', '9988', 'alibaba', '阿里巴巴', '阿里'] },
  { pattern: /fed|fomc|美联储|warsh/i, terms: ['fed', 'fomc', '美联储', 'warsh'] },
  { pattern: /shein|希音/i, terms: ['shein', '希音', '00625'] },
  { pattern: /mechmind|梅卡曼德|09615/i, terms: ['mechmind', '梅卡曼德', '09615'] },
  { pattern: /非农|就业|payroll|jobs/i, terms: ['非农', '就业', 'payroll', 'jobs', 'bls'] },
  { pattern: /ipo|新股|上市|招股/i, terms: ['ipo', '新股', '上市', '招股'] }
];

const state = {
  data: null,
  events: [],
  candidates: [],
  health: null,
  selected: null,
  selectedKind: 'verified',
  returnPage: 'radar',
  feedIndex: 0,
  scope: 'verified',
  market: '全部',
  type: '全部',
  libraryQuery: '',
  marketView: 'overview',
  compareA: '',
  compareB: '',
  watchlist: cloneWatchlist(emptyWatchlist),
  drafts: [],
  answer: null,
  answerText: '',
  loading: false
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char]);
}

function cloneWatchlist(value) {
  const result = {};
  Object.keys(emptyWatchlist).forEach(group => {
    const list = Array.isArray(value && value[group]) ? value[group] : [];
    result[group] = Array.from(new Set(list.map(item => String(item).trim()).filter(Boolean)));
  });
  return result;
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeUrl(value) {
  try {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const url = new URL(raw, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function formatDate(value, compact = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', compact ? {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  } : {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function ageHours(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? (Date.now() - time) / 3600000 : Infinity;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function currentPage() {
  const page = $('.page.active');
  return page ? page.id.replace('page-', '') : 'radar';
}

function normalizeRoute(value) {
  const raw = String(value || '').replace(/^#/, '');
  const mapped = routeAliases[raw] || raw || 'radar';
  return pageNames[mapped] ? mapped : 'radar';
}

function decodeRouteId(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function itemFromRoute(id) {
  const verified = state.events.find(item => String(item.id) === String(id));
  if (verified) return { item: verified, kind: 'verified' };
  const candidate = state.candidates.find(item => String(item.id) === String(id));
  return candidate ? { item: candidate, kind: 'candidate' } : null;
}

function route(value, options = {}) {
  const raw = String(value || '').replace(/^#/, '');
  if (raw === 'library' || raw === 'content') {
    state.marketView = 'events';
    state.scope = 'verified';
  }
  const eventMatch = raw.match(/^event\/(.+)$/);
  const eventId = eventMatch ? decodeRouteId(eventMatch[1]) : '';
  const routedItem = eventId ? itemFromRoute(eventId) : null;
  let page = eventMatch ? (routedItem ? 'detail' : 'radar') : normalizeRoute(raw);

  if (routedItem) {
    state.selected = routedItem.item;
    state.selectedKind = routedItem.kind;
  }
  if (eventMatch && !routedItem && (state.data || state.candidateMeta) && location.hash !== '#radar') {
    history.replaceState(null, '', '#radar');
    showToast('这条事件已不在当前数据中');
  }
  if (page === 'detail' && !state.selected) page = 'radar';

  $$('.page').forEach(section => {
    section.classList.toggle('active', section.id === 'page-' + page);
  });

  const navPage = page === 'detail' ? state.returnPage : page;
  $$('.nav-item').forEach(button => {
    const active = button.dataset.page === navPage;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  $('#page-title').textContent = pageNames[page];
  document.title = page === 'detail' && state.selected
    ? state.selected.title + '｜牛牛市场雷达'
    : pageNames[page] + '｜牛牛市场雷达';

  if (!options.fromHistory) {
    const hash = page === 'detail' && state.selected
      ? '#event/' + encodeURIComponent(state.selected.id)
      : '#' + page;
    if (location.hash !== hash) {
      if (options.replace) history.replaceState(null, '', hash);
      else history.pushState(null, '', hash);
    }
  }

  if (page === 'detail') renderDetail();
  if (page === 'market') {
    renderMarket();
    renderLibrary();
  }
  if (page === 'my') {
    renderSavedDrafts();
    renderWatchlist();
    renderTrust();
  }

  window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
}

async function loadJson(path, fresh = false) {
  const suffix = fresh ? (path.includes('?') ? '&' : '?') + 'v=' + Date.now() : '';
  const response = await fetch(path + suffix, { cache: fresh ? 'no-store' : 'no-cache' });
  if (!response.ok) throw new Error(path + ' HTTP ' + response.status);
  return response.json();
}

function normalizeCandidate(item) {
  const ai = item.ai || {};
  const trust = item.trustTier || item.confidence || '待判定';
  const carried = Boolean(item.carryOver);
  const verificationNote = ai.verificationNeed || item.verification || '必须回到一级信源核验。';
  return {
    id: 'candidate-' + String(item.id || Math.random().toString(36).slice(2)),
    sourceId: item.id || '',
    kind: 'candidate',
    title: ai.summary || item.title || '未命名候选',
    originalTitle: item.title || '',
    conclusion: ai.summary || item.description || '候选信息尚未完成结构化整理。',
    whyImportant: ai.whyImportant || '这条信息已进入自动候选池，是否值得做仍需编辑判断。',
    coreData: [],
    impact: [],
    userValue: '',
    contentDirection: ai.contentDirection || [],
    suggestedAction: '先回到原始来源核验关键数字、日期与措辞，再决定是否进入已核验事件层。',
    market: item.market || '全球',
    type: item.type || '候选',
    signal: item.signal || '发现',
    sourceName: item.source || '候选来源',
    sourceUrl: item.link || '',
    secondaryUrl: '',
    sourceTier: trust === 'A' ? '一级/官方候选' : '发现来源',
    confidence: trust,
    verified: false,
    priority: ai.priority || item.priority || 'B',
    priorityScore: Number(item.score || 0),
    date: item.pubDate || '',
    verificationNote: carried ? '本轮抓取失败，沿用7日窗口内最近一次线索；必须重新确认时效与原始公告。' : verificationNote,
    aiAssist: carried ? '自动采集本轮失败，已保留窗口内上一轮线索；尚未通过人工核验。' : '自动采集、去重与规则初筛；尚未通过人工核验。'
  };
}

function eventDay(item) {
  if (!item || !item.date) return null;
  const date = new Date(String(item.date).slice(0, 10) + 'T00:00:00');
  return Number.isFinite(date.getTime()) ? date : null;
}

function dailyRankScore(item) {
  let score = Number(item.priorityScore || 0);
  const date = eventDay(item);
  if (!date) return score;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delta = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (delta === 0) score += 36;
  else if (delta === -1) score += 24;
  else if (delta >= 1 && delta <= 3) score += 14;
  else if (delta >= -3) score += 12;
  else if (delta <= -6) score -= Math.min(36, Math.abs(delta) * 3);
  else score -= 4;
  if (item.heat === '高') score += 2;
  return score;
}

function sortedEvents() {
  return state.events.slice().sort((a, b) =>
    dailyRankScore(b) - dailyRankScore(a) || Number(b.priorityScore || 0) - Number(a.priorityScore || 0)
  );
}

function sortedCandidates() {
  return state.candidates.slice().sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
}

function dayDelta(item) {
  const date = eventDay(item);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function relativeDay(item) {
  const delta = dayDelta(item);
  if (delta === null) return '时间待确认';
  if (delta === 0) return '今天';
  if (delta === 1) return '明天';
  if (delta === -1) return '昨天';
  if (delta > 1) return delta + '天后';
  return Math.abs(delta) + '天前';
}

function shortDate(value) {
  const date = new Date(String(value || '').slice(0, 10) + 'T00:00:00');
  if (!Number.isFinite(date.getTime())) return '待确认';
  return (date.getMonth() + 1) + '月' + date.getDate() + '日';
}

function fullDate(value) {
  const date = new Date(String(value || '').slice(0, 10) + 'T00:00:00');
  if (!Number.isFinite(date.getTime())) return '待确认';
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
}

function cleanAction(value) {
  return String(value || '继续核验下一项关键事实。').replace(/^[SAB]级[｜|]\s*/u, '');
}

function findComparable(item) {
  if (!item) return null;
  return sortedEvents()
    .filter(candidate => candidate.id !== item.id)
    .map(candidate => {
      const overlap = (candidate.impact || []).filter(value => (item.impact || []).includes(value)).length;
      const score = (candidate.type === item.type ? 7 : 0) + (candidate.market === item.market ? 4 : 0) + overlap * 3;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || dailyRankScore(b.candidate) - dailyRankScore(a.candidate))[0]?.candidate || null;
}

function comparisonRows(first, second) {
  if (!first || !second) return [];
  return [
    ['市场', first.market, second.market],
    ['类型', first.type, second.type],
    ['事件日期', fullDate(first.date), fullDate(second.date)],
    ['相对当前', relativeDay(first), relativeDay(second)],
    ['来源', first.sourceName || '待补充', second.sourceName || '待补充'],
    ['证据状态', (first.sourceTier || '待判断') + ' · ' + (first.confidence || '待定'), (second.sourceTier || '待判断') + ' · ' + (second.confidence || '待定')],
    ['影响对象（编辑标注）', (first.impact || []).slice(0, 3).join('、') || '待判断', (second.impact || []).slice(0, 3).join('、') || '待判断'],
    ['下一核验 / 内容动作', cleanAction(first.suggestedAction), cleanAction(second.suggestedAction)]
  ];
}

function comparisonTableHtml(first, second) {
  const rows = comparisonRows(first, second);
  if (!rows.length) return '<div class="empty-state"><h3>还不能比较</h3><p>至少需要两条已核验事件。</p></div>';
  return [
    '<div class="comparison-table-wrap"><table class="comparison-table">',
      '<thead><tr><th scope="col">维度</th><th scope="col">' + esc(first.title) + '</th><th scope="col">' + esc(second.title) + '</th></tr></thead>',
      '<tbody>',
        rows.map(row => '<tr><th scope="row">' + esc(row[0]) + '</th><td>' + esc(row[1]) + '</td><td>' + esc(row[2]) + '</td></tr>').join(''),
      '</tbody>',
    '</table></div>',
    '<p class="compare-note">当前数据缺少统一数值口径，因此不比较大小、不做排名；影响对象属于编辑标注，不是原始信源结论。</p>'
  ].join('');
}

async function loadData(options = {}) {
  if (state.loading) return;
  state.loading = true;
  $('#refresh-btn').setAttribute('aria-busy', 'true');
  $('#focus-stage').setAttribute('aria-busy', 'true');

  const fresh = Boolean(options.fresh);
  const results = await Promise.allSettled([
    loadJson('./data/events.json', fresh),
    loadJson('./data/ai-candidates.json', fresh),
    loadJson('./data/source-health.json', fresh)
  ]);

  let usedCache = false;
  let answerExpired = false;
  if (results[0].status === 'fulfilled') {
    state.data = results[0].value;
    state.events = Array.isArray(state.data.events) ? state.data.events : [];
    writeStorage(STORAGE.eventsCache, state.data);
  } else {
    const cached = readStorage(STORAGE.eventsCache, null);
    if (cached && Array.isArray(cached.events)) {
      state.data = cached;
      state.events = cached.events;
      usedCache = true;
    } else {
      state.data = null;
      state.events = [];
    }
  }

  if (results[1].status === 'fulfilled') {
    const items = Array.isArray(results[1].value.items) ? results[1].value.items : [];
    state.candidates = items.map(normalizeCandidate);
    state.candidateMeta = results[1].value;
  } else {
    state.candidates = [];
    state.candidateMeta = null;
  }

  state.health = results[2].status === 'fulfilled' ? results[2].value : null;
  if (state.answer && state.answer.item) {
    const pool = state.answer.item.verified ? state.events : state.candidates;
    const refreshedItem = pool.find(item => item.id === state.answer.item.id);
    const refreshedPeer = state.answer.peer && state.events.find(item => item.id === state.answer.peer.id);
    if (refreshedItem && (!state.answer.peer || refreshedPeer)) {
      state.answer.item = refreshedItem;
      state.answer.peer = refreshedPeer || null;
    } else {
      state.answer = null;
      state.answerText = '';
      answerExpired = true;
    }
  }
  state.feedIndex = Math.min(state.feedIndex, Math.max(0, state.events.length - 1));
  state.selected = state.selected || state.events[0] || null;
  state.loading = false;

  $('#refresh-btn').removeAttribute('aria-busy');
  $('#focus-stage').setAttribute('aria-busy', 'false');
  renderAll();
  if (answerExpired) {
    $('#assistant-output').innerHTML = '<div class="empty-state"><h3>原事件已不在最新数据中</h3><p>旧成稿已停止展示，请从“市场”重新选择已核验事件。</p><button class="source-link" type="button" data-market-action="events" data-market-scope="verified">去市场重新选择</button></div>';
  }
  if (/^#event\//.test(location.hash)) {
    const eventId = decodeRouteId(location.hash.replace(/^#event\//, ''));
    if (itemFromRoute(eventId)) {
      route(location.hash, { fromHistory: true, instant: true });
    } else {
      history.replaceState(null, '', '#radar');
      route('radar', { fromHistory: true, instant: true });
      showToast('这条事件已不在当前数据中');
    }
  }

  if (answerExpired) showToast('原事件已不在最新数据中，请重新选择');
  else if (!state.events.length) showToast('已核验内容加载失败，请稍后重试');
  else if (usedCache) showToast('网络不可用，已显示本机缓存');
  else if (fresh) showToast('数据已刷新');
}

function setDataStatus() {
  const button = $('#data-status');
  button.classList.remove('stale', 'warning');

  if (!state.data) {
    $('#updated-at').textContent = '数据暂不可用';
    button.classList.add('warning');
    return;
  }

  const stale = ageHours(state.data.generatedAt) > 48;
  $('#updated-at').textContent = state.events.length + ' 条已核验 · ' + formatDate(state.data.generatedAt, true);
  if (stale) {
    button.classList.add('stale');
    button.setAttribute('aria-label', '已核验数据超过48小时，查看数据状态');
  } else {
    button.setAttribute('aria-label', '查看数据状态');
  }
}

function verificationBadge(item) {
  return item.verified
    ? '<span class="verified-badge">✓ 已核验</span>'
    : '<span class="pending-badge">待核验</span>';
}

function renderFocus() {
  const host = $('#focus-stage');
  const events = sortedEvents();
  if (!events.length) {
    host.innerHTML = '<div class="empty-state"><h3>暂时没有已核验事件</h3><p>可以稍后刷新，自动候选不会在未核验前进入这里。</p></div>';
    $('#feed-progress').innerHTML = '';
    return;
  }

  state.feedIndex = Math.max(0, Math.min(state.feedIndex, events.length - 1));
  const item = events[state.feedIndex];
  const number = item.keyNumber || (item.coreData && item.coreData[0]) || '已核验';

  host.innerHTML = [
    '<article class="focus-card" data-focus-event="' + esc(item.id) + '">',
      '<div class="focus-meta">',
        '<span>' + esc(item.market) + '</span>',
        '<span>' + esc(item.type) + '</span>',
        verificationBadge(item),
      '</div>',
      '<span class="focus-rank">' + (state.feedIndex + 1) + ' / ' + events.length + '</span>',
      '<h3>' + esc(item.title) + '</h3>',
      '<p class="focus-lead">' + esc(item.conclusion) + '</p>',
      '<div class="focus-facts">',
        '<div class="focus-number"><span>关键数字</span><strong>' + esc(number) + '</strong></div>',
        '<div class="focus-why"><span>为什么值得做</span><p>' + esc(item.whyImportant) + '</p></div>',
      '</div>',
      '<div class="focus-actions">',
        '<button class="primary-button" type="button" data-generate-event="' + esc(item.id) + '" data-format="brief">一键生成内容</button>',
        '<button class="secondary-button" type="button" data-open-event="' + esc(item.id) + '" data-kind="verified">查看依据</button>',
      '</div>',
    '</article>'
  ].join('');

  $('#feed-progress').innerHTML = events.map((event, index) =>
    '<span class="' + (index === state.feedIndex ? 'active' : '') + '" aria-label="第' + (index + 1) + '条"></span>'
  ).join('');
  $('#prev-event').disabled = events.length < 2;
  $('#next-event').disabled = events.length < 2;
}

function changeFeed(direction) {
  const events = sortedEvents();
  if (events.length < 2) return;
  state.feedIndex = (state.feedIndex + direction + events.length) % events.length;
  renderFocus();
}

function renderDailyBrief() {
  const host = $('#daily-brief');
  const dateHost = $('#today-date');
  if (dateHost) {
    dateHost.textContent = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  }
  if (!host) return;
  const events = sortedEvents().slice(0, 3);
  host.innerHTML = events.length ? events.map((item, index) => [
    '<button class="brief-row" type="button" data-open-event="' + esc(item.id) + '" data-kind="verified">',
      '<span class="brief-index">0' + (index + 1) + '</span>',
      '<span class="brief-copy"><small>' + esc(item.market + ' · ' + item.type + ' · ' + relativeDay(item)) + '</small><strong>' + esc(item.title) + '</strong></span>',
      '<span class="brief-number">' + esc(item.keyNumber || '已核验') + '</span>',
      '<span class="brief-arrow" aria-hidden="true">→</span>',
    '</button>'
  ].join('')).join('') : '<div class="empty-state"><h3>今日简报暂不可用</h3><p>自动候选不会代替已核验内容。</p></div>';
}

function renderMarketSummary(events) {
  const host = $('#market-summary');
  if (!host) return;
  const markets = Array.from(new Set(events.map(item => item.market).filter(Boolean)));
  const next = events
    .filter(item => dayDelta(item) !== null && dayDelta(item) >= 0)
    .sort((a, b) => dayDelta(a) - dayDelta(b) || dailyRankScore(b) - dailyRankScore(a))[0];
  const cards = [
    { label: '已核验事件', value: String(events.length), note: '可查看依据与生成内容' },
    { label: '覆盖市场', value: String(markets.length), note: markets.join(' · ') || '暂无' },
    { label: '下一节点', value: next ? shortDate(next.date) : '待更新', note: next ? next.title : '当前窗口没有未来事件' }
  ];
  host.innerHTML = cards.map(card => [
    '<article class="market-stat">',
      '<span>' + esc(card.label) + '</span>',
      '<strong>' + esc(card.value) + '</strong>',
      '<small>' + esc(card.note) + '</small>',
    '</article>'
  ].join('')).join('');
}

function renderMarketStory(events) {
  const host = $('#market-story');
  if (!host) return;
  const item = events[0];
  if (!item) {
    host.innerHTML = '<div class="empty-state"><h3>暂无可展示主线</h3><p>等待已核验事件更新。</p></div>';
    return;
  }
  const impact = (item.impact || []).slice(0, 3).join('、') || '影响对象待判断';
  host.innerHTML = [
    '<div class="impact-chain">',
      '<button class="chain-node fact" type="button" data-open-event="' + esc(item.id) + '" data-kind="verified"><small>事实</small><strong>' + esc(item.title) + '</strong></button>',
      '<span class="chain-arrow" aria-hidden="true">↓</span>',
      '<div class="chain-node"><small>关键变化</small><strong>' + esc(item.keyNumber || (item.coreData || [])[0] || '已核验') + '</strong></div>',
      '<span class="chain-arrow" aria-hidden="true">↓</span>',
      '<div class="chain-node analysis"><small>可能影响 · 编辑判断</small><strong>' + esc(impact) + '</strong></div>',
      '<span class="chain-arrow" aria-hidden="true">↓</span>',
      '<div class="chain-node next"><small>下一验证</small><strong>' + esc(cleanAction(item.suggestedAction)) + '</strong></div>',
    '</div>'
  ].join('');
}

function renderMarketCalendar(events) {
  const host = $('#market-calendar');
  if (!host) return;
  const items = events
    .filter(item => dayDelta(item) !== null && dayDelta(item) >= 0)
    .sort((a, b) => dayDelta(a) - dayDelta(b) || dailyRankScore(b) - dailyRankScore(a))
    .slice(0, 4);
  host.innerHTML = items.length ? '<div class="calendar-list">' + items.map(item => [
    '<button type="button" data-open-event="' + esc(item.id) + '" data-kind="verified">',
      '<span class="calendar-date"><strong>' + esc(shortDate(item.date)) + '</strong><small>' + esc(relativeDay(item)) + '</small></span>',
      '<span class="calendar-copy"><strong>' + esc(item.title) + '</strong><small>' + esc(cleanAction(item.suggestedAction)) + '</small></span>',
      '<span aria-hidden="true">→</span>',
    '</button>'
  ].join('')).join('') + '</div>' : '<div class="empty-state"><h3>暂无日历事件</h3><p>不会用未核验候选填充。</p></div>';
}

function renderMarketLanes(events) {
  const host = $('#market-lane-list');
  if (!host) return;
  const lanes = [
    { type: '财报', icon: '▥', title: '业绩变化', note: '看数字与预期差' },
    { type: 'IPO', icon: '◇', title: '新股进度', note: '看阶段与下一节点' },
    { type: '宏观', icon: '⌁', title: '宏观解读', note: '看数据与市场传导' },
    { type: '公司事件', icon: '◎', title: '公司大事', note: '看事实与影响对象' }
  ];
  host.innerHTML = lanes.map(lane => {
    const count = events.filter(item => item.type === lane.type).length;
    return [
      '<button type="button" data-lane-type="' + esc(lane.type) + '"' + (count ? '' : ' disabled') + '>',
        '<span class="lane-icon" aria-hidden="true">' + lane.icon + '</span>',
        '<span><strong>' + esc(lane.title) + '</strong><small>' + esc(lane.note) + '</small></span>',
        '<b>' + count + '</b>',
      '</button>'
    ].join('');
  }).join('');
}

function renderCompare() {
  const firstSelect = $('#compare-a');
  const secondSelect = $('#compare-b');
  const host = $('#compare-output');
  if (!firstSelect || !secondSelect || !host) return;
  const events = sortedEvents();
  if (events.length < 2) {
    firstSelect.innerHTML = '';
    secondSelect.innerHTML = '';
    host.innerHTML = '<div class="empty-state"><h3>事件不足</h3><p>至少需要两条已核验事件才能进行比较。</p></div>';
    return;
  }
  if (!events.some(item => item.id === state.compareA)) state.compareA = events[0].id;
  const first = events.find(item => item.id === state.compareA) || events[0];
  if (!events.some(item => item.id === state.compareB) || state.compareB === state.compareA) {
    state.compareB = (findComparable(first) || events[1]).id;
  }
  const options = events.map(item => '<option value="' + esc(item.id) + '">' + esc(item.title) + '</option>').join('');
  firstSelect.innerHTML = options;
  secondSelect.innerHTML = options;
  firstSelect.value = state.compareA;
  secondSelect.value = state.compareB;
  const second = events.find(item => item.id === state.compareB) || events[1];
  host.innerHTML = comparisonTableHtml(first, second);
}

function renderMarket() {
  const events = sortedEvents();
  $$('[data-market-view]').forEach(button => {
    const active = button.dataset.marketView === state.marketView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('[data-market-panel]').forEach(panel => {
    panel.hidden = panel.dataset.marketPanel !== state.marketView;
  });
  renderMarketSummary(events);
  renderMarketStory(events);
  renderMarketCalendar(events);
  renderMarketLanes(events);
  renderCompare();
}

function renderCandidatePeek() {
  const host = $('#candidate-peek');
  const candidates = sortedCandidates().slice(0, 3);
  if (!candidates.length) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = [
    '<details>',
      '<summary>',
        '<span id="candidate-peek-heading">待核验候选</span>',
        '<small>' + state.candidates.length + ' 条已加工线索 · 不进入已核验首页</small>',
      '</summary>',
      '<div class="candidate-mini-list">',
        candidates.map(item => [
          '<div class="candidate-mini-item">',
            '<span class="pending-badge">待核验</span>',
            '<b>' + esc(item.title) + '</b>',
            '<small>' + esc(item.sourceName) + '</small>',
          '</div>'
        ].join('')).join(''),
        '<button class="text-button" type="button" data-library-scope="candidate">查看全部候选 →</button>',
      '</div>',
    '</details>'
  ].join('');
}

function queryTerms(query) {
  const lower = String(query || '').toLowerCase();
  const cleaned = lower.replace(/今天|什么|怎么|哪些|一下|内容|写成|值得|可以|帮我|一篇|简洁|解读|分析|快讯|变化|适合|最|有|把|做/g, ' ');
  const terms = cleaned.split(/[\s，。！？、；：,.!?;:()（）/]+/)
    .map(term => term.trim())
    .filter(term => term.length >= 2);

  aliasGroups.forEach(group => {
    if (group.pattern.test(query)) terms.push(...group.terms);
  });

  return Array.from(new Set(terms));
}

function itemHaystack(item) {
  return [
    item.title,
    item.originalTitle,
    item.conclusion,
    item.whyImportant,
    item.market,
    item.type,
    item.sourceName,
    ...(item.impact || []),
    ...(item.coreData || [])
  ].join(' ').toLowerCase();
}

function relevanceScore(item, query) {
  const text = String(query || '');
  const lower = text.toLowerCase();
  const haystack = itemHaystack(item);
  let score = 0;

  queryTerms(text).forEach(term => {
    if (haystack.includes(term)) score += term.length >= 4 ? 55 : 35;
  });

  ['港股', '美股', '宏观', '全球'].forEach(market => {
    if (lower.includes(market.toLowerCase()) && item.market === market) score += 90;
  });

  ['财报', 'IPO', '公司事件', '日历', '宏观'].forEach(type => {
    if (lower.includes(type.toLowerCase())) score += item.type === type ? 65 : 0;
  });

  return score;
}

function isOverviewQuery(query) {
  const remaining = String(query || '').toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:()（）/]/g, '')
    .replace(/今天|目前|当前|发生了|有什么|有哪些|什么|怎么|怎样|如何|市场|大事|要闻|重点|给我看看|给我|看看|最值得|写什么|选题|简报|概览|概况|情况|请|帮我|的|了/g, '');
  return remaining.length === 0;
}

function findBestItem(query) {
  const verified = sortedEvents().map(item => ({
    item,
    relevance: relevanceScore(item, query),
    rank: dailyRankScore(item)
  })).sort((a, b) => b.relevance - a.relevance || b.rank - a.rank);
  const candidates = sortedCandidates().map(item => ({
    item,
    relevance: relevanceScore(item, query),
    rank: Number(item.priorityScore || 0)
  })).sort((a, b) => b.relevance - a.relevance || b.rank - a.rank);
  const terms = queryTerms(query);
  if (isOverviewQuery(query)) return sortedEvents()[0] || null;
  const generic = terms.length === 0;

  if (generic) {
    if (verified[0] && verified[0].relevance > 0) return verified[0].item;
    if (candidates[0] && candidates[0].relevance > 0) return candidates[0].item;
    return verified[0] ? verified[0].item : null;
  }

  const verifiedMatch = verified[0] && verified[0].relevance > 0 ? verified[0] : null;
  const candidateMatch = candidates[0] && candidates[0].relevance > 0 ? candidates[0] : null;
  if (!verifiedMatch && !candidateMatch) return null;
  if (!verifiedMatch) return candidateMatch.item;
  if (!candidateMatch) return verifiedMatch.item;
  return candidateMatch.relevance > verifiedMatch.relevance + 24 ? candidateMatch.item : verifiedMatch.item;
}

function findComparePair(query) {
  const lower = String(query || '').toLowerCase();
  const literalTerms = queryTerms(query).filter(term => lower.includes(term.toLowerCase()));
  const ranked = sortedEvents().map(item => {
    const haystack = itemHaystack(item);
    const positions = literalTerms
      .filter(term => haystack.includes(term.toLowerCase()))
      .map(term => lower.indexOf(term.toLowerCase()))
      .filter(position => position >= 0);
    return {
      item,
      relevance: relevanceScore(item, query),
      position: positions.length ? Math.min(...positions) : Infinity,
      rank: dailyRankScore(item)
    };
  }).filter(match => match.relevance > 0)
    .sort((a, b) => a.position - b.position || b.relevance - a.relevance || b.rank - a.rank);

  if (ranked.length >= 2) return [ranked[0].item, ranked[1].item];
  const generic = lower.replace(/对比|比较|区别|差异|pk|两个|两条|事件|一下|帮我|做|看看|个|和|与|[\s，。！？、；：,.!?;:()（）/]/gi, '').length === 0;
  return generic && state.events.length >= 2 ? sortedEvents().slice(0, 2) : null;
}

function detectFormat(query) {
  const text = String(query || '');
  if (/对比|比较|区别|差异|PK/i.test(text)) return 'compare';
  if (/解读|分析|深度|看懂/.test(text)) return 'analysis';
  return 'brief';
}

function formatName(format) {
  return ({ brief: '速览', analysis: '深读', compare: '对比', community: '社区稿（旧）' })[format] || '速览';
}

function normalizeFormat(format) {
  return ['brief', 'analysis', 'compare'].includes(format) ? format : 'brief';
}

function makeDraft(item, format, requestedPeer = null) {
  const facts = (item.coreData || []).filter(Boolean);
  const impacts = (item.impact || []).filter(Boolean);
  const peer = format === 'compare' ? (requestedPeer || findComparable(item)) : null;
  let title = item.title;
  let direct = '';

  if (format === 'compare' && peer) {
    title = item.title + ' vs ' + peer.title;
    direct = [
      '对比结论：两条事件可以比较日期、类型、信源和后续动作，但现有关键数字口径不同，不能据此排名。',
      '',
      item.title + '：' + item.conclusion,
      '',
      peer.title + '：' + peer.conclusion
    ].join('\n');
  } else if (format === 'analysis') {
    title = item.title + '：三点看懂影响';
    direct = [
      '先说结论：' + item.conclusion,
      '',
      '发生了什么：' + (facts.length ? facts.join('；') + '。' : item.conclusion),
      '',
      '为什么重要：' + item.whyImportant,
      impacts.length ? '' : null,
      impacts.length ? '可能影响：' + impacts.join('、') + '。' : null
    ].filter(value => value !== null).join('\n');
  } else {
    direct = [
      '【' + item.market + '快讯】' + item.conclusion,
      facts.length ? '' : null,
      facts.length ? '关键数据：' + facts.join('；') + '。' : null,
      '',
      '为什么重要：' + item.whyImportant
    ].filter(value => value !== null).join('\n');
  }

  const evidence = item.verified
    ? (peer
      ? '事件 A：' + (item.sourceTier || '来源待判断') + '“' + (item.sourceName || '待补充') + '”；事件 B：' + (peer.sourceTier || '来源待判断') + '“' + (peer.sourceName || '待补充') + '”。“为什么重要”和影响对象属于编辑分析。正式发布前仍应分别打开两组原始信源确认是否有更新。'
      : '事实信息来自' + (item.sourceTier || '一级信源') + '“' + (item.sourceName || '待补充') + '”；“为什么重要”和影响对象属于编辑分析。正式发布前仍应重新打开原始信源确认是否有更新。')
    : item.verificationNote;
  const sources = [item.sourceUrl, item.secondaryUrl, peer && peer.sourceUrl, peer && peer.secondaryUrl].map(safeUrl).filter(Boolean);
  const sourceText = sources.length
    ? sources.map((url, index) => '[' + (index + 1) + '] ' + url).join('\n')
    : '原始链接待补充';
  const plainText = [
    title,
    '',
    direct,
    '',
    format === 'compare' && peer ? '同口径对照' : '关键事实',
    format === 'compare' && peer
      ? comparisonRows(item, peer).map(row => '• ' + row[0] + '：' + row[1] + '｜' + row[2]).join('\n')
      : (facts.length ? facts.map(fact => '• ' + fact).join('\n') : '• 待从原始信源逐项核对'),
    '',
    '风险与边界',
    evidence,
    '',
    '下一步',
    item.suggestedAction || '核验后再决定内容动作。',
    '',
    '信源',
    sourceText,
    '',
    '注：市场影响为内容判断，不构成投资建议。'
  ].join('\n');

  return { title, direct, facts, evidence, sources, plainText, peer };
}

function makeVerificationChecklist(item) {
  const url = safeUrl(item.sourceUrl);
  const lines = [
    '候选核验清单｜' + item.title,
    '',
    '1. 打开原始来源，确认标题对应的原文与发布日期。',
    '2. 核对公司名称、股票代码、数字、币种、期间和同比/环比口径。',
    '3. 将事实原文与市场影响判断分开记录。',
    '4. 至少补一个一级信源；社媒或搜索结果不能单独证明事实。',
    '5. 核验完成后，再决定是否生成可发布内容。',
    '',
    '当前状态：' + (item.verificationNote || '待核验'),
    '候选来源：' + item.sourceName,
    url ? '链接：' + url : '链接：待补充'
  ];
  return lines.join('\n');
}

function answerQuery(query, forcedFormat) {
  const clean = String(query || '').trim();
  if (!clean) return;
  const format = forcedFormat || detectFormat(clean);
  const comparePair = format === 'compare' ? findComparePair(clean) : null;
  const item = comparePair ? comparePair[0] : findBestItem(clean);
  if (format === 'compare' && !comparePair) {
    state.answer = null;
    state.answerText = '';
    $('#assistant-output').innerHTML = [
      '<div class="empty-state">',
        '<h3>还缺一个明确的对比对象</h3>',
        '<p>“' + esc(clean) + '”没有同时匹配到两条已核验事件，因此没有擅自替换对象。</p>',
        '<div class="source-links">',
          '<button class="source-link" type="button" data-market-action="compare">去市场手选两条事件</button>',
          '<button class="source-link" type="button" data-prompt="把 SHEIN 和梅卡曼德上市事件做对比">查看对比示例</button>',
        '</div>',
      '</div>'
    ].join('');
    return;
  }
  if (!item) {
    state.answer = null;
    state.answerText = '';
    $('#assistant-output').innerHTML = [
      '<div class="empty-state">',
        '<h3>当前数据池没有匹配答案</h3>',
        '<p>没有找到与“' + esc(clean) + '”匹配的已核验事件，因此没有生成内容，避免把无关信息当答案。</p>',
        '<div class="source-links">',
          '<button class="source-link" type="button" data-prompt="今天最值得写什么？">看今日重点</button>',
          '<button class="source-link" type="button" data-market-action="events">去市场搜索</button>',
        '</div>',
      '</div>'
    ].join('');
    return;
  }

  state.answer = {
    query: clean,
    item,
    peer: comparePair ? comparePair[1] : null,
    format
  };
  renderAnswer();
}

function renderAnswer() {
  const host = $('#assistant-output');
  if (!state.answer) return;
  const item = state.answer.item;

  if (!item.verified) {
    const checklist = makeVerificationChecklist(item);
    state.answerText = checklist;
    const source = safeUrl(item.sourceUrl);
    host.innerHTML = [
      '<article class="answer-card">',
        '<header class="answer-header">',
          '<div class="answer-meta"><span>' + esc(item.market) + '</span><span>' + esc(item.type) + '</span>' + verificationBadge(item) + '</div>',
          '<h2>先别写，先核验这条候选</h2>',
          '<p class="answer-deck">' + esc(item.title) + '</p>',
        '</header>',
        '<div class="answer-body">',
          '<section class="answer-section"><h3>为什么进入候选池</h3><p>' + esc(item.conclusion) + '</p></section>',
          '<section class="evidence-box pending"><h3>核验清单</h3><p>' + esc(checklist) + '</p>',
            source ? '<div class="source-links"><a class="source-link" target="_blank" rel="noopener noreferrer" href="' + esc(source) + '">打开候选来源 ↗</a></div>' : '',
          '</section>',
        '</div>',
        '<div class="answer-actions">',
          '<button class="primary-button" type="button" data-copy-answer>复制核验清单</button>',
          '<button class="secondary-button" type="button" data-open-event="' + esc(item.id) + '" data-kind="candidate">查看候选详情</button>',
        '</div>',
      '</article>'
    ].join('');
    return;
  }

  const draft = makeDraft(item, state.answer.format, state.answer.peer);
  state.answerText = draft.plainText;
  const answerSources = [
    { name: (draft.peer ? '事件 A · ' : '') + (item.sourceName || '一级信源'), url: safeUrl(item.sourceUrl) },
    { name: (draft.peer ? '事件 A · ' : '') + '辅助信源', url: safeUrl(item.secondaryUrl) },
    draft.peer ? { name: '事件 B · ' + (draft.peer.sourceName || '一级信源'), url: safeUrl(draft.peer.sourceUrl) } : null,
    draft.peer ? { name: '事件 B · 辅助信源', url: safeUrl(draft.peer.secondaryUrl) } : null
  ].filter(source => source && source.url)
    .filter((source, index, all) => all.findIndex(candidate => candidate.url === source.url) === index);
  const related = sortedEvents().filter(event => event.id !== item.id).slice(0, 2);

  host.innerHTML = [
    '<article class="answer-card">',
      '<header class="answer-header">',
        '<div class="answer-meta"><span>' + esc(item.market) + '</span><span>' + esc(item.type) + '</span>' + verificationBadge(item) + '</div>',
        '<h2>' + esc(draft.title) + '</h2>',
        '<p class="answer-deck">' + esc(item.conclusion) + '</p>',
        '<div class="format-tabs" role="group" aria-label="输出格式">',
          ['brief', 'analysis', 'compare'].map(format =>
            '<button type="button" class="' + (format === state.answer.format ? 'active' : '') + '" data-answer-format="' + format + '" aria-pressed="' + (format === state.answer.format) + '">' + formatName(format) + '</button>'
          ).join(''),
        '</div>',
      '</header>',
      '<div class="answer-body">',
        '<section class="answer-section"><h3>直接可用</h3><p>' + esc(draft.direct) + '</p></section>',
        draft.peer
          ? '<section class="answer-section"><h3>同口径对照</h3>' + comparisonTableHtml(item, draft.peer) + '</section>'
          : '<section class="answer-section"><h3>关键事实</h3><ul>' + draft.facts.map(fact => '<li>' + esc(fact) + '</li>').join('') + '</ul></section>',
        draft.peer ? '' : '<section class="answer-section"><h3>为什么值得做</h3><p>' + esc(item.whyImportant) + '</p></section>',
        '<section class="evidence-box"><h3>✓ 依据与边界</h3><p>' + esc(draft.evidence) + '</p>',
          '<div class="source-links">',
            answerSources.map(source => '<a class="source-link" target="_blank" rel="noopener noreferrer" href="' + esc(source.url) + '">' + esc(source.name) + ' ↗</a>').join(''),
          '</div>',
        '</section>',
        '<section class="answer-section"><h3>下一步</h3><p>' + esc(cleanAction(item.suggestedAction)) + (draft.peer ? '\n\n对比对象：' + esc(cleanAction(draft.peer.suggestedAction)) : '') + '</p></section>',
        related.length ? '<section class="answer-section"><h3>还可以继续问</h3><div class="source-links">' + related.map(event =>
          '<button class="source-link" type="button" data-generate-event="' + esc(event.id) + '" data-format="brief">' + esc(event.title) + '</button>'
        ).join('') + '</div></section>' : '',
      '</div>',
      '<div class="answer-actions">',
        '<button class="primary-button" type="button" data-copy-answer>复制全文</button>',
        '<button class="secondary-button" type="button" data-save-answer>保存到我的</button>',
        '<button class="secondary-button" type="button" data-open-event="' + esc(item.id) + '" data-kind="verified">查看完整依据</button>',
      '</div>',
    '</article>'
  ].join('');
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      if (!ok) throw new Error('copy failed');
    }
    return true;
  } catch {
    return false;
  }
}

function saveCurrentAnswer() {
  if (!state.answer || !state.answer.item.verified || !state.answerText) return;
  const item = state.answer.item;
  const format = state.answer.format;
  const output = makeDraft(item, format, state.answer.peer);
  const peer = output.peer;
  const id = item.id + '-' + format + (peer ? '-' + peer.id : '');
  const record = {
    id,
    eventId: item.id,
    peerId: peer ? peer.id : '',
    format,
    title: output.title,
    text: state.answerText,
    savedAt: new Date().toISOString()
  };
  state.drafts = [record, ...state.drafts.filter(draft => draft.id !== id)].slice(0, 30);
  writeStorage(STORAGE.drafts, state.drafts);
  renderSavedDrafts();
  showToast('已保存到“我的”');
}

function renderScopeFilters() {
  const scopes = [
    { value: 'verified', label: '已核验 ' + state.events.length },
    { value: 'candidate', label: '待核验候选 ' + state.candidates.length }
  ];
  $('#scope-filters').innerHTML = scopes.map(scope =>
    '<button type="button" class="' + (state.scope === scope.value ? 'active' : '') + '" data-scope="' + scope.value + '" aria-pressed="' + (state.scope === scope.value) + '">' + esc(scope.label) + '</button>'
  ).join('');
}

function currentLibrarySource() {
  return state.scope === 'candidate' ? sortedCandidates() : sortedEvents();
}

function renderFilters() {
  const source = currentLibrarySource();
  const markets = ['全部', ...Array.from(new Set(source.map(item => item.market).filter(Boolean)))];
  const types = ['全部', ...Array.from(new Set(source.map(item => item.type).filter(Boolean)))];
  if (!markets.includes(state.market)) state.market = '全部';
  if (!types.includes(state.type)) state.type = '全部';

  renderScopeFilters();
  $('#market-filters').innerHTML = markets.map(value =>
    '<button type="button" class="chip ' + (state.market === value ? 'active' : '') + '" data-market="' + esc(value) + '" aria-pressed="' + (state.market === value) + '">' + esc(value) + '</button>'
  ).join('');
  $('#type-filters').innerHTML = types.map(value =>
    '<button type="button" class="chip ' + (state.type === value ? 'active' : '') + '" data-type="' + esc(value) + '" aria-pressed="' + (state.type === value) + '">' + esc(value) + '</button>'
  ).join('');
}

function filteredLibrary() {
  const query = state.libraryQuery.trim().toLowerCase();
  return currentLibrarySource().filter(item => {
    const marketMatch = state.market === '全部' || item.market === state.market;
    const typeMatch = state.type === '全部' || item.type === state.type;
    const queryMatch = !query || itemHaystack(item).includes(query) || queryTerms(query).some(term => itemHaystack(item).includes(term));
    return marketMatch && typeMatch && queryMatch;
  });
}

function libraryCardHtml(item) {
  const kind = item.verified ? 'verified' : 'candidate';
  return [
    '<article class="library-card">',
      '<div class="card-meta">',
        '<span>' + esc(item.market) + '</span>',
        '<span>' + esc(item.type) + '</span>',
        verificationBadge(item),
      '</div>',
      '<h3>' + esc(item.title) + '</h3>',
      '<p>' + esc(item.verified ? item.conclusion : item.whyImportant) + '</p>',
      '<div class="library-card-footer">',
        '<small>' + esc(item.sourceName || '来源待补充') + '</small>',
        '<button type="button" data-open-event="' + esc(item.id) + '" data-kind="' + kind + '">' + (item.verified ? '查看并生成' : '查看核验') + '</button>',
      '</div>',
    '</article>'
  ].join('');
}

function renderLibrary() {
  renderFilters();
  const list = filteredLibrary();
  $('#library-count').textContent = '共 ' + list.length + ' 条' + (state.scope === 'verified' ? '已核验内容' : '待核验候选');
  $('#clear-filters').hidden = state.market === '全部' && state.type === '全部' && !state.libraryQuery;
  $('#library-list').innerHTML = list.length
    ? list.map(libraryCardHtml).join('')
    : '<div class="empty-state"><h3>没有匹配内容</h3><p>清除筛选，或换一个股票、人物和主题试试。</p></div>';
}

function findItem(id, kind) {
  const source = kind === 'candidate' ? state.candidates : state.events;
  return source.find(item => String(item.id) === String(id)) || null;
}

function openItem(id, kind) {
  const item = findItem(id, kind);
  if (!item) return;
  const page = currentPage();
  state.returnPage = page === 'detail' ? state.returnPage : page;
  state.selected = item;
  state.selectedKind = kind;
  renderDetail();
  route('event/' + encodeURIComponent(item.id));
}

function renderCorrections(item) {
  const corrections = Array.isArray(item.corrections) ? item.corrections : [];
  if (!corrections.length) return '';
  return corrections.map(correction => [
    '<div class="correction-note">',
      '<strong>' + esc(correction.title || '纠错记录') + '</strong>',
      '<div>' + esc(correction.note || correction.description || '') + '</div>',
    '</div>'
  ].join('')).join('');
}

function aiSteps(item) {
  return String(item.aiAssist || '')
    .replace(/[。；]/g, '、')
    .split('、')
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function renderDetail() {
  const item = state.selected;
  const host = $('#detail-container');
  if (!item) {
    host.innerHTML = '';
    return;
  }

  const primary = safeUrl(item.sourceUrl);
  const secondary = safeUrl(item.secondaryUrl);
  const datasetUpdated = item.verified && state.data ? formatDate(state.data.generatedAt) : '不适用';
  const eventTime = item.time || item.date || '';
  const facts = item.coreData || [];
  const steps = aiSteps(item);
  const primarySourceLabel = item.verified ? (item.sourceTier || '原始信源') : '候选来源';
  const secondarySourceLabel = item.verified ? '辅助信源' : '辅助线索';
  const followTerm = (item.impact || [])[0] || item.market || item.title;
  const followed = Object.values(state.watchlist).flat().some(value => String(value).toLowerCase() === String(followTerm).toLowerCase());

  host.innerHTML = [
    '<article class="reader-detail">',
      '<header class="reader-header">',
        '<div class="reader-meta"><span>' + esc(item.market) + '</span><span>' + esc(item.type) + '</span>' + verificationBadge(item) + '<span>可信度 ' + esc(item.confidence || '待定') + '</span></div>',
        '<h2 id="detail-heading">' + esc(item.title) + '</h2>',
        '<p class="reader-lead">' + esc(item.conclusion) + '</p>',
        renderCorrections(item),
        '<div class="reader-actions">',
          item.verified ? '<button class="primary-button" type="button" data-generate-event="' + esc(item.id) + '" data-format="brief">生成内容</button>' : '<button class="primary-button" type="button" data-copy-checklist="' + esc(item.id) + '">复制核验清单</button>',
          '<button class="secondary-button" type="button" data-prompt="' + esc(item.title + '还有哪些待核验信息？') + '">继续追问</button>',
          item.verified ? '<button class="secondary-button" type="button" data-compare-with="' + esc(item.id) + '">加入对比</button>' : '',
          item.verified ? '<button class="secondary-button" type="button" data-follow-term="' + esc(followTerm) + '">' + (followed ? '已关注' : '关注') + '</button>' : '',
          '<button class="secondary-button" type="button" data-copy-event-link="' + esc(item.id) + '">复制链接</button>',
        '</div>',
      '</header>',
      '<div class="reader-body">',
        '<section class="reader-section"><h3>发生了什么</h3><p>' + esc(item.conclusion) + '</p>' + (facts.length ? '<ul>' + facts.map(fact => '<li>' + esc(fact) + '</li>').join('') + '</ul>' : '') + '</section>',
        '<section class="reader-section analysis-section"><div class="section-label-row"><h3>为什么重要</h3><span class="analysis-label">编辑判断</span></div><p>' + esc(item.whyImportant) + '</p><div class="reader-tags">' + (item.impact || []).map(tag => '<span>' + esc(tag) + '</span>').join('') + '</div></section>',
        '<section class="reader-section"><h3>' + (item.verified ? '下一步看什么' : '还需核验什么') + '</h3><p>' + esc(item.verified ? cleanAction(item.suggestedAction) : item.verificationNote) + '</p><div class="reader-tags">' + (item.contentDirection || []).map(tag => '<span>' + esc(tag) + '</span>').join('') + '</div></section>',
        '<section class="reader-section"><h3>证据状态</h3><div class="key-number">' + esc(item.keyNumber || (item.verified ? '已核验' : '待核验')) + '</div><p>' + esc(item.sourceTier || '来源待判断') + ' · ' + esc(item.sourceName || '待补充') + '</p><dl class="evidence-meta"><div><dt>事件 / 公告时间</dt><dd>' + esc(eventTime || '未单列') + '</dd></div><div><dt>数据集更新</dt><dd>' + esc(datasetUpdated) + '</dd></div><div><dt>核验记录</dt><dd>' + esc(item.verified ? '状态已核验；本版未单列核验人和核验时间' : '尚未完成人工核验') + '</dd></div></dl><div class="source-links">' + (primary ? '<a class="source-link" target="_blank" rel="noopener noreferrer" href="' + esc(primary) + '">' + esc(primarySourceLabel) + ' ↗</a>' : '') + (secondary ? '<a class="source-link" target="_blank" rel="noopener noreferrer" href="' + esc(secondary) + '">' + esc(secondarySourceLabel) + ' ↗</a>' : '') + '</div></section>',
        '<section class="reader-section full"><h3>事实、判断与处理过程</h3><p>事实来自所列信源；“为什么重要”、影响对象和内容建议属于编辑判断，不应写成原文事实。</p>',
          '<details class="process-note"><summary>查看处理过程</summary><ul>' + steps.map(step => '<li>' + esc(step) + '</li>').join('') + '</ul></details>',
        '</section>',
      '</div>',
    '</article>'
  ].join('');
}

function watchlistTerms() {
  return Object.values(state.watchlist).flat().map(value => String(value).trim()).filter(Boolean);
}

function watchGroupFor(term) {
  return /^(?:[A-Z]{1,6}|\d{4,6})(?:\.[A-Z]{2})?$/i.test(String(term || '').trim()) ? '股票' : '主题';
}

function termMatches(item, term) {
  const haystack = itemHaystack(item);
  const lower = term.toLowerCase();
  const expanded = [lower];
  aliasGroups.forEach(group => {
    if (group.pattern.test(term)) expanded.push(...group.terms);
  });
  return Array.from(new Set(expanded)).some(value => {
    if (/^[a-z0-9.]+$/i.test(value)) {
      const words = haystack.match(/[a-z0-9.]+/gi) || [];
      return words.includes(value.toLowerCase());
    }
    return value.length >= 2 && haystack.includes(value.toLowerCase());
  });
}

function renderWatchlist() {
  const host = $('#watch-groups');
  const groups = Object.entries(state.watchlist).filter(([, values]) => values.length);
  host.innerHTML = groups.length ? groups.map(([group, values]) => [
    '<div class="watch-group">',
      '<h4>' + esc(group) + '</h4>',
      '<div class="watch-tags">',
        values.map((value, index) => [
          '<span class="watch-tag">',
            esc(value),
            '<button type="button" data-remove-watch="' + esc(group) + '" data-index="' + index + '" aria-label="删除关注 ' + esc(value) + '">×</button>',
          '</span>'
        ].join('')).join(''),
      '</div>',
    '</div>'
  ].join('')).join('') : '<div class="empty-state"><h3>还没有关注</h3><p>添加股票、人物或主题，相关变化会自动集中到这里。</p></div>';

  const terms = watchlistTerms();
  const matches = terms.length ? sortedEvents().filter(item => terms.some(term => termMatches(item, term))) : [];
  $('#watch-match-count').textContent = matches.length ? matches.length + ' 条相关' : '';
  $('#watch-events').innerHTML = matches.length ? matches.slice(0, 6).map(item => [
    '<div class="watch-event">',
      '<div><h4>' + esc(item.title) + '</h4><p>' + esc(item.market) + ' · ' + esc(item.type) + '</p></div>',
      '<div class="item-actions"><button type="button" data-open-event="' + esc(item.id) + '" data-kind="verified" aria-label="查看 ' + esc(item.title) + '">查看</button></div>',
    '</div>'
  ].join('')).join('') : '<div class="empty-state"><h3>暂无相关变化</h3><p>' + (terms.length ? '已保存关注，出现匹配事件时会显示在这里。' : '先添加一个关注即可开始。') + '</p></div>';
}

function renderSavedDrafts() {
  const host = $('#saved-drafts');
  $('#saved-count').textContent = state.drafts.length;
  host.innerHTML = state.drafts.length ? state.drafts.map(draft => [
    '<div class="saved-item">',
      '<div><h4>' + esc(draft.title) + '</h4><p>' + esc(formatName(draft.format)) + ' · ' + esc(formatDate(draft.savedAt, true)) + '</p></div>',
      '<div class="item-actions">',
        '<button type="button" data-open-draft="' + esc(draft.id) + '" aria-label="打开草稿 ' + esc(draft.title) + '">打开</button>',
        '<button class="danger-button" type="button" data-remove-draft="' + esc(draft.id) + '" aria-label="删除草稿 ' + esc(draft.title) + '">删</button>',
      '</div>',
    '</div>'
  ].join('')).join('') : '<div class="empty-state"><h3>还没有草稿</h3><p>从“今日”或“问一下”生成内容后，可以一键保存到这里。</p></div>';
}

function renderTrust() {
  const host = $('#trust-summary');
  if (!state.data) {
    host.innerHTML = '<div class="empty-state"><h3>数据状态暂不可用</h3><p>请稍后刷新。</p></div>';
    $('#source-health-list').innerHTML = '';
    return;
  }

  const candidateTime = state.candidateMeta && state.candidateMeta.generatedAt;
  const candidateMode = state.candidateMeta && state.candidateMeta.aiConfigured ? '模型辅助与规则初筛' : '规则回退；模型未配置';
  const sources = state.health && Array.isArray(state.health.sources) ? state.health.sources : [];
  const productiveSources = sources.filter(source => Number(source.count || 0) > 0).length;
  host.innerHTML = [
    '<div class="trust-card"><span>已核验内容</span><strong>' + state.events.length + ' 条</strong><small>人工核验后进入首页 · 数据集更新 ' + esc(formatDate(state.data.generatedAt, true)) + '；本版未结构化记录核验人和核验时间</small></div>',
    '<div class="trust-card"><span>已加工候选</span><strong>' + state.candidates.length + ' 条</strong><small>' + esc(candidateMode) + ' · 只做线索，不可直接发布 · 更新 ' + esc(candidateTime ? formatDate(candidateTime, true) : '暂不可用') + '</small></div>',
    '<div class="trust-card"><span>本轮有内容的来源</span><strong>' + productiveSources + ' / ' + sources.length + '</strong><small>请求成功不等于内容覆盖完整；0条来源会单独标出</small></div>'
  ].join('');

  $('#source-health-list').innerHTML = sources.length ? sources.map(source => [
    '<div class="source-row">',
      '<strong>' + esc(source.name) + '</strong>',
      '<span>' + esc(source.trust || '') + '</span>',
      '<span class="source-state ' + esc(source.status || '') + '">' + esc(sourceStatusLabel(source) + (source.preservedCount ? ' · 保留' + source.preservedCount + '条' : '')) + '</span>',
    '</div>'
  ].join('')).join('') : '<div class="empty-state"><h3>来源状态暂不可用</h3><p>这不会改变已核验内容的证据边界。</p></div>';
}

function sourceStatusLabel(source) {
  const status = source && source.status;
  const count = Number(source && source.count || 0);
  if (status === 'ok') return count > 0 ? '直连有内容 · ' + count + '条' : '直连可用 · 本轮0条';
  if (status === 'fallback-ok') return count > 0 ? '降级有内容 · ' + count + '条' : '降级可达 · 本轮0条';
  return ({ error: '失败', 'not-configured': '未配置' })[status] || status || '未知';
}

function renderAll() {
  setDataStatus();
  renderFocus();
  renderDailyBrief();
  renderCandidatePeek();
  renderMarket();
  renderLibrary();
  renderSavedDrafts();
  renderWatchlist();
  renderTrust();
  if (state.answer) renderAnswer();
  if (state.selected) renderDetail();
}

function handlePrompt(prompt) {
  const input = $('#ask-input');
  input.value = prompt;
  resizeAskInput();
  route('workbench');
  answerQuery(prompt);
  setTimeout(() => $('#assistant-output').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function resizeAskInput() {
  const input = $('#ask-input');
  input.style.height = 'auto';
  input.style.height = Math.min(150, Math.max(48, input.scrollHeight)) + 'px';
}

function bindEvents() {
  document.addEventListener('click', async event => {
    const routeLink = event.target.closest('[data-route-link]');
    if (routeLink) {
      event.preventDefault();
      route(routeLink.dataset.routeLink);
      return;
    }

    const nav = event.target.closest('[data-page]');
    if (nav) {
      route(nav.dataset.page);
      return;
    }

    const prompt = event.target.closest('[data-prompt]');
    if (prompt) {
      handlePrompt(prompt.dataset.prompt);
      return;
    }

    const homeAction = event.target.closest('[data-home-action]');
    if (homeAction) {
      route('radar');
      setTimeout(() => $('#daily-brief')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return;
    }

    const marketAction = event.target.closest('[data-market-action]');
    if (marketAction) {
      const action = marketAction.dataset.marketAction;
      if (marketAction.dataset.marketScope) {
        state.scope = marketAction.dataset.marketScope;
        state.market = '全部';
        state.type = '全部';
        state.libraryQuery = '';
        $('#library-search').value = '';
      }
      state.marketView = action === 'calendar' ? 'overview' : action;
      route('market');
      renderMarket();
      if (action === 'calendar') {
        setTimeout(() => $('#market-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
      return;
    }

    const marketView = event.target.closest('[data-market-view]');
    if (marketView) {
      state.marketView = marketView.dataset.marketView;
      renderMarket();
      return;
    }

    const lane = event.target.closest('[data-lane-type]');
    if (lane) {
      state.scope = 'verified';
      state.market = '全部';
      state.type = lane.dataset.laneType;
      state.marketView = 'events';
      route('market');
      renderMarket();
      renderLibrary();
      return;
    }

    const compareWith = event.target.closest('[data-compare-with]');
    if (compareWith) {
      const item = findItem(compareWith.dataset.compareWith, 'verified');
      if (!item) return;
      state.compareA = item.id;
      state.compareB = (findComparable(item) || {}).id || '';
      state.marketView = 'compare';
      route('market');
      renderMarket();
      return;
    }

    const generate = event.target.closest('[data-generate-event]');
    if (generate) {
      const item = findItem(generate.dataset.generateEvent, 'verified');
      if (!item) return;
      state.answer = {
        query: '把“' + item.title + '”写成' + formatName(generate.dataset.format),
        item,
        format: generate.dataset.format || 'brief'
      };
      $('#ask-input').value = state.answer.query;
      resizeAskInput();
      route('workbench');
      renderAnswer();
      setTimeout(() => $('#assistant-output').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      return;
    }

    const open = event.target.closest('[data-open-event]');
    if (open) {
      openItem(open.dataset.openEvent, open.dataset.kind || 'verified');
      return;
    }

    const answerFormat = event.target.closest('[data-answer-format]');
    if (answerFormat && state.answer) {
      state.answer.format = answerFormat.dataset.answerFormat;
      renderAnswer();
      return;
    }

    if (event.target.closest('[data-copy-answer]')) {
      showToast(await copyText(state.answerText) ? '已复制全文' : '复制失败，请手动选择');
      return;
    }

    const copyEventLink = event.target.closest('[data-copy-event-link]');
    if (copyEventLink) {
      const url = new URL(location.href);
      url.hash = 'event/' + encodeURIComponent(copyEventLink.dataset.copyEventLink);
      showToast(await copyText(url.href) ? '事件链接已复制' : '复制失败，请手动复制地址栏');
      return;
    }

    if (event.target.closest('[data-save-answer]')) {
      saveCurrentAnswer();
      return;
    }

    const checklist = event.target.closest('[data-copy-checklist]');
    if (checklist) {
      const item = findItem(checklist.dataset.copyChecklist, 'candidate') || state.selected;
      const text = item ? makeVerificationChecklist(item) : '';
      showToast(await copyText(text) ? '已复制核验清单' : '复制失败，请手动选择');
      return;
    }

    const libraryScope = event.target.closest('[data-library-scope]');
    if (libraryScope) {
      state.scope = libraryScope.dataset.libraryScope;
      state.market = '全部';
      state.type = '全部';
      state.marketView = 'events';
      route('market');
      renderLibrary();
      return;
    }

    const scope = event.target.closest('[data-scope]');
    if (scope) {
      state.scope = scope.dataset.scope;
      state.market = '全部';
      state.type = '全部';
      renderLibrary();
      return;
    }

    const market = event.target.closest('[data-market]');
    if (market) {
      state.market = market.dataset.market;
      renderLibrary();
      return;
    }

    const type = event.target.closest('[data-type]');
    if (type) {
      state.type = type.dataset.type;
      renderLibrary();
      return;
    }

    const follow = event.target.closest('[data-follow-term]');
    if (follow) {
      const value = follow.dataset.followTerm.trim();
      const group = watchGroupFor(value);
      const exists = state.watchlist[group].some(item => item.toLowerCase() === value.toLowerCase());
      if (!exists) state.watchlist[group].push(value);
      writeStorage(STORAGE.watchlist, state.watchlist);
      renderWatchlist();
      if (state.selected) renderDetail();
      showToast(exists ? '已经关注过了' : '已添加关注');
      return;
    }

    const removeWatch = event.target.closest('[data-remove-watch]');
    if (removeWatch) {
      const group = removeWatch.dataset.removeWatch;
      state.watchlist[group].splice(Number(removeWatch.dataset.index), 1);
      writeStorage(STORAGE.watchlist, state.watchlist);
      renderWatchlist();
      showToast('已删除关注');
      return;
    }

    const openDraft = event.target.closest('[data-open-draft]');
    if (openDraft) {
      const draft = state.drafts.find(item => item.id === openDraft.dataset.openDraft);
      const item = draft && state.events.find(eventItem => eventItem.id === draft.eventId);
      if (draft && item) {
        const format = normalizeFormat(draft.format);
        const peer = draft.peerId ? state.events.find(eventItem => eventItem.id === draft.peerId) || null : null;
        state.answer = { query: draft.title, item, peer, format };
        route('workbench');
        renderAnswer();
      } else {
        showToast('原事件已不在当前数据中');
      }
      return;
    }

    const removeDraft = event.target.closest('[data-remove-draft]');
    if (removeDraft) {
      state.drafts = state.drafts.filter(item => item.id !== removeDraft.dataset.removeDraft);
      writeStorage(STORAGE.drafts, state.drafts);
      renderSavedDrafts();
      showToast('已删除草稿');
    }
  });

  $('#prev-event').addEventListener('click', () => changeFeed(-1));
  $('#next-event').addEventListener('click', () => changeFeed(1));
  $('#back-btn').addEventListener('click', () => route(state.returnPage || 'radar'));
  $('#refresh-btn').addEventListener('click', () => loadData({ fresh: true }));

  $('#ask-form').addEventListener('submit', event => {
    event.preventDefault();
    answerQuery($('#ask-input').value);
  });

  $('#ask-input').addEventListener('input', resizeAskInput);
  $('#ask-input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      $('#ask-form').requestSubmit();
    }
  });

  $('#library-search').addEventListener('input', event => {
    state.libraryQuery = event.target.value;
    renderLibrary();
  });

  $('#compare-a').addEventListener('change', event => {
    state.compareA = event.target.value;
    renderCompare();
  });

  $('#compare-b').addEventListener('change', event => {
    state.compareB = event.target.value;
    renderCompare();
  });

  $('#clear-filters').addEventListener('click', () => {
    state.market = '全部';
    state.type = '全部';
    state.libraryQuery = '';
    $('#library-search').value = '';
    renderLibrary();
  });

  $('#watch-form').addEventListener('submit', event => {
    event.preventDefault();
    const group = $('#watch-type').value;
    const input = $('#watch-input');
    const value = input.value.trim();
    if (!value) return;
    const exists = state.watchlist[group].some(item => item.toLowerCase() === value.toLowerCase());
    if (!exists) state.watchlist[group].push(value);
    writeStorage(STORAGE.watchlist, state.watchlist);
    input.value = '';
    renderWatchlist();
    showToast(exists ? '已经关注过了' : '已添加关注');
  });

  $('#example-watchlist').addEventListener('click', () => {
    state.watchlist = cloneWatchlist(exampleWatchlist);
    writeStorage(STORAGE.watchlist, state.watchlist);
    renderWatchlist();
    showToast('已加入示例，可随时删除');
  });

  window.addEventListener('popstate', () => route(location.hash, { fromHistory: true, instant: true }));
  window.addEventListener('online', () => showToast('网络已恢复'));
  window.addEventListener('offline', () => showToast('当前离线，个人草稿仍可使用'));

  document.addEventListener('keydown', event => {
    if (currentPage() !== 'radar') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (['ArrowDown', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      changeFeed(1);
    }
    if (['ArrowUp', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      changeFeed(-1);
    }
  });

  let touchStart = null;
  $('#focus-stage').addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  $('#focus-stage').addEventListener('touchend', event => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx)) changeFeed(dy < 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });
}

function init() {
  state.watchlist = cloneWatchlist(readStorage(STORAGE.watchlist, emptyWatchlist));
  const drafts = readStorage(STORAGE.drafts, []);
  state.drafts = Array.isArray(drafts) ? drafts : [];

  bindEvents();
  route(location.hash, { fromHistory: true, instant: true });
  loadData();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
