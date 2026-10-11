import 'server-only'
import { getTestData } from '@core/index'
import { common } from '@core/data'
import type { PcmType } from '@core/types'
import { categoryLabel, formatDateShort } from '@/lib/format'
import { STATUS_LABEL, statusOf, type ClientSummary, type StoredResult } from '@/lib/types'

export const TYPE_ORDER = common.seuils.pcm.typesOrder as PcmType[]

/** Libellés des six profils (identiques pour les quatre catégories). */
export function profileLabels(): Record<PcmType, string> {
  const t = getTestData('pcm', 'manager').types
  const out = {} as Record<PcmType, string>
  for (const k of TYPE_ORDER) out[k] = t[k].label
  return out
}

export interface SummaryRow {
  client: ClientSummary
  statusLabel: string
  latest: StoredResult | null
}

/** Une ligne par client : dernier résultat s'il existe. */
export function buildSummary(clients: ClientSummary[], results: StoredResult[]): SummaryRow[] {
  const latestBy = new Map<string, StoredResult>()
  for (const r of results) {
    const cur = latestBy.get(r.userId)
    if (!cur || r.attempt > cur.attempt) latestBy.set(r.userId, r)
  }
  return clients
    .map((c) => ({ client: c, statusLabel: STATUS_LABEL[statusOf(c)], latest: latestBy.get(c.id) ?? null }))
    .sort((a, b) => a.client.fullName.localeCompare(b.client.fullName, 'fr'))
}

/** Neutralise les formules des tableurs (cellule commençant par = + - @ ou une tabulation). */
function cell(v: string | number): string {
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Synthèse CSV : UTF-8 avec BOM, séparateur point-virgule. */
export function summaryCsv(rows: SummaryRow[]): string {
  const labels = profileLabels()
  const header = [
    'Nom',
    'E-mail',
    'Catégorie',
    'Statut',
    'Date de passage',
    'Passages',
    'Profil fondamental',
    'Profil du moment',
    ...TYPE_ORDER.map((t) => `${labels[t]} (%)`),
  ]
  const lines = [header, ...rows.map((r) => {
    const res = r.latest?.result
    return [
      r.client.fullName,
      r.client.email,
      categoryLabel(r.client.category),
      r.statusLabel,
      r.latest ? formatDateShort(r.latest.createdAt) : '',
      r.client.resultsCount,
      res ? res.baseProfile.label : '',
      res ? res.phaseProfile.label : '',
      ...TYPE_ORDER.map((t) => (res ? res.percents[t] : '')),
    ]
  })].map((line) => line.map(cell).join(';'))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
