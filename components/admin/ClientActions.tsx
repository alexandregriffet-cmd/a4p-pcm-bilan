'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CredentialsCard } from './CredentialsCard'
import { isMinorCategory } from '@/lib/minor'

interface Props {
  id: string
  email: string
  category: string
  categories: { id: string; label: string }[]
  active: boolean
  guardianConsent: boolean
  /** Le test est terminé : plus de changement de catégorie, nouveau passage possible. */
  finished: boolean
}

const ERRORS: Record<string, string> = {
  'test-termine': 'Le test est terminé : la catégorie ne peut plus être modifiée.',
  'accord-representant-requis': 'Pour cette catégorie, confirmez d\'abord l\'accord du représentant légal.',
  'passage-deja-autorise': 'Un nouveau passage est déjà autorisé.',
  'confirmation-incorrecte': 'L\'adresse e-mail saisie ne correspond pas.',
}

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, data }
}

/** Bouton à double validation, dans la page (pas de boîte de dialogue du navigateur). */
function Confirm({ label, confirmLabel, onConfirm, danger, disabled, testId }: { label: string; confirmLabel: string; onConfirm: () => Promise<void> | void; danger?: boolean; disabled?: boolean; testId?: string }) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!armed) {
    return (
      <button type="button" className={`btn btn-sm ${danger ? 'btn-danger' : ''}`} disabled={disabled} onClick={() => setArmed(true)} data-testid={testId}>
        {label}
      </button>
    )
  }
  return (
    <span className="row" style={{ gap: 8 }}>
      <button
        type="button"
        className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
        disabled={busy}
        data-testid={testId ? `${testId}-confirm` : undefined}
        onClick={async () => {
          setBusy(true)
          try {
            await onConfirm()
          } finally {
            setBusy(false)
            setArmed(false)
          }
        }}
      >
        {busy ? '...' : confirmLabel}
      </button>
      <button type="button" className="btn btn-sm btn-quiet" onClick={() => setArmed(false)} disabled={busy}>
        Annuler
      </button>
    </span>
  )
}

