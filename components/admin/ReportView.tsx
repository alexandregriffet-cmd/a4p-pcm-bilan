import Link from 'next/link'
import type { PcmResult, PcmType, PcmTypeData } from '@core/types'
import { getAudience } from '@core/audiences'
import { getDetail } from '@core/data'
import { clarityPcm } from '@core/index'
import { categoryLabel, formatDate, REPORT_TITLE, SIGNATURE } from '@/lib/format'
import type { StoredResult } from '@/lib/types'
import { TYPE_ACCENT } from './accent'
import { PrintButton } from './PrintButton'

type Profile = PcmTypeData & { type: PcmType }

const ADVICE_TITLE: Record<string, string> = {
  'adulte-sport': 'Conseils pour la pratique sportive',
  'ado-etudes': 'Conseils pour les études',
  'ado-sport': 'Conseils pour la pratique sportive',
  'adulte-hors-sport': 'Conseils pour la vie professionnelle et personnelle',
  manager: 'Conseils pour le management',
}

const CLARITY_TEXT = {
  net: (g: number) => `Profil net : le profil fondamental se détache nettement du deuxième (écart de ${g} points).`,
  nuance: (g: number) => `Profil nuancé : le profil fondamental devance le deuxième de ${g} points. Les deux ont un rôle à explorer.`,
  mixte: (g: number) => `Profil mixte : les deux premiers profils sont proches (écart de ${g} points). Ils guident la personne à parts presque égales.`,
  egalite: () => 'Égalité : les deux premiers profils ont exactement le même total. Le départage est à discuter en entretien.',
} as const

const QUALITY_TEXT = {
  bonne: 'Réponses cohérentes : aucune habitude de réponse anormale détectée.',
  'a-verifier': 'À vérifier en entretien : certaines habitudes de réponse reviennent souvent (position, classement répété ou nombre de choix toujours identique).',
  faible: 'Réponses peu cohérentes : la passation a peut-être été rapide ou peu attentive. Interpréter le résultat avec prudence.',
} as const

const STRESS_LEVELS = ['Signaux de tension', 'Tension en montée', 'Saturation']

const LEAD_TITLE: Record<string, string> = {
  'adulte-sport': 'Quand la personne encadre ou est encadrée',
  'ado-etudes': 'En groupe, en classe et en équipe',
  'ado-sport': 'En groupe et en équipe',
  'adulte-hors-sport': 'Quand la personne encadre ou est encadrée',
  manager: 'Style de management',
}

/** Lecture détaillée du moteur du moment (ce qui valorise la personne en ce moment) et de la ressource. */
function MomentSection({ r }: { r: PcmResult }) {
  const m = r.moment!
  const d = getDetail(r.phaseType)
  const base = getDetail(r.baseType)
  const accent = TYPE_ACCENT[r.phaseType]
  const second = m.ranking[m.ranking.findIndex((x) => x.type === r.phaseType) + 1]
  const resource = r.resourceType && r.resourceType !== r.phaseType ? r.resourceType : undefined
  return (
    <section className="section page-break" aria-label="Moteur du moment en détail">
      <h2>Le moteur du moment en détail</h2>
      <div className="card profile-card" style={{ ['--accent' as string]: accent }}>
        <span className="kicker" style={{ marginBottom: 4 }}>Moteur du moment</span>
        <h2 style={{ marginBottom: 10 }}>{r.phaseProfile.label}</h2>
        <p className="lead">{d.moment.attente}</p>
        <p>
          Avec {r.baseProfile.label} en profil fondamental, la personne communique {base.moment.facon}. En ce moment, elle cherche surtout {d.moment.court}.
          {m.inBase
            ? ` Son premier moteur du moment est son propre profil fondamental : elle est dans sa zone naturelle. Ce qui ressort ensuite est ${r.phaseProfile.label}.`
            : ''}
          {m.gap12 < 10 && second ? ` Une seconde attente est proche : ${second.label}, à explorer en entretien.` : ''}
        </p>

        <div className="duo">
          <div>
            <p className="duo-t">Quand elle est nourrie</p>
            <List items={d.moment.nourri} />
          </div>
          <div>
            <p className="duo-t">Quand elle ne l&apos;est pas</p>
            <List items={d.moment.manque} />
          </div>
        </div>
        <p className="muted small">{d.moment.vigilance}</p>

        <div className="duo">
          <div>
            <p className="duo-t">Se nourrir au quotidien</p>
            <List items={d.moment.se_nourrir} />
          </div>
          <div>
            <p className="duo-t">Ce que l&apos;entourage peut faire</p>
            <List items={d.moment.entourage} />
          </div>
        </div>

        <div className="duo">
          <div>
            <p className="duo-t">Questions pour l&apos;entretien</p>
            <List items={d.moment.questions} />
          </div>
          <div>
            <p className="duo-t">Plan sur quatorze jours</p>
            <List items={d.moment.plan14} />
          </div>
        </div>
      </div>

      {resource && (
        <div className="card" style={{ marginTop: 14, ['--accent' as string]: TYPE_ACCENT[resource] }}>
          <span className="kicker" style={{ marginBottom: 4 }}>Ressource</span>
          <h3 style={{ marginTop: 0 }}>{r.ranking.find((x) => x.type === resource)?.label}</h3>
          <p style={{ marginBottom: 0 }}>{getDetail(resource).moment.ressource}</p>
        </div>
      )}
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  )
}

