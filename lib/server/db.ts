import 'server-only'
import type { ClientSummary, Category, DraftAnswers, Profile, StoredResult } from '@/lib/types'
import type { PcmResult } from '@core/types'
import { getMode } from './mode'

export type DbErrorCode = 'exists' | 'conflict' | 'refused' | 'notfound' | 'failed' | 'unconfigured'

export class DbError extends Error {
  constructor(public code: DbErrorCode, message?: string) {
    super(message ?? code)
  }
}

export interface NewClientInput {
  email: string
  fullName: string
  category: Category
  guardianConsent: boolean
  password: string
}

export interface ClientPatch {
  category?: Category
  active?: boolean
  attemptsAllowed?: number
  guardianConsent?: boolean
}

export interface NewResultInput {
  userId: string
  attempt: number
  category: Category
  answers: Record<string, number[]>
  result: PcmResult
}

/**
 * Accès aux données, côté serveur uniquement. Deux implémentations : Supabase (production) et fichier local (essais).
 * Aucune méthode ne contrôle l'identité de l'appelant : les routes et pages le font avant tout appel (voir guards.ts).
 */
export interface Db {
  getProfile(id: string): Promise<Profile | null>
  listClients(): Promise<ClientSummary[]>
  createClient(input: NewClientInput): Promise<Profile>
  setPassword(id: string, password: string): Promise<void>
  updateClient(id: string, patch: ClientPatch): Promise<Profile>
  deleteClient(id: string): Promise<void>
  /** Écrit consent_at du client connecté (avec ses propres droits en mode Supabase). */
  setConsent(userId: string): Promise<void>
  getDraft(userId: string): Promise<{ answers: DraftAnswers; updatedAt: string } | null>
  saveDraft(userId: string, answers: DraftAnswers): Promise<void>
  clearDraft(userId: string): Promise<void>
  countResults(userId: string): Promise<number>
  listResults(userId: string): Promise<StoredResult[]>
  getResult(id: string): Promise<StoredResult | null>
  listAllResults(): Promise<StoredResult[]>
  insertResult(input: NewResultInput): Promise<StoredResult>
  getNote(userId: string): Promise<{ note: string; updatedAt: string } | null>
  saveNote(userId: string, note: string): Promise<void>
}

export async function getDb(): Promise<Db> {
  const info = getMode()
  if (info.mode === 'local') return (await import('./db-local')).localDb
  if (info.mode === 'supabase') return (await import('./db-supabase')).supabaseDb
  throw new DbError('unconfigured')
}
