import 'server-only'
import { NextResponse } from 'next/server'

export function json(data: unknown, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...(extra ?? {}) } })
}

export const MAX_BODY = 64 * 1024

/** Lit un corps JSON avec une taille maximale. Renvoie null si le corps est absent, trop gros ou invalide. */
export async function readJson(req: Request, maxBytes = MAX_BODY): Promise<Record<string, unknown> | null> {
  const type = req.headers.get('content-type') ?? ''
  if (!type.toLowerCase().startsWith('application/json')) return null
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) return null
  let text: string
  try {
    text = await req.text()
  } catch {
    return null
  }
  if (text.length > maxBytes) return null
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Refuse les requêtes qui proviennent d'un autre site (défense contre les requêtes intersites). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true // appels hors navigateur : sans cookie de victime
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return !!host && new URL(origin).host === host
  } catch {
    return false
  }
}

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  return (xf ? xf.split(',')[0] : req.headers.get('x-real-ip') ?? 'inconnu').trim()
}

export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

const EMAIL = /^[^\s@<>()[\],;:\\"]+@[^\s@<>()[\],;:\\"]+\.[^\s@<>()[\],;:\\"]{2,}$/

export function cleanEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const e = v.trim().toLowerCase()
  return e.length <= 254 && EMAIL.test(e) ? e : null
}

/** Limiteur en mémoire (meilleur effort sur un hébergement sans état : voir README). */
const hits = new Map<string, { n: number; first: number }>()
export function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || now - h.first > windowMs) {
    return false
  }
  return h.n >= max
}
export function noteFailure(key: string, windowMs: number) {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || now - h.first > windowMs) hits.set(key, { n: 1, first: now })
  else h.n += 1
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now - v.first > windowMs) hits.delete(k)
  }
}
export function clearFailures(key: string) {
  hits.delete(key)
}
