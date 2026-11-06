# 0003 — Authentification et profils

## Contexte

Le lot 3 pose les comptes utilisateurs et les profils publics : email et mot
de passe, connexion GitHub, vérification d'email, réinitialisation de mot de
passe, et le modèle fournisseur/suiveur. Il faut une bibliothèque qui couvre
tout ça sans réinventer la gestion des sessions ni le stockage des mots de
passe, compatible avec Drizzle et les licences autorisées.

## Décision

**Better Auth** (MIT) comme bibliothèque d'authentification, avec son
adaptateur Drizzle (`better-auth/adapters/drizzle`, fourni par le paquet lui
aussi MIT). Le schéma des quatre tables qu'il attend (`user`, `session`,
`account`, `verification`) est généré une fois avec
`npx @better-auth/cli generate` à partir de la configuration du serveur, puis
versionné à la main dans `packages/db/src/schema/auth.ts` : ne pas modifier
les noms de colonnes sans régénérer.

Au-dessus de ces quatre tables, trois tables métier : `profiles` (identifiant
public, pays, bio, stack, lien GitHub), `credentials` (parcours déclaré ou
vérifié), `follows` (contrainte d'unicité sur le couple et contrainte
`CHECK` interdisant de se suivre soi-même, posées en base plutôt que
vérifiées seulement côté serveur).

**Hachage des mots de passe : Argon2id** via `@node-rs/argon2` (MIT, binding
natif Rust), plutôt que Scrypt par défaut de Better Auth. Demandé par
nos règles de sécurité ; Better Auth accepte une fonction de hachage personnalisée
(`emailAndPassword.password.hash` / `.verify`), ce qui évite d'avoir à
justifier une exception. Paramètres par défaut du paquet (m=19456, t=2, p=1),
conformes aux recommandations OWASP actuelles.

**Vérification d'email obligatoire avant la création d'une session**
(`requireEmailVerification: true`) : une connexion avec un email non vérifié
échoue en 403 plutôt que de créer une session.

**Emails** derrière une interface `EmailSender` (`apps/server/src/email/`) :
`SmtpEmailSender` (nodemailer, MIT) configuré par variables d'environnement
pour un relais SMTP Brevo ou Resend, et `InMemoryEmailSender` pour les tests
d'intégration, qui garde les messages en mémoire au lieu de les envoyer. En
développement local, `infra/docker-compose.yml` démarre Mailpit
(`--profile dev`, jamais en production) pour voir réellement les emails
envoyés sans configurer de vrai relais.

**Cookies de session** : httpOnly, Secure (automatique dès que
`NODE_ENV=production`), SameSite=Lax. Ce sont les valeurs par défaut de
Better Auth, aucune configuration `advanced.useSecureCookies` n'a été
nécessaire.

**Limite de tentatives** sur `/sign-in/email` (5 par minute, via
`rateLimit.customRules` de Better Auth plutôt qu'un middleware écrit à la
main) et `/request-password-reset` (3 par minute, la règle par défaut de
Better Auth pour ce chemin). L'app web appelait `/forget-password`, ancien
nom de cette route, qui n'existe plus dans Better Auth 1.7 : la demande de
lien répondait 404.

**Domaine des comptes de démonstration** : aucune boîte n'existe derrière
`demo.kemetlabs.dev`, et le serveur n'y envoie jamais d'email. Un compte créé
avec une telle adresse ne pourrait donc jamais être vérifié. L'inscription
refuse ce domaine et ses sous-domaines (`hooks.before` sur `/sign-up/email`
et `/change-email`, `databaseHooks.user.create.before` pour les connexions
sociales), avec le code `DEMO_EMAIL_DOMAIN`. La page d'inscription affiche la
raison sous le champ avant tout envoi. `isDemoEmailAddress` vit dans
`packages/shared` pour être partagée par le serveur, le seed et l'app web.

**Intégration Fastify** : Better Auth n'a pas d'adaptateur Fastify officiel.
Son gestionnaire HTTP standard (`toNodeHandler`) est monté sur une route
`/api/auth/*` isolée dans un plugin Fastify dédié, dont le parseur JSON est
désactivé pour ces seules routes : le gestionnaire lit lui-même le corps brut
de la requête, et Fastify ne doit pas le consommer avant lui. L'encapsulation
du plugin évite que ce changement affecte les autres routes (`/api/me`,
`/api/users/*`).

## Conséquences

- Les quatre tables Better Auth sont regénérées, pas réécrites à la main, si
  la configuration change (nouveau champ, nouveau fournisseur social) :
  `npx @better-auth/cli generate` puis relecture du diff avant de commiter.
- `drizzle-orm` et `drizzle-kit` sont passés en version 0.45 / 0.31 sur tout
  le monorepo : Better Auth 1.7 exige `drizzle-orm >= 0.45.2` en peer
  dependency.
- Les tests d'authentification et d'autorisation tournent contre une vraie
  base PostgreSQL (`DATABASE_URL_TEST`), jamais une base simulée : une
  erreur de contrainte SQL (identifiant déjà pris, auto-suivi) doit être
  détectée par le test, pas seulement supposée. Voir le job CI
  `integration-tests`.
- `@node-rs/argon2` est un binding natif : les images Docker de l'API
  doivent utiliser une base compatible (Alpine via la musl de Node, déjà le
  cas dans `apps/server/Dockerfile`) ; vérifié par le job `infra-smoke`
  existant qui construit et démarre l'image réelle.
