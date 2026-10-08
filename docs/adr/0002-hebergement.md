# 0002 — Hébergement et déploiement

## Contexte

Le projet vise un seul serveur Datacloud (Ubuntu, 2 vCPU, 4 Go de RAM, 80 Go
de SSD), fourni par Systalink pendant la compétition. Pas d'équipe
infrastructure : le déploiement doit être reproductible par une seule
personne, à la main ou par un script, sans connaissance préalable de
Kubernetes ou d'un orchestrateur lourd.

## Décision

Tout tourne en conteneurs Docker sur ce serveur unique, orchestrés par
Docker Compose (`infra/docker-compose.yml`), pas par un orchestrateur
séparé : à cette échelle (un seul hôte), Compose suffit et reste lisible
par une petite équipe.

**Services :**

| Service | Rôle | Image |
| --- | --- | --- |
| `caddy` | Reverse proxy, HTTPS automatique | `caddy:2-alpine` |
| `web` | Fichiers statiques de `apps/web` | construite depuis `apps/web/Dockerfile` |
| `api` | Point d'entrée `api` de `apps/server` | construite depuis `apps/server/Dockerfile`, cible `api` |
| `realtime` | Point d'entrée `realtime` de `apps/server` | même Dockerfile, cible `realtime` |
| `worker` | Point d'entrée `worker` de `apps/server` | même Dockerfile, cible `worker` |
| `postgres` | Base de données | `postgres:16-alpine` |
| `valkey` | Cache, pub/sub Socket.IO, files BullMQ | `valkey/valkey:8-alpine` |

`api`, `realtime` et `worker` partagent un seul Dockerfile multi-étapes
(`apps/server/Dockerfile`) : une étape de build commune compile
`@kemet/shared`, `@kemet/db` et `@kemet/server`, puis `pnpm deploy --prod`
produit un dossier autonome avec seulement les dépendances de production.
Trois étapes finales, identiques à part leur commande de démarrage,
évitent de dupliquer la logique de build pour trois images qui ne diffèrent
que par le point d'entrée lancé.

**Routage (`infra/Caddyfile`) :** `/api/*` vers `api`, `/socket.io/*` vers
`realtime` (WebSocket compris, Caddy le gère sans configuration
supplémentaire), `/realtime/health` vers `realtime` pour que la page
d'accueil temporaire puisse vérifier son état depuis le navigateur, tout le
reste vers `web`. `worker` n'est joignable que depuis l'intérieur du réseau
Docker : il n'a pas de route publique, seul son `HEALTHCHECK` Docker le
surveille.

**HTTPS :** une seule variable, `PUBLIC_HOST`, pilote l'adresse d'écoute de
Caddy. En local, `PUBLIC_HOST=:80` fait écouter Caddy en HTTP simple, sans
certificat. En production, `PUBLIC_HOST` prend le sous-domaine fourni par
Datacloud ou, à défaut de domaine propre, un nom `sslip.io` (qui encode
l'IP du serveur, ex. `203-0-113-10.sslip.io`) : Caddy détecte alors un
domaine réel et obtient seul un certificat Let's Encrypt, sans aucune autre
variable à régler.

**Mémoire :** limite par service posée dans `docker-compose.yml`
(`deploy.resources.limits.memory`, honoré par `docker compose up` même hors
Swarm depuis Compose V2). Budget total des sept services : 2,496 Go,
volontairement sous le plafond de 3,2 Go fixé pour laisser une marge, sur
les 4 Go du serveur (le reste pour le système). Répartition : Postgres
1024M (le plus gros consommateur, pour ses buffers), API 448M, realtime et
worker 320M chacun, Valkey 256M, Caddy et web statique 64M chacun.

**Volumes persistants :** `postgres_data` pour les données de la base,
`uploads` pour les fichiers envoyés par les utilisateurs (montée dans `api`
et `worker`, chemin donné par `UPLOADS_DIR`), `caddy_data` et
`caddy_config` pour que les certificats survivent à un redéploiement.

**Licences des images tierces :**

| Image | Licence |
| --- | --- |
| `caddy:2-alpine` | Apache 2.0 |
| `postgres:16-alpine` | Licence PostgreSQL |
| `valkey/valkey:8-alpine` | BSD-3 (pas Redis 8, dont la licence a changé) |
| `node:22-alpine` | MIT (Node.js), Alpine (MIT/BSD) |

Aucune de ces images ni leurs dépendances de base ne porte de licence
GPL, AGPL ou LGPL.

**Déploiement (`infra/deploy.sh`) :** script par SSH qui se connecte au
serveur, met à jour le dépôt (`git fetch` puis `reset --hard origin/main`),
reconstruit et redémarre les services (`docker compose up -d --build`),
puis nettoie les images devenues inutiles. Pas de migration de base de
données pour l'instant : `packages/db` n'a encore aucun schéma (lot 3).

**Vérification continue :** la pile complète (construction des images,
santé des sept services, mémoire totale) est vérifiée à chaque pull
request et sur `main` par le job CI `infra-smoke`
(`.github/workflows/ci.yml`), plutôt qu'à la main en local : la machine de
développement utilisée pour poser ce lot n'avait pas Docker installé.

## Conséquences

- Un seul hôte, un seul point de panne : acceptable pour une compétition
  avec un budget serveur limité, à revoir si Kemet devait grandir après.
- `docker compose up -d --build` reconstruit les images sur le serveur de
  production lui-même : pas de registre d'images à héberger ni de
  CI/CD de build séparée, au prix d'un temps de déploiement un peu plus
  long et d'un besoin de RAM/CPU pendant le build (surveillé).
- Le budget mémoire serré (3,2 Go pour sept services sur 4 Go de RAM) laisse
  peu de marge pour la croissance : un futur ajustement (par exemple
  réduire le nombre de connexions simultanées PostgreSQL, ou augmenter la
  limite de `worker` si des tâches lourdes apparaissent) devra rester dans
  cette enveloppe tant que le serveur n'est pas changé.
- Pas de registre de conteneurs ni de sauvegarde automatisée de
  `postgres_data` pour l'instant : à poser avant la mise en production
  réelle, hors périmètre de ce lot.
