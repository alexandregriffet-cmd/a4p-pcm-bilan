import 'server-only'
import { getDb } from '@/lib/server/db'
import { clearFailures, clientIp, cleanEmail, json, noteFailure, readJson, sameOrigin, tooMany } from '@/lib/server/http'
import { getMode } from '@/lib/server/mode'
import { login, logout, startLocalSession } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

const WINDOW = 15 * 60 * 1000

export async function POST(req: Request) {
  if (getMode().mode === 'unconfigured') return json({ error: 'indisponible' }, 503)
  if (!sameOrigin(req)) return json({ error: 'origine' }, 403)
  const body = await readJson(req, 4096)
  const email = cleanEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || password.length < 1 || password.length > 200) return json({ error: 'invalid' }, 401)

  const key = `${clientIp(req)}|${email}`
  if (tooMany(key, 8, WINDOW) || tooMany(`ip|${clientIp(req)}`, 40, WINDOW)) return json({ error: 'trop-de-tentatives' }, 429)

  const out = await login(email, password)
  if (!out.ok) {
    noteFailure(key, WINDOW)
    noteFailure(`ip|${clientIp(req)}`, WINDOW)
    return out.reason === 'inactive' ? json({ error: 'inactive' }, 403) : json({ error: 'invalid' }, 401)
  }

  const db = await getDb()
  const profile = await db.getProfile(out.userId)
  if (!profile) {
    await logout()
    noteFailure(key, WINDOW)
    return json({ error: 'invalid' }, 401)
  }
  if (!profile.active) {
    await logout()
    return json({ error: 'inactive' }, 403)
  }
  if (getMode().mode === 'local') await startLocalSession(profile.id, profile.role)
  clearFailures(key)
  return json({ ok: true, role: profile.role })
}
