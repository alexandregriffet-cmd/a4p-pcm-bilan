import 'server-only'

export type ModeInfo =
  | { mode: 'local' }
  | { mode: 'supabase' }
  | { mode: 'unconfigured'; missing: string[]; reason: string }

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const

/**
 * Mode de fonctionnement, décidé uniquement par l'environnement.
 * - local : NEXT_PUBLIC_LOCAL_TEST=1 (essais et tests automatisés, stockage dans un fichier du serveur) ;
 * - supabase : les trois variables Supabase sont présentes ;
 * - unconfigured : sinon, l'application n'affiche que l'écran « Configuration incomplète ».
 * Le mode local est refusé sur Vercel : il ne doit jamais servir en ligne.
 */
export function getMode(): ModeInfo {
  if (process.env.NEXT_PUBLIC_LOCAL_TEST === '1') {
    if (process.env.VERCEL) {
      return {
        mode: 'unconfigured',
        missing: [],
        reason: 'La variable NEXT_PUBLIC_LOCAL_TEST est réservée aux essais sur ordinateur. Supprimez-la des variables Vercel.',
      }
    }
    return { mode: 'local' }
  }
  const missing = REQUIRED.filter((k) => !(process.env[k] ?? '').trim())
  if (missing.length > 0) {
    return { mode: 'unconfigured', missing: [...missing], reason: 'Des variables d\'environnement Supabase sont absentes.' }
  }
  return { mode: 'supabase' }
}
