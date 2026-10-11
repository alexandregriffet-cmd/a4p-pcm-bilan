'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export interface ClientRow {
  id: string
  fullName: string
  email: string
  category: string
  categoryLabel: string
  status: 'pas-commence' | 'en-cours' | 'termine'
  statusLabel: string
  lastResultAt: string | null
  lastResultLabel: string
  active: boolean
  resultsCount: number
}

const STATUS_CLASS: Record<ClientRow['status'], string> = {
  'pas-commence': 'badge',
  'en-cours': 'badge badge-line',
  termine: 'badge badge-ok',
}

export function ClientTable({ rows, categories }: { rows: ClientRow[]; categories: { id: string; label: string }[] }) {
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [desc, setDesc] = useState(true)

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = rows.filter(
      (r) =>
        (!cat || r.category === cat) &&
        (!status || r.status === status) &&
        (!needle || r.fullName.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle)),
    )
    list.sort((a, b) => {
      // Les clients sans date de passage restent en fin de liste, quel que soit le sens du tri.
      if (!a.lastResultAt && !b.lastResultAt) return a.fullName.localeCompare(b.fullName, 'fr')
      if (!a.lastResultAt) return 1
      if (!b.lastResultAt) return -1
      return desc ? b.lastResultAt.localeCompare(a.lastResultAt) : a.lastResultAt.localeCompare(b.lastResultAt)
    })
    return list
  }, [rows, cat, status, q, desc])

  return (
    <div>
      <div className="filters">
        <div className="field">
          <label htmlFor="f-q">Recherche</label>
          <input id="f-q" type="search" placeholder="Nom ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-cat">Catégorie</label>
          <select id="f-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-status">Statut</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            <option value="pas-commence">Pas commencé</option>
            <option value="en-cours">En cours</option>
            <option value="termine">Terminé</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-sort">Tri</label>
          <button id="f-sort" type="button" className="btn btn-quiet btn-block" onClick={() => setDesc(!desc)}>
            Date de passage {desc ? '(récent d\'abord)' : '(ancien d\'abord)'}
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">{rows.length === 0 ? 'Aucun client pour le moment. Créez le premier client.' : 'Aucun client ne correspond à ces filtres.'}</div>
      ) : (
        <ul className="client-list" aria-label="Liste des clients">
          {shown.map((r) => (
            <li key={r.id}>
              <Link prefetch={false} href={`/admin/clients/${r.id}`} className="lrow cols-clients" data-client-email={r.email}>
                <span>
                  <span className="t">{r.fullName}</span>
                  <span className="meta block">{r.email}</span>
                </span>
                <span className="meta">{r.categoryLabel}</span>
                <span className="row" style={{ gap: 6 }}>
                  <span className={STATUS_CLASS[r.status]}>{r.statusLabel}</span>
                  {!r.active && <span className="badge badge-off">Accès désactivé</span>}
                </span>
                <span className="meta">{r.lastResultLabel || 'Pas de passage'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
