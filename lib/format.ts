import { AUDIENCES } from '@core/audiences'
import type { Category } from './types'

export const SIGNATURE = 'A4P Mental, Alexandre Griffet'
export const APP_NAME = 'A4P Bilan'
export const REPORT_TITLE = 'Bilan de Construction Mentale'

/** Libellés des cinq catégories, tels que définis dans le cahier des charges. */
const LABELS: Record<Category, string> = {
  'adulte-sport': 'Adulte sportif',
  'adulte-hors-sport': 'Adulte, hors sport',
  manager: 'Manager',
  'ado-etudes': 'Adolescent, études',
  'ado-sport': 'Adolescent, sport',
}

export const CATEGORIES = AUDIENCES.map((a) => ({ id: a.id as Category, label: LABELS[a.id as Category] }))

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && AUDIENCES.some((a) => a.id === v)
}

export function categoryLabel(c: Category | null | undefined): string {
  if (!c) return 'Non définie'
  return LABELS[c]
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  })
}
