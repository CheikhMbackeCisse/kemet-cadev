# 0020 : Déploiement de production, sauvegardes et retour arrière

## Contexte

L'ADR 0002 posait un déploiement qui reconstruisait les images sur le
serveur (`git pull` puis `docker compose up --build`). Trois défauts pour la
production :

- le serveur de 4 Go doit installer toutes les dépendances du monorepo et
  compiler pendant que l'application tourne à côté ;
- l'image qui tourne en production n'est pas celle que la CI a testée ;
- aucun retour arrière : si la nouvelle version ne démarre pas, le site
  reste en panne jusqu'à une correction.

Il fallait aussi des sauvegardes copiées hors du serveur, et dont la
restauration est prouvée, pas seulement supposée.

## Décision

**Images construites par la CI.** Le workflow `Images` ne se déclenche
qu'après un workflow `CI` vert sur un push de `main`, et publie quatre
images sur GHCR, étiquetées par le SHA du commit. Le dépôt et ses paquets
restent privés. Le Container registry est aujourd'hui gratuit chez GitHub,
paquets privés compris : le plafond de 500 Mo de l'offre gratuite ne
s'applique qu'aux artefacts et aux autres registres de paquets. Le
workflow purge quand même les anciennes versions (job `prune`, par l'API
GitHub et le `GITHUB_TOKEN`, sans action tierce), au cas où cette gratuité
changerait : une version étiquetée n'est supprimée que hors des 10 plus
récentes et sans mise à jour depuis 30 jours, jamais celle de `main`. Les
images sont publiées sans attestation de provenance (`provenance: false`),
une seule version par commit : on perd la preuve signée du workflow qui a
construit l'image, acceptable pour des paquets privés.
`infra/docker-compose.yml` garde `build` pour le local et la CI, et gagne
`image` : `KEMET_IMAGE_PREFIX` et `KEMET_IMAGE_TAG` choisissent l'image
téléchargée en production.

**Retour arrière automatique.** `infra/deploy.sh` attend que tous les
services soient `healthy` (`docker compose up --wait`), puis joue un test de
fumée Playwright en lecture seule contre l'adresse publique. Si l'une des
deux étapes échoue, il redéploie le commit précédent, noté dans
`.deploy-history` sur le serveur. Les migrations ne sont pas annulées : elles
doivent rester additives pour que la version précédente tourne sur le
nouveau schéma.

**Durcissement du serveur.** `infra/server/setup.sh` : ufw ne laisse
entrer que 22, 80 et 443, SSH par clé uniquement. Docker contourne ufw pour
les ports qu'il publie : c'est donc `infra/docker-compose.yml` qui garantit
qu'aucun autre port n'est publié (seul Caddy publie 80 et 443, Mailpit
n'existe que dans le profil `dev`).

**Sauvegardes chiffrées hors du serveur.** `pg_dump` et une archive des
fichiers envoyés, chiffrés avec `age` (licence BSD-3-Clause, outil système
installé sur le serveur, pas une dépendance du projet) pour une clé publique.
La clé privée ne va jamais sur le serveur : une restauration déchiffre sur le poste de l'administrateur et envoie le flux par SSH. Le workflow `Backup` les rapatrie
chaque nuit en artefact GitHub, gardé 14 jours : hors du serveur, gratuit, et
illisible sans la clé. Le job CI `backup-restore` sauvegarde une pile
complète, modifie les données, restaure et vérifie l'état restauré, à chaque
pull request.

**Supervision.** Sonde externe gratuite (UptimeRobot) sur `/` et
`/api/health`, plutôt qu'un service de supervision de plus sur un serveur
de 4 Go.

## Conséquences

- Un déploiement ne peut viser qu'un commit de `main` dont la CI est verte :
  aucune image n'existe pour les autres.
- Une commande `docker compose` lancée à la main sur le serveur doit lire
  `.env.deployed`, qui porte le commit déployé. `infra/server/compose.sh`
  le fait pour les scripts du serveur.
- Le serveur se connecte à GHCR avec un jeton en lecture seule
  (`read:packages`), et clone le dépôt avec une clé de déploiement en
  lecture seule.
- Un retour arrière vers un commit de plus de 30 jours, hors des 10
  derniers, peut ne plus trouver son image. Le point de terminaison
  `/users/` de la purge devra devenir `/orgs/` si le dépôt passe dans une
  organisation.
- Les artefacts, eux, comptent dans les 500 Mo : rapports Playwright gardés
  7 jours, sauvegardes 14 jours (environ 4 Mo chacune avec les données de
  démonstration).
- La clé SSH du workflow `Backup` est limitée par une commande forcée
  (`infra/server/backup-gate.sh`) et ses secrets vivent dans un environnement
  GitHub réservé à `main` : le compte de déploiement est dans le groupe
  `docker`, une clé qui ouvrirait un shell serait un accès root.
- Perdre la clé privée `age` rend toutes les sauvegardes inutilisables :
  l'administrateur la garde en deux exemplaires hors du dépôt.
- Le test de fumée ne couvre que la lecture. Les parcours qui écrivent
  (inscription, message, image, @kemet) sont vérifiés à la main en
  production, pour ne pas remplir la base de comptes de test.
