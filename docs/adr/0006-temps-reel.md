# 0006 — Diffusion temps réel des salons

## Contexte

Les salons (`docs/adr/0004-salons-et-espaces.md`) doivent se mettre à jour
en direct chez tous les membres connectés : nouveau message, message
modifié ou supprimé, réaction, retrait d'un membre. Le service `realtime`
(Socket.IO) existait déjà comme coquille vide depuis le lot 1 ; il fallait
décider qui écrit en base, qui diffuse, et comment un client qui se
reconnecte après une coupure rattrape ce qu'il a manqué.

## Décision

**Les écritures passent par l'API (Fastify), jamais directement par
Socket.IO.** Envoyer un message, le modifier, le supprimer, réagir, marquer
un salon comme lu : ce sont des routes REST classiques, validées avec Zod,
dont les droits sont vérifiés côté serveur comme n'importe quelle autre
route (`docs/adr/0004-salons-et-espaces.md`), et limitées en débit
(`@fastify/rate-limit`, 20 messages par minute).

**`realtime` ne lit ni n'écrit jamais en base.** Après chaque écriture
réussie, l'API publie un événement sur Valkey (`apps/server/src/chat/
pubsub.ts`, un seul canal `kemet:chat-events`, payload validé par
`chatEventSchema` de `packages/shared`). Le service `realtime` s'abonne à
ce canal et ne fait que relayer chaque événement vers la room Socket.IO du
salon concerné (`channel:<id>`). Cette séparation garde `realtime` simple
et sans état métier : il authentifie des sockets et route des messages
déjà décidés par l'API.

**Pas de `@socket.io/redis-adapter`.** Cet adaptateur sert à synchroniser
plusieurs instances du serveur Socket.IO entre elles. Le projet n'a qu'une
seule instance `realtime` (un seul serveur Datacloud, voir
`docs/CONTEXTE.md`) : un pub/sub applicatif simple sur Valkey (`ioredis`,
déjà une dépendance pour BullMQ) suffit et évite une dépendance de plus.

**Authentification du socket à la connexion**, pas par événement : un
middleware Socket.IO (`io.use`) relit les cookies de la poignée de main
avec `auth.api.getSession` (même mécanisme que `apps/server/src/auth/
session.ts` côté HTTP) et rejette la connexion sans session valide. Un
socket ne rejoint la room d'un salon (`channel:join`) qu'après vérification
de l'appartenance à l'espace en base, exactement les mêmes règles que les
routes REST.

**Retrait immédiat d'un membre exclu.** Quand une route retire un membre
d'un espace, l'API publie un événement `member:removed`. Le service
`realtime` garde en mémoire une table `profileId → sockets` et fait
quitter à ces sockets toutes les rooms des salons de cet espace dès que
l'événement arrive, sans attendre une reconnexion.

**Déduplication par `client_id` et rattrapage par pagination REST.** Chaque
message porte un identifiant généré par le client (voir
`docs/adr/0004-salons-et-espaces.md`). Si l'envoi réussit en base mais que
la réponse ou l'événement se perd (coupure réseau), renvoyer le même
message avec le même `client_id` renvoie le message déjà créé au lieu
d'en créer un doublon. À la reconnexion, le client n'a rien à savoir sur
ce qu'il a manqué côté Socket.IO : il recharge simplement l'historique par
la route REST paginée (`GET /api/channels/:id/messages`) à partir du
dernier message reçu.

**Frappe en cours et présence : éphémères, jamais en base.** `typing:start`
et `typing:stop` passent uniquement par Socket.IO, relayés directement
d'un socket à la room sans transiter par l'API ni Valkey : perdre cet état
à la reconnexion n'a aucune conséquence.

## Conséquences

- `realtime` a maintenant besoin de la base de données (pour vérifier les
  appartenances) et de `BETTER_AUTH_SECRET` (pour authentifier les
  sockets), là où ce n'était qu'un healthcheck vide : voir les variables
  d'environnement déjà prévues dans `infra/docker-compose.yml` depuis le
  lot 2.
- Un événement mal formé publié sur Valkey (bug futur, panne partielle) est
  rejeté silencieusement par `realtime` (`chatEventSchema.safeParse`)
  plutôt que de faire planter le service : la perte d'un événement reste
  acceptable puisque le client peut toujours rattraper par REST, un crash
  du relais ne l'est pas.
- Ajouter un nouveau type d'événement temps réel demande de l'ajouter à
  `chatEventSchema` (`packages/shared`) : client et serveur partagent le
  même contrat, une variante oubliée d'un côté échoue au typage plutôt
  qu'au runtime.
