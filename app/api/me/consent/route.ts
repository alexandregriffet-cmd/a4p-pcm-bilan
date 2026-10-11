import 'server-only'
import { accessOf } from '@/lib/access'
import { getDb } from '@/lib/server/db'
import { apiClient } from '@/lib/server/guards'
import { json, readJson } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/** Enregistre le consentement du client connecté (case obligatoire cochée). Ne renvoie aucune donnée de test. */
export async function POST(req: Request) {
  const g = await apiClient(req)
  if (!g.ok) return g.res
  const body = await readJson(req, 2048)
  if (body?.accepted !== true) return json({ error: 'consentement-requis' }, 400)
  const db = await getDb()
  const count = await db.countResults(g.me.id)
  const state = accessOf(g.me, count)
  if (state === 'guardian') return json({ error: 'accord-representant-absent' }, 403)
  if (state === 'done') return json({ ok: true })
  if (state === 'consent') await db.setConsent(g.me.id)
  return json({ ok: true })
}
