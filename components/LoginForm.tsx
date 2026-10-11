'use client'

import { useState } from 'react'
import { Logo } from './Logo'

export function LoginForm({ localHint, sessionNotice }: { localHint?: { email: string; password: string } | null; sessionNotice?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(sessionNotice ? 'Cet accès n\'est pas disponible pour le moment. Contactez A4P Mental.' : '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; role?: string; error?: string }
      if (res.ok && data.ok) {
        window.location.assign(data.role === 'admin' ? '/admin' : '/espace')
        return
      }
      if (data.error === 'inactive') setError('Cet accès n\'est pas disponible pour le moment. Contactez A4P Mental.')
      else if (res.status === 429) setError('Trop de tentatives. Patientez quelques minutes avant de réessayer.')
      else if (res.status === 503) setError('Le service n\'est pas disponible pour le moment.')
      else setError('Adresse e-mail ou mot de passe incorrect.')
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau puis réessayez.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <Logo large href={null} />
        </div>
        <p className="login-aud">Construction mentale</p>
        <hr className="rule" />
        <h1>Connexion à votre espace</h1>
        <form onSubmit={submit} noValidate={false}>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="votre@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && (
            <div className="msg msg-error" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Patientez...' : 'Se connecter →'}
          </button>
        </form>
        <p className="login-links muted small">Mot de passe perdu ? Contactez A4P Mental</p>
        {localHint && (
          <div className="local-box">
            <strong>Mode de test local</strong>
            <div className="small">Administrateur : {localHint.email}</div>
            <div className="small">Mot de passe : {localHint.password}</div>
          </div>
        )}
        <p className="login-foot">A4P Mental &middot; Construction mentale</p>
      </div>
    </div>
  )
}
