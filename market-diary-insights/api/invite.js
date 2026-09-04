import { loadInvites } from '../lib/blob-store.js';
import { allowedOrigin, setPrivateHeaders, setPublicCors } from '../lib/http.js';

export default async function handler(request, response) {
  setPrivateHeaders(response);
  const origin = allowedOrigin(request);
  if (!origin) return response.status(403).json({ ok: false, error: 'origin_not_allowed' });
  setPublicCors(response, origin);
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET') return response.status(405).json({ ok: false, error: 'method_not_allowed' });

  const code = String(request.query?.code || '');
  if (!/^[A-Za-z0-9_-]{10,32}$/.test(code)) return response.status(400).json({ ok: false, error: 'invalid_invite' });
  try {
    const invites = await loadInvites();
    const item = invites.items.find(invite => invite.code === code && invite.active !== false);
    return item
      ? response.status(200).json({ ok: true, label: item.label })
      : response.status(404).json({ ok: false, error: 'invite_not_found' });
  } catch {
    return response.status(503).json({ ok: false, error: 'invite_service_unavailable' });
  }
}

