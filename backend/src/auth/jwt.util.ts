import { createHmac } from 'crypto';

function base64url(input: Buffer | string) {
  const str = (input instanceof Buffer ? input : Buffer.from(input))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return str;
}

export function signJwt(
  payload: Record<string, any>,
  secret: string,
  expiresInSec: number,
) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(body));
  const data = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', secret).update(data).digest();
  const sigB64 = base64url(sig);
  return `${data}.${sigB64}`;
}

export function verifyJwt(
  token: string,
  secret: string,
): { valid: boolean; payload?: any; reason?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = base64url(
    createHmac('sha256', secret).update(data).digest(),
  );
  if (expectedSig !== sigB64) return { valid: false, reason: 'signature' };
  try {
    const payloadJson = Buffer.from(
      payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp)
      return { valid: false, reason: 'expired' };
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, reason: 'payload' };
  }
}
