import 'server-only'
import type { ClientSummary, DraftAnswers, Profile, Category, StoredResult } from '@/lib/types'
import type { PcmResult } from '@core/types'
import { DbError, type ClientPatch, type Db, type NewClientInput, type NewResultInput } from './db'
import { getServiceClient, getUserClient } from './supabase'

/* eslint-disable @typescript-eslint/no-explicit-any */

const PROFILE_COLS = 'id,email,full_name,role,category,active,guardian_consent,consent_at,attempts_allowed,created_at'

function toProfile(r: any): Profile {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name ?? '',
    role: r.role,
    category: (r.category ?? null) as Category | null,
    active: !!r.active,
    guardianConsent: !!r.guardian_consent,
    consentAt: r.consent_at ?? null,
    attemptsAllowed: r.attempts_allowed ?? 1,
    createdAt: r.created_at,
  }
}

function toResult(r: any): StoredResult {
  return {
    id: r.id,
    userId: r.user_id,
    attempt: r.attempt,
    category: r.category,
    createdAt: r.created_at,
    result: r.result as PcmResult,
  }
}

function draftCount(a: unknown): number {
  if (!a || typeof a !== 'object') return 0
  return Object.values(a as Record<string, unknown>).filter((v) => Array.isArray(v) && v.length > 0).length
}

function fail(e: { message?: string; code?: string } | null, fallback = 'failed'): never {
  const code = e?.code
  if (code === '23505') throw new DbError('conflict', e?.message)
  if (code === 'P0001') throw new DbError('refused', e?.message)
  throw new DbError(fallback as 'failed', e?.message)
}

const SELECT_RESULT = 'id,user_id,attempt,category,created_at,result'

