import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.cwd(), 'market-diary');
const read = file => fs.readFile(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [html, app, css, eventText, candidateText, rawCandidateText, healthText, secText, manifestText, sw, enrich, update] = await Promise.all([
  read('index.html'),
  read('app.js'),
  read('styles.css'),
  read('data/events.json'),
  read('data/ai-candidates.json'),
  read('data/candidates.json'),
  read('data/source-health.json'),
  read('data/sec-watchlist.json'),
  read('manifest.webmanifest'),
  read('sw.js'),
  read('scripts/enrich-candidates.mjs'),
  read('scripts/update-candidates.mjs')
]);

const events = JSON.parse(eventText);
const candidates = JSON.parse(candidateText);
const rawCandidates = JSON.parse(rawCandidateText);
const health = JSON.parse(healthText);
const sec = JSON.parse(secText);
const manifest = JSON.parse(manifestText);

const testHooks = {};
const testContext = vm.createContext({
  testHooks,
  document: { addEventListener() {} }
});
vm.runInContext(app + '\nObject.assign(testHooks, { state, findBestItem, findComparePair, normalizeFormat, bindEvents, route });', testContext);
testHooks.state.events = events.events;
testHooks.state.candidates = [];

function fakeElement(id, dataset = {}) {
  const classes = new Set();
  return {
    id,
    dataset,
    classList: {
      toggle(name, active) { active ? classes.add(name) : classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    style: {},
    scrollHeight: 48,
    value: '',
    hidden: false,
    innerHTML: '',
    textContent: '',
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {}
  };
}

const legacyIds = [
  'page-title', 'prev-event', 'next-event', 'back-btn', 'refresh-btn', 'ask-form', 'ask-input',
  'library-search', 'scope-filters', 'market-filters', 'type-filters', 'library-count', 'clear-filters',
  'library-list', 'watch-form', 'watch-type', 'watch-input', 'example-watchlist', 'focus-stage'
];
const legacyElements = new Map(legacyIds.map(id => [id, fakeElement(id)]));
const legacyPages = ['radar', 'workbench', 'library', 'my', 'detail'].map(page => fakeElement('page-' + page));
const legacyNav = ['radar', 'workbench', 'library', 'my'].map(page => fakeElement('nav-' + page, { page }));
for (const element of [...legacyPages, ...legacyNav]) legacyElements.set(element.id, element);
testContext.document = {
  title: '',
  addEventListener() {},
  querySelector(selector) {
    if (selector === '.page.active') return legacyPages.find(page => page.classList.contains('active')) || null;
    return selector.startsWith('#') ? legacyElements.get(selector.slice(1)) || null : null;
  },
  querySelectorAll(selector) {
    if (selector === '.page') return legacyPages;
    if (selector === '.nav-item') return legacyNav;
    return [];
  }
};
testContext.window = { addEventListener() {}, scrollTo() {} };
testContext.location = { hash: '#market', href: 'https://example.test/market-diary/#market' };
testContext.history = { pushState() {}, replaceState() {} };
testHooks.bindEvents();
testHooks.route('market', { fromHistory: true, instant: true });
assert(legacyElements.get('page-library').classList.contains('active'), 'cached legacy market page must remain visible with the new script');
assert(legacyElements.get('nav-library').classList.contains('active'), 'cached legacy market navigation must remain active with the new script');

const requiredIds = [
  'page-radar',
  'page-workbench',
  'page-market',
  'page-my',
  'page-detail',
  'ask-form',
  'market-summary',
  'market-story',
  'market-calendar',
  'compare-a',
  'compare-b',
  'compare-output',
  'library-list',
  'toast'
];

requiredIds.forEach(id => assert(html.includes('id="' + id + '"'), 'missing required id: ' + id));
assert((html.match(/<link[^>]+stylesheet/g) || []).length === 1, 'frontend must load exactly one stylesheet');
assert((html.match(/<script[^>]+src=/g) || []).length === 1, 'frontend must load exactly one external script');
assert(/src="\.\/app\.js(?:\?[^" ]+)?"/.test(html), 'app.js must be the active frontend script');
assert(html.includes('rel="manifest"'), 'web app manifest is required');
assert(html.includes('rel="apple-touch-icon"'), 'apple touch icon is required');
assert(app.includes("register('./sw.js')"), 'service worker registration is required');
assert(app.includes("cache: fresh ? 'no-store' : 'no-cache'"), 'data requests must revalidate online');
assert(app.includes("library: 'market'") && app.includes("content: 'market'"), 'legacy content routes must map to market');
assert(app.includes("raw === 'library' || raw === 'content'") && app.includes("state.marketView = 'events'"), 'legacy content routes must open the market event list');
assert(app.includes("page === 'market' && !$('#page-market') && $('#page-library')") && app.includes("navPage === 'market' && button.dataset.page === 'library'"), 'new scripts must keep cached legacy market markup navigable during upgrades');
assert(app.includes("raw.match(/^event\\/(.+)$/)") && app.includes("'#event/' + encodeURIComponent(state.selected.id)"), 'event detail routes must be shareable and restorable');
assert(app.includes('data-copy-event-link'), 'event detail must offer a copy-link action');
assert(app.includes('function findComparePair') && app.includes('peer: comparePair ? comparePair[1] : null'), 'explicit comparison queries must preserve both matched events');
assert(app.includes("const compareA = $('#compare-a')") && app.includes('if (compareA)') && app.includes("const compareB = $('#compare-b')") && app.includes('if (compareB)'), 'new controls must be guarded while a cached legacy page upgrades');
assert(app.includes('peerId: peer ? peer.id') && app.includes('eventItem.id === draft.peerId'), 'saved comparisons must preserve their second event');
assert(app.includes("['事件日期', fullDate(first.date), fullDate(second.date)]"), 'comparison dates must retain the year');
assert(app.includes('const refreshedItem = pool.find') && app.includes('state.answer.peer = refreshedPeer'), 'data refresh must rebind the current answer to fresh event objects');
assert(app.includes('旧成稿已停止展示'), 'expired answers must be removed from the workbench after refresh');
assert(app.includes("item.verified ? (item.sourceTier || '原始信源') : '候选来源'"), 'candidate links must not be mislabeled as verified primary sources');
assert(app.includes('function isOverviewQuery') && app.includes('if (isOverviewQuery(query)) return sortedEvents()[0]'), 'overview queries must use the current verified priority directly');
for (const query of ['房地产市场怎么走', '原油市场怎么走', '黄金市场怎么走']) {
  assert(testHooks.findBestItem(query) === null, 'unmatched entity query must not fall back to an unrelated event: ' + query);
}
const overviewQueries = ['今天发生了什么', '今天有什么市场大事', '今天有哪些要闻', '给我看看今天的重点', '市场有什么重点'];
const overviewId = testHooks.findBestItem(overviewQueries[0])?.id;
assert(overviewId, 'overview query must return a verified priority');
for (const query of overviewQueries) assert(testHooks.findBestItem(query)?.id === overviewId, 'overview query synonyms must resolve consistently: ' + query);
const pairFixtures = [
  ['对比阿里配售和美国非农', 'baba-placement-80b,bls-benchmark-2026'],
  ['对比SHEIN和NVDA', 'shein-hk-debut-sep1,nvda-q2-fy27'],
  ['把梅卡曼德和SHEIN上市事件做对比', 'mechmind-hk-debut-sep1,shein-hk-debut-sep1']
];
for (const [query, expected] of pairFixtures) {
  const pair = testHooks.findComparePair(query);
  assert(pair && pair.map(item => item.id).join(',') === expected, 'comparison query resolved the wrong pair: ' + query);
}
assert(testHooks.findComparePair('对比阿里和黄金') === null, 'comparison must not invent a missing second object');
assert(testHooks.normalizeFormat('community') === 'brief' && testHooks.normalizeFormat('compare') === 'compare', 'legacy draft format must normalize safely');
assert(html.includes('data-page="market"') && !html.includes('data-page="library"'), 'market must be the third primary entry');
assert((html.match(/data-market-scope="verified"/g) || []).length >= 2 && app.includes("if (marketAction.dataset.marketScope)") && app.includes("state.libraryQuery = ''"), 'home verified-event shortcuts must reset candidate filters');
assert(!html.includes('今日三条已核验信号'), 'recent events must not be mislabeled as today events');
assert(html.includes('当前是事件市场视图'), 'market page must disclose the no-realtime-data boundary');
const comparisonSource = app.slice(app.indexOf('function comparisonRows'), app.indexOf('function comparisonTableHtml'));
assert(comparisonSource && !comparisonSource.includes('keyNumber') && !comparisonSource.includes('coreData'), 'comparison must not compare untyped free-text metrics');
assert(app.includes('当前数据缺少统一数值口径'), 'comparison must disclose missing comparable metrics');
assert(!/analytics\.js|product-upgrades\.js|requestcatcher/i.test(html + app), 'temporary analytics or legacy patch script is active');
assert(!/visitor_id|md_viewer_label|MarketDiaryAnalytics/.test(app), 'persistent visitor tracking remains in active app');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced-motion support is required');
assert(sw.includes("key.startsWith(CACHE_PREFIX)"), 'service worker may only delete Market Diary caches');
assert(sw.includes("SHELL.map(path => new Request(path, { cache: 'reload' }))"), 'service worker install must bypass stale HTTP cache');
assert(sw.includes("cache: request.mode === 'navigate' ? 'reload' : 'no-cache'"), 'service worker network requests must revalidate deployed assets');
assert(sw.includes('event.waitUntil(\n    network.then'), 'runtime cache writes must keep the service worker alive');
assert(!sw.includes('ignoreSearch: true'), 'service worker must not mix differently versioned shell assets');
const styleAsset = html.match(/href="(\.\/styles\.css\?v=[^"]+)"/)?.[1];
const scriptAsset = html.match(/src="(\.\/app\.js\?v=[^"]+)"/)?.[1];
assert(styleAsset && sw.includes("'" + styleAsset + "'"), 'service worker shell must cache the exact stylesheet version');
assert(scriptAsset && sw.includes("'" + scriptAsset + "'"), 'service worker shell must cache the exact script version');
assert(manifest.icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png'), '192px PNG icon is required');
assert(manifest.icons.some(icon => icon.sizes === '512x512' && icon.type === 'image/png'), '512px PNG icon is required');
await Promise.all(['icon-192.png', 'icon-512.png'].map(file => fs.access(path.join(root, file))));
assert(enrich.includes('id:x.id') && enrich.includes('byId.get(String(x.id))'), 'AI enrichment must preserve and join by candidate id');
assert(update.includes('runLimited(tasks)') && update.includes('preservedItems'), 'candidate collection must limit concurrency and preserve recent items on source failure');
assert(update.includes("x.status==='error'") && update.includes('inWindow(x.pubDate)'), 'candidate carry-over must be limited to failed sources and the active time window');

assert(Array.isArray(events.events) && events.events.length > 0, 'events.json must contain events');
assert(events.events.every(event => event.verified === true), 'every event-layer item must be explicitly verified');
const ids = new Set();
for (const event of events.events) {
  assert(event.id && !ids.has(event.id), 'event id missing or duplicated: ' + event.id);
  ids.add(event.id);
  for (const field of ['title', 'conclusion', 'whyImportant', 'market', 'type', 'sourceName', 'sourceUrl']) {
    assert(event[field], 'event ' + event.id + ' missing ' + field);
  }
  assert(/^\d{4}-\d{2}-\d{2}$/.test(event.date || '') && Number.isFinite(Date.parse(event.date + 'T00:00:00Z')), 'event ' + event.id + ' has invalid date');
  assert(Array.isArray(event.coreData) && event.coreData.every(value => typeof value === 'string' && value.trim()), 'event ' + event.id + ' coreData must contain non-empty strings');
  assert(Array.isArray(event.impact) && event.impact.every(value => typeof value === 'string' && value.trim()), 'event ' + event.id + ' impact must contain non-empty strings');
  if (event.verified) {
    assert(event.sourceTier && event.confidence, 'verified event ' + event.id + ' missing evidence metadata');
    assert(/^https?:\/\//.test(event.sourceUrl), 'verified event ' + event.id + ' has invalid source URL');
  }
}

assert(Array.isArray(candidates.items), 'ai-candidates.json must contain an items array');
assert(typeof candidates.aiConfigured === 'boolean', 'ai-candidates.json must disclose aiConfigured');
if (!candidates.aiConfigured) {
  assert(candidates.model === 'rule-fallback', 'unconfigured AI must identify the rule fallback model');
  assert(candidates.items.every(item => item.ai && item.ai.mode === 'rule-fallback'), 'unconfigured AI items must be marked rule-fallback');
}
assert(Array.isArray(rawCandidates.items), 'candidates.json must contain an items array');
const rawIds = new Set(rawCandidates.items.map(item => String(item.id)));
const candidateIds = new Set();
for (const candidate of candidates.items) {
  assert(candidate.id && !candidateIds.has(String(candidate.id)), 'candidate id missing or duplicated: ' + candidate.id);
  candidateIds.add(String(candidate.id));
  assert(rawIds.has(String(candidate.id)), 'enriched candidate is not present in raw candidate pool: ' + candidate.id);
  assert(candidate.verified !== true, 'automatic candidate must never be marked verified: ' + candidate.id);
  assert(candidate.title && candidate.source && /^https?:\/\//.test(candidate.link || ''), 'candidate missing title, source, or valid link: ' + candidate.id);
}

assert(Array.isArray(health.sources), 'source-health.json must contain a sources array');
assert(health.summary && health.summary.total === health.sources.length, 'source health total must match source rows');
assert(health.summary.ok === health.sources.filter(source => source.status === 'ok').length, 'source health ok summary must match rows');
assert(health.summary.fallback === health.sources.filter(source => source.status === 'fallback-ok').length, 'source health fallback summary must match rows');
assert(health.summary.error === health.sources.filter(source => source.status === 'error').length, 'source health error summary must match rows');
assert(health.summary.notConfigured === health.sources.filter(source => source.status === 'not-configured').length, 'source health notConfigured summary must match rows');
const allowedStatuses = new Set(['ok', 'fallback-ok', 'error', 'not-configured']);
for (const source of health.sources) {
  assert(source.key && source.name && allowedStatuses.has(source.status), 'source health row has invalid identity or status');
  assert(Number.isInteger(source.count) && source.count >= 0, 'source ' + source.key + ' has invalid count');
  assert(Number.isFinite(Date.parse(source.checkedAt)), 'source ' + source.key + ' has invalid checkedAt');
}
assert(app.includes('本轮0条'), 'source UI must distinguish reachable zero-result sources');

assert(Array.isArray(sec.health) && sec.summary && sec.summary.watchEntities === sec.health.length, 'SEC watchlist summary must match health rows');
assert(sec.summary.healthy === sec.health.filter(item => item.status === 'ok').length, 'SEC healthy summary must match rows');
assert(sec.summary.errors === sec.health.filter(item => item.status === 'error').length, 'SEC error summary must match rows');
assert(Array.isArray(sec.filings) && sec.summary.filings === sec.filings.length, 'SEC filings summary must match rows');
assert(Array.isArray(sec.holdingSignals) && sec.summary.holdingSignals === sec.holdingSignals.length, 'SEC holding-signal summary must match rows');

console.log('frontend contract ok | verified=' + events.events.length + ' processedCandidates=' + candidates.items.length + ' rawCandidates=' + rawCandidates.items.length + ' sources=' + health.sources.length + ' secHealthy=' + sec.summary.healthy + '/' + sec.summary.watchEntities);
