import Link from 'next/link'
import { requireAdminPage } from '@/lib/server/guards'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()
  return (
    <>
      <nav className="subnav no-print" aria-label="Navigation administrateur">
        <div className="wrap subnav-in">
          <Link prefetch={false} href="/admin">Tableau de bord</Link>
          <Link prefetch={false} href="/admin/clients/nouveau">Nouveau client</Link>
          <Link prefetch={false} href="/admin/export">Exports</Link>
        </div>
      </nav>
      {children}
    </>
  )
}
