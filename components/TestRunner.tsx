'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clientTexts } from '@/lib/texts'
import type { ClientQuestion, DraftAnswers } from '@/lib/types'
import { LogoutButton } from './LogoutButton'

type Phase = 'run' | 'review' | 'confirm'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const MAX_PICKS = 6
const isFull = (v: number[] | undefined) => !!v && v.length >= 3 && v.length <= MAX_PICKS

/**
 * Passation du bilan : une situation par écran, classement de 3 à 6 choix, brouillon enregistré par le serveur,
 * récapitulatif puis confirmation explicite. Aucune donnée de lecture n'existe dans ce composant :
 * il ne reçoit que les textes des situations et des réponses.
 */
export function TestRunner({ questions, initial, tu }: { questions: ClientQuestion[]; initial: DraftAnswers; tu: boolean }) {
  const router = useRouter()
  const t = clientTexts(tu).test
  const total = questions.length

  const startIdx = (() => {
    const first = questions.findIndex((q) => !isFull(initial[q.id]))
    return first === -1 ? total - 1 : first
  })()
  const answeredAtStart = questions.filter((q) => isFull(initial[q.id])).length

  const [picks, setPicks] = useState<DraftAnswers>(initial)
  const [idx, setIdx] = useState(startIdx)
  const [phase, setPhase] = useState<Phase>(answeredAtStart === total ? 'review' : 'run')
  const [save, setSave] = useState<SaveState>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [resumed] = useState(Object.keys(initial).length > 0)

  const picksRef = useRef(picks)
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const flush = useCallback(async (keepalive = false) => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    try {
      const res = await fetch('/api/test/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: picksRef.current }),
        keepalive,
      })
      if (!res.ok) throw new Error('save')
      setSave('saved')
    } catch {
      dirty.current = true
      setSave('error')
    }
  }, [])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush(true)
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [flush])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [idx, phase])

  const q = questions[idx]
  const current = q ? (picks[q.id] ?? []) : []
  const complete = current.length >= 3
  const answered = useMemo(() => questions.filter((x) => isFull(picks[x.id])).length, [questions, picks])
  const ratio = total ? answered / total : 0
  const missing = useMemo(() => questions.map((x, i) => ({ n: i + 1, ok: isFull(picks[x.id]) })).filter((x) => !x.ok), [questions, picks])
  const allDone = answered === total

  const update = useCallback(
    (qid: string, next: number[]) => {
      const merged = { ...picksRef.current }
      if (next.length === 0) delete merged[qid]
      else merged[qid] = next
      picksRef.current = merged
      setPicks(merged)
      dirty.current = true
      setSave('saving')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), 500)
    },
    [flush],
  )

  const toggle = useCallback(
    (opt: number) => {
      if (!q) return
      const cur = picksRef.current[q.id] ?? []
      if (cur.includes(opt)) update(q.id, cur.filter((x) => x !== opt))
      else if (cur.length < MAX_PICKS) update(q.id, [...cur, opt])
    },
    [q, update],
  )

  const goNext = useCallback(() => {
    if (idx >= total - 1) {
      void flush()
      setPhase('review')
    } else setIdx(idx + 1)
  }, [idx, total, flush])

  const goBack = useCallback(() => {
    if (idx > 0) setIdx(idx - 1)
  }, [idx])

  useEffect(() => {
    if (phase !== 'run') return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (e.key >= '1' && e.key <= '6') toggle(Number(e.key) - 1)
      else if (e.key === 'ArrowRight' && complete) goNext()
      else if (e.key === 'ArrowLeft') goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, toggle, complete, goNext, goBack])

  async function submit() {
    if (!allDone || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await flush()
      const answers: Record<string, number[]> = {}
      for (const x of questions) answers[x.id] = picksRef.current[x.id]
      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (res.ok || res.status === 409) {
        // Le serveur affiche la page de remerciement (ou la même page si le test était déjà enregistré).
        router.refresh()
        return
      }
      throw new Error('submit')
    } catch {
      setError(t.errorSubmit)
      setSubmitting(false)
      setPhase('review')
    }
  }

  const percent = Math.round(ratio * 100)
  const firstMissing = () => {
    const i = questions.findIndex((x) => !isFull(picks[x.id]))
    return i === -1 ? total - 1 : i
  }

  if (phase === 'confirm') {
    return (
      <div className="wrap-narrow section" style={{ paddingTop: 32 }}>
        <div className="card card-hero confirm-card" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-text">
          <span className="kicker">{t.kicker}</span>
          <h1 id="confirm-title">{t.confirmTitle}</h1>
          <p id="confirm-text" className="lead">
            {t.confirmText}
          </p>
          {error && (
            <div className="msg msg-error" role="alert">
              {error}
            </div>
          )}
          <div className="stack">
            <button type="button" className="btn btn-primary btn-block" disabled={submitting} onClick={() => void submit()}>
              {submitting ? t.validating : t.confirmYes}
            </button>
            <button type="button" className="btn btn-quiet btn-block" disabled={submitting} onClick={() => setPhase('review')}>
              {t.confirmNo}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'review') {
    return (
      <div className="wrap-narrow section" style={{ paddingTop: 12 }}>
        <span className="kicker" style={{ marginTop: 8 }}>{t.kicker}</span>
        <h1>{t.reviewTitle}</h1>
        <div className="run-prog" style={{ marginBottom: 12 }}>
          <span className="lbl">{t.progress}</span>
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${ratio * 100}%` }} />
          </div>
          <span className="small muted">{percent} %</span>
        </div>
        <p className={missing.length ? 'msg msg-error' : 'msg msg-ok'} role="status" style={{ marginTop: 0 }}>
          {missing.length ? t.reviewMissing(missing.length) : t.reviewComplete}
        </p>
        <p className="muted small">{t.goTo}</p>
        <div className="grid-nums" style={{ marginBottom: 22 }}>
          {questions.map((x, i) => {
            const ok = isFull(picks[x.id])
            return (
              <button
                key={x.id}
                type="button"
                className={`num ${ok ? 'ok' : 'ko'}`}
                aria-label={ok ? `Situation ${i + 1}` : t.missingAria(i + 1)}
                onClick={() => {
                  setIdx(i)
                  setPhase('run')
                }}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        {error && (
          <div className="msg msg-error" role="alert">
            {error}
          </div>
        )}
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block" disabled={!allDone} onClick={() => setPhase('confirm')}>
            {t.validate}
          </button>
          {!allDone && <p className="muted small">{t.validateBlocked}</p>}
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setIdx(firstMissing())
              setPhase('run')
            }}
          >
            {t.back}
          </button>
          <div className="row between">
            <span className="small muted">{save === 'saved' ? t.saved : save === 'saving' ? t.saving : save === 'error' ? t.saveError : ''}</span>
            <LogoutButton />
          </div>
        </div>
      </div>
    )
  }

  const step = current.length >= MAX_PICKS ? 4 : Math.min(current.length, 3)

  return (
    <div className="runner">
      <div className="run-top">
        <div className="wrap-narrow">
          <div className="run-top-row">
            <span className="run-name">{t.kicker}</span>
            <button type="button" className="link-btn" onClick={() => { void flush(); setPhase('review') }}>
              {t.overview}
            </button>
          </div>
          <div className="run-top-row">
            <span className="small muted">{t.intro}</span>
            <span className="run-count" aria-label={`Situation ${idx + 1} sur ${total}`}>{t.situationOf(idx + 1, total)}</span>
          </div>
          <div className="run-prog">
            <span className="lbl">{t.progress}</span>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} aria-label={t.progress}>
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
            <span className="small muted">{percent} %</span>
          </div>
          <div className="savestate" role="status" aria-live="polite">
            {save === 'saving' ? t.saving : save === 'saved' ? t.saved : save === 'error' ? t.saveError : ''}
          </div>
        </div>
      </div>

      <div className="wrap-narrow">
        {resumed && answeredAtStart > 0 && idx === startIdx && answered === answeredAtStart && (
          <div className="msg msg-info" style={{ marginTop: 16 }}>
            {t.resumeNotice}
          </div>
        )}

        <h2 className="situation" data-testid="situation">{q.situation}</h2>
        <p className="instruction" aria-live="polite">
          {t.instruction[step]}
        </p>
        <div className="ranksteps" aria-hidden="true">
          {t.rankLabels.map((l, i) => (
            <div key={l} className={`rankstep ${i < current.length ? 'done' : i === current.length ? 'now' : ''} ${i >= 3 ? 'optional' : ''}`}>
              {l}
            </div>
          ))}
        </div>

        <div className="opts" role="group" aria-label="Réponses possibles">
          {q.options.map((text, i) => {
            const rank = current.indexOf(i)
            const selected = rank !== -1
            const dim = false
            return (
              <button
                key={i}
                type="button"
                className={`opt ${selected ? 'sel' : ''} ${dim ? 'dim' : ''}`}
                aria-pressed={selected}
                aria-label={selected ? `${text} : ${t.rankLabels[rank]} choix` : text}
                data-opt={i}
                onClick={() => toggle(i)}
              >
                <span className="rk" aria-hidden="true">
                  {selected ? t.rankLabels[rank] : ''}
                </span>
                <span>{text}</span>
              </button>
            )
          })}
        </div>

        <div className="skip-row">
          <button type="button" className="link-btn" onClick={() => update(q.id, [])} disabled={current.length === 0} style={{ opacity: current.length ? 1 : 0.4 }}>
            {t.reset}
          </button>
          {!complete && (
            <button type="button" className="link-btn" onClick={goNext}>
              {t.skip}
            </button>
          )}
        </div>
        <p className="muted small" style={{ marginTop: 14 }}>{t.hint}</p>
      </div>

      <div className="runbar">
        <div className="runbar-inner">
          <button type="button" className="btn btn-quiet btn-back" onClick={goBack} disabled={idx === 0}>
            {t.back}
          </button>
          <button type="button" className="btn btn-primary btn-next" onClick={goNext} disabled={!complete}>
            {idx === total - 1 ? t.finish : t.next}
          </button>
        </div>
      </div>
    </div>
  )
}
