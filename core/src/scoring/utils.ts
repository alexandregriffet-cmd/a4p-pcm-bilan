import type { Band, Progress } from '../types'

/** Remplace les tirets cadratins et retire les emoji d'un texte issu des données. */
export function cleanText(s: string): string {
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/ \u2014 /g, ', ')
    .replace(/\u2014/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Premier palier dont le minimum est atteint (paliers triés du plus haut au plus bas). */
export function pickBand<T extends { min: number }>(bands: readonly T[], value: number): T {
  const sorted = [...bands].sort((a, b) => b.min - a.min)
  return sorted.find((b) => value >= b.min) ?? sorted[sorted.length - 1]
}

export function bandLabel(bands: readonly Band[], value: number): string {
  return pickBand(bands, value).label
}

export function isLikertValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5
}

export function isOptionIndex(v: unknown, nbOptions: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < nbOptions
}

export function makeProgress(answered: number, total: number): Progress {
  return {
    answered,
    total,
    ratio: total > 0 ? answered / total : 0,
    complete: total > 0 && answered === total,
  }
}

export function meta(p: Progress) {
  return { answered: p.answered, total: p.total, complete: p.complete }
}
