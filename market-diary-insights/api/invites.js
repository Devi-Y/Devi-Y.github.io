import { randomBytes } from 'node:crypto';
import { loadInvites, saveInvites } from '../lib/blob-store.js';
import { isAdmin, readJsonBody, setPrivateHeaders } from '../lib/http.js';

const SITE_URL = 'https://devi-y.github.io/market-diary/';

function cleanLabel(value) {
  const label = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
  return label.length >= 1 && label.length <= 40 ? label : '';
}

function publicInvite(item) {
  return {
    code: item.code,
    label: item.label,
    active: item.active !== false,
    createdAt: item.createdAt,
    shareUrl: SITE_URL + '?invite=' + encodeURIComponent(item.code)
  };
}

export default async function handler(request, response) {
  setPrivateHeaders(response);
  if (!isAdmin(request)) return response.status(401).json({ ok: false, error: 'unauthorized' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return response.status(503).json({ ok: false, error: 'storage_not_configured' });

  try {
    const invites = await loadInvites();
    if (request.method === 'GET') {
      return response.status(200).json({ ok: true, items: invites.items.map(publicInvite) });
    }
    if (request.method === 'POST') {
      const body = readJsonBody(request, 4096);
      const label = cleanLabel(body.label);
      if (!label) return response.status(400).json({ ok: false, error: 'invalid_label' });
      const item = { code: randomBytes(9).toString('base64url'), label, active: true, createdAt: new Date().toISOString() };
      invites.items.unshift(item);
      invites.updatedAt = new Date().toISOString();
      await saveInvites(invites);
      return response.status(201).json({ ok: true, item: publicInvite(item) });
    }
    if (request.method === 'DELETE') {
      const body = readJsonBody(request, 4096);
      const item = invites.items.find(invite => invite.code === String(body.code || ''));
      if (!item) return response.status(404).json({ ok: false, error: 'invite_not_found' });
      item.active = false;
      item.updatedAt = new Date().toISOString();
      invites.updatedAt = item.updatedAt;
      await saveInvites(invites);
      return response.status(200).json({ ok: true, item: publicInvite(item) });
    }
    return response.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch {
    return response.status(500).json({ ok: false, error: 'invite_service_unavailable' });
  }
}

