import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import './globals.css'
import { ConfigIncomplete } from '@/components/ConfigIncomplete'
import { LogoutButton } from '@/components/LogoutButton'
import { Logo } from '@/components/Logo'
import { APP_NAME, SIGNATURE } from '@/lib/format'
import { getCaller } from '@/lib/server/guards'
import { getMode } from '@/lib/server/mode'

export const metadata: Metadata = {
  title: 'A4P PCM Bilan',
  description: 'Bilans PCM privés, A4P Mental.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D1B3E',
}

export const dynamic = 'force-dynamic'

const BG = 'linear-gradient(160deg, #071230 0%, #0d1b3e 45%, #14295a 100%)'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const info = getMode()
  let me = null
  if (info.mode !== 'unconfigured') {
    try {
      me = await getCaller()
    } catch {
      me = null
    }
  }
  const area = me && me.active ? (me.role === 'admin' ? 'Espace administrateur' : 'Mon espace') : null

  return (
    <html lang="fr" style={{ background: '#0D1B3E', backgroundImage: BG }}>
      <body style={{ background: '#0D1B3E', backgroundImage: BG, color: '#FFFFFF' }}>
        <div className="app" style={{ background: '#0D1B3E', backgroundImage: BG }}>
          {info.mode === 'unconfigured' ? (
            <ConfigIncomplete missing={info.missing} reason={info.reason} />
          ) : (
            <>
              {info.mode === 'local' && (
                <div className="local-bar no-print" role="status">
                  Mode de test local : données fictives enregistrées dans un fichier du serveur de test. Ne jamais utiliser en ligne.
                </div>
              )}
              <header className="hdr no-print">
                <div className="hdr-in">
                  <div className="hdr-left">
                    <Logo href={null} />
                    <div className="hdr-ctx">
                      <span>{APP_NAME}</span>
                      {area && (
                        <>
                          <span aria-hidden="true">&middot;</span>
                          <span className="pill">{area}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {area && (
                    <div className="hdr-right">
                      <LogoutButton />
                    </div>
                  )}
                </div>
              </header>
              <main>{children}</main>
              <footer className="foot no-print">
                <div className="foot-in">
                  <span>{SIGNATURE}</span>
                  <span className="foot-links">
                    <Link href="/confidentialite" prefetch={false}>Confidentialité</Link>
                  </span>
                </div>
              </footer>
            </>
          )}
        </div>
      </body>
    </html>
  )
}
