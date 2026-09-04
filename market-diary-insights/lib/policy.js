const EVENT_TYPES = new Set(['page_view', 'ui_click', 'interaction', 'consent']);
const PAGES = new Set(['radar', 'workbench', 'market', 'my', 'detail']);
const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
const KINDS = new Set(['verified', 'candidate']);
const FORMATS = new Set(['brief', 'analysis', 'compare']);
const METHODS = new Set(['click', 'keyboard', 'swipe', 'history', 'direct']);
const RESULTS = new Set(['success', 'failure', 'matched', 'no_match', 'needs_pair', 'cache', 'duplicate']);

const ACTIONS = new Set([
  'consent.granted',
  'nav.home', 'nav.radar', 'nav.workbench', 'nav.market', 'nav.my', 'nav.data_status', 'nav.detail_back',
  'home.brief', 'market.open_events', 'market.open_compare', 'market.open_calendar', 'market.open_candidates',
  'market.tab_select', 'market.lane_select',
  'feed.prev', 'feed.next', 'feed.navigate',
  'event.open', 'event.link_copy',
  'prompt.preset', 'ask.submit', 'ask.result',
  'content.generate', 'content.format_change', 'content.copy', 'checklist.copy',
  'draft.save', 'draft.open', 'draft.delete',
  'filter.scope', 'filter.market', 'filter.type', 'filter.clear', 'library.search',
  'compare.add', 'compare.select',
  'watch.add', 'watch.remove', 'watch.example_load',
  'source.open', 'data.refresh_click', 'data.refresh_result', 'details.toggle'
]);

const EVENT_KEYS = new Set(['id', 'type', 'at', 'page', 'action', 'targetId', 'targetKind', 'format', 'method', 'result', 'sourceHost', 'countBucket']);
const SESSION_KEYS = new Set(['version', 'visitorId', 'sessionId', 'startedAt', 'inviteCode', 'device', 'referrerHost', 'events']);

function hasOnlyKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.has(key));
}

function cleanEnum(value, allowed) {
  const candidate = String(value || '');
  return allowed.has(candidate) ? candidate : '';
}

function cleanId(value, prefix) {
  const candidate = String(value || '');
  const pattern = new RegExp('^' + prefix + '[a-f0-9]{20,40}$');
  return pattern.test(candidate) ? candidate : '';
}

function cleanPublicId(value) {
  const candidate = String(value || '');
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(candidate) ? candidate : '';
}

function cleanHost(value) {
  const candidate = String(value || '').toLowerCase();
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)*[a-z0-9][a-z0-9-]{0,62}$/.test(candidate) ? candidate : '';
}

function cleanTimestamp(value, now) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return now.toISOString();
  const lower = now.getTime() - 48 * 60 * 60 * 1000;
  const upper = now.getTime() + 5 * 60 * 1000;
  return new Date(Math.min(upper, Math.max(lower, parsed))).toISOString();
}

function cleanBucket(value) {
  const candidate = String(value || '');
  return /^(?:0|1-5|6-15|16-40|40\+)$/.test(candidate) ? candidate : '';
}

export function sanitizeEvent(raw, now = new Date()) {
  if (!hasOnlyKeys(raw, EVENT_KEYS)) return null;
  const id = cleanId(raw.id, 'me_');
  const type = cleanEnum(raw.type, EVENT_TYPES);
  const page = cleanEnum(raw.page, PAGES);
  if (!id || !type || !page) return null;

  const action = raw.action === undefined ? '' : cleanEnum(raw.action, ACTIONS);
  if (raw.action !== undefined && !action) return null;

  const event = { id, type, at: cleanTimestamp(raw.at, now), page };
  if (action) event.action = action;

  const optional = [
    ['targetId', cleanPublicId(raw.targetId)],
    ['targetKind', cleanEnum(raw.targetKind, KINDS)],
    ['format', cleanEnum(raw.format, FORMATS)],
    ['method', cleanEnum(raw.method, METHODS)],
    ['result', cleanEnum(raw.result, RESULTS)],
    ['sourceHost', cleanHost(raw.sourceHost)],
    ['countBucket', cleanBucket(raw.countBucket)]
  ];
  for (const [key, value] of optional) {
    if (raw[key] !== undefined && !value) return null;
    if (value) event[key] = value;
  }
  return event;
}

