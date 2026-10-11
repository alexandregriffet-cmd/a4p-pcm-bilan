import 'server-only'
import { apiAdmin } from '@/lib/server/guards'
import { json } from '@/lib/server/http'
import { generatePassword } from '@/lib/server/password'

export const dynamic = 'force-dynamic'

/** Génère un mot de passe lisible de 12 caractères (tirage cryptographique côté serveur). Rien n'est enregistré. */
export async function POST(req: Request) {
  const g = await apiAdmin(req)
  if (!g.ok) return g.res
  return json({ password: generatePassword() })
}
