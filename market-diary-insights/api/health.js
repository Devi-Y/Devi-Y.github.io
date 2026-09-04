import { setPrivateHeaders } from '../lib/http.js';

export default function handler(request, response) {
  setPrivateHeaders(response);
  if (request.method !== 'GET') return response.status(405).json({ ok: false, error: 'method_not_allowed' });
  return response.status(200).json({
    ok: true,
    service: 'market-diary-insights',
    storageConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    adminConfigured: Boolean(process.env.ANALYTICS_ADMIN_TOKEN),
    retentionDays: 90,
    identityModel: 'consented anonymous browser id'
  });
}

