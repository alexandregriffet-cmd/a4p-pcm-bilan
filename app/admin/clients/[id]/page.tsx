import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClientActions } from '@/components/admin/ClientActions'
import { NoteEditor } from '@/components/admin/NoteEditor'
import { CATEGORIES, categoryLabel, formatDate, formatDateTime } from '@/lib/format'
import { getDb } from '@/lib/server/db'
import { isUuid, requireAdminPage } from '@/lib/server/guards'
import { STATUS_LABEL, statusOf } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ClientPage({ params }: { params: { id: string } }) {
  await requireAdminPage()
  if (!isUuid(params.id)) notFound()
  const db = await getDb()
  const p = await db.getProfile(params.id)
  if (!p || p.role !== 'client') notFound()
  const [results, draft, note] = await Promise.all([db.listResults(p.id), db.getDraft(p.id).catch(() => null), db.getNote(p.id)])
  const draftAnswered = draft ? Object.values(draft.answers).filter((v) => Array.isArray(v) && v.length > 0).length : 0
  const status = statusOf({ resultsCount: results.length, attemptsAllowed: p.attemptsAllowed, draftAnswered })
  const finished = results.length >= p.attemptsAllowed
  const latest = results.length ? results[results.length - 1] : null

  return (
    <div className="wrap section" style={{ paddingTop: 10 }}>
      <div style={{ marginBottom: 6 }}>
        <Link prefetch={false} href="/admin" className="back-link">
          &larr; Tableau de bord
        </Link>
      </div>
      <header className="page-head" style={{ paddingTop: 6 }}>
        <span className="kicker">Fiche client</span>
        <h1>{p.fullName}</h1>
        <p className="sub">{p.email}</p>
      </header>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Informations</h3>
          <dl className="info-list">
            <div><dt>Catégorie</dt><dd>{categoryLabel(p.category)}</dd></div>
            <div><dt>Statut</dt><dd data-testid="client-status">{STATUS_LABEL[status]}{!p.active ? ' (accès désactivé)' : ''}</dd></div>
            <div><dt>Compte créé le</dt><dd>{formatDate(p.createdAt)}</dd></div>
            <div><dt>Consentement</dt><dd>{p.consentAt ? formatDateTime(p.consentAt) : 'Pas encore donné'}</dd></div>
            {p.category === 'ado-etudes' && <div><dt>Accord du représentant légal</dt><dd>{p.guardianConsent ? 'Recueilli' : 'Non confirmé'}</dd></div>}
            <div><dt>Passages autorisés</dt><dd>{p.attemptsAllowed} (utilisés : {results.length})</dd></div>
            {draftAnswered > 0 && !finished && <div><dt>Brouillon</dt><dd>{draftAnswered} situation(s) renseignée(s)</dd></div>}
            {latest && <div><dt>Dernier passage</dt><dd>{formatDate(latest.createdAt)}</dd></div>}
          </dl>
        </div>

        <div className="card">
          <h3>Résultats</h3>
          {results.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Aucun résultat pour le moment.</p>
          ) : (
            <ul className="plain-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
              {[...results].reverse().map((r) => {
                const isLatest = r.attempt === results[results.length - 1].attempt
                return (
                  <li key={r.id} style={{ marginBottom: 10 }}>
                    <Link prefetch={false} href={`/admin/clients/${p.id}/resultat?tentative=${r.attempt}`} className="btn btn-sm btn-primary" data-testid={`open-result-${r.attempt}`}>
                      Ouvrir le résultat
                    </Link>{' '}
                    <span className="small">
                      Tentative {r.attempt}, {formatDate(r.createdAt)}, {categoryLabel(r.category)}
                    </span>{' '}
                    {!isLatest && <span className="badge">Tentative précédente</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h2>Actions</h2>
        </div>
        <ClientActions
          id={p.id}
          email={p.email}
          category={p.category ?? ''}
          categories={CATEGORIES}
          active={p.active}
          guardianConsent={p.guardianConsent}
          finished={finished}
        />
      </section>

      <section className="panel">
        <NoteEditor id={p.id} initial={note?.note ?? ''} />
      </section>
    </div>
  )
}