export function ClientActions({ id, email, category, categories, active, guardianConsent, finished }: Props) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null)
  const [newCat, setNewCat] = useState(category)
  const [guardianTick, setGuardianTick] = useState(false)
  const [delEmail, setDelEmail] = useState('')

  const fail = (code: unknown) => setMsg({ kind: 'error', text: ERRORS[String(code)] ?? 'L\'action a échoué. Réessayez.' })

  async function regenerate() {
    setCred(null)
    const r = await call(`/api/admin/clients/${id}/password`, 'POST', {})
    if (!r.ok || typeof r.data.password !== 'string') return fail(r.data.error)
    setCred({ email, password: r.data.password })
    setMsg({ kind: 'ok', text: 'Nouveau mot de passe créé. L\'ancien ne fonctionne plus.' })
  }

  async function changeCategory() {
    const body: Record<string, unknown> = { category: newCat }
    if (isMinorCategory(newCat) && !guardianConsent) body.guardianConsent = guardianTick
    const r = await call(`/api/admin/clients/${id}`, 'PATCH', body)
    if (!r.ok) return fail(r.data.error)
    setMsg({ kind: 'ok', text: 'Catégorie modifiée. Le brouillon éventuel a été effacé.' })
    router.refresh()
  }

  async function toggleActive() {
    const r = await call(`/api/admin/clients/${id}`, 'PATCH', { active: !active })
    if (!r.ok) return fail(r.data.error)
    setMsg({ kind: 'ok', text: active ? 'Accès désactivé.' : 'Accès réactivé.' })
    router.refresh()
  }

  async function allowRetake() {
    const r = await call(`/api/admin/clients/${id}`, 'PATCH', { allowRetake: true })
    if (!r.ok) return fail(r.data.error)
    setMsg({ kind: 'ok', text: 'Nouveau passage autorisé. L\'ancien résultat est conservé.' })
    router.refresh()
  }

  async function confirmGuardian() {
    const r = await call(`/api/admin/clients/${id}`, 'PATCH', { guardianConsent: true })
    if (!r.ok) return fail(r.data.error)
    setMsg({ kind: 'ok', text: 'Accord du représentant légal enregistré.' })
    router.refresh()
  }

  async function remove() {
    const r = await call(`/api/admin/clients/${id}`, 'DELETE', { confirmEmail: delEmail })
    if (!r.ok) return fail(r.data.error)
    window.location.assign('/admin')
  }

  const needsGuardianTick = isMinorCategory(newCat) && !guardianConsent
  const catUnchanged = newCat === category

  return (
    <div className="stack">
      {msg && (
        <div className={`msg ${msg.kind === 'ok' ? 'msg-ok' : 'msg-error'}`} role={msg.kind === 'ok' ? 'status' : 'alert'}>
          {msg.text}
        </div>
      )}
      {cred && <CredentialsCard email={cred.email} password={cred.password} title="Nouveaux identifiants à transmettre" />}

      <div className="card">
        <h3>Mot de passe</h3>
        <p className="muted small">Génère un nouveau mot de passe. L&apos;ancien devient invalide immédiatement. Le nouveau n&apos;est affiché qu&apos;une fois.</p>
        <Confirm label="Régénérer le mot de passe" confirmLabel="Oui, régénérer" onConfirm={regenerate} testId="regen" />
      </div>

      <div className="card">
        <h3>Catégorie du test</h3>
        {finished ? (
          <p className="muted small" style={{ margin: 0 }}>
            Le test est terminé : la catégorie ne peut plus être modifiée. Autorisez un nouveau passage pour pouvoir la changer.
          </p>
        ) : (
          <>
            <p className="muted small">Modifiable tant que le test n&apos;est pas terminé. Un brouillon éventuel est effacé.</p>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
                <label htmlFor="a-cat">Nouvelle catégorie</label>
                <select id="a-cat" value={newCat} onChange={(e) => setNewCat(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <Confirm label="Changer la catégorie" confirmLabel="Oui, changer" onConfirm={changeCategory} disabled={catUnchanged || (needsGuardianTick && !guardianTick)} testId="cat" />
            </div>
            {needsGuardianTick && (
              <label className="check">
                <input type="checkbox" checked={guardianTick} onChange={(e) => setGuardianTick(e.target.checked)} />
                <span>Accord du représentant légal recueilli</span>
              </label>
            )}
          </>
        )}
        {isMinorCategory(category) && !guardianConsent && (
          <div style={{ marginTop: 12 }}>
            <p className="muted small">L&apos;accord du représentant légal n&apos;est pas confirmé : le test n&apos;est pas accessible.</p>
            <Confirm label="Confirmer l'accord du représentant légal" confirmLabel="Oui, accord recueilli" onConfirm={confirmGuardian} testId="guardian" />
          </div>
        )}
      </div>

      <div className="card">
        <h3>Accès</h3>
        <p className="muted small">{active ? 'Le client peut se connecter.' : 'Le client ne peut plus se connecter.'}</p>
        <Confirm label={active ? 'Désactiver l\'accès' : 'Réactiver l\'accès'} confirmLabel={active ? 'Oui, désactiver' : 'Oui, réactiver'} onConfirm={toggleActive} danger={active} testId="active" />
      </div>

      <div className="card">
        <h3>Nouveau passage</h3>
        {finished ? (
          <>
            <p className="muted small">Le client pourra repasser le test une fois de plus. Le résultat actuel est conservé et marqué comme tentative précédente.</p>
            <Confirm label="Autoriser un nouveau passage" confirmLabel="Oui, autoriser" onConfirm={allowRetake} testId="retake" />
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>Disponible une fois le test terminé.</p>
        )}
      </div>

      <div className="card danger-zone">
        <h3>Supprimer le client</h3>
        <p className="muted small">
          Supprime définitivement le compte, le brouillon, tous les résultats et les notes. Cette action est irréversible. Retapez l&apos;adresse e-mail du client pour confirmer.
        </p>
        <div className="field">
          <label htmlFor="del-email">Adresse e-mail du client</label>
          <input id="del-email" type="email" value={delEmail} onChange={(e) => setDelEmail(e.target.value)} placeholder={email} autoComplete="off" />
        </div>
        <button type="button" className="btn btn-sm btn-danger" disabled={delEmail.trim().toLowerCase() !== email.toLowerCase()} onClick={() => void remove()} data-testid="delete">
          Supprimer définitivement
        </button>
      </div>
    </div>
  )
}
