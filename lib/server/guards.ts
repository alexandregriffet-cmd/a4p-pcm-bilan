import 'server-only'
import { redirect } from 'next/navigation'
import type { Profile } from '@/lib/types'
import { getDb } from './db'
import { clientIp, json, sameOrigin } from './http'
import { getMode } from './mode'
import { currentUserId } from './session'

/** Profil de la personne connectée (lu en base à chaque appel), ou null. */
export async function getCaller(): Promise<Profile | null> {
  const id = await currentUserId()
  if (!id) return null
  const db = await getDb()
  return db.getProfile(id)
}

/* ------------------------------ Pages serveur ------------------------------ */

/** Page réservée à l'administrateur : tout autre cas est renvoyé. */
export async function requireAdminPage(): Promise<Profile> {
  const me = await getCaller()
  if (!me) redirect('/')
  if (me.role !== 'admin' || !me.active) redirect(me.role === 'client' ? '/espace' : '/')
  return me
}

/* ------------------------------ Routes API ------------------------------ */

type Guard = { ok: true; me: Profile } | { ok: false; res: Response }

function unavailable(): Response {
  return json({ error: 'indisponible' }, 503)
}

async function guard(req: Request, role: 'admin' | 'client'): Promise<Guard> {
  if (getMode().mode === 'unconfigured') return { ok: false, res: unavailable() }
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) return { ok: false, res: json({ error: 'origine' }, 403) }
  const me = await getCaller()
  if (!me) return { ok: false, res: json({ error: 'non-connecte' }, 401) }
  if (!me.active) return { ok: false, res: json({ error: 'acces-indisponible' }, 403) }
  if (me.role !== role) return { ok: false, res: json({ error: 'interdit' }, 403) }
  return { ok: true, me }
}

/** Vérifie la session ET le rôle administrateur à chaque appel de l'API d'administration. */
export const apiAdmin = (req: Request) => guard(req, 'admin')
export const apiClient = (req: Request) => guard(req, 'client')

export { clientIp }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v)
}
