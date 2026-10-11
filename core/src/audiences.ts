export type AudienceId = 'adulte-sport' | 'ado-etudes' | 'ado-sport' | 'adulte-hors-sport' | 'manager'
export type Adresse = 'tu' | 'vous'

export interface Audience {
  id: AudienceId
  label: string
  description: string
  adresse: Adresse
}

export const AUDIENCES: readonly Audience[] = [
  {
    id: 'adulte-sport',
    label: 'Adulte sportif',
    description: 'Sportifs adultes, amateurs ou de haut niveau, qui souhaitent mieux comprendre leur fonctionnement mental dans la pratique.',
    adresse: 'vous',
  },
  {
    id: 'ado-etudes',
    label: 'Adolescent et études',
    description: 'Adolescents et étudiants, pour comprendre leur fonctionnement mental face aux études, aux contrôles et aux choix d\'orientation.',
    adresse: 'tu',
  },
  {
    id: 'ado-sport',
    label: 'Adolescent sportif',
    description: 'Adolescents sportifs, pour comprendre leur fonctionnement mental dans leur pratique : entraînements, matchs et compétitions.',
    adresse: 'tu',
  },
  {
    id: 'adulte-hors-sport',
    label: 'Adulte hors sport',
    description: 'Adultes en dehors du contexte sportif, dans leur vie professionnelle et personnelle.',
    adresse: 'vous',
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Managers et dirigeants, dans l\'exercice de leurs responsabilités d\'encadrement et de décision.',
    adresse: 'vous',
  },
] as const

export const AUDIENCE_IDS: readonly AudienceId[] = AUDIENCES.map((a) => a.id)

export function getAudience(id: AudienceId): Audience {
  const found = AUDIENCES.find((a) => a.id === id)
  if (!found) throw new Error(`Public inconnu : ${id}`)
  return found
}
