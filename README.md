# A4P PCM Bilan

Application privée de bilans PCM (personnalité et communication) pour A4P Mental, Alexandre Griffet.

- Un seul administrateur (le coach) crée les clients, choisit leur catégorie et génère leur mot de passe.
- Chaque client se connecte, passe son test une seule fois, puis ne voit qu'une page de remerciement. **Aucun résultat n'est jamais envoyé au navigateur d'un client.**
- Seul l'administrateur consulte les résultats, les exporte en PDF et en CSV, puis envoie le rapport au client hors plateforme.

Stack : Next.js 14.2.15 (App Router), React 18.3.1, TypeScript 5.6.3, @supabase/ssr, @supabase/supabase-js, CSS simple. Le noyau de calcul PCM est copié dans `core/` (alias `@core/*`).

## Catégories

| Identifiant | Libellé | Adresse |
|---|---|---|
| adulte-sport | Adulte sportif | vouvoiement |
| adulte-hors-sport | Adulte, hors sport | vouvoiement |
| manager | Manager | vouvoiement |
| ado-etudes | Adolescent, études | tutoiement (espace client uniquement) |
| ado-sport | Adolescent, sport | tutoiement (espace client uniquement) |

Pour ado-etudes et ado-sport, l'administrateur doit confirmer l'accord du représentant légal : sans cela le test n'est pas accessible.

## Installation et lancement

```
npm install
npx tsc --noEmit
npm run build
npm start
```

Variables (voir `.env.example`) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement), `NEXT_PUBLIC_SITE_URL`.

Sans ces variables et sans le drapeau de test local, l'application n'affiche que l'écran « Configuration incomplète ».

## Mise en place de Supabase

