import type { AudienceId } from './audiences'
import type { TestId } from './tests'

export type { AudienceId, TestId }

/* ------------------------------------------------------------------ */
/* Communs                                                             */
/* ------------------------------------------------------------------ */

export interface Progress {
  /** Nombre de questions valablement répondues. */
  answered: number
  total: number
  /** Entre 0 et 1. */
  ratio: number
  complete: boolean
}

export interface ResultMeta {
  answered: number
  total: number
  complete: boolean
}

export interface Band {
  min: number
  label: string
}

/* ------------------------------------------------------------------ */
/* Données communes (data/common.json)                                 */
/* ------------------------------------------------------------------ */

export interface CommonData {
  PMP_PROFILES: Record<string, string[]>
  MBTI_TO_MOTOR: Record<string, string>
  MOTOR_FAMILIES: Record<string, string>
  ponderations: {
    pmp: {
      globalIndex: Record<string, number>
      globalDivisor: number
      pressureIndex: Record<string, number>
    }
    pcm: { premier: number; deuxieme: number; troisieme: number }
    cmp: { echelleMax: number }
    psycho: { echelleSituation: number; echelleLikert: number }
  }
  seuils: {
    pmp: {
      dimensionOrder: string[]
      dimensionBands: Band[]
      globalBands: Band[]
      seuilTexteForce: number
      coherence: {
        base: string[]
        min: number
        max: number
        bonus: { familles: string[]; dimension: string; seuil: number; points: number }[]
      }
      stylesApprentissage: { label: string; dimensions: string[] }[]
      axesBinaires: Record<'ei' | 'sn' | 'tf' | 'jp', [string, string]>
      stabilite: string[]
      nbPointsForts: number
      nbPointsVigilance: number
    }
    mpa: {
      axes: Record<MpaAxe, { premier: string; second: string }>
      seuilPole: number
      mbtiVersPoles: Record<string, string>
      indiceClarte: { min: number; label: string; desc: { tu: string; vous: string } }[]
    }
    cmp: { niveaux: { min: number; code: string }[] }
    psycho: {
      typesOrder: PsychoTypeKey[]
      regulationInversees: string[]
      neurochimie: Record<
        'dopamine' | 'serotonine' | 'noradrenaline' | 'gaba' | 'acetylcholine',
        { items: { id: string; inverse?: boolean }[]; diviseur: number }
      >
      itca: { seuilEleve: number; seuilPresent: number; defaut: number }
      regulationDefaut: number
    }
    pcm: { typesOrder: PcmType[] }
  }
}

/* ------------------------------------------------------------------ */
/* PMP                                                                 */
/* ------------------------------------------------------------------ */

export type PmpDimensionKey =
  | 'activation'
  | 'attention'
  | 'regulation'
  | 'engagement'
  | 'confiance'
  | 'resilience'
  | 'cognition'
  | 'motricite'

export interface PmpLikertQuestion {
  id: string
  type: 'likert'
  dimension: PmpDimensionKey
  label?: string
  text: string
  reverse: boolean
}

export interface PmpBinaryQuestion {
  id: string
  type: 'binary'
  axis: 'ei' | 'sn' | 'tf' | 'jp'
  text: string
  optionA: string
  optionB: string
}

export type PmpQuestion = PmpLikertQuestion | PmpBinaryQuestion

export interface PmpDimensionData {
  label: string
  description: string
  low: string
  high: string
}

export interface PmpData {
  questions: PmpQuestion[]
  dimensions: Record<PmpDimensionKey, PmpDimensionData>
}

/** Likert : 1 à 5. Binaire : 'A' ou 'B'. */
export type PmpAnswers = Record<string, number | 'A' | 'B'>

export interface PmpOptions {
  /** Surcharge du drapeau reverse par id de question (true = inversée, false = non inversée). */
  reverseOverrides?: Record<string, boolean>
}

export interface PmpDimensionResult {
  key: PmpDimensionKey
  label: string
  description: string
  score: number
  /** Libellé du barème des dimensions (force mentale, zone solide, ...). */
  band: string
  /** Texte d'interprétation : texte « élevé » à partir de 60, texte « bas » en dessous. */
  interpretation: string
}

