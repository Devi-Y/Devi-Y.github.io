'use strict';

const state = { token: sessionStorage.getItem('mdiAdminToken') || '', days: 30, summary: null, invites: [] };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const ACTION_LABELS = {
  'consent.granted': '允许匿名统计',
  'nav.home': '返回首页', 'nav.radar': '进入今日', 'nav.workbench': '进入问一下', 'nav.market': '进入市场', 'nav.my': '进入我的', 'nav.data_status': '查看数据状态', 'nav.detail_back': '详情返回',
  'home.brief': '查看当前简报', 'market.open_events': '查看事件', 'market.open_compare': '打开对比', 'market.open_calendar': '查看日历', 'market.open_candidates': '查看候选',
  'market.tab_select': '切换市场视图', 'market.lane_select': '选择市场任务',
  'feed.prev': '上一条事件', 'feed.next': '下一条事件', 'feed.navigate': '切换事件',
  'event.open': '打开事件', 'event.link_copy': '复制事件链接', 'prompt.preset': '使用快捷问题', 'ask.submit': '提交问题', 'ask.result': '问题匹配结果',
  'content.generate': '生成内容', 'content.format_change': '切换输出格式', 'content.copy': '复制内容', 'checklist.copy': '复制核验清单',
  'draft.save': '保存草稿', 'draft.open': '打开草稿', 'draft.delete': '删除草稿',
  'filter.scope': '筛选证据状态', 'filter.market': '筛选市场', 'filter.type': '筛选类型', 'filter.clear': '清除筛选', 'library.search': '使用市场搜索',
  'compare.add': '加入对比', 'compare.select': '选择对比事件', 'watch.add': '添加关注', 'watch.remove': '删除关注', 'watch.example_load': '载入示例关注',
  'source.open': '打开来源', 'data.refresh_click': '刷新数据', 'data.refresh_result': '刷新结果', 'details.toggle': '展开详情'
};
const PAGE_LABELS = { radar: '今日', workbench: '问一下', market: '市场', my: '我的', detail: '事件详情' };

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function toast(message) {
  const host = $('#toast');
  host.textContent = message;
  host.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => host.classList.remove('show'), 2200);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}), Authorization: 'Bearer ' + state.token };
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...options, headers, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('UNAUTHORIZED');
  if (!response.ok || !body.ok) throw new Error(body.error || 'REQUEST_FAILED');
  return body;
}

function metric(label, value, note) {
  return '<article class="metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(note) + '</small></article>';
}

function renderMetrics(summary) {
  const value = summary.totals;
  $('#metrics').innerHTML = [
    metric('同意统计的访客', value.visitors, '随机浏览器编号'),
    metric('访问会话', value.sessions, '一次打开到离开'),
    metric('按钮点击', value.clicks, '仅白名单交互'),
    metric('页面浏览', value.pageViews, '已去重路由'),
    metric('人均点击', value.clicksPerVisitor, '点击 / 匿名访客'),
    metric('有备注访客', value.taggedVisitors, '通过专属链接进入')
  ].join('');
}

function renderDaily(rows) {
  if (!rows.length) return $('#daily-chart').innerHTML = '<p class="empty">这个时间段还没有已同意的访问。</p>';
  const max = Math.max(...rows.flatMap(row => [row.clicks, row.visitors]), 1);
  $('#daily-chart').innerHTML = rows.map(row => {
    const clicks = Math.max(2, Math.round(row.clicks / max * 165));
    const visitors = Math.max(2, Math.round(row.visitors / max * 165));
    return '<div class="day" title="' + esc(row.date + ' · ' + row.visitors + '人 · ' + row.clicks + '次点击') + '"><div class="day-bars"><i class="bar visitors" style="height:' + visitors + 'px"></i><i class="bar clicks" style="height:' + clicks + 'px"></i></div><small>' + esc(row.date.slice(5)) + '</small></div>';
  }).join('');
}

function renderRank(host, rows, label, value) {
  if (!rows.length) return $(host).innerHTML = '<p class="empty">暂无数据</p>';
  const max = Math.max(...rows.map(value), 1);
  $(host).innerHTML = rows.map(row => '<div class="rank-row"><span title="' + esc(label(row)) + '">' + esc(label(row)) + '</span><span class="track"><i style="width:' + Math.max(2, value(row) / max * 100) + '%"></i></span><strong>' + esc(value(row)) + '</strong></div>').join('');
}

function renderFunnels(rows) {
  const groups = [
    ['内容使用', ['radar', 'event', 'generate', 'retain']],
    ['市场探索', ['market', 'filter', 'event']],
    ['提问使用', ['ask', 'answer', 'retain']]
  ];
  const byKey = new Map(rows.map(row => [row.key, row]));
  $('#funnels').innerHTML = groups.map(([title, keys]) => '<div class="funnel-group"><h3>' + esc(title) + '</h3>' + keys.map(key => {
    const row = byKey.get(key) || { label: key, visitors: 0 };
    return '<div class="funnel-step"><span>' + esc(row.label) + '</span><strong>' + row.visitors + ' 人</strong></div>';
  }).join('') + '</div>').join('');
}

function renderVisitors(rows) {
  $('#visitor-count').textContent = rows.length + ' 位';
  $('#visitor-rows').innerHTML = rows.length ? rows.map(row => '<tr><td><strong>' + esc(row.label) + '</strong><small>' + esc(row.visitorId) + '</small></td><td>' + esc(formatTime(row.lastSeenAt)) + '</td><td>' + row.sessions + '</td><td>' + row.clicks + '</td><td>' + row.pageViews + '</td><td>' + esc(PAGE_LABELS[row.topPage] || row.topPage) + '</td><td>' + esc(ACTION_LABELS[row.topAction] || row.topAction) + '</td><td>' + esc(row.device) + '</td></tr>').join('') : '<tr><td colspan="8" class="empty">暂无访客数据</td></tr>';
}