function Reading({ profile, which, category }: { profile: Profile; which: 'base' | 'phase'; category: string }) {
  const accent = TYPE_ACCENT[profile.type]
  const d = getDetail(profile.type)
  const full = which === 'base'
  const four: [string, string][] = [
    ['Percevoir le monde', d.perception],
    ['Recevoir l\u2019information', d.recoit],
    ['La traiter', d.traite],
    ['La restituer', d.restitue],
  ]
  const stress = [profile.distress1, profile.distress2, profile.distress3]
  return (
    <div className={`card profile-card reading-pane ${which === 'phase' ? 'page-break' : ''}`} style={{ ['--accent' as string]: accent }}>
      <div className="reading-block">
        <span className="kicker" style={{ marginBottom: 4 }}>
          {which === 'base' ? 'Lecture du profil fondamental' : 'Lecture du profil du moment'}
        </span>
        <h2 style={{ marginBottom: 10 }}>{profile.label}</h2>
        {which === 'phase' && <p className="lead">{profile.phase_description}</p>}
        <p>{profile.description}</p>

        <h3>Fonctionnement en quatre temps</h3>
        <div className="stress">
          {four.map(([t, x]) => (
            <div key={t} className="stress-item">
              <div>
                <strong>{t}</strong>
                <div>{x}</div>
              </div>
            </div>
          ))}
        </div>

        <h3>Style de communication</h3>
        <p>{d.style_com}</p>
        <div className="duo">
          <div>
            <p className="duo-t">Atouts</p>
            <List items={d.com_atouts} />
          </div>
          <div>
            <p className="duo-t">Points de vigilance</p>
            <List items={d.com_vigilance} />
          </div>
        </div>

        {full && (
          <>
            <h3>{LEAD_TITLE[category] ?? 'Encadrer et être encadré'}</h3>
            <ul>
              <li>
                <strong>Quand la personne encadre.</strong> {d.encadre}
              </li>
              <li>
                <strong>Quand la personne est encadrée.</strong> {d.encadree}
              </li>
              <li>
                <strong>Point de progression.</strong> {d.angle}
              </li>
            </ul>
          </>
        )}

        <h3>Moteurs</h3>
        <ul>
          {profile.besoins.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>

        <h3>Se ressourcer au quotidien</h3>
        <List items={d.recharge} />

        <h3>Comment lui parler</h3>
        <div className="duo">
          <div>
            <p className="duo-t">À privilégier</p>
            <List items={d.oui} />
          </div>
          <div>
            <p className="duo-t">À éviter</p>
            <List items={d.non} />
          </div>
        </div>

        <h3>Sous pression</h3>
        <p className="muted small">Quand la pression augmente, les réactions évoluent en trois temps.</p>
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

const ORDER = ['architecte', 'connecteur', 'guerrier', 'visionnaire', 'creatif', 'competiteur']

const TYPE_LINES: Record<string, string> = {
  architecte: 'Rigueur, organisation et exigence de qualité.',
  connecteur: 'Relations, chaleur humaine et sens du collectif.',
  guerrier: 'Valeurs, convictions et engagement.',
  visionnaire: 'Réflexion, imagination et recul intérieur.',
  creatif: 'Spontanéité, jeu et énergie créative.',
  competiteur: 'Action, défi et goût de la réussite.',
}

/** Page de couverture (export PDF uniquement). */
function Cover({ person, stored, cat }: { person: ReportPerson; stored: StoredResult; cat: string }) {
  const order = ORDER as PcmType[]
  return (
    <section className="print-only report-cover" aria-label="Couverture">
      <div className="cover-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-a4p.png" alt="A4P Mental, Alexandre Griffet" className="cover-logo" />
      </div>
      <div className="cover-mid">
        <div className="cover-dots" aria-hidden="true">
          {order.map((t) => (
            <span key={t} style={{ background: TYPE_ACCENT[t] }} />
          ))}
        </div>
        <p className="cover-kicker">Fonctionnement, moteurs et communication</p>
        <p className="cover-title">{REPORT_TITLE}</p>
        <div className="cover-rule" />
        <p className="cover-name">{person.fullName}</p>
        <p className="cover-sub">
          {cat} &middot; Passage du {formatDate(stored.createdAt)}
        </p>
      </div>
      <div className="cover-bottom">
        <p className="cover-conf">Document confidentiel</p>
        <p className="cover-sign">{SIGNATURE}</p>
        <p className="cover-tag">Une architecture mentale. Pas une béquille émotionnelle.</p>
      </div>
    </section>
  )
}

/** Page de présentation du bilan (export PDF uniquement). */
function Presentation({ person, stored, cat }: { person: ReportPerson; stored: StoredResult; cat: string }) {
  return (
    <section className="print-only report-intro" aria-label="Présentation du bilan">
      <p className="intro-kicker">Présentation</p>
      <h2 className="intro-title">À propos de ce bilan</h2>
      <div className="intro-rule" />
      <p className="intro-lead">
        Ce bilan décrit la façon dont une personne fonctionne et communique, à partir de ses réponses à 96 situations de la vie courante. Pour chacune,
        elle a classé, parmi six propositions, les réactions qui lui ressemblent (de trois à six).
      </p>

      <div className="intro-id">
        <div>
          <span>Participant</span>
          <strong>{person.fullName}</strong>
        </div>
        <div>
          <span>Catégorie</span>
          <strong>{cat}</strong>
        </div>
        <div>
          <span>Date de passage</span>
          <strong>{formatDate(stored.createdAt)}</strong>
        </div>
      </div>

      <h3 className="intro-h">Les six profils</h3>
      <ul className="intro-types">
        {[...stored.result.ranking]
          .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
          .map((x) => (
          <li key={x.type}>
            <span className="type-dot" style={{ background: TYPE_ACCENT[x.type] }} aria-hidden="true" />
            <strong>{x.label}</strong>
            <span>{TYPE_LINES[x.type]}</span>
          </li>
        ))}
      </ul>

      <h3 className="intro-h">Comment lire ce rapport</h3>
      <ol className="intro-steps">
        <li>
          <strong>Le profil fondamental</strong> est le plus présent dans les réponses : il structure la personne dans la durée.
        </li>
        <li>
          <strong>Le profil du moment</strong> est le deuxième : il décrit ce qui est particulièrement actif en ce moment et peut évoluer.
        </li>
        <li>
          <strong>La lecture complète</strong> détaille les deux profils : fonctionnement, communication, moteurs et signaux de tension.
        </li>
        <li>
          <strong>Les fiches pratiques</strong> comparent les profils et proposent un plan d&apos;action.
        </li>
      </ol>

      <div className="intro-note">
        <p>
          Cet outil est un support d&apos;accompagnement, pas un diagnostic. Il invite à la réflexion et à l&apos;échange. Ce document est confidentiel et
          destiné à la personne concernée.
        </p>
      </div>
    </section>
  )
}

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
      <Cover person={person} stored={stored} cat={cat} />
      <Presentation person={person} stored={stored} cat={cat} />
      {standalone && (
        <p className="no-print muted small" style={{ margin: '8px 0 0' }}>
          L&apos;export PDF ajoute une page de couverture et une page de présentation avant le rapport.
        </p>
      )}
      <div className="print-only print-head">
        <p className="brand-line">Rapport de construction mentale, confidentiel</p>
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
          {r.moment
            ? 'Le profil fondamental décrit ce qui structure la personne dans la durée et sa façon de communiquer. Le moteur du moment décrit ce qui la valorise en ce moment.'
            : 'Le profil fondamental décrit ce qui structure la personne dans la durée. Le profil du moment décrit ce qui est particulièrement actif en ce moment.'}
        </p>
        <div className="grid grid-2">
          <div className="card profile-card" style={{ ['--accent' as string]: TYPE_ACCENT[r.baseType] }}>
            <span className="kicker" style={{ marginBottom: 2 }}>Profil fondamental</span>
            <p className="profile-name">{r.baseProfile.label}</p>
            <p className="muted small" style={{ margin: 0 }}>Le plus présent dans les réponses</p>
          </div>
          <div className="card profile-card" style={{ ['--accent' as string]: TYPE_ACCENT[r.phaseType] }}>
            <span className="kicker" style={{ marginBottom: 2 }}>{r.moment ? 'Moteur du moment' : 'Profil du moment'}</span>
            <p className="profile-name">{r.phaseProfile.label}</p>
            <p className="muted small" style={{ margin: 0 }}>
              {r.moment
                ? r.moment.inBase
                  ? 'Le plus valorisant après le profil fondamental, qui est aussi le premier en ce moment'
                  : 'Ce qui valorise le plus en ce moment'
                : 'Le deuxième, actif en ce moment'}
            </p>
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
                  {x.type === r.baseType && <span className="badge badge-amber">Fondamental</span>}
                  {!r.moment && x.type === r.phaseType && <span className="badge badge-line">Du moment</span>}
                  {r.moment && x.type === r.resourceType && <span className="badge badge-line">Ressource</span>}
                </span>
                <strong>{x.percent} %</strong>
              </div>
              <div className="bar" role="img" aria-label={`${x.label} : ${x.percent} pour cent`} style={{ ['--accent' as string]: TYPE_ACCENT[x.type] }}>
                <span style={{ width: `${Math.max(2, Math.min(100, x.percent))}%` }} />
              </div>
            </div>
          ))}
        </div>

        {r.moment && (
          <div className="card" style={{ marginTop: 14 }}>
            <h3>Ce qui valorise la personne en ce moment</h3>
            <p className="muted small">
              Ce que la personne a choisi comme le plus valorisant dans ses réponses. La ressource désigne le deuxième profil du style : très présent dans la façon d&apos;être, il est
              peut-être déjà comblé aujourd&apos;hui (hypothèse à confirmer en entretien).
            </p>
            {r.moment.ranking.map((x) => (
              <div key={x.type} className="dist-row">
                <div className="dist-head">
                  <span className="row" style={{ gap: 10 }}>
                    <span className="type-dot" style={{ background: TYPE_ACCENT[x.type] }} aria-hidden="true" />
                    <strong>{x.label}</strong>
                    {x.type === r.moment!.topType && <span className="badge badge-amber">Moteur du moment</span>}
                  </span>
                  <strong>{x.percent} %</strong>
                </div>
                <div className="bar" role="img" aria-label={`${x.label} : ${x.percent} pour cent`} style={{ ['--accent' as string]: TYPE_ACCENT[x.type] }}>
                  <span style={{ width: `${Math.max(2, Math.min(100, x.percent))}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section" style={{ paddingTop: 0 }} aria-label="Fiabilité de la lecture">
        <div className="card">
          <h3>Fiabilité de cette lecture</h3>
          {(() => {
            const c = clarityPcm(r)
            return (
              <>
                <p style={{ marginBottom: 6 }}>
                  <strong>Netteté.</strong> {CLARITY_TEXT[c.clarity](c.gap12)}
                  {c.momentToConfirm ? ' Le profil du moment se distingue peu du suivant : à confirmer en entretien.' : ''}
                </p>
                <p style={{ marginBottom: 6 }}>
                  <strong>Cohérence des réponses.</strong>{' '}
                  {r.quality
                    ? `${QUALITY_TEXT[r.quality.level]} (indice ${r.quality.index} sur 100)`
                    : 'Non disponible pour ce passage, enregistré avant la mise en place de l\u2019ordre aléatoire des réponses.'}
                </p>
                {r.moment && (
                  <p style={{ marginBottom: 6 }}>
                    <strong>Moteur du moment.</strong>{' '}
                    {r.moment.gap12 >= 10
                      ? `Lecture nette (${r.moment.gap12} points d\u2019écart entre les deux premiers).`
                      : r.moment.gap12 >= 4
                        ? `Lecture nuancée (${r.moment.gap12} points d\u2019écart) : à confirmer en entretien.`
                        : `Lecture mixte (${r.moment.gap12} points d\u2019écart) : plusieurs attentes proches, à explorer en entretien.`}
                    {r.moment.inBase ? ' La personne est actuellement dans son profil fondamental.' : ''}
                  </p>
                )}
                {r.recognition && (
                  <p style={{ marginBottom: 6 }}>
                    <strong>Reconnaissance.</strong> Part des situations où chaque profil a été retenu :{' '}
                    {r.ranking.map((x) => `${x.label} ${r.recognition![x.type]} %`).join(', ')}. En moyenne {String(r.avgChoices).replace('.', ',')} choix par situation.
                  </p>
                )}
              </>
            )
          })()}
          <p className="muted small" style={{ margin: 0 }}>Repères provisoires, à affiner avec les données de l&apos;étude de validation. Ils éclairent l&apos;entretien et ne le remplacent pas.</p>
        </div>
      </section>

      <section className="section page-break" aria-label="Lecture complète">
        <h2>Lecture complète</h2>
        <Reading profile={r.baseProfile} which="base" category={stored.category} />
        <div style={{ height: 14 }} />
        <Reading profile={r.phaseProfile} which="phase" category={stored.category} />
      </section>

      {r.moment && <MomentSection r={r} />}

      <section className="section page-break" aria-label="Fiche comparée">
        <h2>Fiche comparée : fondamental et moment</h2>
        <p className="muted">
          Cette fiche met côte à côte les deux profils les plus présents. Les écarts indiquent où la personne peut se sentir tiraillée, ou au contraire
          disposer de deux ressources complémentaires.
        </p>
        <table className="compare">
          <thead>
            <tr>
              <th></th>
              <th>{r.baseProfile.label} (fondamental)</th>
              <th>{r.phaseProfile.label} (du moment)</th>
            </tr>
          </thead>
          <tbody>
            {([
              ['Perception', 'perception'],
              ['Réception de l\u2019information', 'recoit'],
              ['Traitement', 'traite'],
              ['Restitution', 'restitue'],
              ['Style de communication', 'style_com'],
            ] as [string, 'perception' | 'recoit' | 'traite' | 'restitue' | 'style_com'][]).map(([lbl, k]) => (
              <tr key={k}>
                <th scope="row">{lbl}</th>
                <td>{getDetail(r.baseType)[k]}</td>
                <td>{getDetail(r.phaseType)[k]}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Se ressourcer</th>
              <td>{getDetail(r.baseType).recharge.join(' ; ')}</td>
              <td>{getDetail(r.phaseType).recharge.join(' ; ')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="section" aria-label="Communiquer avec les autres profils">
        <h2>Communiquer avec les autres profils</h2>
        <p className="muted">
          Repères pour ajuster sa façon de communiquer selon la personne que l&apos;on a en face, à partir du profil fondamental ({r.baseProfile.label}).
        </p>
        <table className="compare">
          <thead>
            <tr>
              <th>Face à un profil</th>
              <th>Pour mieux se comprendre</th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((t) => (
              <tr key={t}>
                <th scope="row">
                  <span className="type-dot" style={{ background: TYPE_ACCENT[t as PcmType] }} aria-hidden="true" /> {r.ranking.find((x) => x.type === t)?.label ?? t}
                </th>
                <td>{getDetail(r.baseType).autres[t as PcmType]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section" aria-label="Plan d'action">
        <h2>Plan d&apos;action sur 30 jours</h2>
        <p className="muted">Trois pistes simples, à essayer une à la fois, puis à discuter lors de l&apos;entretien de restitution.</p>
        <ol className="plan">
          {[...getDetail(r.baseType).plan.slice(0, 2), getDetail(r.phaseType).plan[0]].map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="reminder">
          <h3 style={{ color: 'var(--amber)' }}>Personne ne se résume à un seul profil</h3>
          <p style={{ margin: 0 }}>
            Chacun porte les six profils, à des degrés divers. Le profil fondamental et le profil du moment ne sont que les deux plus présents aujourd&apos;hui. Le
            profil du moment peut évoluer au fil des événements et des périodes de vie, et les autres profils restent des ressources.
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
