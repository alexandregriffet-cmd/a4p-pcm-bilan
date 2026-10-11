import Link from 'next/link'
import type { PcmType, PcmTypeData } from '@core/types'
import { getAudience } from '@core/audiences'
import { categoryLabel, formatDate, REPORT_TITLE, SIGNATURE } from '@/lib/format'
import type { StoredResult } from '@/lib/types'
import { TYPE_ACCENT } from './accent'
import { PrintButton } from './PrintButton'

type Profile = PcmTypeData & { type: PcmType }

const ADVICE_TITLE: Record<string, string> = {
  'adulte-sport': 'Conseils pour la pratique sportive',
  'ado-etudes': 'Conseils pour les études',
  'adulte-hors-sport': 'Conseils pour la vie professionnelle et personnelle',
  manager: 'Conseils pour le management',
}

const STRESS_LEVELS = ['Premier niveau', 'Deuxième niveau', 'Troisième niveau']

function Reading({ profile, which, category }: { profile: Profile; which: 'base' | 'phase'; category: string }) {
  const accent = TYPE_ACCENT[profile.type]
  const stress = [profile.distress1, profile.distress2, profile.distress3]
  return (
    <div className={`card profile-card reading-pane ${which === 'phase' ? 'page-break' : ''}`} style={{ ['--accent' as string]: accent }}>
      <div className="reading-block">
        <span className="kicker" style={{ marginBottom: 4 }}>
          {which === 'base' ? 'Lecture du profil de base' : 'Lecture du profil de phase'}
        </span>
        <h2 style={{ marginBottom: 10 }}>{profile.label}</h2>
        {which === 'phase' && <p className="lead">{profile.phase_description}</p>}
        <p>{profile.description}</p>

        <h3>Besoins</h3>
        <ul>
          {profile.besoins.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>

        <h3>Comportements sous stress</h3>
        <p className="muted small">Quand la pression monte, les comportements évoluent en trois niveaux successifs.</p>
        <div className="stress">
          {stress.map((t, i) => (
            <div key={i} className="stress-item">
              <span className="stress-n" aria-hidden="true">{i + 1}</span>
              <div>
                <strong>{STRESS_LEVELS[i]}</strong>
                <div>{t}</div>
              </div>
            </div>
          ))}
        </div>

        <h3>Recommandations de coaching</h3>
        <ul>
          {profile.coaching.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <h3>Communication</h3>
        <p>
          <strong>Canal de communication privilégié :</strong> {profile.canal}
        </p>
        <ul>
          {profile.communication.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <h3>{ADVICE_TITLE[category] ?? 'Conseils'}</h3>
        <ul style={{ marginBottom: 0 }}>
          {profile.sport_conseils.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export interface ReportPerson {
  fullName: string
  email: string
}

/**
 * Lecture complète d'un client, côté administrateur uniquement (composant serveur, aucune interaction).
 * `standalone` ajoute les boutons et le lien de retour ; `separate` force un saut de page avant le rapport.
 */
export function ReportView({
  person,
  stored,
  backHref,
  attempts,
  standalone = true,
  separate = false,
}: {
  person: ReportPerson
  stored: StoredResult
  backHref?: string
  attempts?: { attempt: number; href: string; date: string; current: boolean }[]
  standalone?: boolean
  separate?: boolean
}) {
  const r = stored.result
  const tu = getAudience(stored.category).adresse === 'tu'
  const cat = categoryLabel(stored.category)

  return (
    <article className={`report ${separate ? 'report-sep' : ''}`}>
      <div className="print-only print-head">
        <p className="brand-line">Rapport PCM, confidentiel</p>
        <p className="sub-line">
          {person.fullName} | {cat} | Passage du {formatDate(stored.createdAt)}
        </p>
      </div>

      <header className="section report-head" style={{ paddingTop: standalone ? 28 : 8, paddingBottom: 12 }}>
        {standalone && backHref && (
          <div className="no-print" style={{ marginBottom: 10 }}>
            <Link href={backHref} className="back-link" prefetch={false}>
              &larr; Retour à la fiche
            </Link>
          </div>
        )}
        <span className="kicker">{REPORT_TITLE}</span>
        <h1>{person.fullName}</h1>
        <dl className="meta-grid">
          <div>
            <dt>E-mail</dt>
            <dd>{person.email}</dd>
          </div>
          <div>
            <dt>Catégorie</dt>
            <dd>{cat}</dd>
          </div>
          <div>
            <dt>Date de passage</dt>
            <dd>{formatDate(stored.createdAt)}</dd>
          </div>
          <div>
            <dt>Tentative</dt>
            <dd>{stored.attempt}</dd>
          </div>
        </dl>
        {standalone && attempts && attempts.length > 1 && (
          <div className="no-print attempt-picker" role="group" aria-label="Choix de la tentative">
            <span className="lbl">Tentative</span>
            <div className="tabs" style={{ margin: '6px 0 0' }}>
              {attempts.map((a) => (
                <Link prefetch={false} key={a.attempt} href={a.href} className="tab" aria-pressed={a.current} aria-current={a.current ? 'page' : undefined}>
                  Tentative {a.attempt} : {a.date}
                </Link>
              ))}
            </div>
          </div>
        )}
        {standalone && (
          <div className="no-print row" style={{ marginTop: 12 }}>
            <PrintButton />
          </div>
        )}
        {tu && (
          <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
            Les textes de lecture de cette catégorie sont reproduits tels que l&apos;élève les lit, au tutoiement.
          </p>
        )}
        {!r.meta.complete && <div className="msg msg-info">Ce résultat est issu d&apos;un test incomplet.</div>}
      </header>

      <section className="section" style={{ paddingTop: 8 }} aria-label="Synthèse">
        <h2>Synthèse du profil</h2>
        <p className="muted">
          Le profil de base décrit ce qui structure la personne dans la durée. Le profil de phase décrit ce qui est particulièrement actif en ce moment.
        </p>
        <div className="grid grid-2">
          <div className="card profile-card" style={{ ['--accent' as string]: TYPE_ACCENT[r.baseType] }}>
            <span className="kicker" style={{ marginBottom: 2 }}>Profil de base</span>
            <p className="profile-name">{r.baseProfile.label}</p>
            <p className="muted small" style={{ margin: 0 }}>Le plus présent dans les réponses</p>
          </div>
          <div className="card profile-card" style={{ ['--accent' as string]: TYPE_ACCENT[r.phaseType] }}>
            <span className="kicker" style={{ marginBottom: 2 }}>Profil de phase</span>
            <p className="profile-name">{r.phaseProfile.label}</p>
            <p className="muted small" style={{ margin: 0 }}>Le deuxième, actif en ce moment</p>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>Répartition des six profils</h3>
          <p className="muted small">Chaque barre indique la proportion des points possibles obtenue par le profil.</p>
          {r.ranking.map((x) => (
            <div key={x.type} className="dist-row">
              <div className="dist-head">
                <span className="row" style={{ gap: 10 }}>
                  <span className="type-dot" style={{ background: TYPE_ACCENT[x.type] }} aria-hidden="true" />
                  <strong>{x.label}</strong>
                  {x.type === r.baseType && <span className="badge badge-amber">Base</span>}
                  {x.type === r.phaseType && <span className="badge badge-line">Phase</span>}
                </span>
                <strong>{x.percent} %</strong>
              </div>
              <div className="bar" role="img" aria-label={`${x.label} : ${x.percent} pour cent`} style={{ ['--accent' as string]: TYPE_ACCENT[x.type] }}>
                <span style={{ width: `${Math.max(2, Math.min(100, x.percent))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section page-break" aria-label="Lecture complète">
        <h2>Lecture complète</h2>
        <Reading profile={r.baseProfile} which="base" category={stored.category} />
        <div style={{ height: 14 }} />
        <Reading profile={r.phaseProfile} which="phase" category={stored.category} />
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="reminder">
          <h3 style={{ color: 'var(--amber)' }}>Personne ne se résume à un seul profil</h3>
          <p style={{ margin: 0 }}>
            Chacun porte les six profils, à des degrés divers. Le profil de base et le profil de phase ne sont que les deux plus présents aujourd&apos;hui. La
            phase peut évoluer au fil des événements et des périodes de vie, et les autres profils restent des ressources.
          </p>
        </div>
        <p className="muted small" style={{ marginTop: 16 }}>
          Cet outil est un support d&apos;accompagnement, pas un diagnostic. Il invite à la réflexion et à l&apos;échange avec la personne accompagnée.
        </p>
      </section>

      <div className="print-only print-foot">{SIGNATURE}</div>
    </article>
  )
}
