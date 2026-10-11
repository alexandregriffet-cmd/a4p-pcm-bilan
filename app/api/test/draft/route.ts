import 'server-only'
import { accessOf } from '@/lib/access'
import { getDb } from '@/lib/server/db'
import { apiClient } from '@/lib/server/guards'
import { json, readJson } from '@/lib/server/http'
import { sanitizeDraft } from '@/lib/server/questions'

export const dynamic = 'force-dynamic'

/** Sauvegarde automatique du brouillon du client connecté, pour SA catégorie (lue en base, jamais envoyée par le navigateur). */
export async function PUT(req: Request) {
  const g = await apiClient(req)
  if (!g.ok) return g.res
  const body = await readJson(req)
  if (!body) return json({ error: 'requete-invalide' }, 400)
  const db = await getDb()
  const count = await db.countResults(g.me.id)
  if (accessOf(g.me, count) !== 'ready' || !g.me.category) return json({ error: 'test-indisponible' }, 403)
  const answers = sanitizeDraft(body.answers, g.me.category)
  if (!answers) return json({ error: 'reponses-invalides' }, 400)
  await db.saveDraft(g.me.id, answers)
  return json({ ok: true })
}
