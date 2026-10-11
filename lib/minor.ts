import type { Category } from './types'

/** Catégories d'adolescents : l'accord du représentant légal est exigé avant le test. */
export function isMinorCategory(c: Category | string | null | undefined): boolean {
  return c === 'ado-etudes' || c === 'ado-sport'
}
