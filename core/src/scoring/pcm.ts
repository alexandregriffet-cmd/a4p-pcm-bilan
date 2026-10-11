import { common } from '../data'
import type { PcmAnswers, PcmData, PcmRankedType, PcmResult, PcmType, PcmTypeData, Progress } from '../types'
import { isOptionIndex, makeProgress, meta } from './utils'

/** Un classement complet comporte trois index valides et distincts. */
function isFullRanking(v: unknown, nbOptions: number): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((i) => isOptionIndex(i, nbOptions)) &&
    new Set(v).size === 3
  )
}

export function progressPcm(answers: PcmAnswers, data: PcmData): Progress {
  const answered = data.questions.filter((q) => isFullRanking(answers[q.id], q.options.length)).length
  return makeProgress(answered, data.questions.length)
}

export function isCompletePcm(answers: PcmAnswers, data: PcmData): boolean {
  return progressPcm(answers, data).complete
}

function profileOf(data: PcmData, type: PcmType): PcmTypeData & { type: PcmType } {
  return JSON.parse(JSON.stringify({ type, ...data.types[type] }))
}

/**
 * Calcul fidèle à app/individuel/tests/pcm/page.tsx : 6, 4 et 2 points pour
 * les premier, deuxième et troisième choix ; maximum par profil = 6 points par
 * situation (432). Profil de base = total le plus élevé, profil de phase =
 * deuxième total. Aucun nom de base ni de driver n'est exposé.
 */
export function scorePcm(answers: PcmAnswers, data: PcmData): PcmResult {
  const W = common.ponderations.pcm
  const points = [W.premier, W.deuxieme, W.troisieme]
  const order = common.seuils.pcm.typesOrder
  const scores = {} as Record<PcmType, number>
  for (const t of order) scores[t] = 0

  for (const q of data.questions) {
    const ranked = answers[q.id]
    if (!Array.isArray(ranked)) continue
    const used = new Set<number>()
    for (let pos = 0; pos < 3; pos++) {
      const idx = ranked[pos]
      if (!isOptionIndex(idx, q.options.length) || used.has(idx)) continue
      used.add(idx)
      scores[q.options[idx].type] += points[pos]
    }
  }

  const maxPoints = data.questions.length * W.premier
  const percents = {} as Record<PcmType, number>
  for (const t of order) percents[t] = Math.round((scores[t] / maxPoints) * 100)

  const sorted = [...order].sort((a, b) => scores[b] - scores[a])
  const ranking: PcmRankedType[] = sorted.map((t) => ({
    type: t,
    label: data.types[t].label,
    points: scores[t],
    percent: percents[t],
  }))

  return {
    test: 'pcm',
    meta: meta(progressPcm(answers, data)),
    scores,
    percents,
    maxPoints,
    totalPoints: order.reduce((s, t) => s + scores[t], 0),
    ranking,
    baseType: sorted[0],
    phaseType: sorted[1],
    baseProfile: profileOf(data, sorted[0]),
    phaseProfile: profileOf(data, sorted[1]),
  }
}
