import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/** Client Supabase lié à la session de la personne (cookies). Les politiques RLS s'appliquent. */
export function getUserClient() {
  const cookieStore = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          /* appel depuis un composant serveur : le middleware rafraîchit la session */
        }
      },
    },
  })
}

/** Client à clé de service. SERVEUR UNIQUEMENT (ce fichier importe server-only). Contourne la RLS. */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Configuration Supabase incomplète')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
