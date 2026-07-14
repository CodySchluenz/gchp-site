// Random secrets and SHA-256 hashing for magic-link tokens and sessions.
// Secrets travel to the user (token in the link, session id in the cookie);
// only their hashes are ever stored, so a database read cannot mint a login.

const enc = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return toHex(new Uint8Array(digest));
}
