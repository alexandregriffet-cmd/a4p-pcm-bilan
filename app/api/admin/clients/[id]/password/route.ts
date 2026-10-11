import 'server-only'
import { getDb } from '@/lib/server/db'
import { apiAdmin, isUuid } from '@/lib/server/guards'
import { json, readJson } from '@/lib/server/http'
import { generatePassword, PASSWORD_MIN, validPassword } from '@/lib/server/password'

export const dynamic = 'force-dynamic'

/** Régénère le mot de passe d'un client : l'ancien devient invalide, le nouveau n'est affiché qu'une fois. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await apiAdmin(req)
  if (!g.ok) return g.res
  if (!isUuid(params.id)) return json({ error: 'introuvable' }, 404)
  const body = await readJson(req, 2048)
  const db = await getDb()
  const target = await db.getProfile(params.id)
  if (!target || target.role !== 'client') return json({ error: 'introuvable' }, 404)

  let password: string
  if (body?.password === undefined || body.password === '') password = generatePassword()
  else if (validPassword(body.password)) password = body.password
  else return json({ error: 'mot-de-passe-invalide', min: PASSWORD_MIN }, 400)

  try {
    await db.setPassword(target.id, password)
  } catch {
    return json({ error: 'echec' }, 500)
  }
  return json({ ok: true, email: target.email, password })
}
