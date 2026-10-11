import 'server-only'
import { getTestData } from '@core/index'
import type { PcmData } from '@core/types'
import type { Category, ClientQuestion, DraftAnswers } from '@/lib/types'

export function pcmData(category: Category): PcmData {
  return getTestData('pcm', category)
}

/** Situations pour le navigateur du client : texte seulement, jamais le profil rattaché à chaque option. */
export function clientQuestions(category: Category): ClientQuestion[] {
  return pcmData(category).questions.map((q) => ({ id: q.id, situation: q.situation, options: q.options.map((o) => o.text) }))
}

/** Valide et nettoie un brouillon (0 à 3 choix distincts, entre 0 et 5, pour des situations connues). */
export function sanitizeDraft(input: unknown, category: Category): DraftAnswers | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const data = pcmData(category)
  const known = new Map(data.questions.map((q) => [q.id, q.options.length]))
  const out: DraftAnswers = {}
  for (const [id, v] of Object.entries(input as Record<string, unknown>)) {
    const n = known.get(id)
    if (n === undefined || !Array.isArray(v) || v.length > 3) return null
    if (!v.every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < n)) return null
    if (new Set(v).size !== v.length) return null
    if (v.length > 0) out[id] = v as number[]
  }
  return out
}
