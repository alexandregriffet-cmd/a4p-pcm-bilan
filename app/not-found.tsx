import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="wrap-narrow section" style={{ paddingTop: 48 }}>
      <span className="kicker">Page introuvable</span>
      <h1>Cette page n&apos;existe pas</h1>
      <p className="muted">L&apos;adresse est peut-être incorrecte, ou la page a été déplacée.</p>
      <Link className="btn btn-primary" href="/" prefetch={false}>
        Retour
      </Link>
    </div>
  )
}
