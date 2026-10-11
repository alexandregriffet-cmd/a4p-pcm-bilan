import 'server-only'
import { cookies } from 'next/headers'
import { LOCAL_COOKIE, signLocalSession, verifyLocalSession } from '@/lib/local-session'
import { getMode } from './mode'
import { getUserClient } from './supabase'

const LOCAL_TTL_MS = 12 * 60 * 60 * 1000

/** Identifiant de la personne connectée (session vérifiée), ou null. */
export async function currentUserId(): Promise<string | null> {
  const info = getMode()
  if (info.mode === 'local') {
    const p = await verifyLocalSession(cookies().get(LOCAL_COOKIE)?.value)
    return p?.uid ?? null
  }
  if (info.mode === 'supabase') {
    try {
      const { data } = await getUserClient().auth.getUser()
      return data.user?.id ?? null
    } catch {
      return null
    }
  }
  return null
}

export type LoginOutcome = { ok: true; userId: string } | { ok: false; reason: 'invalid' | 'inactive' }

/** Vérifie e-mail et mot de passe. Supabase ouvre la session ici ; le mode local la pose ensuite (startLocalSession). */
export async function login(email: string, password: string): Promise<LoginOutcome> {
  const info = getMode()
  if (info.mode === 'local') {
    const { localCheckPassword } = await import('./db-local')
    const r = localCheckPassword(email, password)
    if (!r.ok) return { ok: false, reason: r.reason === 'banned' ? 'inactive' : 'invalid' }
    return { ok: true, userId: r.id }
  }
  if (info.mode === 'supabase') {
    const { data, error } = await getUserClient().auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      const e = error as { code?: string; message?: string } | null
      if (e?.code === 'user_banned' || /banned/i.test(e?.message ?? '')) return { ok: false, reason: 'inactive' }
      return { ok: false, reason: 'invalid' }
    }
    return { ok: true, userId: data.user.id }
  }
  return { ok: false, reason: 'invalid' }
}

/** Mode local : pose le cookie signé une fois le rôle connu. */
export async function startLocalSession(userId: string, role: 'admin' | 'client'): Promise<void> {
  const token = await signLocalSession({ uid: userId, role, exp: Date.now() + LOCAL_TTL_MS })
  cookies().set(LOCAL_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: LOCAL_TTL_MS / 1000 })
}

export async function logout(): Promise<void> {
  const info = getMode()
  if (info.mode === 'local') {
    cookies().set(LOCAL_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  } else if (info.mode === 'supabase') {
    try {
      await getUserClient().auth.signOut()
    } catch {
      /* ignoré */
    }
  }
}
