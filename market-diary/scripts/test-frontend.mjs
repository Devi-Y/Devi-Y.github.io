import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'market-diary');
const read = file => fs.readFile(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [html, app, css, eventText, candidateText] = await Promise.all([
  read('index.html'),
  read('app.js'),
  read('styles.css'),
  read('data/events.json'),
  read('data/ai-candidates.json')
]);

const events = JSON.parse(eventText);
const candidates = JSON.parse(candidateText);

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
assert(app.includes("register('./sw.js')"), 'service worker registration is required');
assert(!/analytics\.js|product-upgrades\.js|requestcatcher/i.test(html + app), 'temporary analytics or legacy patch script is active');
assert(!/visitor_id|md_viewer_label|MarketDiaryAnalytics/.test(app), 'persistent visitor tracking remains in active app');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced-motion support is required');

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
