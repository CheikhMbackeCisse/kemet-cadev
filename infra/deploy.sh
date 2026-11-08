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
#   KEMET_BUILD_ON_SERVER=1
#                       procédure de secours : construit les images sur le
#                       serveur au lieu de les télécharger depuis GHCR. Le
#                       commit peut alors être celui de n'importe quelle
#                       branche poussée. Voir docs/DEPLOIEMENT.md.
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

BUILD_ON_SERVER=${KEMET_BUILD_ON_SERVER:-0}
if [[ $BUILD_ON_SERVER != 0 && $BUILD_ON_SERVER != 1 ]]; then
  echo "KEMET_BUILD_ON_SERVER invalide : $BUILD_ON_SERVER (0 ou 1 attendu)" >&2
  exit 1
fi

if [[ ! $COMMIT =~ $COMMIT_PATTERN ]]; then
  echo "Commit invalide : $COMMIT (SHA complet de 40 caractères attendu)" >&2
  exit 1
fi

# Exécuté sur le serveur. Sous-commandes :
#   activate <commit> <0|1>
#                      aligne le dépôt sur ce commit et démarre ses images,
#                      téléchargées (0) ou construites sur place (1)
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
    BUILD=$4
    git fetch --quiet origin
    git checkout --quiet --detach "$COMMIT"
    . infra/server/compose.sh
    if [[ $BUILD == 1 ]]; then
      # Préfixe à part : une image construite ici ne passe jamais pour une
      # image de GHCR.
      # Un service à la fois : la pile tourne pendant la construction et le
      # serveur n'a pas de swap. api, realtime et worker partagent les
      # premières étapes de leur Dockerfile, construites une seule fois.
      # .env.deployed n'est réécrit qu'une fois tout construit : un échec
      # laisse les commandes manuelles sur les images en place.
      for service in api realtime worker web; do
        echo "Construction de $service ($COMMIT)"
        KEMET_IMAGE_PREFIX=kemet-local KEMET_IMAGE_TAG=$COMMIT compose build --quiet "$service"
      done
      printf 'KEMET_IMAGE_PREFIX=kemet-local\nKEMET_IMAGE_TAG=%s\n' "$COMMIT" > .env.deployed
    else
      echo "KEMET_IMAGE_TAG=$COMMIT" > .env.deployed
      echo "Téléchargement des images de $COMMIT"
      compose pull --quiet
    fi
    echo "Redémarrage des services"
    # Les migrations Drizzle tournent au démarrage de l'api
    # (apps/server/src/api/main.ts) : --wait couvre aussi leur succès.
    compose up -d --no-build --wait --wait-timeout 180
    # .deploy-history sert au retour arrière, qui télécharge depuis GHCR :
    # un commit construit ici n'y a pas d'image et n'y est pas noté.
    if [[ $BUILD != 1 && $(tail -n 1 .deploy-history 2>/dev/null) != "$COMMIT" ]]; then
      echo "$COMMIT" >> .deploy-history
    fi
    # Garde seulement les images construites ici pour le commit en ligne.
    docker images --format '{{.Repository}}:{{.Tag}}' \
      | grep -E '^kemet-local-' | grep -v ":$COMMIT$" | xargs -r docker image rm > /dev/null || true
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
  remote activate "$previous" 0
  exit 1
}

if [[ $BUILD_ON_SERVER == 1 ]]; then
  echo "Déploiement de $COMMIT sur $REMOTE:$REMOTE_PATH, images construites sur le serveur"
else
  echo "Déploiement de $COMMIT sur $REMOTE:$REMOTE_PATH"
fi
if ! remote activate "$COMMIT" "$BUILD_ON_SERVER"; then
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
