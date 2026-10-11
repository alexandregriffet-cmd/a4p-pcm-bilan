import 'server-only'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { ClientSummary, DraftAnswers, Profile, StoredResult } from '@/lib/types'
import { DbError, type ClientPatch, type Db, type NewClientInput, type NewResultInput } from './db'
import { isMinorCategory } from '@/lib/minor'

/**
 * Stockage du mode de test local (NEXT_PUBLIC_LOCAL_TEST=1) : un fichier JSON sur le serveur de test.
 * Il reproduit les règles de la base (unicité, nombre de passages, catégorie figée) pour que les essais
 * passent par les mêmes routes que la production. Jamais utilisé en ligne.
 */

interface LocalUser {
  id: string
  email: string
  salt: string
  hash: string
  banned: boolean
}
interface LocalData {
  users: LocalUser[]
  profiles: Profile[]
  drafts: Record<string, { answers: DraftAnswers; updatedAt: string }>
  results: (StoredResult & { answers: Record<string, number[]> })[]
  notes: Record<string, { note: string; updatedAt: string }>
}

export const LOCAL_ADMIN_EMAIL = process.env.LOCAL_ADMIN_EMAIL || 'admin@a4p.test'
export const LOCAL_ADMIN_PASSWORD = process.env.LOCAL_ADMIN_PASSWORD || 'AdminEssai-2026'

function dir(): string {
  return process.env.LOCAL_DATA_DIR || path.join(process.cwd(), '.local-data')
}
function file(): string {
  return path.join(dir(), 'store.json')
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString('hex')
}

function seed(): LocalData {
  const salt = randomBytes(16).toString('hex')
  const id = randomUUID()
  return {
    users: [{ id, email: LOCAL_ADMIN_EMAIL.toLowerCase(), salt, hash: hashPassword(LOCAL_ADMIN_PASSWORD, salt), banned: false }],
    profiles: [
      {
        id,
        email: LOCAL_ADMIN_EMAIL.toLowerCase(),
        fullName: 'Administrateur',
        role: 'admin',
        category: null,
        active: true,
        guardianConsent: false,
        consentAt: null,
        attemptsAllowed: 1,
        createdAt: new Date().toISOString(),
      },
    ],
    drafts: {},
    results: [],
    notes: {},
  }
}

function load(): LocalData {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf8')) as LocalData
  } catch {
    const d = seed()
    save(d)
    return d
  }
}

function save(d: LocalData) {
  fs.mkdirSync(dir(), { recursive: true })
  const tmp = file() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(d))
  fs.renameSync(tmp, file())
}

function strip(r: StoredResult & { answers?: unknown }): StoredResult {
  return { id: r.id, userId: r.userId, attempt: r.attempt, category: r.category, createdAt: r.createdAt, result: r.result }
}

function draftCount(a: DraftAnswers | undefined): number {
  return a ? Object.values(a).filter((v) => Array.isArray(v) && v.length > 0).length : 0
}

/** Vérifie un mot de passe (mode local). Renvoie l'identifiant ou un motif d'échec. */
export function localCheckPassword(email: string, password: string): { ok: true; id: string } | { ok: false; reason: 'invalid' | 'banned' } {
  const d = load()
  const u = d.users.find((x) => x.email === email.trim().toLowerCase())
  const salt = u?.salt ?? '00'
  const given = Buffer.from(hashPassword(password, salt), 'hex')
  const real = Buffer.from(u?.hash ?? '00'.repeat(32), 'hex')
  const same = given.length === real.length && timingSafeEqual(given, real)
  if (!u || !same) return { ok: false, reason: 'invalid' }
  if (u.banned) return { ok: false, reason: 'banned' }
  return { ok: true, id: u.id }
}