export function sanitizeSession(raw, now = new Date()) {
  if (!hasOnlyKeys(raw, SESSION_KEYS)) return null;
  if (raw.version !== 1 || !Array.isArray(raw.events) || raw.events.length < 1 || raw.events.length > 200) return null;

  const visitorId = cleanId(raw.visitorId, 'mv_');
  const sessionId = cleanId(raw.sessionId, 'ms_');
  const device = cleanEnum(raw.device, DEVICES);
  const inviteCode = raw.inviteCode === undefined || raw.inviteCode === ''
    ? ''
    : (/^[A-Za-z0-9_-]{10,32}$/.test(String(raw.inviteCode)) ? String(raw.inviteCode) : '');
  const referrerHost = raw.referrerHost === undefined || raw.referrerHost === '' ? '' : cleanHost(raw.referrerHost);
  if (!visitorId || !sessionId || !device) return null;
  if (raw.inviteCode !== undefined && raw.inviteCode !== '' && !inviteCode) return null;
  if (raw.referrerHost !== undefined && raw.referrerHost !== '' && !referrerHost) return null;

  const events = raw.events.map(event => sanitizeEvent(event, now));
  if (events.some(event => !event)) return null;
  const uniqueEvents = [...new Map(events.map(event => [event.id, event])).values()];

  return {
    version: 1,
    visitorId,
    sessionId,
    startedAt: cleanTimestamp(raw.startedAt, now),
    inviteCode,
    device,
    referrerHost,
    events: uniqueEvents
  };
}

