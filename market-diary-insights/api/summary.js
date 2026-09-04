import { loadSessions } from '../lib/blob-store.js';
import { isAdmin, setPrivateHeaders } from '../lib/http.js';
import { aggregateSessions } from '../lib/policy.js';

export default async function handler(request, response) {
  setPrivateHeaders(response);
  if (request.method !== 'GET') return response.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!isAdmin(request)) return response.status(401).json({ ok: false, error: 'unauthorized' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return response.status(503).json({ ok: false, error: 'storage_not_configured' });

  const days = [7, 30, 90].includes(Number(request.query?.days)) ? Number(request.query.days) : 30;
  try {
    const now = new Date();
    const sessions = await loadSessions(days, now);
    return response.status(200).json({ ok: true, ...aggregateSessions(sessions, { days, now }) });
  } catch {
    return response.status(500).json({ ok: false, error: 'summary_unavailable' });
  }
}

