import { pmpConfig } from '../config'
import { common } from '../data'
import type {
  PmpAnswers,
  PmpData,
  PmpDimensionKey,
  PmpDimensionResult,
  PmpOptions,
  PmpResult,
  Progress,
} from '../types'
import { bandLabel, isLikertValue, makeProgress, meta } from './utils'

function isValidAnswer(q: PmpData['questions'][number], v: unknown): boolean {
  return q.type === 'likert' ? isLikertValue(v) : v === 'A' || v === 'B'
}

export function progressPmp(answers: PmpAnswers, data: PmpData): Progress {
  const answered = data.questions.filter((q) => isValidAnswer(q, answers[q.id])).length
  return makeProgress(answered, data.questions.length)
}

export function isCompletePmp(answers: PmpAnswers, data: PmpData): boolean {
  return progressPmp(answers, data).complete
}

function effectiveReverse(id: string, flag: boolean, overrides: Record<string, boolean>): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : flag
}

/**
 * Calcul fidèle à lib/pmp/scoring.ts (computePmpResults). Les réponses absentes
 * sont ignorées (comme dans la page du test), le dénominateur porte sur les
 * réponses données.
 */
export function scorePmp(answers: PmpAnswers, data: PmpData, options: PmpOptions = {}): PmpResult {
  const S = common.seuils.pmp
  const W = common.ponderations.pmp
  const overrides = { ...pmpConfig.reverseOverrides, ...(options.reverseOverrides ?? {}) }
  const keys = S.dimensionOrder as PmpDimensionKey[]

  const scores = {} as Record<PmpDimensionKey, number>
  for (const key of keys) {
    let total = 0
    let count = 0
    for (const q of data.questions) {
      if (q.type !== 'likert' || q.dimension !== key) continue
      const v = answers[q.id]
      if (!isLikertValue(v)) continue
      total += effectiveReverse(q.id, q.reverse === true, overrides) ? 6 - v : v
      count++
    }
    scores[key] = count > 0 ? Math.round((total / (count * 5)) * 100) : 0
  }

  const binaryAxes: Record<'ei' | 'sn' | 'tf' | 'jp', number> = { ei: 0, sn: 0, tf: 0, jp: 0 }
  for (const q of data.questions) {
    if (q.type !== 'binary') continue
    const v = answers[q.id]
    if (v === 'A') binaryAxes[q.axis] += 1
    if (v === 'B') binaryAxes[q.axis] -= 1
  }
  const ax = S.axesBinaires
  const binaryCode =
    (binaryAxes.ei >= 0 ? ax.ei[0] : ax.ei[1]) +
    (binaryAxes.sn >= 0 ? ax.sn[0] : ax.sn[1]) +
    (binaryAxes.tf >= 0 ? ax.tf[0] : ax.tf[1]) +
    (binaryAxes.jp >= 0 ? ax.jp[0] : ax.jp[1])

  const motor = common.MBTI_TO_MOTOR[binaryCode]
  const motorFamily = common.MOTOR_FAMILIES[motor[0]]

  const globalIndex = Math.round(
    keys.reduce((sum, k) => sum + scores[k] * W.globalIndex[k], 0) / W.globalDivisor
  )
  const pressureIndex = Math.round(
    Object.entries(W.pressureIndex).reduce((sum, [k, w]) => sum + scores[k as PmpDimensionKey] * w, 0)
  )
  const stabilityIndex = Math.round(
    S.stabilite.reduce((sum, k) => sum + scores[k as PmpDimensionKey], 0) / S.stabilite.length
  )

  const profiles = Object.entries(common.PMP_PROFILES)
    .map(([name, dims]) => ({
      name,
      value: Math.round(dims.reduce((sum, d) => sum + (scores[d as PmpDimensionKey] ?? 0), 0) / dims.length),
      dimensions: dims as PmpDimensionKey[],
    }))
    .sort((a, b) => b.value - a.value)

  const learning = S.stylesApprentissage
    .map((s) => ({
      label: s.label,
      value: Math.round(s.dimensions.reduce((sum, d) => sum + scores[d as PmpDimensionKey], 0) / s.dimensions.length),
    }))
    .sort((a, b) => b.value - a.value)
  const learningStyle = learning[0].label

  let coherenceIndex = Math.round(
    S.coherence.base.reduce((sum, d) => sum + scores[d as PmpDimensionKey], 0) / S.coherence.base.length
  )
  for (const b of S.coherence.bonus) {
    if (b.familles.includes(motor[0]) && scores[b.dimension as PmpDimensionKey] >= b.seuil) {
      coherenceIndex += b.points
    }
  }
  coherenceIndex = Math.max(S.coherence.min, Math.min(S.coherence.max, coherenceIndex))

  const dimensions: PmpDimensionResult[] = keys.map((key) => {
    const d = data.dimensions[key]
    const score = scores[key]
    return {
      key,
      label: d.label,
      description: d.description,
      score,
      band: bandLabel(S.dimensionBands, score),
      interpretation: score >= S.seuilTexteForce ? d.high : d.low,
    }
  })
  const byKey = (k: string) => dimensions.find((d) => d.key === k) as PmpDimensionResult
  const strengths = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, S.nbPointsForts)
    .map(([k]) => byKey(k))
  const vigilances = Object.entries(scores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, S.nbPointsVigilance)
    .map(([k]) => byKey(k))

  return {
    test: 'pmp',
    meta: meta(progressPmp(answers, data)),
    scores,
    dimensions,
    globalIndex,
    globalBand: bandLabel(S.globalBands, globalIndex),
    pressureIndex,
    stabilityIndex,
    coherenceIndex,
    learningStyle,
    profiles,
    mainProfile: profiles[0],
    binaryCode,
    binaryAxes,
    motor,
    motorFamily,
    strengths,
    vigilances,
  }
}
