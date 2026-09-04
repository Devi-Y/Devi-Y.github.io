import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSessions, sanitizeEvent, sanitizeSession } from '../lib/policy.js';

const now = new Date('2026-09-04T10:00:00.000Z');
const baseEvent = {
  id: 'me_0123456789abcdef01234567',
  type: 'ui_click',
  at: '2026-09-04T09:00:00.000Z',
  page: 'radar',
  action: 'event.open',
  targetId: 'nvda-q2-fy27',
  targetKind: 'verified',
  method: 'click'
};

test('event sanitizer keeps only approved analytics fields', () => {
  assert.deepEqual(sanitizeEvent(baseEvent, now), baseEvent);
  assert.equal(sanitizeEvent({ ...baseEvent, query: '我的私密问题' }, now), null);
  assert.equal(sanitizeEvent({ ...baseEvent, action: 'unknown.action' }, now), null);
  assert.equal(sanitizeEvent({ ...baseEvent, sourceHost: 'https://example.com/full/path' }, now), null);
});

test('session sanitizer rejects identity and free-text additions', () => {
  const session = {
    version: 1,
    visitorId: 'mv_0123456789abcdef01234567',
    sessionId: 'ms_0123456789abcdef01234567',
    startedAt: '2026-09-04T08:50:00.000Z',
    inviteCode: 'Abcdefghijk2',
    device: 'mobile',
    referrerHost: 'example.com',
    events: [baseEvent]
  };
  assert.equal(sanitizeSession(session, now).events.length, 1);
  assert.equal(sanitizeSession({ ...session, name: '张三' }, now), null);
  assert.equal(sanitizeSession({ ...session, events: [{ ...baseEvent, watchTerm: '黄金' }] }, now), null);
});

test('aggregator counts distinct anonymous visitors, clicks and funnels', () => {
  const sessions = [
    {
      visitorId: 'mv_0123456789abcdef01234567',
      sessionId: 'ms_0123456789abcdef01234567',
      device: 'mobile',
      invite: { code: 'Abcdefghijk2', label: '测试邀请' },
      events: [
        { ...baseEvent, id: 'me_111111111111111111111111', type: 'page_view', action: undefined },
        baseEvent,
        { ...baseEvent, id: 'me_222222222222222222222222', page: 'workbench', action: 'content.generate', format: 'brief' },
        { ...baseEvent, id: 'me_333333333333333333333333', page: 'workbench', action: 'content.copy', result: 'success' }
      ]
    },
    {
      visitorId: 'mv_abcdefabcdefabcdefabcdef',
      sessionId: 'ms_abcdefabcdefabcdefabcdef',
      device: 'desktop',
      events: [{ ...baseEvent, id: 'me_444444444444444444444444', page: 'market', action: 'filter.market' }]
    }
  ];
  const summary = aggregateSessions(sessions, { now, days: 30 });
  assert.equal(summary.totals.visitors, 2);
  assert.equal(summary.totals.sessions, 2);
  assert.equal(summary.totals.clicks, 4);
  assert.equal(summary.totals.pageViews, 1);
  assert.equal(summary.totals.taggedVisitors, 1);
  assert.equal(summary.visitors[0].label, '测试邀请');
  assert.equal(summary.funnel.find(step => step.key === 'generate').visitors, 1);
  assert.equal(summary.funnel.find(step => step.key === 'filter').visitors, 1);
});
