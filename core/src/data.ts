import commonJson from '../data/common.json'

import adulteSportPcm from '../data/adulte-sport/pcm.json'
import adoEtudesPcm from '../data/ado-etudes/pcm.json'
import adoSportPcm from '../data/ado-sport/pcm.json'
import adulteHorsSportPcm from '../data/adulte-hors-sport/pcm.json'
import managerPcm from '../data/manager/pcm.json'

import type { AudienceId, CommonData, DataByTest, TestId } from './types'

export const common = commonJson as unknown as CommonData

/**
 * COPIE ALLEGEE pour la plateforme : seules les données du bilan sont embarquées
 * (les données BIPM n'ont pas à être livrées au navigateur de cette plateforme).
 * Le reste du noyau (src) est identique au noyau du dépôt de référence.
 */
const REGISTRY: { [A in AudienceId]: Partial<Record<TestId, unknown>> } = {
  'adulte-sport': { pcm: adulteSportPcm },
  'ado-etudes': { pcm: adoEtudesPcm },
  'ado-sport': { pcm: adoSportPcm },
  'adulte-hors-sport': { pcm: adulteHorsSportPcm },
  manager: { pcm: managerPcm },
}

/** Données (questions et textes de résultats) d'un test pour un public. */
export function getTestData<T extends TestId>(test: T, audience: AudienceId): DataByTest[T] {
  const byAudience = REGISTRY[audience]
  if (!byAudience) throw new Error(`Public inconnu : ${audience}`)
  const data = byAudience[test]
  if (!data) throw new Error(`Test absent de cette plateforme : ${test}`)
  return data as DataByTest[T]
}
