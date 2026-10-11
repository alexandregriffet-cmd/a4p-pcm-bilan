import Link from 'next/link'
import { PrintButton } from '@/components/admin/PrintButton'
import { ReportView } from '@/components/admin/ReportView'
import { getDb } from '@/lib/server/db'
import { requireAdminPage } from '@/lib/server/guards'

export const dynamic = 'force-dynamic'

/** Tous les rapports à la suite, un client par page, imprimables en un seul PDF (dernier passage de chaque client). */
export default async function AllReportsPage() {
  await requireAdminPage()
  const db = await getDb()
  const [clients, results] = await Promise.all([db.listClients(), db.listAllResults()])
  const latest = new Map<string, (typeof results)[number]>()
  for (const r of results) {
    const cur = latest.get(r.userId)
    if (!cur || r.attempt > cur.attempt) latest.set(r.userId, r)
  }
  const items = clients
    .filter((c) => latest.has(c.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'))
    .map((c) => ({ c, stored: latest.get(c.id)! }))

  return (
    <div className="wrap-narrow">
      <div className="section no-print" style={{ paddingTop: 10 }}>
        <Link prefetch={false} href="/admin/export" className="back-link">
          &larr; Exports
        </Link>
        <span className="kicker" style={{ marginTop: 8 }}>Exports</span>
        <h1>Rapports complets de tous les clients</h1>
        <p className="muted">
          {items.length === 0
            ? 'Aucun rapport disponible pour le moment.'
            : `${items.length} rapport(s), un par page, dans l'ordre alphabétique. Pour chaque client, le dernier passage est repris.`}
        </p>
        {items.length > 0 && <PrintButton label="Exporter tous les rapports en PDF" />}
      </div>
      {items.map(({ c, stored }, i) => (
        <ReportView key={stored.id} person={{ fullName: c.fullName, email: c.email }} stored={stored} standalone={false} separate={i > 0} />
      ))}
    </div>
  )
}
