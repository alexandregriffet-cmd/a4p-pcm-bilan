import Link from 'next/link'
import { CONTACT, HOST, POSTAL, RETENTION } from '@/lib/legal'
import { SIGNATURE } from '@/lib/format'

export const metadata = { title: 'Confidentialité, A4P Bilan' }

export default function ConfidentialitePage() {
  return (
    <div className="wrap-narrow section" style={{ paddingTop: 30 }}>
      <span className="kicker">A4P Bilan</span>
      <h1>Politique de confidentialité</h1>
      <p className="muted">Les champs entre crochets sont à compléter avant la mise en ligne.</p>

      <div className="stack">
        <div className="card">
          <h3>Responsable de traitement</h3>
          <p style={{ marginBottom: 6 }}>{SIGNATURE}</p>
          <p className="muted small" style={{ margin: 0 }}>
            Adresse postale : {POSTAL}. Contact : {CONTACT}.
          </p>
        </div>

        <div className="card">
          <h3>Données collectées</h3>
          <ul className="plain-list">
            <li>Compte : nom, adresse e-mail (identifiant), catégorie du test, date du consentement. Les comptes sont créés par A4P Mental : il n&apos;existe pas d&apos;inscription libre.</li>
            <li>Test : vos classements pour chacune des situations proposées, le brouillon en cours, puis le résultat calculé.</li>
            <li>Accompagnement : notes privées rédigées par A4P Mental, le cas échéant.</li>
          </ul>
        </div>

        <div className="card">
          <h3>Qui voit quoi</h3>
          <ul className="plain-list">
            <li>Vous ne voyez jamais votre résultat sur cette plateforme : votre rapport complet vous est communiqué par votre coach, en dehors de la plateforme.</li>
            <li>Seul l&apos;administrateur, A4P Mental, accède aux résultats et aux notes.</li>
          </ul>
        </div>

        <div className="card">
          <h3>Finalité et base légale</h3>
          <p style={{ margin: 0 }}>
            Les données servent uniquement à établir le Bilan de Construction Mentale et à l&apos;accompagnement. Elles reposent sur le
            consentement recueilli à la première connexion. Pour un mineur, l&apos;accord du représentant légal est recueilli avant l&apos;ouverture de
            l&apos;accès.
          </p>
        </div>

        <div className="card">
          <h3>Durée de conservation</h3>
          <p style={{ margin: 0 }}>
            {RETENTION}. Aucune donnée n&apos;est supprimée automatiquement : la suppression se fait à votre demande ou à l&apos;initiative d&apos;A4P Mental.
          </p>
        </div>

        <div className="card">
          <h3>Vos droits</h3>
          <p>
            Vous disposez d&apos;un droit d&apos;accès, de rectification et de suppression de vos données. Pour les exercer, écrivez à {CONTACT}.
          </p>
          <p style={{ margin: 0 }}>En cas de difficulté, vous pouvez saisir la CNIL (www.cnil.fr).</p>
        </div>

        <div className="card">
          <h3>Nature des résultats</h3>
          <p style={{ margin: 0 }}>Les résultats constituent un support d&apos;accompagnement et d&apos;échange. Ils ne constituent pas un diagnostic.</p>
        </div>

        <div className="card">
          <h3>Sécurité et hébergement</h3>
          <p style={{ margin: 0 }}>
            Les données sont protégées par des règles d&apos;accès strictes appliquées au niveau de la base de données : un client n&apos;a aucun accès
            aux résultats. Hébergeur et lieu d&apos;hébergement : {HOST}.
          </p>
        </div>
        <p>
          <Link href="/" className="back-link" prefetch={false}>&larr; Retour à la connexion</Link>
        </p>
      </div>
    </div>
  )
}
