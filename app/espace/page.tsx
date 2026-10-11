import { redirect } from 'next/navigation'
import { ConsentForm } from '@/components/ConsentForm'
import { LogoutButton } from '@/components/LogoutButton'
import { TestRunner } from '@/components/TestRunner'
import { accessOf } from '@/lib/access'
import { getAudience } from '@core/audiences'
import { clientTexts } from '@/lib/texts'
import { getDb } from '@/lib/server/db'
import { getCaller } from '@/lib/server/guards'
import { clientQuestions } from '@/lib/server/questions'
import { isMinorCategory } from '@/lib/minor'

export const dynamic = 'force-dynamic'

/**
 * Seule page du client. Le serveur lit son profil en base et décide : accès indisponible, consentement,
 * test, ou remerciement. La page ne transmet jamais de résultat : il n'existe aucune lecture côté client.
 */
export default async function EspacePage() {
  const me = await getCaller()
  if (!me) redirect('/')
  if (me.role === 'admin') redirect('/admin')

  const tu = me.category ? getAudience(me.category).adresse === 'tu' : false
  const tx = clientTexts(tu)
  const db = await getDb()
  const count = await db.countResults(me.id)
  const state = accessOf(me, count)

  if (state === 'inactive') {
    return (
      <Message title={tx.inactive.title} text={tx.inactive.text} />
    )
  }

  if (state === 'done') {
    return (
      <div className="wrap-narrow section thanks" style={{ paddingTop: 48 }}>
        <div className="card card-hero">
          <span className="kicker">Bilan PCM</span>
          <h1 data-testid="thanks-title">{tx.thanks.title}</h1>
          <p className="lead">{tx.thanks.text}</p>
          <p className="muted small" style={{ marginBottom: 18 }}>{tx.thanks.sign}</p>
          <LogoutButton />
        </div>
      </div>
    )
  }

  if (state === 'guardian') {
    return <Message title={tx.guardianBlocked.title} text={tx.guardianBlocked.text} />
  }

  if (state === 'consent') {
    return <ConsentForm t={tx.consent} minor={isMinorCategory(me.category)} />
  }

  // state === 'ready'
  const draft = await db.getDraft(me.id)
  return <TestRunner questions={clientQuestions(me.category!)} initial={draft?.answers ?? {}} tu={tu} />
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="wrap-narrow section" style={{ paddingTop: 48 }}>
      <div className="card">
        <span className="kicker">A4P Mental</span>
        <h1>{title}</h1>
        <p className="lead">{text}</p>
        <LogoutButton />
      </div>
    </div>
  )
}
