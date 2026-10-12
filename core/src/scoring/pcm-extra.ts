import type { PcmAnswers, PcmQuality, PcmResult } from '../types'

/** Générateur pseudo-aléatoire déterministe (mulberry32) initialisé par une graine texte (xmur3). */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = (() => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  })()
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Ordre d'affichage des options d'une situation : permutation déterministe (mêmes graine, même ordre,
 * donc une reprise après rechargement affiche les options au même endroit). order[position affichée] = index d'origine.
 */
export function displayOrder(seed: string, nbOptions: number): number[] {
  const r = rng(seed)
  const idx = Array.from({ length: nbOptions }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

/** Convertit des choix exprimés en positions affichées vers les index d'origine des options. */
export function toOriginalIndex(shown: number[], order: number[]): number[] {
  return shown.map((p) => order[p])
}

/**
 * Indice de cohérence : deux signes de réponses peu attentives, mesurés sur les positions affichées.
 * Avec un ordre aléatoire, une préférence de profil n'explique pas une position répétée.
 * - positionShare : part des premiers choix tombés sur la position la plus fréquente (hasard : 1/6, soit 17 %).
 * - repeatShare : part des situations dont le classement affiché répète celui de la situation précédente.
 * Seuils provisoires, à recalibrer avec les données de l'étude pilote.
 */
export function consistencyPcm(shown: PcmAnswers, ids: string[], nbOptions = 6): PcmQuality | undefined {
  const rows = ids.map((id) => shown[id]).filter((v): v is [number, number, number] => Array.isArray(v) && v.length === 3)
  if (rows.length < 12) return undefined
  const counts = Array(nbOptions).fill(0)
  for (const r of rows) counts[r[0]]++
  const positionShare = Math.max(...counts) / rows.length
  let same = 0
  for (let i = 1; i < rows.length; i++) if (rows[i].every((v, k) => v === rows[i - 1][k])) same++
  const repeatShare = same / (rows.length - 1)
  const a = Math.min(1, Math.max(0, (positionShare - 1 / nbOptions) / (0.6 - 1 / nbOptions)))
  const b = Math.min(1, repeatShare / 0.5)
  const index = Math.round(100 * (1 - Math.max(a, b)))
  const level = positionShare >= 0.4 || repeatShare >= 0.4 ? 'faible' : positionShare >= 0.3 || repeatShare >= 0.2 ? 'a-verifier' : 'bonne'
  return { index, level, positionShare: Math.round(positionShare * 100) / 100, repeatShare: Math.round(repeatShare * 100) / 100 }
}

export type Clarity = 'net' | 'nuance' | 'mixte' | 'egalite'

export interface PcmClarity {
  /** Écart entre le 1er et le 2e profil, en points de pourcentage (sur 432). */
  gap12: number
  /** Écart entre le 2e et le 3e profil, en points de pourcentage. */
  gap23: number
  clarity: Clarity
  /** Vrai si le 2e profil se distingue peu du 3e : le profil du moment est à confirmer en entretien. */
  momentToConfirm: boolean
}

/**
 * Netteté du profil à partir du classement existant (aucune donnée nouvelle).
 * Seuils provisoires : 10 points de pourcentage ou plus = net, de 4 à 9 = nuancé, moins de 4 = mixte.
 */
export function clarityPcm(result: Pick<PcmResult, 'ranking'>): PcmClarity {
  const [a, b, c] = result.ranking
  const gap12 = a.percent - b.percent
  const gap23 = b.percent - c.percent
  const exact = a.points === b.points
  const clarity: Clarity = exact ? 'egalite' : gap12 >= 10 ? 'net' : gap12 >= 4 ? 'nuance' : 'mixte'
  return { gap12, gap23, clarity, momentToConfirm: b.points === c.points || gap23 < 2 }
}
