import { notFound } from 'next/navigation'
import { ReportView } from '@/components/admin/ReportView'
import { formatDateShort } from '@/lib/format'
import { getDb } from '@/lib/server/db'
import { isUuid, requireAdminPage } from '@/lib/server/guards'

export const dynamic = 'force-dynamic'

export default async function ResultPage({ params, searchParams }: { params: { id: string }; searchParams: { tentative?: string } }) {
  await requireAdminPage()
  if (!isUuid(params.id)) notFound()
  const db = await getDb()
  const p = await db.getProfile(params.id)
  if (!p || p.role !== 'client') notFound()
  const results = await db.listResults(p.id)
  if (results.length === 0) notFound()
  const wanted = Number(searchParams.tentative)
  const stored = results.find((r) => r.attempt === wanted) ?? results[results.length - 1]
  const attempts = results.map((r) => ({
    attempt: r.attempt,
    href: `/admin/clients/${p.id}/resultat?tentative=${r.attempt}`,
    date: formatDateShort(r.createdAt),
    current: r.id === stored.id,
  }))
  return (
    <div className="wrap-narrow">
      <ReportView person={{ fullName: p.fullName, email: p.email }} stored={stored} backHref={`/admin/clients/${p.id}`} attempts={attempts} />
    </div>
  )
}
