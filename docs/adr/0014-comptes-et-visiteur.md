# 0014 — Comptes (connexion, inscription) et mode visiteur

## Contexte

Le plan initial range le mode visiteur ("espaces publics et fil lisibles sans
compte") dans le lot 11. En l'abordant, l'état réel du produit s'est révélé
plus en retard que prévu : le lot 3 avait posé Better Auth côté serveur
(email et mot de passe, GitHub, vérification d'email obligatoire,
réinitialisation de mot de passe) et le lot 4 le système de design, mais
aucun écran de connexion ni d'inscription n'avait jamais été câblé côté
`apps/web`. Tous les tests, d'intégration comme Playwright, s'authentifient
en appelant `/api/auth/*` directement. `AppShell` ne savait pas non plus si
quelqu'un était connecté, et aucun écran ne permettait de compléter son
profil après l'inscription, pourtant obligatoire avant la moindre action
(`requireOwnProfile` le bloque partout). Décision : poser
les deux ensemble dans ce lot, le mode visiteur n'ayant de sens qu'en regard
d'un vrai chemin "avec compte".

## Décisions

**Lecture optionnelle plutôt qu'un garde de routage générique.** Pas de
composant qui bloquerait l'accès à une page tant que la session n'est pas
résolue : chaque route de lecture concernée (espaces publics, salons,
messages, fil "Pour toi") accepte une session absente et renvoie ce qu'un
visiteur a le droit de voir, exactement comme un membre verrait moins qu'un
administrateur. Côté serveur, le motif se répète : remplacer
`requireSessionUserId` (lève une 401) par `getSessionUserId` (renvoie
`null`), et faire descendre un `profileId: string | null` jusqu'aux
fonctions de repository concernées. Aucune route d'écriture ne change.
Côté `apps/web`, chaque page décide elle-même quoi afficher via
`useSession()` plutôt que d'être bloquée en amont par un routeur.

**Le direct Socket.IO s'ouvre aux visiteurs, pas seulement une lecture REST
figée.** `apps/server/src/realtime/main.ts` exigeait jusqu'ici une session
valide pour la simple connexion (`io.use`). Un visiteur se voit maintenant
accepté avec `profileId = null` plutôt que rejeté ; `canAccessChannel`
(extraite dans `apps/server/src/realtime/access.ts` pour être testable
indépendamment du reste du serveur temps réel) n'exécute la vérification
d'appartenance que si `profileId` n'est pas `null`, le passage public restant
devant. Un visiteur ne figure jamais dans `socketsByProfile` (réservé à la
déconnexion ciblée d'un membre exclu) et ses événements `typing:start` /
`typing:stop` sont ignorés côté serveur, pas seulement masqués côté
interface : l'absence de composeur dans l'UI visiteur n'est pas une garantie
de sécurité en soi.

**Le fil "Pour toi" est accessible sans session, jamais "Abonnements".**
`listPourToiFeed` ne dépendait déjà d'aucun profil (classement par score sur
une fenêtre glissante). `GET /api/posts` sert ce fil à un visiteur même si
`tab=abonnements` est demandé, plutôt que de renvoyer une erreur : l'écran ne
propose de toute façon que l'onglet "Pour toi" quand `useSession()` renvoie
`"visitor"`.

**Mot de passe oublié inclus dans ce même lot.** Le backend
(`/api/auth/forget-password`, `/api/auth/reset-password`) existait déjà
depuis le lot 3, jamais câblé : coût marginal faible (deux pages courtes)
pour fermer un vrai manque plutôt que d'ouvrir un lot séparé pour si peu.
Le message après une demande reste le même, qu'un compte existe ou non pour
l'adresse saisie : ne jamais révéler si un email est enregistré.

**Appels directs aux routes Better Auth plutôt qu'un client dédié.** Pas de
dépendance `better-auth/client` ajoutée : les pages de connexion,
d'inscription, de mot de passe oublié et de déconnexion appellent
`/api/auth/*` avec le même `request()` que le reste de `apps/web/src/lib/chat/api.ts`,
cohérent avec la façon dont les tests existants pilotent déjà ces routes
directement. Les erreurs renvoyées par Better Auth n'ont pas la forme
`{error:{code,message}}` du reste de l'API (propre à notre gestionnaire
d'erreurs Fastify) : les pages ne lisent donc que `statusCode` sur l'erreur
capturée, jamais `message`, et choisissent elles-mêmes le texte français
affiché.

**Un petit point de configuration public pour le bouton GitHub.**
`apps/server/src/config/auth-config.ts` (même forme que
`projects-config.ts` du lot 9) expose `GET /api/auth-config` sans
authentification : la page de connexion masque le bouton "Continuer avec
GitHub" si le serveur ne porte pas d'identifiants OAuth, plutôt que
d'afficher un bouton qui échouerait silencieusement.

**Complétion de profil comme étape bloquante, pas un formulaire optionnel.**
Un compte avec une session valide mais sans profil (`profile === null`) est
un troisième état (`"incomplete"`) distinct de `"visitor"` et `"ready"` dans
`useSession()`. La page `/completer-profil` redirige vers `/fil` une fois le
profil créé, et toute page qui détecte cet état y renvoie.

## Conséquences

- Pas d'écran d'édition de profil après la complétion initiale : seule la
  création une fois est câblée. Modifier son profil ensuite reste un trou,
  pré-existant à ce lot, pas introduit par lui.
- Pas de page de profil public (`/u/:handle`) : l'API existe depuis le
  lot 3, jamais câblée côté web.
- La forme exacte de la réponse de `POST /api/auth/sign-in/social` (JSON
  avec une URL à suivre côté client plutôt qu'une redirection HTTP directe)
  suit le comportement documenté habituel de Better Auth mais n'a pu être
  vérifiée qu'en CI, aucun fournisseur GitHub OAuth n'étant configuré sur le
  poste de développement actuel.
- Salon "Mèmes" (type spécial image) et page Kemet Pro restent des sous-lots
  11 séparés.

## Complément du 08/11/2026

La lecture des projets et des compétitions rejoint le mode visiteur : aucun
de ces contenus n'est privé, et ces pages étaient déjà dans la navigation
d'un visiteur. Les candidatures, le vote personnel et toute écriture restent
réservés à un compte.
