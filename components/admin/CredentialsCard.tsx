'use client'

import { useState } from 'react'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [done, setDone] = useState<'ok' | 'ko' | null>(null)
  return (
    <div className="cred-row">
      <div className="cred-main">
        <span className="lbl">{label}</span>
        <code className="cred-val" data-testid={secret ? 'cred-password' : undefined}>{value}</code>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-quiet"
        onClick={async () => {
          setDone((await copyText(value)) ? 'ok' : 'ko')
          window.setTimeout(() => setDone(null), 2000)
        }}
      >
        {done === 'ok' ? 'Copié' : done === 'ko' ? 'Copie impossible' : 'Copier'}
      </button>
    </div>
  )
}

/** Identifiants à transmettre : le mot de passe n'est affiché qu'une fois, il n'est jamais relisible ensuite. */
export function CredentialsCard({ email, password, title = 'Identifiants à transmettre' }: { email: string; password: string; title?: string }) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '')
  const [all, setAll] = useState<'ok' | 'ko' | null>(null)
  const message = `Adresse du site : ${site}\nIdentifiant : ${email}\nMot de passe : ${password}`
  return (
    <section className="card card-hero cred-card" aria-labelledby="cred-title" data-testid="credentials">
      <span className="kicker">Affichage unique</span>
      <h2 id="cred-title">{title}</h2>
      <p className="muted small">
        Ce mot de passe n&apos;est affiché qu&apos;une seule fois. Il n&apos;est enregistré nulle part en clair : notez-le ou copiez-le maintenant. En cas de perte, régénérez-en un depuis la fiche du client.
      </p>
      <CopyRow label="Adresse du site" value={site} />
      <CopyRow label="Identifiant (e-mail)" value={email} />
      <CopyRow label="Mot de passe" value={password} secret />
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={async () => {
            setAll((await copyText(message)) ? 'ok' : 'ko')
            window.setTimeout(() => setAll(null), 2000)
          }}
        >
          {all === 'ok' ? 'Copié' : all === 'ko' ? 'Copie impossible' : 'Copier les trois lignes'}
        </button>
      </div>
    </section>
  )
}