export interface PmpResult {
  test: 'pmp'
  meta: ResultMeta
  /** Scores 0 à 100 par dimension. */
  scores: Record<PmpDimensionKey, number>
  /** Détail par dimension, dans l'ordre du questionnaire. */
  dimensions: PmpDimensionResult[]
  globalIndex: number
  globalBand: string
  pressureIndex: number
  stabilityIndex: number
  coherenceIndex: number
  learningStyle: string
  /** Profils de synthèse triés, le premier est le profil retenu. */
  profiles: { name: string; value: number; dimensions: PmpDimensionKey[] }[]
  mainProfile: { name: string; value: number; dimensions: PmpDimensionKey[] }
  /** Code à quatre lettres issu des seize choix binaires (voir README). */
  binaryCode: string
  binaryAxes: Record<'ei' | 'sn' | 'tf' | 'jp', number>
  /** Code moteur (D1 à C4) et famille (ST, SF, NF, NT). Le profil moteur détaillé est celui du MPA. */
  motor: string
  motorFamily: string
  strengths: PmpDimensionResult[]
  vigilances: PmpDimensionResult[]
}

/* ------------------------------------------------------------------ */
/* MPA                                                                 */
/* ------------------------------------------------------------------ */

export type MpaAxe = 'SR' | 'CI' | 'LH' | 'StF'

export interface MpaQuestion {
  id: string
  axe: MpaAxe
  pole: string
  text: string
}

export interface MpaAxeData {
  s: string
  r: string
  title: string
  color: string
}

export interface MpaProfilData {
  code: string
  nom: string
  famille: string
  marche: string
  neuroarbitres: string
  milieu: string
  description: string
  motricite: string
  apprentissage: string
  pression: string
  coaching: string
  besoins: string
  risques: string
  sport: string[]
}

export interface MpaData {
  questions: MpaQuestion[]
  axes: Record<MpaAxe, MpaAxeData>
  profils: Record<string, MpaProfilData>
  opp: Record<MpaAxe, Record<string, string>>
}

export type MpaAnswers = Record<string, 'A' | 'B'>

export interface MpaOptions {
  adresse?: 'tu' | 'vous'
}

export interface MpaAxeResult {
  axe: MpaAxe
  title: string
  color: string
  premierPole: string
  premierPoleLabel: string
  secondPole: string
  secondPoleLabel: string
  /** Pourcentage de réponses vers le premier pôle, 0 à 100 (50 si aucune réponse). */
  score: number
  /** Pôle dominant (à 50 ou plus, le premier pôle). */
  pole: string
  poleLabel: string
  /** Écart à 50. */
  intensite: number
}

export interface MpaProfilResult extends Omit<MpaProfilData, 'famille' | 'marche'> {
  /** Texte de la donnée, sans tiret cadratin ni emoji. */
  famille: string
  marche: string
}

export interface MpaResult {
  test: 'mpa'
  meta: ResultMeta
  axes: MpaAxeResult[]
  scores: Record<MpaAxe, number>
  /** Pôles dominants dans l'ordre SR, CI, LH, StF, par exemple ['S','C','L','St']. */
  code4: string[]
  code4Label: string
  /** Code moteur D1 à C4 (correspondance à valider, voir README). */
  motorCode: string
  motorFamily: string
  marche: 'terrienne' | 'aerienne'
  profile: MpaProfilResult
  /** Indice de clarté préférentielle, 50 à 100. */
  globalScore: number
  globalLabel: string
  globalDescription: string
}

/* ------------------------------------------------------------------ */
/* CMP                                                                 */
/* ------------------------------------------------------------------ */

export interface CmpOption {
  text: string
  scores: { pression: number; maturite: number; blocage: number; ressource: number }
}

export interface CmpQuestion {
  id: string
  situation: string
  options: CmpOption[]
}

export interface CmpProfilData {
  code: string
  label: string
  subtitle: string
  description: string
  forces: string[]
  vigilances: string[]
  leviers: string[]
  color: string
  bg: string
  minScore: number
}

export interface CmpData {
  questions: CmpQuestion[]
  profils: CmpProfilData[]
}

/** Index de l'option choisie, de 0 à 4. */
export type CmpAnswers = Record<string, number>

export interface CmpResult {
  test: 'cmp'
  meta: ResultMeta
  scorePression: number
  scoreMaturite: number
  scoreBlocage: number
  scoreRessource: number
  globalScore: number
  level: CmpProfilData
}

