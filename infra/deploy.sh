#!/usr/bin/env bash
# Déploiement sur le serveur Datacloud par SSH.
# Usage : infra/deploy.sh <utilisateur@hôte> [chemin distant]
# Le chemin distant par défaut suppose un dépôt déjà cloné une première fois
# à la main (voir docs/DEPLOIEMENT.md, étape "premier déploiement").

set -euo pipefail

REMOTE=${1:?"usage: infra/deploy.sh <utilisateur@hôte> [chemin distant]"}
REMOTE_PATH=${2:-/opt/kemet}

echo "Déploiement sur $REMOTE:$REMOTE_PATH"

ssh "$REMOTE" bash -s "$REMOTE_PATH" <<'REMOTE_SCRIPT'
set -euo pipefail
REMOTE_PATH=$1
cd "$REMOTE_PATH"

echo "Mise à jour du dépôt"
git fetch origin
git checkout main
git reset --hard origin/main

echo "Construction et démarrage des services"
docker compose -f infra/docker-compose.yml --env-file .env up -d --build

# Pas de schéma ni de migration avant le lot 3 (authentification et
# profils) : cette étape rejoindra ce script quand packages/db en aura une.

echo "Nettoyage des images inutilisées"
docker image prune -f

echo "État des services"
docker compose -f infra/docker-compose.yml --env-file .env ps
REMOTE_SCRIPT

echo "Déploiement terminé."
