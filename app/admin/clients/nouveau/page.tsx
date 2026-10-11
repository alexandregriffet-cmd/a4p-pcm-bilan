import Link from 'next/link'
import { NewClientForm } from '@/components/admin/NewClientForm'
import { CATEGORIES } from '@/lib/format'
import { requireAdminPage } from '@/lib/server/guards'

export const dynamic = 'force-dynamic'

export default async function NewClientPage() {
  await requireAdminPage()
  return (
    <div className="wrap-narrow section" style={{ paddingTop: 10 }}>
      <div style={{ marginBottom: 6 }}>
        <Link prefetch={false} href="/admin" className="back-link">
          &larr; Tableau de bord
        </Link>
      </div>
      <span className="kicker">Nouveau client</span>
      <h1>Créer un client</h1>
      <p className="muted">Le client se connecte avec son e-mail et le mot de passe que vous lui transmettez. Il n&apos;a accès qu&apos;à son propre test.</p>
      <NewClientForm categories={CATEGORIES} />
    </div>
  )
}
