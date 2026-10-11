# 0015 — Les limites de débit par route n'ont jamais été appliquées

## Contexte

Le lot 11 ajoute une limite anti-spam plus stricte pour les comptes de
moins de 24 heures, au-dessus des limites par minute déjà
posées aux lots 5, 5 bis et 7 sur la création de messages, de posts, de
partages, de réponses et l'envoi de fichiers, via `@fastify/rate-limit`
(`config: { rateLimit: { max, timeWindow } }` sur chaque route).

En écrivant le premier test qui envoie délibérément plus de requêtes que la
limite configurée pour vérifier que le compte récent se fait refuser plus
tôt, aucune des deux réponses attendues n'arrivait : ni la limite réduite,
ni même la limite normale. Les cinq, dix, puis douze requêtes envoyées à la
suite passaient toutes, sans aucun en-tête `x-ratelimit-*` sur la réponse.
En sondant une route totalement indépendante de ce lot
(`POST /api/skills`, limite fixe à 10 par minute depuis le lot 6, jamais
testée au-delà), le même constat : douze créations de skill d'affilée,
aucun refus. **Aucune limite de débit par route, sur aucune route, n'a
jamais été appliquée dans ce dépôt.**

## Cause

`apps/server/src/api/app.ts` enregistrait `@fastify/rate-limit` avec
`app.register(rateLimit, { global: false })`, puis déclarait toutes les
routes directement à la suite, de façon synchrone, dans le corps de
`buildApp()`. `register()` met seulement en file d'attente le chargement
du greffon : son code ne s'exécute pas avant que Fastify appelle
`.ready()` (déclenché plus tard par `.listen()` ou `.inject()`). Le hook
`onRoute` que `@fastify/rate-limit` pose pour lire `config.rateLimit` sur
chaque route ne s'installe donc qu'à ce moment-là — bien après que toutes
les routes du fichier aient déjà été déclarées de façon synchrone, sans ce
hook. Résultat : `config.rateLimit` n'a jamais eu d'effet, sur aucune
route, qu'elle date de ce lot ou d'un lot précédent. Le bug existait avant
le lot 11, invisible faute d'un test qui dépasse jamais une de ces
limites.

Un deuxième bug du même ordre s'est révélé une fois le premier corrigé : le
gestionnaire d'erreurs global de `buildApp()` forçait tout ce qui n'était
ni une `AppError` ni une `ZodError` vers une réponse 500 générique. Une
fois la limite de débit effectivement appliquée, le `429` levé par
`@fastify/rate-limit` (une erreur simple avec un `statusCode` posé dessus,
pas une `AppError`) se retrouvait donc, lui aussi, transformé en 500.

## Décision

**Différer la déclaration des routes avec `app.after()`.** Tout ce qui
suit l'enregistrement de `rateLimit` et de `multipart` dans `buildApp()`
(les routes de santé, Better Auth, et l'ensemble des modules via
`registerXRoutes`) est maintenant posé dans un `app.after(() => { ... })`,
qui ne s'exécute qu'une fois ces deux greffons chargés. `buildApp()` reste
synchrone : `app.after()` met simplement son callback en file d'attente
lui aussi, exécuté au même moment que le reste du démarrage (`.ready()`),
sans obliger chaque appelant de `buildApp()` à devenir asynchrone.

**Respecter un `statusCode` 4xx explicite dans le gestionnaire d'erreurs
global**, avant de retomber sur 500. Couvre le 429 de `@fastify/rate-limit`
et, plus généralement, toute erreur interne à Fastify qui pose déjà un
code de statut client correct (corps JSON invalide, par exemple), plutôt
que de les masquer toutes derrière une erreur serveur générique.

## Conséquences

- Toutes les limites de débit par route posées depuis le lot 5 s'appliquent
  réellement pour la première fois : création de message, de post, de
  partage, de réponse, de skill, de projet, de compétition, de lien
  d'invitation, envoi de fichier.
- Deux tests de `apps/server/src/api/points.integration.test.ts`
  publiaient six posts d'affilée avec un compte flambant neuf pour tester
  le plafond de points, ce qui dépasse maintenant la limite anti-spam
  réduite d'un compte récent (5/minute). Corrigé en vieillissant le profil
  de l'auteur avant la boucle, comme au lot 8 pour la fraîcheur des points :
  ces deux tests vérifient le plafond de points, pas l'anti-spam, déjà
  couvert par ses propres tests
  (`apps/server/src/moderation/anti-spam.integration.test.ts`).
- Aucun autre test existant n'envoie assez de requêtes à une route limitée
  pour être concerné (vérifié avec une recherche des boucles et des
  `Promise.all` sur les suites d'intégration).
- À surveiller : si un futur lot ajoute un test qui enchaîne plus
  d'une poignée de requêtes sur une route déjà limitée, la limite
  s'applique désormais pour de vrai.
