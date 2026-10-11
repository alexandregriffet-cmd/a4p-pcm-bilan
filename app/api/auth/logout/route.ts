import 'server-only'
import { json, sameOrigin } from '@/lib/server/http'
import { logout } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'origine' }, 403)
  await logout()
  return json({ ok: true })
}
