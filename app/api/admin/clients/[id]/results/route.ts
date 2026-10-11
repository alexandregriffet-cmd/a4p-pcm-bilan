import 'server-only'
import { getDb } from '@/lib/server/db'
import { apiAdmin, isUuid } from '@/lib/server/guards'
import { json } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/** Résultats d'un client (toutes les tentatives). Réservé à l'administrateur. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await apiAdmin(req)
  if (!g.ok) return g.res
  if (!isUuid(params.id)) return json({ error: 'introuvable' }, 404)
  const db = await getDb()
  const target = await db.getProfile(params.id)
  if (!target || target.role !== 'client') return json({ error: 'introuvable' }, 404)
  const results = await db.listResults(target.id)
  return json({ client: { id: target.id, email: target.email, fullName: target.fullName, category: target.category }, results })
}