/* ------------------------------------------------------------------ */
/* Psycho-émotionnel                                                   */
/* ------------------------------------------------------------------ */

export type PsychoTypeKey = 'combatif' | 'expressif' | 'analytique' | 'absorbant'

export interface PsychoOption {
  text: string
  scores: Record<string, number>
}

export type PsychoQuestion =
  | { id: string; type: 'likert'; dimension: 'regulation' | 'neurochimie' | 'itca'; text: string }
  | { id: string; type: 'situational'; dimension: 'reactions'; text: string; situation: string; options: PsychoOption[] }
  | { id: string; type: 'multiple'; dimension: 'coping'; text: string; options: PsychoOption[] }

export interface PsychoProfilData {
  code: string
  label: string
  subtitle: string
  emoji: string
  description: string
  neurochimie: { nt: string; statut: 'dominant' | 'carence'; description: string; regulation: string[] }[]
  declencheurs: string[]
  coping_naturel: string[]
  coping_manquant: string[]
  impact_performance: string
  recommandations: string[]
  color: string
  bg: string
}

export interface PsychoItcaData {
  code: string
  label: string
  description: string
  traits: string[]
  sport_impact: string
  orientation: string
  alert: boolean
  color: string
}

export interface PsychoData {
  questions: PsychoQuestion[]
  profils: Record<PsychoTypeKey, PsychoProfilData>
  itca: PsychoItcaData[]
}

/** Likert : nombre de 1 à 5. Situations et choix : index d'option. */
export type PsychoAnswers = Record<string, number>

export interface PsychoResult {
  test: 'psycho'
  meta: ResultMeta
  dominantType: PsychoTypeKey
  /** Pourcentages 0 à 100 des quatre types émotionnels. */
  types: Record<PsychoTypeKey, number>
  profile: PsychoProfilData
  regulation: number
  neurochemistry: Record<'dopamine' | 'serotonine' | 'noradrenaline' | 'gaba' | 'acetylcholine', number>
  itca: { average: number; level: PsychoItcaData }
  globalScore: number
}

/* ------------------------------------------------------------------ */
/* PCM                                                                 */
/* ------------------------------------------------------------------ */

export type PcmType = 'architecte' | 'connecteur' | 'guerrier' | 'visionnaire' | 'creatif' | 'competiteur'

export interface PcmOption {
  text: string
  type: PcmType
}

export interface PcmQuestion {
  id: string
  situation: string
  options: PcmOption[]
}

/** Textes d'un profil du Bilan de Construction Mentale. */
export interface PcmTypeData {
  label: string
  emoji: string
  color: string
  bg: string
  besoins: string[]
  distress1: string
  distress2: string
  distress3: string
  description: string
  phase_description: string
  coaching: string[]
  communication: string[]
  sport_conseils: string[]
}

export interface PcmData {
  questions: PcmQuestion[]
  types: Record<PcmType, PcmTypeData>
}

/** [premier choix, deuxième choix, troisième choix], index d'option de 0 à 5. */
export type PcmAnswers = Record<string, [number, number, number]>

export interface PcmRankedType {
  type: PcmType
  label: string
  points: number
  percent: number
}

export interface PcmResult {
  test: 'pcm'
  meta: ResultMeta
  /** Points par profil, total attendu : 12 par situation. */
  scores: Record<PcmType, number>
  percents: Record<PcmType, number>
  maxPoints: number
  totalPoints: number
  ranking: PcmRankedType[]
  baseType: PcmType
  phaseType: PcmType
  baseProfile: PcmTypeData & { type: PcmType }
  phaseProfile: PcmTypeData & { type: PcmType }
}

/* ------------------------------------------------------------------ */
/* Associations test -> types                                          */
/* ------------------------------------------------------------------ */

export interface DataByTest {
  pmp: PmpData
  mpa: MpaData
  cmp: CmpData
  psycho: PsychoData
  pcm: PcmData
}

export interface AnswersByTest {
  pmp: PmpAnswers
  mpa: MpaAnswers
  cmp: CmpAnswers
  psycho: PsychoAnswers
  pcm: PcmAnswers
}

export interface ResultByTest {
  pmp: PmpResult
  mpa: MpaResult
  cmp: CmpResult
  psycho: PsychoResult
  pcm: PcmResult
}