function eventLabel(event) {
  return event.action || event.type;
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function topEntry(map, fallback = '—') {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted[0]?.[0] || fallback;
}

export function aggregateSessions(sessions, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const days = [7, 30, 90].includes(Number(options.days)) ? Number(options.days) : 30;
  const cutoff = now.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
  const visitorMap = new Map();
  const dailyMap = new Map();
  const actionMap = new Map();
  const pageMap = new Map();
  const inviteMap = new Map();
  const recent = [];
  const funnelSets = {
    radar: new Set(),
    event: new Set(),
    generate: new Set(),
    retain: new Set(),
    market: new Set(),
    filter: new Set(),
    ask: new Set(),
    answer: new Set()
  };

  let pageViews = 0;
  let clicks = 0;
  let includedSessions = 0;

  for (const session of Array.isArray(sessions) ? sessions : []) {
    const events = (Array.isArray(session.events) ? session.events : []).filter(event => {
      const time = Date.parse(event.at);
      return Number.isFinite(time) && time >= cutoff && time <= now.getTime() + 5 * 60 * 1000;
    });
    if (!events.length) continue;
    includedSessions += 1;

    const visitorId = String(session.visitorId || '');
    const inviteLabel = String(session.invite?.label || '');
    const visitor = visitorMap.get(visitorId) || {
      visitorId,
      label: inviteLabel || ('匿名 ' + visitorId.slice(-6).toUpperCase()),
      tagged: Boolean(inviteLabel),
      devices: new Map(),
      pages: new Map(),
      actions: new Map(),
      sessions: new Set(),
      clicks: 0,
      pageViews: 0,
      firstSeenAt: events[0].at,
      lastSeenAt: events[0].at
    };
    if (inviteLabel) {
      visitor.label = inviteLabel;
      visitor.tagged = true;
    }
    visitor.sessions.add(session.sessionId);
    increment(visitor.devices, session.device || 'desktop');

    const inviteKey = inviteLabel || '未标记';
    const invite = inviteMap.get(inviteKey) || { label: inviteKey, visitors: new Set(), sessions: new Set(), clicks: 0 };
    invite.visitors.add(visitorId);
    invite.sessions.add(session.sessionId);

    for (const event of events) {
      const isClick = event.type === 'ui_click';
      const isPageView = event.type === 'page_view';
      const day = event.at.slice(0, 10);
      const daily = dailyMap.get(day) || { date: day, visitors: new Set(), sessions: new Set(), clicks: 0, pageViews: 0 };
      daily.visitors.add(visitorId);
      daily.sessions.add(session.sessionId);

      const page = pageMap.get(event.page) || { page: event.page, clicks: 0, pageViews: 0 };
      increment(visitor.pages, event.page);
      if (event.action) increment(visitor.actions, event.action);
      if (isPageView) {
        pageViews += 1;
        visitor.pageViews += 1;
        daily.pageViews += 1;
        page.pageViews += 1;
      }
      if (isClick) {
        clicks += 1;
        visitor.clicks += 1;
        daily.clicks += 1;
        page.clicks += 1;
        invite.clicks += 1;
        increment(actionMap, eventLabel(event));
      }

      if (event.page === 'radar' && isPageView) funnelSets.radar.add(visitorId);
      if (event.action === 'event.open') funnelSets.event.add(visitorId);
      if (event.action === 'content.generate') funnelSets.generate.add(visitorId);
      if (['content.copy', 'draft.save'].includes(event.action)) funnelSets.retain.add(visitorId);
      if (event.page === 'market' && isPageView) funnelSets.market.add(visitorId);
      if (event.action?.startsWith('filter.')) funnelSets.filter.add(visitorId);
      if (event.action === 'ask.submit') funnelSets.ask.add(visitorId);
      if (event.action === 'ask.result' && event.result === 'matched') funnelSets.answer.add(visitorId);

      if (Date.parse(event.at) < Date.parse(visitor.firstSeenAt)) visitor.firstSeenAt = event.at;
      if (Date.parse(event.at) > Date.parse(visitor.lastSeenAt)) visitor.lastSeenAt = event.at;
      recent.push({
        at: event.at,
        visitorId,
        label: visitor.label,
        page: event.page,
        type: event.type,
        action: event.action || '',
        targetId: event.targetId || '',
        targetKind: event.targetKind || '',
        format: event.format || '',
        result: event.result || ''
      });

      dailyMap.set(day, daily);
      pageMap.set(event.page, page);
    }
    visitorMap.set(visitorId, visitor);
    inviteMap.set(inviteKey, invite);
  }

  const visitors = [...visitorMap.values()].map(visitor => ({
    visitorId: visitor.visitorId,
    label: visitor.label,
    tagged: visitor.tagged,
    device: topEntry(visitor.devices),
    sessions: visitor.sessions.size,
    clicks: visitor.clicks,
    pageViews: visitor.pageViews,
    topPage: topEntry(visitor.pages),
    topAction: topEntry(visitor.actions),
    firstSeenAt: visitor.firstSeenAt,
    lastSeenAt: visitor.lastSeenAt
  })).sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));

  const daily = [...dailyMap.values()].map(row => ({
    date: row.date,
    visitors: row.visitors.size,
    sessions: row.sessions.size,
    clicks: row.clicks,
    pageViews: row.pageViews
  })).sort((a, b) => a.date.localeCompare(b.date));

  const topActions = [...actionMap.entries()].map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action)).slice(0, 20);
  const pages = [...pageMap.values()].sort((a, b) => b.clicks + b.pageViews - a.clicks - a.pageViews);
  const invites = [...inviteMap.values()].map(invite => ({
    label: invite.label,
    visitors: invite.visitors.size,
    sessions: invite.sessions.size,
    clicks: invite.clicks
  })).sort((a, b) => b.clicks - a.clicks);

  const funnel = [
    { key: 'radar', label: '进入今日', visitors: funnelSets.radar.size },
    { key: 'event', label: '查看事件', visitors: funnelSets.event.size },
    { key: 'generate', label: '生成内容', visitors: funnelSets.generate.size },
    { key: 'retain', label: '复制或保存', visitors: funnelSets.retain.size },
    { key: 'market', label: '进入市场', visitors: funnelSets.market.size },
    { key: 'filter', label: '使用筛选', visitors: funnelSets.filter.size },
    { key: 'ask', label: '提交问题', visitors: funnelSets.ask.size },
    { key: 'answer', label: '匹配答案', visitors: funnelSets.answer.size }
  ];

  return {
    meta: {
      generatedAt: now.toISOString(),
      days,
      privacyModel: 'opt-in anonymous browser analytics',
      retentionDays: 90
    },
    totals: {
      visitors: visitors.length,
      sessions: includedSessions,
      clicks,
      pageViews,
      clicksPerVisitor: visitors.length ? Number((clicks / visitors.length).toFixed(1)) : 0,
      taggedVisitors: visitors.filter(visitor => visitor.tagged).length
    },
    daily,
    topActions,
    pages,
    invites,
    funnel,
    visitors,
    recent: recent.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 120)
  };
}