function renderRecent(rows) {
  $('#recent-rows').innerHTML = rows.length ? rows.map(row => '<tr><td>' + esc(formatTime(row.at)) + '</td><td><strong>' + esc(row.label) + '</strong><small>' + esc(row.visitorId.slice(-10)) + '</small></td><td>' + esc(PAGE_LABELS[row.page] || row.page) + '</td><td>' + esc(ACTION_LABELS[row.action] || row.action || row.type) + '</td><td>' + esc(row.targetId || row.format || '—') + '</td><td>' + esc(row.result || '—') + '</td></tr>').join('') : '<tr><td colspan="6" class="empty">暂无行为数据</td></tr>';
}

function renderInvites() {
  const active = state.invites.filter(item => item.active);
  $('#invite-list').innerHTML = active.length ? active.map(item => '<div class="invite-row"><strong>' + esc(item.label) + '</strong><code>' + esc(item.shareUrl) + '</code><button type="button" data-disable-invite="' + esc(item.code) + '">停用</button></div>').join('') : '<p class="empty">还没有专属链接。未使用专属链接的访客仍会显示匿名编号。</p>';
}

function render(summary) {
  state.summary = summary;
  $('#updated-at').textContent = '数据生成于 ' + formatTime(summary.meta.generatedAt) + ' · 保留 ' + summary.meta.retentionDays + ' 天';
  renderMetrics(summary);
  renderDaily(summary.daily);
  renderFunnels(summary.funnel);
  renderRank('#top-actions', summary.topActions, row => ACTION_LABELS[row.action] || row.action, row => row.count);
  renderRank('#page-stats', summary.pages, row => PAGE_LABELS[row.page] || row.page, row => row.clicks + row.pageViews);
  renderVisitors(summary.visitors);
  renderRecent(summary.recent);
}

async function loadDashboard() {
  $('#dashboard-error').textContent = '';
  $('#refresh').disabled = true;
  try {
    const [summary, invites] = await Promise.all([api('/api/summary?days=' + state.days), api('/api/invites')]);
    state.invites = invites.items;
    render(summary);
    renderInvites();
    $('#login-view').hidden = true;
    $('#dashboard').hidden = false;
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      sessionStorage.removeItem('mdiAdminToken');
      state.token = '';
      $('#dashboard').hidden = true;
      $('#login-view').hidden = false;
      $('#login-error').textContent = '口令不正确，请重新输入。';
    } else {
      $('#dashboard-error').textContent = '暂时无法读取分析数据，请稍后刷新。';
    }
  } finally {
    $('#refresh').disabled = false;
  }
}

function csvCell(value) {
  return '"' + String(value ?? '').replaceAll('"', '""') + '"';
}

function exportCsv() {
  if (!state.summary) return;
  const rows = [['访客备注', '匿名编号', '最近访问', '会话数', '点击数', '页面浏览', '常用页面', '常用动作', '设备']];
  state.summary.visitors.forEach(row => rows.push([row.label, row.visitorId, row.lastSeenAt, row.sessions, row.clicks, row.pageViews, PAGE_LABELS[row.topPage] || row.topPage, ACTION_LABELS[row.topAction] || row.topAction, row.device]));
  const blob = new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'market-diary-visitors-' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

$('#login-form').addEventListener('submit', event => {
  event.preventDefault();
  state.token = $('#admin-token').value.trim();
  if (!state.token) return;
  sessionStorage.setItem('mdiAdminToken', state.token);
  $('#login-error').textContent = '';
  loadDashboard();
});

$$('[data-days]').forEach(button => button.addEventListener('click', () => {
  state.days = Number(button.dataset.days);
  $$('[data-days]').forEach(item => item.classList.toggle('active', item === button));
  loadDashboard();
}));

$('#refresh').addEventListener('click', loadDashboard);
$('#export-csv').addEventListener('click', exportCsv);
$('#logout').addEventListener('click', () => {
  sessionStorage.removeItem('mdiAdminToken');
  state.token = '';
  state.summary = null;
  $('#dashboard').hidden = true;
  $('#login-view').hidden = false;
  $('#admin-token').value = '';
});

$('#invite-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('#invite-label');
  try {
    const result = await api('/api/invites', { method: 'POST', body: JSON.stringify({ label: input.value.trim() }) });
    state.invites.unshift(result.item);
    $('#invite-url').textContent = result.item.shareUrl;
    $('#invite-result').hidden = false;
    input.value = '';
    renderInvites();
    toast('专属链接已生成');
  } catch {
    toast('生成失败，请稍后再试');
  }
});

$('#copy-invite').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#invite-url').textContent);
    toast('链接已复制');
  } catch {
    toast('复制失败，请手动选择链接');
  }
});

$('#invite-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-disable-invite]');
  if (!button) return;
  try {
    const result = await api('/api/invites', { method: 'DELETE', body: JSON.stringify({ code: button.dataset.disableInvite }) });
    const item = state.invites.find(invite => invite.code === result.item.code);
    if (item) item.active = false;
    renderInvites();
    toast('专属链接已停用，历史记录保留');
  } catch {
    toast('停用失败，请稍后再试');
  }
});

$('#cleanup').addEventListener('click', async () => {
  try {
    const result = await api('/api/cleanup', { method: 'POST' });
    toast('已清理 ' + result.deleted + ' 条过期会话');
    loadDashboard();
  } catch {
    toast('清理失败，请稍后再试');
  }
});

if (state.token) loadDashboard();
