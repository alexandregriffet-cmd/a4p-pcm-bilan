import Link from 'next/link'
import { ClientTable, type ClientRow } from '@/components/admin/ClientTable'
import { CATEGORIES, categoryLabel, formatDateShort } from '@/lib/format'
import { getDb } from '@/lib/server/db'
import { requireAdminPage } from '@/lib/server/guards'
import { STATUS_LABEL, statusOf } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  await requireAdminPage()
  const db = await getDb()
  const clients = await db.listClients()
  const rows: ClientRow[] = clients.map((c) => {
    const status = statusOf(c)
    return {
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      category: c.category ?? '',
      categoryLabel: categoryLabel(c.category),
      status,
      statusLabel: STATUS_LABEL[status],
      lastResultAt: c.lastResultAt,
      lastResultLabel: c.lastResultAt ? formatDateShort(c.lastResultAt) : '',
      active: c.active,
      resultsCount: c.resultsCount,
    }
  })
  const count = (s: ClientRow['status']) => rows.filter((r) => r.status === s).length

  return (
    <div className="wrap section" style={{ paddingTop: 10 }}>
      <header className="page-head">
        <span className="kicker">Tableau de bord</span>
        <h1>Bilans de construction mentale</h1>
        <p className="sub">Vos clients, leur avancement et leurs résultats.</p>
      </header>

      <div className="stats" data-testid="stats">
        <div className="stat">
          <span className="lbl">Clients</span>
          <div className="val" data-testid="stat-clients">{rows.length}</div>
        </div>
        <div className="stat">
          <span className="lbl">Pas commencé</span>
          <div className="val" data-testid="stat-pas-commence">{count('pas-commence')}</div>
        </div>
        <div className="stat">
          <span className="lbl">En cours</span>
          <div className="val" data-testid="stat-en-cours">{count('en-cours')}</div>
        </div>
        <div className="stat">
          <span className="lbl">Terminé</span>
          <div className="val" data-testid="stat-termine">{count('termine')}</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h2>Clients</h2>
          <Link prefetch={false} href="/admin/clients/nouveau" className="btn btn-primary btn-sm">
            Créer un client
          </Link>
        </div>
        <ClientTable rows={rows} categories={CATEGORIES} />
      </section>
    </div>
  )
}
