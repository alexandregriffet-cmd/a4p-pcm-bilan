import { getAudience } from './audiences'
import { getTestData } from './data'
import { isCompleteCmp, progressCmp, scoreCmp } from './scoring/cmp'
import { isCompleteMpa, progressMpa, scoreMpa } from './scoring/mpa'
import { isCompletePcm, progressPcm, scorePcm } from './scoring/pcm'
import { isCompletePmp, progressPmp, scorePmp } from './scoring/pmp'
import { isCompletePsycho, progressPsycho, scorePsycho } from './scoring/psycho'
import type { AnswersByTest, AudienceId, Progress, ResultByTest, TestId } from './types'

export * from './audiences'
export * from './tests'
export * from './types'
export * from './config'
export * from './data'
export * from './scoring'

/** Calcule le résultat d'un test pour un public (charge les données, applique le tutoiement du MPA). */
export function scoreTest<T extends TestId>(test: T, audience: AudienceId, answers: AnswersByTest[T]): ResultByTest[T] {
  const data = getTestData(test, audience)
  let result: unknown
  switch (test) {
    case 'pmp':
      result = scorePmp(answers as AnswersByTest['pmp'], data as ReturnType<typeof getTestData<'pmp'>>)
      break
    case 'mpa':
      result = scoreMpa(answers as AnswersByTest['mpa'], data as ReturnType<typeof getTestData<'mpa'>>, {
        adresse: getAudience(audience).adresse,
      })
      break
    case 'cmp':
      result = scoreCmp(answers as AnswersByTest['cmp'], data as ReturnType<typeof getTestData<'cmp'>>)
      break
    case 'psycho':
      result = scorePsycho(answers as AnswersByTest['psycho'], data as ReturnType<typeof getTestData<'psycho'>>)
      break
    case 'pcm':
      result = scorePcm(answers as AnswersByTest['pcm'], data as ReturnType<typeof getTestData<'pcm'>>)
      break
    default:
      throw new Error(`Test inconnu : ${String(test)}`)
  }
  return result as ResultByTest[T]
}

export function progressTest<T extends TestId>(test: T, audience: AudienceId, answers: AnswersByTest[T]): Progress {
  const data = getTestData(test, audience) as never
  const a = answers as never
  switch (test) {
    case 'pmp': return progressPmp(a, data)
    case 'mpa': return progressMpa(a, data)
    case 'cmp': return progressCmp(a, data)
    case 'psycho': return progressPsycho(a, data)
    case 'pcm': return progressPcm(a, data)
    default: throw new Error(`Test inconnu : ${String(test)}`)
  }
}

export function isCompleteTest<T extends TestId>(test: T, audience: AudienceId, answers: AnswersByTest[T]): boolean {
  const data = getTestData(test, audience) as never
  const a = answers as never
  switch (test) {
    case 'pmp': return isCompletePmp(a, data)
    case 'mpa': return isCompleteMpa(a, data)
    case 'cmp': return isCompleteCmp(a, data)
    case 'psycho': return isCompletePsycho(a, data)
    case 'pcm': return isCompletePcm(a, data)
    default: throw new Error(`Test inconnu : ${String(test)}`)
  }
}
