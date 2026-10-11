import type { Profile } from './types'
import { isMinorCategory } from '@/lib/minor'

/**
 * Accès d'un client à son test. Fonction pure, utilisée par les pages et par les routes
 * (la décision est toujours reprise côté serveur à partir du profil lu en base).
 */
export type Access = 'inactive' | 'done' | 'guardian' | 'consent' | 'ready'

export function accessOf(p: Pick<Profile, 'role' | 'active' | 'category' | 'guardianConsent' | 'consentAt' | 'attemptsAllowed'>, resultsCount: number): Access {
  if (!p.active || p.role !== 'client' || !p.category) return 'inactive'
  if (resultsCount >= p.attemptsAllowed) return 'done'
  if (isMinorCategory(p.category) && !p.guardianConsent) return 'guardian'
  if (!p.consentAt) return 'consent'
  return 'ready'
}
