import 'server-only'
import { DbError, getDb } from '@/lib/server/db'
import { apiAdmin } from '@/lib/server/guards'
import { cleanEmail, cleanText, json, readJson } from '@/lib/server/http'
import { generatePassword, PASSWORD_MIN, validPassword } from '@/lib/server/password'
import { isCategory } from '@/lib/format'
import { isMinorCategory } from '@/lib/minor'

export const dynamic = 'force-dynamic'

/**
 * Création d'un client par l'administrateur (clé de service, e-mail confirmé d'office).
 * Le mot de passe est renvoyé UNE fois dans cette réponse et n'est stocké nulle part en clair.
 */
export async function POST(req: Request) {
  const g = await apiAdmin(req)
  if (!g.ok) return g.res
  const body = await readJson(req, 8192)
  if (!body) return json({ error: 'requete-invalide' }, 400)

  const firstName = cleanText(body.firstName, 80)
  const lastName = cleanText(body.lastName, 80)
  const email = cleanEmail(body.email)
  const category = body.category
  if (!firstName || !lastName) return json({ error: 'nom-requis' }, 400)
  if (!email) return json({ error: 'email-invalide' }, 400)
  if (!isCategory(category)) return json({ error: 'categorie-invalide' }, 400)
  const guardianConsent = body.guardianConsent === true
  if (isMinorCategory(category) && !guardianConsent) return json({ error: 'accord-representant-requis' }, 400)

  let password: string
  if (body.password === undefined || body.password === null || body.password === '') {
    password = generatePassword()
  } else if (validPassword(body.password)) {
    password = body.password
  } else {
    return json({ error: 'mot-de-passe-invalide', min: PASSWORD_MIN }, 400)
  }

  const db = await getDb()
  try {
    const profile = await db.createClient({ email, fullName: `${firstName} ${lastName}`, category, guardianConsent, password })
    return json({ ok: true, client: { id: profile.id, email: profile.email, fullName: profile.fullName, category: profile.category }, password }, 201)
  } catch (e) {
    if (e instanceof DbError && e.code === 'exists') return json({ error: 'email-existant' }, 409)
    return json({ error: 'echec' }, 500)
  }
}