export const localDb: Db = {
  async getProfile(id) {
    return load().profiles.find((p) => p.id === id) ?? null
  },

  async listClients() {
    const d = load()
    return d.profiles
      .filter((p) => p.role === 'client')
      .map<ClientSummary>((p) => {
        const mine = d.results.filter((r) => r.userId === p.id)
        const last = mine.map((r) => r.createdAt).sort().pop() ?? null
        return { ...p, resultsCount: mine.length, lastResultAt: last, draftAnswered: draftCount(d.drafts[p.id]?.answers) }
      })
  },

  async createClient(input: NewClientInput) {
    const d = load()
    const email = input.email.toLowerCase()
    if (d.users.some((u) => u.email === email)) throw new DbError('exists')
    const id = randomUUID()
    const salt = randomBytes(16).toString('hex')
    d.users.push({ id, email, salt, hash: hashPassword(input.password, salt), banned: false })
    const profile: Profile = {
      id,
      email,
      fullName: input.fullName,
      role: 'client',
      category: input.category,
      active: true,
      guardianConsent: input.guardianConsent,
      consentAt: null,
      attemptsAllowed: 1,
      createdAt: new Date().toISOString(),
    }
    d.profiles.push(profile)
    save(d)
    return profile
  },

  async setPassword(id, password) {
    const d = load()
    const u = d.users.find((x) => x.id === id)
    if (!u) throw new DbError('notfound')
    u.salt = randomBytes(16).toString('hex')
    u.hash = hashPassword(password, u.salt)
    save(d)
  },

  async updateClient(id, patch: ClientPatch) {
    const d = load()
    const p = d.profiles.find((x) => x.id === id)
    const u = d.users.find((x) => x.id === id)
    if (!p || !u) throw new DbError('notfound')
    const count = d.results.filter((r) => r.userId === id).length
    if (patch.category !== undefined && patch.category !== p.category) {
      // Même règle que le déclencheur SQL : plus de changement une fois le test terminé.
      if (count >= p.attemptsAllowed) throw new DbError('refused', 'Le test est terminé.')
      p.category = patch.category
      delete d.drafts[id]
    }
    if (patch.active !== undefined) {
      p.active = patch.active
      u.banned = !patch.active
    }
    if (patch.attemptsAllowed !== undefined) p.attemptsAllowed = patch.attemptsAllowed
    if (patch.guardianConsent !== undefined) p.guardianConsent = patch.guardianConsent
    save(d)
    return p
  },

  async deleteClient(id) {
    const d = load()
    const p = d.profiles.find((x) => x.id === id)
    if (!p) throw new DbError('notfound')
    if (p.role !== 'client') throw new DbError('refused')
    d.users = d.users.filter((x) => x.id !== id)
    d.profiles = d.profiles.filter((x) => x.id !== id)
    d.results = d.results.filter((r) => r.userId !== id)
    delete d.drafts[id]
    delete d.notes[id]
    save(d)
  },

  async setConsent(userId) {
    const d = load()
    const p = d.profiles.find((x) => x.id === userId)
    if (!p) throw new DbError('notfound')
    if (!p.consentAt) p.consentAt = new Date().toISOString()
    save(d)
  },

  async getDraft(userId) {
    return load().drafts[userId] ?? null
  },

  async saveDraft(userId, answers) {
    const d = load()
    d.drafts[userId] = { answers, updatedAt: new Date().toISOString() }
    save(d)
  },

  async clearDraft(userId) {
    const d = load()
    delete d.drafts[userId]
    save(d)
  },

  async countResults(userId) {
    return load().results.filter((r) => r.userId === userId).length
  },

  async listResults(userId) {
    return load()
      .results.filter((r) => r.userId === userId)
      .sort((a, b) => a.attempt - b.attempt)
      .map(strip)
  },

  async getResult(id) {
    const r = load().results.find((x) => x.id === id)
    return r ? strip(r) : null
  },

  async listAllResults() {
    return load()
      .results.slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(strip)
  },

  async insertResult(input: NewResultInput) {
    const d = load()
    const p = d.profiles.find((x) => x.id === input.userId)
    const mine = d.results.filter((r) => r.userId === input.userId)
    if (mine.some((r) => r.attempt === input.attempt)) throw new DbError('conflict')
    // Mêmes garde-fous que le déclencheur SQL enforce_result_rules.
    if (!p || p.role !== 'client' || !p.active || !p.consentAt) throw new DbError('refused')
    if (p.category !== input.category) throw new DbError('refused')
    if (input.attempt > p.attemptsAllowed || input.attempt !== mine.length + 1) throw new DbError('refused')
    if (isMinorCategory(p.category) && !p.guardianConsent) throw new DbError('refused')
    const row = {
      id: randomUUID(),
      userId: input.userId,
      attempt: input.attempt,
      category: input.category,
      createdAt: new Date().toISOString(),
      result: input.result,
      answers: input.answers,
    }
    d.results.push(row)
    save(d)
    return strip(row)
  },

  async getNote(userId) {
    return load().notes[userId] ?? null
  },

  async saveNote(userId, note) {
    const d = load()
    d.notes[userId] = { note, updatedAt: new Date().toISOString() }
    save(d)
  },
}
