import Link from 'next/link'
import { PrintButton } from '@/components/admin/PrintButton'
import { categoryLabel, formatDate, formatDateShort, SIGNATURE } from '@/lib/format'
import { getDb } from '@/lib/server/db'
import { requireAdminPage } from '@/lib/server/guards'
import { buildSummary, profileLabels, TYPE_ORDER } from '@/lib/server/summary'

export const dynamic = 'force-dynamic'

export default async function ExportPage() {
  await requireAdminPage()
  const db = await getDb()
  const [clients, results] = await Promise.all([db.listClients(), db.listAllResults()])
  const rows = buildSummary(clients, results)
  const labels = profileLabels()
  const today = formatDate(new Date().toISOString())

  return (
    <div className="wrap section sheet-landscape" style={{ paddingTop: 10 }}>
      <div className="print-only print-head">
        <p className="brand-line">Synthèse PCM, confidentiel</p>
        <p className="sub-line">Édité le {today} | {rows.length} client(s)</p>
      </div>

      <header className="page-head no-print">
        <span className="kicker">Exports</span>
        <h1>Synthèse de tous les clients</h1>
        <p className="sub">Tableau imprimable, export CSV et rapports complets.</p>
      </header>

      <div className="row no-print" style={{ margin: '14px 0' }}>
        <PrintButton label="Exporter la synthèse en PDF" />
        <a href="/api/admin/export/csv" className="btn btn-quiet" download data-testid="csv-link">
          Exporter la synthèse en CSV
        </a>
        <Link prefetch={false} href="/admin/export/rapports" className="btn btn-quiet">
          Rapports complets de tous les clients
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty">Aucun client pour le moment.</div>
      ) : (
        <div className="table-wrap">
          <table className="sheet" data-testid="summary-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>E-mail</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th>Date de passage</th>
                <th>Profil de base</th>
                <th>Profil de phase</th>
                {TYPE_ORDER.map((t) => (
                  <th key={t} className="num-col">{labels[t]} %</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const res = r.latest?.result
                return (
                  <tr key={r.client.id}>
                    <td>{r.client.fullName}</td>
                    <td>{r.client.email}</td>
                    <td>{categoryLabel(r.client.category)}</td>
                    <td>{r.statusLabel}</td>
                    <td>{r.latest ? formatDateShort(r.latest.createdAt) : ''}</td>
                    <td>{res ? res.baseProfile.label : ''}</td>
                    <td>{res ? res.phaseProfile.label : ''}</td>
                    {TYPE_ORDER.map((t) => (
                      <td key={t} className="num-col">{res ? res.percents[t] : ''}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="print-only print-foot">{SIGNATURE}</div>
    </div>
  )
}
