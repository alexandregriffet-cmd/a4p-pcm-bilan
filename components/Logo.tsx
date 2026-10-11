import Link from 'next/link'

/** Wordmark A4P en CSS (aucune image externe). */
export function Logo({ large, href = '/' }: { large?: boolean; href?: string | null }) {
  const inner = (
    <>
      <span className="logo-mark" aria-hidden="true">A4P</span>
      <span className="logo-sig">
        A4P Mental <span aria-hidden="true">&middot;</span> Alexandre Griffet
      </span>
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
