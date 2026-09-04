import { del, get, list, put } from '@vercel/blob';

const PRIVATE = { access: 'private' };

export async function getJson(pathname) {
  const result = await get(pathname, PRIVATE);
  if (!result || result.statusCode !== 200) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

export async function putJson(pathname, value) {
  return put(pathname, JSON.stringify(value), {
    ...PRIVATE,
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: true
  });
}

export async function listAll(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

function monthKeys(days, now = new Date()) {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const keys = [];
  let cursor = first;
  while (cursor >= new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 1))) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
  }
  return keys;
}

async function mapLimited(items, limit, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        output[index] = await mapper(items[index], index);
      } catch {
        output[index] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

export async function loadSessions(days, now = new Date()) {
  const monthLists = await Promise.all(monthKeys(days, now).map(key => listAll('sessions/' + key + '/')));
  const blobs = monthLists.flat();
  const sessions = await mapLimited(blobs, 10, blob => getJson(blob.pathname));
  return sessions.filter(Boolean);
}

export async function loadInvites() {
  const stored = await getJson('config/invites.json');
  return stored && Array.isArray(stored.items) ? stored : { version: 1, items: [] };
}

export async function saveInvites(value) {
  return putJson('config/invites.json', value);
}

export async function purgeExpiredSessions(retentionDays = 90, now = new Date()) {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const blobs = await listAll('sessions/');
  const expired = blobs.filter(blob => Date.parse(blob.uploadedAt) < cutoff).map(blob => blob.url);
  for (let index = 0; index < expired.length; index += 100) {
    await del(expired.slice(index, index + 100));
  }
  return expired.length;
}

