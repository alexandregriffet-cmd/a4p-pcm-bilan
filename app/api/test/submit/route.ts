import 'server-only'
import { isCompleteTest, scoreTest } from '@core/index'
import type { PcmAnswers } from '@core/types'
import { accessOf } from '@/lib/access'
import { DbError, getDb } from '@/lib/server/db'
import { apiClient } from '@/lib/server/guards'
import { json, readJson } from '@/lib/server/http'
import { pcmData } from '@/lib/server/questions'

export const dynamic = 'force-dynamic'

/**
 * Validation finale. Le serveur relit le profil en base, ignore toute catégorie envoyée par le navigateur,
 * recalcule le résultat avec le noyau, l'enregistre avec la clé de service et ne renvoie que { ok: true }.
 */
export async function POST(req: Request) {
  const g = await apiClient(req)
  if (!g.ok) return g.res
  const body = await readJson(req)
  if (!body) return json({ error: 'requete-invalide' }, 400)

  const db = await getDb()
  const profile = await db.getProfile(g.me.id)
  if (!profile || !profile.category) return json({ error: 'test-indisponible' }, 403)
  const count = await db.countResults(profile.id)
  const state = accessOf(profile, count)
  if (state === 'done') return json({ error: 'deja-passe' }, 409)
  if (state !== 'ready') return json({ error: 'test-indisponible' }, 403)

  const category = profile.category // seule source de vérité : la base
  const data = pcmData(category)
  const raw = body.answers
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'reponses-invalides' }, 400)
  const answers: PcmAnswers = {}
  for (const q of data.questions) {
    const v = (raw as Record<string, unknown>)[q.id]
    if (v === undefined) continue
    if (!Array.isArray(v) || v.length !== 3 || !v.every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < q.options.length) || new Set(v).size !== 3) {
      return json({ error: 'reponses-invalides' }, 400)
    }
    answers[q.id] = [v[0], v[1], v[2]] as [number, number, number]
  }
  if (!isCompleteTest('pcm', category, answers)) return json({ error: 'incomplet' }, 422)

  const result = scoreTest('pcm', category, answers)
  try {
    await db.insertResult({ userId: profile.id, attempt: count + 1, category, answers, result })
  } catch (e) {
    if (e instanceof DbError && (e.code === 'conflict' || e.code === 'refused')) return json({ error: 'deja-passe' }, 409)
    return json({ error: 'echec' }, 500)
  }
  await db.clearDraft(profile.id)
  return json({ ok: true })
}
