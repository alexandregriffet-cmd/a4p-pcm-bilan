'use client'

import { useState } from 'react'

export function NoteEditor({ id, initial }: { id: string; initial: string }) {
  const [note, setNote] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  async function save() {
    setState('saving')
    try {
      const res = await fetch(`/api/admin/clients/${id}/note`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) })
      setState(res.ok ? 'saved' : 'error')
    } catch {
      setState('error')
    }
  }
  return (
    <div className="card">
      <h3>Notes privées</h3>
      <p className="muted small">Visibles de vous seul. Jamais accessibles au client.</p>
      <label htmlFor="note" className="lbl-block">Notes</label>
      <textarea id="note" value={note} maxLength={20000} onChange={(e) => { setNote(e.target.value); setState('idle') }} />
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void save()} disabled={state === 'saving'}>
          Enregistrer la note
        </button>
        <span className="small muted" role="status">
          {state === 'saving' ? 'Enregistrement...' : state === 'saved' ? 'Note enregistrée' : state === 'error' ? 'Enregistrement impossible' : ''}
        </span>
      </div>
    </div>
  )
}
