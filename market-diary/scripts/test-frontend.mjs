import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'market-diary');
const read = file => fs.readFile(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [html, app, css, eventText, candidateText, manifestText, sw, enrich, update] = await Promise.all([
  read('index.html'),
  read('app.js'),
  read('styles.css'),
  read('data/events.json'),
  read('data/ai-candidates.json'),
  read('manifest.webmanifest'),
  read('sw.js'),
  read('scripts/enrich-candidates.mjs'),
  read('scripts/update-candidates.mjs')
]);

const events = JSON.parse(eventText);
const candidates = JSON.parse(candidateText);
const manifest = JSON.parse(manifestText);

const requiredIds = [
  'page-radar',
  'page-workbench',
  'page-library',
  'page-my',
  'page-detail',
  'ask-form',
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
assert(!/analytics\.js|product-upgrades\.js|requestcatcher/i.test(html + app), 'temporary analytics or legacy patch script is active');
assert(!/visitor_id|md_viewer_label|MarketDiaryAnalytics/.test(app), 'persistent visitor tracking remains in active app');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced-motion support is required');
assert(sw.includes("key.startsWith(CACHE_PREFIX)"), 'service worker may only delete Market Diary caches');
assert(manifest.icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png'), '192px PNG icon is required');
assert(manifest.icons.some(icon => icon.sizes === '512x512' && icon.type === 'image/png'), '512px PNG icon is required');
await Promise.all(['icon-192.png', 'icon-512.png'].map(file => fs.access(path.join(root, file))));
assert(enrich.includes('id:x.id') && enrich.includes('byId.get(String(x.id))'), 'AI enrichment must preserve and join by candidate id');
assert(update.includes('runLimited(tasks)') && update.includes('preservedItems'), 'candidate collection must limit concurrency and preserve recent items on source failure');
assert(update.includes("x.status==='error'") && update.includes('inWindow(x.pubDate)'), 'candidate carry-over must be limited to failed sources and the active time window');

assert(Array.isArray(events.events) && events.events.length > 0, 'events.json must contain events');
const ids = new Set();
for (const event of events.events) {
  assert(event.id && !ids.has(event.id), 'event id missing or duplicated: ' + event.id);
  ids.add(event.id);
  for (const field of ['title', 'conclusion', 'whyImportant', 'market', 'type', 'sourceName', 'sourceUrl']) {
    assert(event[field], 'event ' + event.id + ' missing ' + field);
  }
  assert(Array.isArray(event.coreData), 'event ' + event.id + ' coreData must be an array');
  if (event.verified) {
    assert(event.sourceTier && event.confidence, 'verified event ' + event.id + ' missing evidence metadata');
    assert(/^https?:\/\//.test(event.sourceUrl), 'verified event ' + event.id + ' has invalid source URL');
  }
}

assert(Array.isArray(candidates.items), 'ai-candidates.json must contain an items array');
console.log('frontend contract ok | verified=' + events.events.length + ' candidates=' + candidates.items.length);
