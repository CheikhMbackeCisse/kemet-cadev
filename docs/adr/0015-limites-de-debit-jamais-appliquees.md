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

## Complément : l'adresse du client derrière Caddy

Les limites sont comptées par adresse IP. Sans réglage, Fastify prend
l'adresse de la connexion, qui est celle de Caddy pour toute requête venue
d'Internet : un seul compteur pour tous les utilisateurs, et une démo à
plusieurs se serait bloquée en quelques secondes.

- `trustProxy` limité aux plages `loopback` et `uniquelocal` (10/8,
  172.16/12, 192.168/16, fc00::/7). L'API n'est publiée sur aucun port de
  l'hôte : seules les adresses du réseau Docker l'atteignent. Un
  `X-Forwarded-For` reçu d'une adresse publique est ignoré. Un appelant
  d'une adresse privée peut poser le sien : sans conséquence tant que
  l'API reste hors de tout port publié. Restreindre au sous-réseau Docker
  exact demanderait de le fixer dans le compose.
- Caddy, sans `trusted_proxies`, remplace le `X-Forwarded-For` reçu du
  navigateur par la seule adresse du client : un client ne peut pas se
  faire passer pour un autre.
- Better Auth lit ses propres en-têtes, pas `request.ip`. L'API lui
  transmet l'adresse résolue par Fastify dans `x-kemet-client-ip`, écrasé à
  chaque requête, et Better Auth ne lit que cet en-tête. Les deux limites
  (routes et connexion) partent donc de la même adresse. Une nuance : en
  IPv6, Better Auth regroupe les adresses par /64, `@fastify/rate-limit`
  compte l'adresse complète.

Couvert par `apps/server/src/api/client-ip.integration.test.ts`, avec deux
adresses de client derrière une adresse de proxy, et un client qui change
d'en-tête à chaque tentative.

## Complément du 08/11/2026 : une clé par compte, l'adresse IP sans session

Compter par adresse IP pénalise les réseaux partagés, nombreux chez les
utilisateurs visés : NAT des opérateurs mobiles, campus, cybercafés. Avec
une clé par adresse, 20 messages par minute valaient pour tout un campus.

- La clé de chaque limite de route est désormais `user:<identifiant>` pour
  une requête avec session, `ip:<adresse>` sinon (`apps/server/src/api/rate-limit.ts`,
  `keyGenerator` global de `@fastify/rate-limit`). Une adresse IPv6 est
  ramenée à son préfixe /64, comme le fait déjà Better Auth.
- Sans session, la limite de la route est multipliée par
  `RATE_LIMIT_ANONYMOUS_IP_FACTOR` (3 par défaut), par un hook `onRoute`
  posé avant celui du greffon. Les routes d'écriture refusent de toute façon
  une requête sans session : ce facteur ne concerne en pratique que les
  routes publiques limitées.
- La limite réduite des comptes récents (`antiSpamMax`) s'applique
  toujours, comptée par compte.
- La session d'une requête n'est lue qu'une fois : `getSessionUserId`
  garde son résultat le temps de la requête, partagé par la clé, la limite
  et la route.
- Les limites de connexion et d'inscription de Better Auth restent comptées
  par adresse : il n'y a pas encore de compte à ce moment-là.

- Le hook ne modifie jamais l'objet de configuration d'une route : il est
  souvent partagé (`publicReadLimit` des projets et des compétitions), et
  chaque GET est redéclaré en HEAD avec le même objet. Le modifier en place
  multipliait la limite à chaque déclaration.
- Si la session ne peut pas être lue (base indisponible), la requête
  échoue. Aucun repli sur la clé par adresse.
- `RATE_LIMIT_ANONYMOUS_IP_FACTOR` est plafonné à 10.

Ce qui change pour un attaquant : un compte ne contourne plus sa limite en
changeant d'adresse, mais plusieurs comptes derrière une même adresse ont
chacun la leur. Sur les routes branchées sur `antiSpamMax` (messages,
posts, réponses, fichiers et images, signalements, conversations privées,
travaux et leurs médias, "Qui a travaillé sur ce sujet ?"), un compte
récent n'a qu'une fraction de la limite. Ailleurs (réactions, skills,
projets, compétitions, invitations), un compte neuf a la limite pleine :
créer des comptes en série multiplie ces quotas, borné par la vérification d'email
et la limite d'inscription de Better Auth, mais pas par la connexion
GitHub, Google ou LinkedIn. Point ouvert.

Autre coût : une requête limitée lit la session avant le compteur, refus
compris. Sans cookie ou avec un cookie mal signé, Better Auth répond sans
toucher à la base ; un compte connecté qui insiste paie une lecture par
tentative. Le cache de session en cookie de Better Auth réduirait ce coût
au prix d'un délai de révocation ; il n'est pas activé.

Couvert par `apps/server/src/api/rate-limit.test.ts` et, avec de vraies
sessions, par `apps/server/src/moderation/anti-spam.integration.test.ts`.
