// Double-submit CSRF: a random cookie value plus an HMAC of it rendered as a
// hidden form field. Verification recomputes the HMAC and compares in
// constant time. Stateless — nothing stored server-side.

const enc = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return toHex(new Uint8Array(sig));
}

export function newCsrfCookieValue(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function csrfTokenFor(secret: string, cookieValue: string): Promise<string> {
  return hmacHex(secret, cookieValue);
}

export async function verifyCsrf(
  secret: string,
  cookieValue: string,
  token: string,
): Promise<boolean> {
  if (!cookieValue || !token) return false;
  const expected = await hmacHex(secret, cookieValue);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
