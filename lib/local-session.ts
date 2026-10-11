/**
 * Session du mode de test local uniquement (NEXT_PUBLIC_LOCAL_TEST=1).
 * Cookie signé par HMAC-SHA256 (Web Crypto, utilisable dans le middleware et dans les routes).
 */
export const LOCAL_COOKIE = 'a4p_local_session'

export interface LocalSessionPayload {
  uid: string
  role: 'admin' | 'client'
  exp: number
}

function secret(): string {
  return process.env.LOCAL_SESSION_SECRET || 'a4p-local-test-secret'
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signLocalSession(p: LocalSessionPayload): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(p)))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), new TextEncoder().encode(body)))
  return `${body}.${b64url(sig)}`
}

export async function verifyLocalSession(token: string | undefined | null): Promise<LocalSessionPayload | null> {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig), new TextEncoder().encode(body))
    if (!ok) return null
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as LocalSessionPayload
    if (!p || typeof p.uid !== 'string' || typeof p.exp !== 'number' || p.exp < Date.now()) return null
    if (p.role !== 'admin' && p.role !== 'client') return null
    return p
  } catch {
    return null
  }
}
