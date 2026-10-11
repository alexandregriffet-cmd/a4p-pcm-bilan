import type { AudienceId } from '@core/audiences'
import type { PcmResult } from '@core/types'

/** Catégorie d'un client : les cinq publics du noyau. */
export type Category = AudienceId
export type Role = 'admin' | 'client'

export interface Profile {
  id: string
  email: string
  fullName: string
  role: Role
  category: Category | null
  active: boolean
  guardianConsent: boolean
  consentAt: string | null
  attemptsAllowed: number
  createdAt: string
}

export interface ClientSummary extends Profile {
  resultsCount: number
  lastResultAt: string | null
  /** Nombre de situations ayant au moins un choix dans le brouillon en cours. */
  draftAnswered: number
}

export type ClientStatus = 'pas-commence' | 'en-cours' | 'termine'

export interface StoredResult {
  id: string
  userId: string
  attempt: number
  category: Category
  createdAt: string
  result: PcmResult
}

/** Brouillon : situation -> choix déjà faits (0 à 3 index distincts, dans l'ordre 1er, 2e, 3e). */
export type DraftAnswers = Record<string, number[]>

/** Situation transmise au navigateur du client : jamais le type associé à chaque option. */
export interface ClientQuestion {
  id: string
  situation: string
  options: string[]
}

export function statusOf(c: { resultsCount: number; attemptsAllowed: number; draftAnswered: number }): ClientStatus {
  if (c.resultsCount >= c.attemptsAllowed) return 'termine'
  if (c.draftAnswered > 0) return 'en-cours'
  return 'pas-commence'
}

export const STATUS_LABEL: Record<ClientStatus, string> = {
  'pas-commence': 'Pas commencé',
  'en-cours': 'En cours',
  termine: 'Terminé',
}
