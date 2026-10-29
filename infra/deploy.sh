#!/usr/bin/env bash
# Déploiement sur le serveur Datacloud par SSH, à partir des images publiées
# sur GHCR par le workflow Images (.github/workflows/images.yml).
#
# Usage : infra/deploy.sh <utilisateur@hôte> <adresse publique> [commit]
#   <adresse publique>  ex. https://kemet.example.com, sert au test de fumée
#   [commit]            SHA complet d'un commit de main ; par défaut origin/main
#
# Variables facultatives :
#   KEMET_REMOTE_PATH   chemin du dépôt sur le serveur (défaut /opt/kemet)
#   SKIP_SMOKE=1        ne pas lancer le test de fumée Playwright
#
# Ordre des opérations : téléchargement des images (le service en place
# continue de tourner si ça échoue), redémarrage avec attente de l'état
# healthy, test de fumée contre l'adresse publique. Si l'une des deux
# dernières étapes échoue, retour au commit déployé précédemment.

set -euo pipefail

REMOTE=${1:?"usage: infra/deploy.sh <utilisateur@hôte> <adresse publique> [commit]"}
PUBLIC_URL=${2:?"usage: infra/deploy.sh <utilisateur@hôte> <adresse publique> [commit]"}
REMOTE_PATH=${KEMET_REMOTE_PATH:-/opt/kemet}
COMMIT_PATTERN='^[0-9a-f]{40}$'

if [[ ! $PUBLIC_URL =~ ^https:// ]]; then
  echo "Adresse publique invalide : $PUBLIC_URL (https:// attendu)" >&2
  exit 1
fi
if [[ ! $REMOTE_PATH =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "Chemin distant invalide : $REMOTE_PATH" >&2
  exit 1
fi

if [[ -n ${3:-} ]]; then
  COMMIT=$3
else
  git fetch --quiet origin main
  COMMIT=$(git rev-parse origin/main)
fi

if [[ ! $COMMIT =~ $COMMIT_PATTERN ]]; then
  echo "Commit invalide : $COMMIT (SHA complet de 40 caractères attendu)" >&2
  exit 1
fi

# Exécuté sur le serveur. Sous-commandes :
#   activate <commit>  aligne le dépôt sur ce commit et démarre ses images
#   previous <commit>  affiche le dernier commit déployé autre que celui-ci
remote() {
  # ssh recolle les arguments en une chaîne que le shell distant relit :
  # printf %q les protège.
  ssh "$REMOTE" "bash -s -- $(printf '%q ' "$REMOTE_PATH" "$@")" <<'REMOTE_SCRIPT'
set -euo pipefail
REMOTE_PATH=$1
ACTION=$2
cd "$REMOTE_PATH"

case $ACTION in
  activate)
    COMMIT=$3
    git fetch --quiet origin
    git checkout --quiet --detach "$COMMIT"
    echo "KEMET_IMAGE_TAG=$COMMIT" > .env.deployed
    . infra/server/compose.sh
    echo "Téléchargement des images de $COMMIT"
    compose pull --quiet
    echo "Redémarrage des services"
    # Les migrations Drizzle tournent au démarrage de l'api
    # (apps/server/src/api/main.ts) : --wait couvre aussi leur succès.
    compose up -d --no-build --wait --wait-timeout 180
    if [[ $(tail -n 1 .deploy-history 2>/dev/null) != "$COMMIT" ]]; then
      echo "$COMMIT" >> .deploy-history
    fi
    docker image prune -f > /dev/null
    compose ps
    ;;
  previous)
    grep -vx "$3" .deploy-history 2>/dev/null | tail -n 1 || true
    ;;
esac
REMOTE_SCRIPT
}

rollback() {
  local previous
  previous=$(remote previous "$COMMIT")
  if [[ -z $previous ]]; then
    echo "Aucun déploiement précédent connu : pas de retour arrière possible." >&2
    exit 1
  fi
  if [[ ! $previous =~ $COMMIT_PATTERN ]]; then
    echo "Commit précédent illisible dans .deploy-history : $previous" >&2
    exit 1
  fi
  echo "Retour arrière vers $previous" >&2
  remote activate "$previous"
  exit 1
}

echo "Déploiement de $COMMIT sur $REMOTE:$REMOTE_PATH"
if ! remote activate "$COMMIT"; then
  echo "Les services ne sont pas devenus sains." >&2
  rollback
fi

if [[ ${SKIP_SMOKE:-} != 1 ]]; then
  echo "Test de fumée contre $PUBLIC_URL"
  if ! PLAYWRIGHT_BASE_URL=$PUBLIC_URL pnpm --filter @kemet/web exec \
    playwright test --grep @prod-smoke --project desktop; then
    echo "Le test de fumée a échoué." >&2
    rollback
  fi
fi

echo "Déploiement terminé : $COMMIT"
