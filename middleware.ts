import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { LOCAL_COOKIE, verifyLocalSession } from '@/lib/local-session'

/**
 * Protège toutes les routes sauf la connexion (/), /confidentialite, la connexion/déconnexion de l'API et les actifs.
 * Contrôle aussi le rôle pour /admin et /api/admin. Les pages et les routes revérifient tout côté serveur.
 */
const PUBLIC_PAGES = new Set(['/', '/confidentialite'])
const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/logout'])

function isApi(path: string) {
  return path.startsWith('/api/')
}
function isAdminPath(path: string) {
  return path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/')
}

function deny(req: NextRequest, status: 401 | 403, redirectTo: string) {
  if (isApi(req.nextUrl.pathname)) return NextResponse.json({ error: status === 401 ? 'non-connecte' : 'interdit' }, { status })
  const url = req.nextUrl.clone()
  url.pathname = redirectTo
  url.search = ''
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const local = process.env.NEXT_PUBLIC_LOCAL_TEST === '1'
  const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  // Rien n'est configuré : la page affiche « Configuration incomplète », aucune donnée n'est servie.
  if (!local && !hasSupabase) return NextResponse.next()

  const path = request.nextUrl.pathname
  if (PUBLIC_PAGES.has(path) || PUBLIC_API.has(path)) return NextResponse.next()

  let role: 'admin' | 'client' | null = null
  let authenticated = false
  let response = NextResponse.next({ request })

  if (local) {
    const s = await verifyLocalSession(request.cookies.get(LOCAL_COOKIE)?.value)
    authenticated = !!s
    role = s?.role ?? null
  } else {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    const { data } = await supabase.auth.getUser()
    authenticated = !!data.user
    if (data.user) {
      const { data: p } = await supabase.from('profiles').select('role,active').eq('id', data.user.id).maybeSingle()
      role = p && p.active ? ((p.role as 'admin' | 'client') ?? null) : null
    }
  }

  if (!authenticated) return deny(request, 401, '/')
  if (isAdminPath(path) && role !== 'admin') return deny(request, 403, role === 'client' ? '/espace' : '/')
  if ((path === '/espace' || path.startsWith('/espace/')) && role === 'admin') return deny(request, 403, '/admin')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|logo-a4p.png|logo-a4p-emblem.png).*)'],
}
