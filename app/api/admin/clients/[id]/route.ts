import 'server-only'
import { DbError, getDb, type ClientPatch } from '@/lib/server/db'
import { apiAdmin, isUuid } from '@/lib/server/guards'
import { json, readJson } from '@/lib/server/http'
import { isCategory } from '@/lib/format'

export const dynamic = 'force-dynamic'

/** Modifications d'un client : catégorie (tant que le test n'est pas terminé), accès, nouveau passage, accord du représentant légal. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await apiAdmin(req)
  if (!g.ok) return g.res
  if (!isUuid(params.id)) return json({ error: 'introuvable' }, 404)
  const body = await readJson(req, 4096)
  if (!body) return json({ error: 'requete-invalide' }, 400)

  const db = await getDb()
  const target = await db.getProfile(params.id)
  if (!target || target.role !== 'client') return json({ error: 'introuvable' }, 404)
  const count = await db.countResults(target.id)
  const patch: ClientPatch = {}

  if (body.category !== undefined) {
    if (!isCategory(body.category)) return json({ error: 'categorie-invalide' }, 400)
    if (body.category !== target.category) {
      if (count >= target.attemptsAllowed) return json({ error: 'test-termine' }, 409)
      const guardian = body.guardianConsent === true || target.guardianConsent
      if (body.category === 'ado-etudes' && !guardian) return json({ error: 'accord-representant-requis' }, 400)
      patch.category = body.category
      if (body.guardianConsent === true) patch.guardianConsent = true
    }
  } else if (body.guardianConsent !== undefined) {
    if (typeof body.guardianConsent !== 'boolean') return json({ error: 'requete-invalide' }, 400)
    patch.guardianConsent = body.guardianConsent
  }

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') return json({ error: 'requete-invalide' }, 400)
    patch.active = body.active
  }

  if (body.allowRetake === true) {
    // Réservé à l'administrateur : un client qui a terminé peut repasser une fois de plus, l'ancien résultat est conservé.
    if (count < target.attemptsAllowed) return json({ error: 'passage-deja-autorise' }, 409)
    patch.attemptsAllowed = count + 1
  }

  if (Object.keys(patch).length === 0) return json({ error: 'rien-a-modifier' }, 400)

  try {
    const updated = await db.updateClient(target.id, patch)
    if (patch.category !== undefined || patch.attemptsAllowed !== undefined) await db.clearDraft(target.id)
    return json({ ok: true, client: { id: updated.id, category: updated.category, active: updated.active, attemptsAllowed: updated.attemptsAllowed, guardianConsent: updated.guardianConsent } })
  } catch (e) {
    if (e instanceof DbError && e.code === 'refused') return json({ error: 'test-termine' }, 409)
    return json({ error: 'echec' }, 500)
  }
}

/** Suppression définitive du client et de toutes ses données, après confirmation de son e-mail. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await apiAdmin(req)
  if (!g.ok) return g.res
  if (!isUuid(params.id)) return json({ error: 'introuvable' }, 404)
  const body = await readJson(req, 2048)
  const db = await getDb()
  const target = await db.getProfile(params.id)
  if (!target || target.role !== 'client') return json({ error: 'introuvable' }, 404)
  const confirm = typeof body?.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : ''
  if (confirm !== target.email.toLowerCase()) return json({ error: 'confirmation-incorrecte' }, 400)
  try {
    await db.deleteClient(target.id)
  } catch {
    return json({ error: 'echec' }, 500)
  }
  return json({ ok: true })
}
