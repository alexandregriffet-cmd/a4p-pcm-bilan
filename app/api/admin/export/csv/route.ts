import 'server-only'
import { getDb } from '@/lib/server/db'
import { apiAdmin } from '@/lib/server/guards'
import { buildSummary, summaryCsv } from '@/lib/server/summary'

export const dynamic = 'force-dynamic'

/** Synthèse CSV de tous les clients (téléchargement réel, UTF-8 avec BOM, séparateur point-virgule). */
export async function GET(req: Request) {
  const g = await apiAdmin(req)
  if (!g.ok) return g.res
  const db = await getDb()
  const [clients, results] = await Promise.all([db.listClients(), db.listAllResults()])
  const csv = summaryCsv(buildSummary(clients, results))
  const day = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="synthese-pcm-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
