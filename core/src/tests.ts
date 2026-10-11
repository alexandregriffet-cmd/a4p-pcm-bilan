export type TestId = 'pmp' | 'mpa' | 'cmp' | 'psycho' | 'pcm'

/** bipm : plateforme BIPM (pmp, mpa, cmp, psycho). pcm : plateforme à part. */
export type TestGroup = 'bipm' | 'pcm'

export type ResponseFormat =
  | 'likert-1-5-et-binaire'
  | 'binaire'
  | 'choix-unique-5-options'
  | 'mixte-likert-et-choix'
  | 'classement-3-sur-6'

export interface TestMeta {
  id: TestId
  nom: string
  nomLong: string
  groupe: TestGroup
  nbQuestions: number
  formatDeReponse: ResponseFormat
  /** Libellé lisible du format de réponse. */
  formatLibelle: string
  /** Durée estimée de passation, en minutes (fourchette). */
  dureeEstimee: { minMinutes: number; maxMinutes: number; libelle: string }
  /** Description courte, au vouvoiement neutre. */
  description: string
}

export const TESTS: readonly TestMeta[] = [
  {
    id: 'pmp',
    nom: 'PMP',
    nomLong: 'PMP Profil Mental de Performance',
    groupe: 'bipm',
    nbQuestions: 136,
    formatDeReponse: 'likert-1-5-et-binaire',
    formatLibelle: '120 affirmations notées de 1 à 5 et 16 choix entre deux propositions',
    dureeEstimee: { minMinutes: 20, maxMinutes: 30, libelle: '20 à 30 minutes' },
    description: 'Le PMP explore huit dimensions du fonctionnement mental et dégage un profil moteur à partir de seize choix binaires. Il donne une vue d\'ensemble des ressources et des points de vigilance.',
  },
  {
    id: 'mpa',
    nom: 'MPA',
    nomLong: 'MPA Mode Préférentiel d\'Action',
    groupe: 'bipm',
    nbQuestions: 100,
    formatDeReponse: 'binaire',
    formatLibelle: '100 choix entre deux affirmations',
    dureeEstimee: { minMinutes: 10, maxMinutes: 15, libelle: '10 à 15 minutes' },
    description: 'Le MPA identifie votre mode préférentiel d\'action selon quatre axes (énergie, perception, décision, organisation) et le relie à l\'un des seize profils moteurs.',
  },
  {
    id: 'cmp',
    nom: 'CMP',
    nomLong: 'CMP Compétences Mentales de Performance',
    groupe: 'bipm',
    nbQuestions: 30,
    formatDeReponse: 'choix-unique-5-options',
    formatLibelle: '30 situations, une réponse à choisir parmi cinq',
    dureeEstimee: { minMinutes: 10, maxMinutes: 15, libelle: '10 à 15 minutes' },
    description: 'Le CMP mesure vos compétences mentales à travers trente situations concrètes : tenue sous pression, maturité mentale, ressources disponibles et niveau de blocage.',
  },
  {
    id: 'psycho',
    nom: 'Psycho-émotionnel',
    nomLong: 'Psycho-émotionnel',
    groupe: 'bipm',
    nbQuestions: 50,
    formatDeReponse: 'mixte-likert-et-choix',
    formatLibelle: '50 questions : échelles de 1 à 5 et situations à cinq réponses',
    dureeEstimee: { minMinutes: 12, maxMinutes: 18, libelle: '12 à 18 minutes' },
    description: 'Le test psycho-émotionnel décrit votre type émotionnel dominant, votre régulation, un profil neurochimique indicatif et un inventaire de traits cognitifs.',
  },
  {
    id: 'pcm',
    nom: 'PCM',
    nomLong: 'PCM Personnalité et Communication',
    groupe: 'pcm',
    nbQuestions: 72,
    formatDeReponse: 'classement-3-sur-6',
    formatLibelle: '72 situations, trois réponses à classer parmi six',
    dureeEstimee: { minMinutes: 20, maxMinutes: 30, libelle: '20 à 30 minutes' },
    description: 'Le PCM dégage six profils de personnalité et de communication. Il distingue le profil de base, stable dans la durée, du profil de phase, qui reflète la période actuelle.',
  },
] as const

/** Tests de la plateforme BIPM. */
export const BIPM_TESTS: readonly TestId[] = ['pmp', 'mpa', 'cmp', 'psycho']

/** Le PCM est une plateforme à part, hors groupe BIPM. */
export const PCM_TEST: TestId = 'pcm'

export const TEST_IDS: readonly TestId[] = TESTS.map((t) => t.id)

export function getTestMeta(id: TestId): TestMeta {
  const found = TESTS.find((t) => t.id === id)
  if (!found) throw new Error(`Test inconnu : ${id}`)
  return found
}
