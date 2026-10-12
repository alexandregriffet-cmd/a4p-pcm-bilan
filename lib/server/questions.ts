import 'server-only'
import { displayOrder, getTestData } from '@core/index'
import type { PcmData } from '@core/types'
import type { Category, ClientQuestion, DraftAnswers } from '@/lib/types'

export function pcmData(category: Category): PcmData {
  return getTestData('pcm', category)
}

/** Situations pour le navigateur du client : texte seulement, jamais le profil rattaché à chaque option. */
export function clientQuestions(category: Category, userId: string, attempt: number): ClientQuestion[] {
  const data = pcmData(category)
  const toClient = (q: PcmData['questions'][number]): ClientQuestion => {
    const order = orderOf(userId, attempt, q.id, q.options.length)
    return { id: q.id, situation: q.situation, options: order.map((i) => q.options[i].text) }
  }
  return interleave(data.questions, data.valorisation ?? []).map(toClient)
}

/**
 * Ordre de passation : les situations de valorisation sont insérées une fois toutes les trois situations de style,
 * pour que le parcours paraisse d'un seul tenant. Même ordre pour tout le monde (le brouillon est indexé par identifiant).
 */
export function interleave<T>(style: T[], val: T[]): T[] {
  const out: T[] = []
  let v = 0
  style.forEach((q, i) => {
    out.push(q)
    if ((i + 1) % 3 === 0 && v < val.length) out.push(val[v++])
  })
  while (v < val.length) out.push(val[v++])
  return out
}

/** Toutes les situations d'une catégorie : style puis valorisation. */
export function allQuestionsOf(category: Category): PcmData['questions'] {
  const d = pcmData(category)
  return [...d.questions, ...(d.valorisation ?? [])]
}

/** Ordre d'affichage des options d'une situation pour un client et une tentative : stable, propre à chaque personne. */
export function orderOf(userId: string, attempt: number, questionId: string, nbOptions: number): number[] {
  return displayOrder(`${userId}|${attempt}|${questionId}`, nbOptions)
}

/** Valide et nettoie un brouillon (0 à 3 choix distincts, entre 0 et 5, pour des situations connues). */
export function sanitizeDraft(input: unknown, category: Category): DraftAnswers | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const data = pcmData(category)
  const known = new Map(allQuestionsOf(category).map((q) => [q.id, q.options.length]))
  const out: DraftAnswers = {}
  for (const [id, v] of Object.entries(input as Record<string, unknown>)) {
    const n = known.get(id)
    if (n === undefined || !Array.isArray(v) || v.length > n) return null
    if (!v.every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < n)) return null
    if (new Set(v).size !== v.length) return null
    if (v.length > 0) out[id] = v as number[]
  }
  return out
}
