import { common } from '../data'
import type {
  MpaAnswers,
  MpaAxe,
  MpaAxeResult,
  MpaData,
  MpaOptions,
  MpaProfilData,
  MpaResult,
  Progress,
} from '../types'
import { cleanText, makeProgress, meta, pickBand } from './utils'

const AXES: MpaAxe[] = ['SR', 'CI', 'LH', 'StF']

/**
 * Tables de correspondance entre le code à quatre pôles et le code moteur.
 *
 * Correspondance à valider (voir README) : chaque lettre de la table
 * MBTI_TO_MOTOR est traduite en pôle du MPA (E=S, I=R, S=C, N=I, T=L, F=H,
 * J=St, P=F). La table est ensuite inversée : pôles -> code moteur.
 */
function buildTables() {
  const letterToPole = common.seuils.mpa.mbtiVersPoles
  const polesToMotor: Record<string, string> = {}
  const motorToPoles: Record<string, string[]> = {}
  for (const [mbti, motor] of Object.entries(common.MBTI_TO_MOTOR)) {
    const poles = mbti.split('').map((l) => letterToPole[l])
    polesToMotor[poles.join('|')] = motor
    motorToPoles[motor] = poles
  }
  return { polesToMotor, motorToPoles }
}

const TABLES = buildTables()

/** Code moteur (D1 à C4) vers pôles dans l'ordre SR, CI, LH, StF. */
export const MPA_MOTOR_TO_POLES: Readonly<Record<string, readonly string[]>> = TABLES.motorToPoles
/** Pôles joints par '|' (par exemple 'S|C|L|St') vers code moteur. */
export const MPA_POLES_TO_MOTOR: Readonly<Record<string, string>> = TABLES.polesToMotor

export function mpaMotorFromPoles(poles: readonly string[]): string {
  const motor = MPA_POLES_TO_MOTOR[poles.join('|')]
  if (!motor) throw new Error(`Code à quatre pôles inconnu : ${poles.join('|')}`)
  return motor
}

function oppositePole(axe: MpaAxe, pole: string): string {
  const { premier, second } = common.seuils.mpa.axes[axe]
  return pole === premier ? second : premier
}

function poleOfAnswer(q: MpaData['questions'][number], v: unknown): string | null {
  if (v === 'A') return q.pole
  if (v === 'B') return oppositePole(q.axe, q.pole)
  return null
}

export function progressMpa(answers: MpaAnswers, data: MpaData): Progress {
  const answered = data.questions.filter((q) => answers[q.id] === 'A' || answers[q.id] === 'B').length
  return makeProgress(answered, data.questions.length)
}

export function isCompleteMpa(answers: MpaAnswers, data: MpaData): boolean {
  return progressMpa(answers, data).complete
}

export function scoreMpa(answers: MpaAnswers, data: MpaData, options: MpaOptions = {}): MpaResult {
  const S = common.seuils.mpa
  const adresse = options.adresse ?? 'vous'

  const counts: Record<MpaAxe, { first: number; total: number }> = {
    SR: { first: 0, total: 0 },
    CI: { first: 0, total: 0 },
    LH: { first: 0, total: 0 },
    StF: { first: 0, total: 0 },
  }
  for (const q of data.questions) {
    const pole = poleOfAnswer(q, answers[q.id])
    if (pole === null) continue
    counts[q.axe].total++
    if (pole === S.axes[q.axe].premier) counts[q.axe].first++
  }

  const scores = {} as Record<MpaAxe, number>
  const axes: MpaAxeResult[] = AXES.map((axe) => {
    const c = counts[axe]
    const score = c.total > 0 ? Math.round((c.first / c.total) * 100) : 50
    scores[axe] = score
    const info = data.axes[axe]
    const { premier, second } = S.axes[axe]
    const pole = score >= S.seuilPole ? premier : second
    return {
      axe,
      title: info.title,
      color: info.color,
      premierPole: premier,
      premierPoleLabel: info.s,
      secondPole: second,
      secondPoleLabel: info.r,
      score,
      pole,
      poleLabel: pole === premier ? info.s : info.r,
      intensite: Math.abs(score - 50),
    }
  })

  const code4 = axes.map((a) => a.pole)
  const motorCode = mpaMotorFromPoles(code4)
  const raw: MpaProfilData | undefined = Object.values(data.profils).find((p) => p.code === motorCode)
  if (!raw) throw new Error(`Aucun profil MPA pour le code moteur ${motorCode}`)

  const globalScore = Math.min(
    100,
    Math.round(50 + axes.reduce((sum, a) => sum + a.intensite, 0) / 4)
  )
  const band = pickBand(S.indiceClarte, globalScore)

  return {
    test: 'mpa',
    meta: meta(progressMpa(answers, data)),
    axes,
    scores,
    code4,
    code4Label: code4.join(''),
    motorCode,
    motorFamily: common.MOTOR_FAMILIES[motorCode[0]],
    marche: motorCode[0] === 'D' || motorCode[0] === 'G' ? 'terrienne' : 'aerienne',
    profile: {
      ...raw,
      sport: [...raw.sport],
      famille: cleanText(raw.famille),
      marche: cleanText(raw.marche),
    },
    globalScore,
    globalLabel: band.label,
    globalDescription: band.desc[adresse],
  }
}
