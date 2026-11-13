# Déploiement

Toute l'application tourne sur un seul serveur Datacloud, en
conteneurs Docker décrits par `infra/docker-compose.yml`. Seul Caddy est
exposé. Procédure complète : `docs/DEPLOIEMENT.md`. Décisions :
`docs/adr/0002-hebergement.md`, `docs/adr/0020-deploiement-production.md`.

```mermaid
flowchart TB
  user([Navigateur ou web app installée])
  gh[GitHub Actions : CI, Images, Backup]
  ghcr[(GHCR : images par commit)]
  llm[Gemini, Groq, OpenRouter]
  smtp[Serveur SMTP]
  offsite[(Artefacts du workflow Backup)]

  subgraph server[Serveur Datacloud, Ubuntu 24.04, ufw : 22, 80, 443]
    caddy[caddy : HTTPS automatique, en-têtes de sécurité]
    subgraph app[Réseau Docker interne]
      web[web : fichiers statiques de l'app, port 8080]
      api[api : Fastify, port 3001]
      realtime[realtime : Socket.IO, port 3002]
      worker[worker : BullMQ, port 3003]
      postgres[(postgres 16)]
      valkey[(valkey 8)]
    end
    uploads[(volume uploads)]
    pgdata[(volume postgres_data)]
    backup[infra/server/backup.sh : pg_dump et fichiers, chiffrés avec age]
  end

  user -- "HTTPS 443" --> caddy
  caddy -- "/" --> web
  caddy -- "/api/*" --> api
  caddy -- "/socket.io/*" --> realtime
  api --> postgres
  api -- "pub/sub, cache, budget OpenRouter, files" --> valkey
  realtime -- "abonnement pub/sub" --> valkey
  realtime --> postgres
  worker -- "files BullMQ" --> valkey
  worker --> postgres
  api --- uploads
  worker -- "nettoyage horaire des fichiers orphelins" --- uploads
  postgres --- pgdata
  api -- "chaîne de secours" --> llm
  api -- "vérification d'email" --> smtp
  backup --> postgres
  backup --> uploads

  gh -- "après une CI verte sur main" --> ghcr
  gh -- "infra/deploy.sh par SSH" --> server
  ghcr -- "docker compose pull" --> server
  gh -- "chaque nuit, clé SSH restreinte par backup-gate.sh" --> backup
  backup -- "fichiers .age" --> offsite
```

Ce que le schéma montre :

- **Un seul point d'entrée.** Caddy obtient seul son certificat Let's Encrypt
  pour `PUBLIC_HOST` ; `api`, `realtime`, `worker`, `postgres` et `valkey`
  n'ont aucun port publié.
- **Le temps réel passe par Valkey.** `api` publie un événement, `realtime`
  le relaie aux rooms Socket.IO authentifiées. Les deux processus se
  redémarrent indépendamment.
- **Déploiement par commit.** `infra/deploy.sh` télécharge les images d'un
  commit publiées sur GHCR, attend que chaque service soit sain, joue le test
  de fumée `@prod-smoke` et revient au commit précédent en cas d'échec. Avec
  `KEMET_BUILD_ON_SERVER=1`, il construit les images sur le serveur à la
  place, pour un commit qui n'a pas d'image publiée ; les mêmes vérifications
  suivent.
- **Sauvegardes chiffrées avant de quitter le serveur.** La clé privée `age`
  ne va jamais sur le serveur ; une restauration est jouée pour de vrai par
  le job CI `backup-restore`.

En production depuis le 07/11/2026 sur `kemetlabs.dev` (Ubuntu 24.04,
4 Go de mémoire). Les limites de mémoire de chaque service sont fixées dans
`infra/docker-compose.yml` ; la mémoire mesurée est dans
`docs/EXPLOITATION.md`.
