import { purgeExpiredSessions } from '../lib/blob-store.js';
import { isCleanupAuthorized, setPrivateHeaders } from '../lib/http.js';

export default async function handler(request, response) {
  setPrivateHeaders(response);
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!isCleanupAuthorized(request)) return response.status(401).json({ ok: false, error: 'unauthorized' });
  try {
    const deleted = await purgeExpiredSessions(90);
    return response.status(200).json({ ok: true, deleted, retentionDays: 90 });
  } catch {
    return response.status(500).json({ ok: false, error: 'cleanup_failed' });
  }
}

