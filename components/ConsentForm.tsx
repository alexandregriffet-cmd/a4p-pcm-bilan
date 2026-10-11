'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ClientTexts } from '@/lib/texts'
import { LogoutButton } from './LogoutButton'

export function ConsentForm({ t, minor }: { t: ClientTexts['consent']; minor: boolean }) {
  const router = useRouter()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/me/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      })
      if (!res.ok) throw new Error('refus')
      router.refresh()
    } catch {
      setError(t.error)
      setBusy(false)
    }
  }

  return (
    <div className="wrap-narrow section" style={{ paddingTop: 32 }}>
      <span className="kicker">A4P Mental</span>
      <h1>{t.title}</h1>
      <p className="lead">{t.intro}</p>
      <div className="card">
        <h2 style={{ fontSize: '1.05rem' }}>{t.infoTitle}</h2>
        <ul className="plain-list">
          {t.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {minor && (
          <div className="minor-box">
            <strong>{t.minorTitle}</strong>
            <p style={{ margin: '6px 0 8px' }}>{t.minorText}</p>
            <label className="check" style={{ opacity: 0.85 }}>
              <input type="checkbox" checked readOnly disabled aria-readonly="true" />
              <span>{t.guardianLabel}</span>
            </label>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{t.label}</span>
        </label>
        <p className="small" style={{ margin: '4px 0 18px' }}>
          <Link href="/confidentialite" target="_blank" rel="noopener" prefetch={false}>
            {t.link}
          </Link>
        </p>
        {error && (
          <div className="msg msg-error" role="alert">
            {error}
          </div>
        )}
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={!consent || busy} onClick={() => void accept()}>
            {t.cta}
          </button>
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
