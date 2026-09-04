import { loadInvites, putJson } from '../lib/blob-store.js';
import { allowedOrigin, readJsonBody, setPrivateHeaders, setPublicCors } from '../lib/http.js';
import { sanitizeSession } from '../lib/policy.js';

export default async function handler(request, response) {
  setPrivateHeaders(response);
  const origin = allowedOrigin(request);
  if (!origin) return response.status(403).json({ ok: false, error: 'origin_not_allowed' });
  setPublicCors(response, origin);
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return response.status(503).json({ ok: false, error: 'storage_not_configured' });

  const now = new Date();
  let session;
  try {
    session = sanitizeSession(readJsonBody(request), now);
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') return response.status(413).json({ ok: false, error: 'payload_too_large' });
    return response.status(400).json({ ok: false, error: 'invalid_request' });
  }
  if (!session) return response.status(400).json({ ok: false, error: 'invalid_analytics_payload' });

  try {
    const invites = session.inviteCode ? await loadInvites() : { items: [] };
    const invitation = invites.items.find(item => item.code === session.inviteCode && item.active !== false);
    const document = {
      ...session,
      invite: invitation ? { code: invitation.code, label: invitation.label } : null,
      receivedAt: now.toISOString(),
      eventCount: session.events.length
    };
    const month = session.startedAt.slice(0, 7);
    await putJson('sessions/' + month + '/' + session.sessionId + '.json', document);
    return response.status(202).json({ ok: true, accepted: session.events.length, receivedAt: document.receivedAt });
  } catch {
    return response.status(503).json({ ok: false, error: 'analytics_storage_unavailable' });
  }
}
