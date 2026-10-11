import { common } from '../data'
import type { CmpAnswers, CmpData, CmpResult, Progress } from '../types'
import { isOptionIndex, makeProgress, meta, pickBand } from './utils'

export function progressCmp(answers: CmpAnswers, data: CmpData): Progress {
  const answered = data.questions.filter((q) => isOptionIndex(answers[q.id], q.options.length)).length
  return makeProgress(answered, data.questions.length)
}

export function isCompleteCmp(answers: CmpAnswers, data: CmpData): boolean {
  return progressCmp(answers, data).complete
}

/**
 * Calcul fidèle à app/individuel/tests/cmp/page.tsx (calcResults) : chaque
 * score est la somme des points rapportée à 100, le score global est la
 * moyenne de Pression, Maturité, Ressources et du complément du Blocage.
 */
export function scoreCmp(answers: CmpAnswers, data: CmpData): CmpResult {
  const max = common.ponderations.cmp.echelleMax
  let pression = 0
  let maturite = 0
  let blocage = 0
  let ressource = 0
  let count = 0
  for (const q of data.questions) {
    const idx = answers[q.id]
    if (!isOptionIndex(idx, q.options.length)) continue
    const s = q.options[idx].scores
    pression += s.pression
    maturite += s.maturite
    blocage += s.blocage
    ressource += s.ressource
    count++
  }
  const pct = (v: number) => (count > 0 ? Math.round((v / (count * max)) * 100) : 0)
  const scorePression = pct(pression)
  const scoreMaturite = pct(maturite)
  const scoreBlocage = pct(blocage)
  const scoreRessource = pct(ressource)
  const globalScore = Math.round((scorePression + scoreMaturite + (100 - scoreBlocage) + scoreRessource) / 4)

  const level = pickBand(
    data.profils.map((p) => ({ ...p, min: p.minScore })),
    globalScore
  )
  const { min: _min, ...levelData } = level
  void _min

  return {
    test: 'cmp',
    meta: meta(progressCmp(answers, data)),
    scorePression,
    scoreMaturite,
    scoreBlocage,
    scoreRessource,
    globalScore,
    level: {
      ...levelData,
      forces: [...levelData.forces],
      vigilances: [...levelData.vigilances],
      leviers: [...levelData.leviers],
    },
  }
}
