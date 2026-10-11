'use client'

import { useState } from 'react'

export function LogoutButton() {
  const [busy, setBusy] = useState(false)
  async function out() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    } catch {
      /* la redirection ci-dessous suffit */
    }
    window.location.assign('/')
  }
  return (
    <button type="button" className="hdr-out" onClick={() => void out()} disabled={busy}>
      Déconnexion
    </button>
  )
}
