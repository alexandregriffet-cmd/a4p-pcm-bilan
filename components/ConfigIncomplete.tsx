import { Logo } from './Logo'

/** Seul écran affiché lorsque l'application n'est pas configurée (aucune démonstration implicite). */
export function ConfigIncomplete({ missing, reason }: { missing: string[]; reason: string }) {
  return (
    <main className="wrap-narrow section" style={{ paddingTop: 48 }}>
      <Logo large href={null} />
      <h1 style={{ marginTop: 24 }}>Configuration incomplète</h1>
      <p className="muted">{reason}</p>
      {missing.length > 0 && (
        <>
          <p className="muted">Variables à renseigner :</p>
          <ul>
            {missing.map((m) => (
              <li key={m}>
                <code>{m}</code>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">Consultez le fichier GUIDE_PAS_A_PAS.md, étape 6.</p>
    </main>
  )
}