export const supabaseDb: Db = {
  async getProfile(id) {
    const { data, error } = await getServiceClient().from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle()
    if (error) fail(error)
    return data ? toProfile(data) : null
  },

  async listClients() {
    const svc = getServiceClient()
    const [p, r, d] = await Promise.all([
      svc.from('profiles').select(PROFILE_COLS).eq('role', 'client'),
      svc.from('test_results').select('user_id,created_at'),
      svc.from('test_drafts').select('user_id,answers'),
    ])
    if (p.error) fail(p.error)
    if (r.error) fail(r.error)
    if (d.error) fail(d.error)
    const results = (r.data ?? []) as { user_id: string; created_at: string }[]
    const drafts = (d.data ?? []) as { user_id: string; answers: unknown }[]
    return ((p.data ?? []) as any[]).map<ClientSummary>((row) => {
      const mine = results.filter((x) => x.user_id === row.id).map((x) => x.created_at).sort()
      const dr = drafts.find((x) => x.user_id === row.id)
      return { ...toProfile(row), resultsCount: mine.length, lastResultAt: mine.length ? mine[mine.length - 1] : null, draftAnswered: draftCount(dr?.answers) }
    })
  },

  async createClient(input: NewClientInput) {
    const svc = getServiceClient()
    const email = input.email.toLowerCase()
    const created = await svc.auth.admin.createUser({ email, password: input.password, email_confirm: true })
    if (created.error || !created.data.user) {
      const e = created.error as { code?: string; status?: number; message?: string } | null
      if (e?.code === 'email_exists' || e?.status === 422 || /already|exist|registered/i.test(e?.message ?? '')) throw new DbError('exists')
      throw new DbError('failed', e?.message)
    }
    const id = created.data.user.id
    const ins = await svc
      .from('profiles')
      .insert({
        id,
        email,
        full_name: input.fullName,
        role: 'client',
        category: input.category,
        active: true,
        guardian_consent: input.guardianConsent,
        attempts_allowed: 1,
      })
      .select(PROFILE_COLS)
      .single()
    if (ins.error || !ins.data) {
      // Annule la création du compte pour ne laisser aucun identifiant sans profil.
      await svc.auth.admin.deleteUser(id)
      if (ins.error?.code === '23505') throw new DbError('exists')
      throw new DbError('failed', ins.error?.message)
    }
    return toProfile(ins.data)
  },

  async setPassword(id, password) {
    const { error } = await getServiceClient().auth.admin.updateUserById(id, { password })
    if (error) throw new DbError('failed', error.message)
  },

  async updateClient(id, patch: ClientPatch) {
    const svc = getServiceClient()
    const row: Record<string, unknown> = {}
    if (patch.category !== undefined) row.category = patch.category
    if (patch.active !== undefined) row.active = patch.active
    if (patch.attemptsAllowed !== undefined) row.attempts_allowed = patch.attemptsAllowed
    if (patch.guardianConsent !== undefined) row.guardian_consent = patch.guardianConsent
    const { data, error } = await svc.from('profiles').update(row).eq('id', id).select(PROFILE_COLS).single()
    if (error || !data) fail(error ?? { message: 'introuvable' }, 'notfound')
    if (patch.active !== undefined) {
      // Un compte désactivé ne peut plus ouvrir de session ni renouveler la sienne.
      const ban = await svc.auth.admin.updateUserById(id, { ban_duration: patch.active ? 'none' : '876000h' })
      if (ban.error) throw new DbError('failed', ban.error.message)
    }
    return toProfile(data)
  },

  async deleteClient(id) {
    const svc = getServiceClient()
    const p = await svc.from('profiles').select('role').eq('id', id).maybeSingle()
    if (p.error) fail(p.error)
    if (!p.data) throw new DbError('notfound')
    if (p.data.role !== 'client') throw new DbError('refused')
    // La suppression du compte d'authentification supprime en cascade profil, brouillon, résultats et notes.
    const { error } = await svc.auth.admin.deleteUser(id)
    if (error) throw new DbError('failed', error.message)
  },

  async setConsent(userId) {
    // Écriture avec les droits du client lui-même : seule la colonne consent_at est autorisée par la base.
    const user = getUserClient()
    const { error } = await user.from('profiles').update({ consent_at: new Date().toISOString() }).eq('id', userId).is('consent_at', null)
    if (error) fail(error)
  },

  async getDraft(userId) {
    const { data, error } = await getUserClient().from('test_drafts').select('answers,updated_at').eq('user_id', userId).maybeSingle()
    if (error) fail(error)
    return data ? { answers: (data.answers ?? {}) as DraftAnswers, updatedAt: data.updated_at as string } : null
  },

  async saveDraft(userId, answers) {
    const { error } = await getUserClient()
      .from('test_drafts')
      .upsert({ user_id: userId, answers, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) fail(error)
  },

  async clearDraft(userId) {
    const { error } = await getServiceClient().from('test_drafts').delete().eq('user_id', userId)
    if (error) fail(error)
  },

  async countResults(userId) {
    const { count, error } = await getServiceClient().from('test_results').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if (error) fail(error)
    return count ?? 0
  },

  async listResults(userId) {
    const { data, error } = await getServiceClient().from('test_results').select(SELECT_RESULT).eq('user_id', userId).order('attempt')
    if (error) fail(error)
    return ((data ?? []) as any[]).map(toResult)
  },

  async getResult(id) {
    const { data, error } = await getServiceClient().from('test_results').select(SELECT_RESULT).eq('id', id).maybeSingle()
    if (error) fail(error)
    return data ? toResult(data) : null
  },

  async listAllResults() {
    const { data, error } = await getServiceClient().from('test_results').select(SELECT_RESULT).order('created_at')
    if (error) fail(error)
    return ((data ?? []) as any[]).map(toResult)
  },

  async insertResult(input: NewResultInput) {
    const { data, error } = await getServiceClient()
      .from('test_results')
      .insert({ user_id: input.userId, attempt: input.attempt, category: input.category, answers: input.answers, result: input.result })
      .select(SELECT_RESULT)
      .single()
    if (error || !data) fail(error ?? { message: 'insertion impossible' })
    return toResult(data)
  },

  async getNote(userId) {
    const { data, error } = await getServiceClient().from('admin_notes').select('note,updated_at').eq('user_id', userId).maybeSingle()
    if (error) fail(error)
    return data ? { note: data.note as string, updatedAt: data.updated_at as string } : null
  },

  async saveNote(userId, note) {
    const { error } = await getServiceClient().from('admin_notes').upsert({ user_id: userId, note, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) fail(error)
  },
}
