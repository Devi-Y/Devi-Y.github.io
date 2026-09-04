import { timingSafeEqual } from 'node:crypto';

const DEFAULT_ORIGIN = 'https://devi-y.github.io';

export function allowedOrigin(request) {
  const configured = String(process.env.ANALYTICS_ALLOWED_ORIGINS || DEFAULT_ORIGIN)
    .split(',').map(value => value.trim()).filter(Boolean);
  const origin = String(request.headers.origin || '');
  return configured.includes(origin) ? origin : '';
}

export function setPublicCors(response, origin) {
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '86400');
  response.setHeader('Vary', 'Origin');
}

export function setPrivateHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

function sameSecret(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export function isAdmin(request) {
  const expected = process.env.ANALYTICS_ADMIN_TOKEN;
  if (!expected) return false;
  const authorization = String(request.headers.authorization || '');
  const actual = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return sameSecret(actual, expected);
}

export function isCleanupAuthorized(request) {
  const authorization = String(request.headers.authorization || '');
  const actual = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return sameSecret(actual, process.env.CRON_SECRET) || sameSecret(actual, process.env.ANALYTICS_ADMIN_TOKEN);
}

export function readJsonBody(request, maxBytes = 64 * 1024) {
  const declared = Number(request.headers['content-length'] || 0);
  if (declared > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  const raw = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : String(request.body || '');
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  return JSON.parse(raw);
}

