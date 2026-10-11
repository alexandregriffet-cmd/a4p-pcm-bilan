import Link from 'next/link'

/** Logo A4P Mental (images dans /public). Version large : emblème, nom et signature. */
export function Logo({ large, href = '/' }: { large?: boolean; href?: string | null }) {
  const inner = large ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-a4p.png" alt="" className="logo-img-lg" width={900} height={743} />
  ) : (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-a4p-emblem.png" alt="" className="logo-img" width={400} height={156} />
      <span className="logo-sig">A4P Mental</span>
    </>
  )
  const cls = large ? 'logo logo-lg' : 'logo'
  if (href === null) {
    return (
      <span className={cls} role="img" aria-label="A4P Mental, Alexandre Griffet">
        {inner}
      </span>
    )
  }
  return (
    <Link prefetch={false} href={href} className={cls} aria-label="A4P Mental, accueil">
      {inner}
    </Link>
  )
}
