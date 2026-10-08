# 0001 — Choix de la pile technique

## Contexte

Le projet est construit par une petite équipe en quelques semaines, pour une
compétition où le jury lit le code. Il faut une pile simple à faire tourner
en local et sur un seul petit serveur, avec un typage fiable de bout en bout
entre le client et le serveur, et des licences compatibles avec les règles
de la compétition.

## Décision

Monorepo pnpm avec Turborepo pour l'orchestration des tâches (dev, build,
test, lint, typecheck). TypeScript strict partout, aucun `any` non justifié.

- `apps/web` : React et Vite, PWA installable via `vite-plugin-pwa`,
  Tailwind pour le style.
- `apps/server` : Fastify, avec trois points d'entrée distincts (`api`,
  `realtime`, `worker`) qui partagent le même code mais tournent comme des
  processus séparés. Socket.IO pour le temps réel, BullMQ pour les files de
  tâches.
- `packages/shared` : schémas Zod et types partagés entre le client et le
  serveur, pour qu'une réponse d'API soit validée des deux côtés avec la
  même définition.
- `packages/db` : schéma Drizzle et migrations pour PostgreSQL avec
  pgvector. Le schéma métier arrive au lot 3 ; ce paquet ne contient pour
  l'instant que la connexion.
- Vitest pour les tests unitaires et d'intégration, Playwright pour les
  parcours complets.
- Un script `licenses:check` qui échoue si une dépendance directe ou
  indirecte est sous GPL, AGPL ou LGPL, et qui génère
  `THIRD_PARTY_LICENSES.md`.

## Conséquences

- Le typage partagé via `packages/shared` évite une classe entière de bugs
  d'intégration entre le client et le serveur, au prix d'un paquet
  supplémentaire à maintenir.
- Trois points d'entrée serveur séparés demandent trois process en
  développement (géré par `concurrently` dans `pnpm dev`) et trois services
  Docker en production, mais permettent de monter en charge ou de redéployer
  chaque rôle indépendamment.
- Turborepo ajoute une étape d'apprentissage légère, mais évite d'écrire à
  la main l'orchestration des tâches entre les quatre paquets.
- `licenses:check` ralentit légèrement chaque exécution de CI, mais retire
  tout risque de merge accidentel d'une dépendance aux licences interdites.
