import 'server-only'
import { getDb } from '@/lib/server/db'
import { apiAdmin, isUuid } from '@/lib/server/guards'
import { json, readJson } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/** Notes privées de l'administrateur sur un client (table distincte, jamais lisible par un client). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await apiAdmin(req)
  if (!g.ok) return g.res
  if (!isUuid(params.id)) return json({ error: 'introuvable' }, 404)
  const body = await readJson(req)
  if (!body || typeof body.note !== 'string' || body.note.length > 20000) return json({ error: 'requete-invalide' }, 400)
  const db = await getDb()
  const target = await db.getProfile(params.id)
  if (!target || target.role !== 'client') return json({ error: 'introuvable' }, 404)
  await db.saveNote(target.id, body.note)
  return json({ ok: true })
}
