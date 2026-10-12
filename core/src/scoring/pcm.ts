import { common } from '../data'
import type { PcmAnswers, PcmData, PcmMoment, PcmRankedType, PcmResult, PcmType, PcmTypeData, Progress } from '../types'
import { isOptionIndex, makeProgress, meta } from './utils'

export const MIN_CHOICES = 3

/** Un classement valide comporte de 3 à 6 index valides et distincts, du 1er choix au dernier retenu. */
function isFullRanking(v: unknown, nbOptions: number): v is number[] {
  return (
    Array.isArray(v) &&
    v.length >= MIN_CHOICES &&
    v.length <= nbOptions &&
    v.every((i) => isOptionIndex(i, nbOptions)) &&
    new Set(v).size === v.length
  )
}

/** Points par rang (1er à 6e). Les options non retenues se partagent à égalité la moyenne des rangs restants : total fixe de 16 points par situation. */
const RANK_POINTS = [6, 4, 3, 2, 1, 0]

function allQuestions(data: PcmData) {
  return [...data.questions, ...(data.valorisation ?? [])]
}

export function progressPcm(answers: PcmAnswers, data: PcmData): Progress {
  const qs = allQuestions(data)
  const answered = qs.filter((q) => isFullRanking(answers[q.id], q.options.length)).length
  return makeProgress(answered, qs.length)
}

export function isCompletePcm(answers: PcmAnswers, data: PcmData): boolean {
  return progressPcm(answers, data).complete
}

function profileOf(data: PcmData, type: PcmType): PcmTypeData & { type: PcmType } {
  return JSON.parse(JSON.stringify({ type, ...data.types[type] }))
}

/** Total de points par profil pour un ensemble de situations (de 3 à 6 choix classés, options non retenues à égalité). */
function scoreSet(questions: PcmData['questions'], answers: PcmAnswers, order: PcmType[]) {
  const scores = {} as Record<PcmType, number>
  const retained = {} as Record<PcmType, number>
  for (const t of order) {
    scores[t] = 0
    retained[t] = 0
  }
  let answeredCount = 0
  let choiceSum = 0
  for (const q of questions) {
    const ranked = answers[q.id]
    if (!isFullRanking(ranked, q.options.length)) continue
    answeredCount++
    choiceSum += ranked.length
    const used = new Set<number>()
    ranked.forEach((idx, pos) => {
      used.add(idx)
      scores[q.options[idx].type] += RANK_POINTS[pos]
      retained[q.options[idx].type] += 1
    })
    const rest = RANK_POINTS.slice(ranked.length, q.options.length)
    if (rest.length) {
      const share = rest.reduce((sum, v) => sum + v, 0) / rest.length
      q.options.forEach((o, idx) => {
        if (!used.has(idx)) scores[o.type] += share
      })
    }
  }
  const recognition = Object.fromEntries(order.map((t) => [t, answeredCount ? Math.round((retained[t] / answeredCount) * 100) : 0])) as Record<PcmType, number>
  const avgChoices = answeredCount ? Math.round((choiceSum / answeredCount) * 100) / 100 : 0
  const maxPoints = questions.length * RANK_POINTS[0]
  const percents = {} as Record<PcmType, number>
  for (const t of order) percents[t] = Math.round((scores[t] / maxPoints) * 100)
  const sorted = [...order].sort((x, y) => scores[y] - scores[x])
  return { scores, percents, recognition, avgChoices, maxPoints, sorted }
}

/**
 * Deux calculs séparés, de 3 à 6 options classées par situation : 6, 4, 3, 2, 1 et 0 points du 1er au 6e rang,
 * les options non retenues se partageant à égalité les rangs restants (total fixe de 16 points par situation).
 * - Style (72 situations) : profil fondamental = total le plus élevé, deuxième profil = ressource.
 * - Valorisation (24 situations, quand elles existent) : moteur du moment. Si le moteur du moment est le profil
 *   fondamental, la personne est dans sa base et le profil du moment affiché est le suivant du classement de valorisation.
 *   Sans situations de valorisation (anciennes données), le profil du moment reste le deuxième du style.
 */
export function scorePcm(answers: PcmAnswers, data: PcmData): PcmResult {
  const order = common.seuils.pcm.typesOrder
  const style = scoreSet(data.questions, answers, order)
  const { scores, percents, maxPoints, sorted } = style

  const ranking: PcmRankedType[] = sorted.map((t) => ({
    type: t,
    label: data.types[t].label,
    points: scores[t],
    percent: percents[t],
  }))

  let phaseType = sorted[1]
  let moment: PcmMoment | undefined
  let resourceType: PcmType | undefined
  if (data.valorisation && data.valorisation.length) {
    const m = scoreSet(data.valorisation, answers, order)
    const top = m.sorted[0]
    const inBase = top === sorted[0]
    phaseType = inBase ? m.sorted[1] : top
    resourceType = sorted[1]
    moment = {
      scores: m.scores,
      percents: m.percents,
      ranking: m.sorted.map((t) => ({ type: t, label: data.types[t].label, points: m.scores[t], percent: m.percents[t] })),
      topType: top,
      gap12: m.percents[m.sorted[0]] - m.percents[m.sorted[1]],
      inBase,
      recognition: m.recognition,
      avgChoices: m.avgChoices,
    }
  }

  return {
    test: 'pcm',
    meta: meta(progressPcm(answers, data)),
    scores,
    percents,
    maxPoints,
    totalPoints: Math.round(order.reduce((sum, t) => sum + scores[t], 0)),
    recognition: style.recognition,
    avgChoices: style.avgChoices,
    ranking,
    baseType: sorted[0],
    phaseType,
    baseProfile: profileOf(data, sorted[0]),
    phaseProfile: profileOf(data, phaseType),
    ...(moment ? { moment, resourceType } : {}),
  }
}