1. Créer un projet Supabase en région Europe.
2. Éditeur SQL : coller et exécuter `supabase/schema.sql` (idempotent, relançable sans risque).
3. Authentication : désactiver l'inscription libre (Sign In / Providers, Allow new users to sign up : désactivé), ne pas exiger de confirmation d'e-mail (les comptes sont créés déjà confirmés par l'application), garder le mot de passe comme seule méthode (pas de lien magique).
4. Créer le premier administrateur : Authentication, Users, Add user (e-mail et mot de passe, Auto Confirm User), puis exécuter `supabase/first-admin.sql` après avoir remplacé l'e-mail.
5. Déployer sur Vercel avec les 4 variables, Root Directory = dossier du projet.

Le guide détaillé, pas à pas, est dans `GUIDE_PAS_A_PAS.md`.

## Architecture et sécurité

```
app/
  page.tsx                      connexion (redirige selon le rôle)
  espace/page.tsx               seule page du client : consentement, passation ou remerciement
  confidentialite/page.tsx      politique de confidentialité (champs entre crochets à compléter)
  admin/                        espace administrateur (layout protégé par le rôle)
    page.tsx                    tableau de bord
    clients/nouveau             création d'un client
    clients/[id]                fiche client et actions
    clients/[id]/resultat       lecture complète (?tentative=N)
    export, export/rapports     synthèse, rapports complets (impression PDF)
  api/
    auth/login, auth/logout
    me/consent                  consentement du client
    test/draft (PUT)            sauvegarde du brouillon
    test/submit (POST)          validation finale, recalcul serveur, réponse { ok: true }
    admin/password              génération d'un mot de passe
    admin/clients (POST)        création
    admin/clients/[id] (PATCH, DELETE)
    admin/clients/[id]/password (POST)
    admin/clients/[id]/note (PUT)
    admin/clients/[id]/results (GET)
    admin/export/csv (GET)
lib/server/                     code serveur uniquement (import 'server-only')
  db-supabase.ts, db-local.ts   deux implémentations d'une même interface (db.ts)
  guards.ts                     contrôle de session et de rôle à chaque appel
components/admin/               composants de l'espace administrateur
components/TestRunner.tsx       passation (reçoit seulement le texte des situations)
core/                           noyau PCM copié (données et calcul)
supabase/schema.sql             tables, droits, RLS, déclencheurs
supabase/tests/                 tests SQL (voir ci-dessous)
```

Principes :

- **Le client ne reçoit jamais de résultat.** Le navigateur du client reçoit le texte des situations et des réponses, sans le profil rattaché à chaque option. Le résultat est calculé et enregistré par le serveur, qui répond seulement `{ ok: true }`.
- **La catégorie vient de la base.** La route de validation relit le profil, ignore toute catégorie envoyée, recalcule avec le noyau, vérifie consentement, accord du représentant légal, activité du compte et nombre de passages autorisés.
- **Trois couches pour les résultats** : routes d'API réservées à l'administrateur (rôle relu à chaque appel), politiques RLS (aucune politique client, politique restrictive en plus), déclencheurs SQL (catégorie figée, numéro de tentative, immuabilité).
- La clé de service n'existe que dans `lib/server/` (`server-only`) et n'est jamais envoyée au navigateur.
- Middleware : toutes les routes sont protégées sauf `/`, `/confidentialite`, la connexion et les actifs ; `/admin` et `/api/admin` exigent le rôle administrateur.
- Corps de requête limités à 64 Ko, contrôle de l'origine sur les requêtes qui modifient des données, en-têtes de sécurité, limitation des tentatives de connexion (en mémoire, meilleur effort).
- Aucune donnée n'est supprimée automatiquement.

## Premier administrateur

```sql
-- supabase/first-admin.sql (après création de l'utilisateur dans Authentication)
insert into public.profiles (id, email, full_name, role, category, active)
select u.id, lower(u.email), 'Alexandre Griffet', 'admin', null, true
from auth.users u where lower(u.email) = lower('VOTRE_EMAIL@exemple.fr')
on conflict (id) do update set role = 'admin', active = true;
```

## Mode de test local

`NEXT_PUBLIC_LOCAL_TEST=1` (et seulement dans ce cas) fait tourner l'application sans Supabase, avec un fichier JSON sur le serveur (`.local-data/store.json`, ou `LOCAL_DATA_DIR`). Un bandeau l'indique et l'administrateur de test est affiché sur l'écran de connexion (`admin@a4p.test`, modifiable par `LOCAL_ADMIN_EMAIL` et `LOCAL_ADMIN_PASSWORD`). Le mode est refusé automatiquement sur Vercel. La valeur étant fixée à la construction, il faut reconstruire (`next build`) pour l'activer ou le retirer.

```
NEXT_PUBLIC_LOCAL_TEST=1 npm run build
NEXT_PUBLIC_LOCAL_TEST=1 LOCAL_DATA_DIR=/chemin/vide npm start
E2E_BASE=http://localhost:3000 SHOTS=/chemin/captures node scripts/e2e.cjs
```

## Vérifications

- Base de données : `scripts/pg-test.sh /dossier/temporaire` initialise un PostgreSQL 16 local, simule `auth`, `anon`, `authenticated`, `service_role`, applique `schema.sql` deux fois puis déroule `supabase/tests/01-security.sql` (76 contrôles, dont : un client ne lit ni ses résultats ni les notes, ne modifie ni rôle ni catégorie, ne peut rien insérer dans `test_results`).
- Parcours complet : `scripts/e2e.cjs` (Playwright, mode de test local).

## Exports

- PDF : bouton « Exporter en PDF » (impression du navigateur, feuille d'impression A4 dédiée). Choisir « Enregistrer au format PDF » et décocher les en-têtes et pieds de page du navigateur.
- CSV : `/api/admin/export/csv`, UTF-8 avec BOM, séparateur point-virgule.

## Risques résiduels

- Limitation des tentatives de connexion en mémoire : sur Vercel, elle est locale à chaque instance. Les limites propres de Supabase Auth complètent le dispositif.
- Après régénération du mot de passe ou désactivation, une session déjà ouverte reste valable côté Supabase jusqu'à expiration du jeton (au plus une heure), mais chaque appel du site relit l'état du compte : un compte désactivé est refusé immédiatement.
- Le mot de passe transmis au client circule hors plateforme (message, courrier) : à transmettre par un canal approprié.
- Toute personne ayant la clé `service_role` ou un accès au tableau de bord Supabase contourne les règles : protéger ces accès.
