'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CredentialsCard } from './CredentialsCard'

const ERRORS: Record<string, string> = {
  'nom-requis': 'Le prénom et le nom sont obligatoires.',
  'email-invalide': 'L\'adresse e-mail n\'est pas valide.',
  'categorie-invalide': 'Choisissez une catégorie.',
  'accord-representant-requis': 'Pour cette catégorie, l\'accord du représentant légal doit être recueilli.',
  'mot-de-passe-invalide': 'Le mot de passe doit comporter au moins 10 caractères, sans espace au début ni à la fin.',
  'email-existant': 'Un client existe déjà avec cette adresse e-mail.',
}

export function NewClientForm({ categories }: { categories: { id: string; label: string }[] }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [guardian, setGuardian] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ id: string; email: string; password: string; fullName: string } | null>(null)

  async function generate() {
    setGenBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = (await res.json()) as { password?: string }
      if (!res.ok || !data.password) throw new Error('gen')
      setPassword(data.password)
    } catch {
      setError('La génération a échoué. Réessayez.')
    } finally {
      setGenBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, category, guardianConsent: guardian, password: password || undefined }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; password?: string; client?: { id: string; email: string; fullName: string } }
      if (!res.ok || !data.client || !data.password) {
        setError(ERRORS[data.error ?? ''] ?? 'La création a échoué. Réessayez.')
        return
      }
      setCreated({ id: data.client.id, email: data.client.email, password: data.password, fullName: data.client.fullName })
      setPassword('')
    } catch {
      setError('Connexion impossible. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setCreated(null)
    setFirstName('')
    setLastName('')
    setEmail('')
    setCategory('')
    setGuardian(false)
    setPassword('')
    setError('')
  }

  if (created) {
    return (
      <div className="stack">
        <div className="msg msg-ok" role="status">
          Le client {created.fullName} a été créé. Transmettez-lui ses identifiants.
        </div>
        <CredentialsCard email={created.email} password={created.password} />
        <div className="row">
          <Link prefetch={false} href={`/admin/clients/${created.id}`} className="btn btn-primary">
            Ouvrir la fiche du client
          </Link>
          <button type="button" className="btn btn-quiet" onClick={reset}>
            Créer un autre client
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card" autoComplete="off">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="c-first">Prénom</label>
          <input id="c-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="c-last">Nom</label>
          <input id="c-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={80} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-email">Adresse e-mail (identifiant)</label>
        <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} />
      </div>
      <div className="field">
        <label htmlFor="c-cat">Catégorie du test</label>
        <select id="c-cat" value={category} onChange={(e) => setCategory(e.target.value)} required>
          <option value="" disabled>
            Choisir une catégorie
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {category === 'ado-etudes' && (
        <label className="check">
          <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} />
          <span>Accord du représentant légal recueilli (obligatoire pour cette catégorie)</span>
        </label>
      )}
      <div className="field">
        <label htmlFor="c-pass">Mot de passe (10 caractères minimum)</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input id="c-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Générez-le ou saisissez-le" autoComplete="off" spellCheck={false} />
          <button type="button" className="btn btn-quiet" style={{ flex: '0 0 auto' }} onClick={() => void generate()} disabled={genBusy}>
            {genBusy ? '...' : 'Générer un mot de passe'}
          </button>
        </div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Sans saisie, un mot de passe de 12 caractères lisibles est généré à la création.
        </p>
      </div>
      {error && (
        <div className="msg msg-error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy || (category === 'ado-etudes' && !guardian)}>
        {busy ? 'Création...' : 'Créer le client'}
      </button>
    </form>
  )
}
