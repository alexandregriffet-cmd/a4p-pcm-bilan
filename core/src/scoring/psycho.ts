import { common } from '../data'
import type { Progress, PsychoAnswers, PsychoData, PsychoResult, PsychoTypeKey } from '../types'
import { isLikertValue, isOptionIndex, makeProgress, meta } from './utils'

function isValid(q: PsychoData['questions'][number], v: unknown): boolean {
  return q.type === 'likert' ? isLikertValue(v) : isOptionIndex(v, q.options.length)
}

export function progressPsycho(answers: PsychoAnswers, data: PsychoData): Progress {
  const answered = data.questions.filter((q) => isValid(q, answers[q.id])).length
  return makeProgress(answered, data.questions.length)
}

export function isCompletePsycho(answers: PsychoAnswers, data: PsychoData): boolean {
  return progressPsycho(answers, data).complete
}

/**
 * Calcul fidèle à app/individuel/tests/psycho/page.tsx (calcResults).
 * Les questions de coping (PE31 à PE40) ne sont pas intégrées au calcul,
 * comme dans la plateforme actuelle.
 */
export function scorePsycho(answers: PsychoAnswers, data: PsychoData): PsychoResult {
  const S = common.seuils.psycho
  const sums: Record<PsychoTypeKey, number> = { combatif: 0, expressif: 0, analytique: 0, absorbant: 0 }
  let regulationScore = 0
  let regulationCount = 0
  let itcaScore = 0
  let itcaCount = 0
  const likertById: Record<string, number> = {}

  for (const q of data.questions) {
    const ans = answers[q.id]
    if (!isValid(q, ans)) continue
    if (q.type === 'situational') {
      const s = q.options[ans].scores
      for (const t of S.typesOrder) sums[t] += s[t] ?? 0
    }
    if (q.type === 'likert') {
      likertById[q.id] = ans
      if (q.dimension === 'regulation') {
        regulationScore += S.regulationInversees.includes(q.id) ? 6 - ans : ans
        regulationCount++
      }
      if (q.dimension === 'itca') {
        itcaScore += ans
        itcaCount++
      }
    }
  }

  // Les échelles neurochimiques ne portent que sur des items de type Likert du bloc neurochimie.
  const neuroIds = new Set(data.questions.filter((q) => q.type === 'likert' && q.dimension === 'neurochimie').map((q) => q.id))
  const neuro = {} as PsychoResult['neurochemistry']
  for (const [name, cfg] of Object.entries(S.neurochimie)) {
    let total = 0
    for (const item of cfg.items) {
      if (!neuroIds.has(item.id)) continue
      const v = likertById[item.id]
      if (v === undefined) continue
      total += item.inverse ? 6 - v : v
    }
    neuro[name as keyof typeof neuro] = Math.min(100, Math.round((total / cfg.diviseur) * 100))
  }

  const nbSituations = data.questions.filter((q) => q.type === 'situational').length
  const maxSit = nbSituations * common.ponderations.psycho.echelleSituation
  const types = {} as Record<PsychoTypeKey, number>
  for (const t of S.typesOrder) types[t] = Math.round((sums[t] / maxSit) * 100)

  const dominantType = [...S.typesOrder].sort((a, b) => types[b] - types[a])[0]
  const regulation = regulationCount > 0 ? Math.round((regulationScore / (regulationCount * 5)) * 100) : S.regulationDefaut
  const itcaAvg = itcaCount > 0 ? itcaScore / itcaCount : S.itca.defaut

  // Les niveaux ITCA sont ordonnés du plus élevé au plus bas dans les données.
  const itcaSorted = [...data.itca].sort((a, b) => b.code.localeCompare(a.code))
  const level = itcaAvg >= S.itca.seuilEleve ? itcaSorted[0] : itcaAvg >= S.itca.seuilPresent ? itcaSorted[1] : itcaSorted[2]

  const globalScore = Math.round((regulation + (100 - Math.abs(types.combatif - types.absorbant))) / 2)

  const profile = data.profils[dominantType]
  return {
    test: 'psycho',
    meta: meta(progressPsycho(answers, data)),
    dominantType,
    types,
    profile: JSON.parse(JSON.stringify(profile)),
    regulation,
    neurochemistry: neuro,
    itca: { average: itcaAvg, level: JSON.parse(JSON.stringify(level)) },
    globalScore,
  }
}
