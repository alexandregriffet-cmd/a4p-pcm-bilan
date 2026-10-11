import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'
import { getCaller } from '@/lib/server/guards'
import { getMode } from '@/lib/server/mode'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const info = getMode()
  let notice = false
  if (info.mode !== 'unconfigured') {
    const me = await getCaller().catch(() => null)
    if (me && me.active) redirect(me.role === 'admin' ? '/admin' : '/espace')
    notice = !!me && !me.active
  }
  let hint: { email: string; password: string } | null = null
  if (info.mode === 'local') {
    const { LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD } = await import('@/lib/server/db-local')
    hint = { email: LOCAL_ADMIN_EMAIL, password: LOCAL_ADMIN_PASSWORD }
  }
  if (info.mode === 'unconfigured') return null
  return <LoginForm localHint={hint} sessionNotice={notice} />
}
