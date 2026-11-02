#!/usr/bin/env bash
# Choisit ce que fait le workflow Images pour un commit de main : construire
# ses images, ou réétiqueter celles du dernier commit construit si le commit
# ne touche que la documentation. Écrit sha, mode et source dans
# $GITHUB_OUTPUT.
#
# Entrées (variables d'environnement) : EVENT, REF, INPUT_SHA
# (workflow_dispatch), RUN_SHA et RUN_ID (workflow_run), IMAGE_PREFIX
# (ghcr.io/<propriétaire>/<dépôt>).
set -euo pipefail

scripts="$(cd "$(dirname "$0")" && pwd)"
heavy_jobs='"integration-tests", "e2e-tests", "infra-smoke", "backup-restore"'

output() {
  echo "$1=$2" >> "$GITHUB_OUTPUT"
}

build() {
  output mode build
  exit 0
}

require_sha() {
  [[ $1 =~ ^[0-9a-f]{40}$ ]] || { echo "SHA complet de 40 caractères attendu : $1" >&2; exit 1; }
}

ci_green_on_main() {
  local count
  count=$(gh run list --workflow ci.yml --commit "$1" --event push \
    --json conclusion --jq 'map(select(.conclusion == "success")) | length')
  [ "$count" -gt 0 ]
}

if [ "$EVENT" = workflow_dispatch ]; then
  # Le fichier de workflow exécuté est celui de la branche choisie au
  # lancement : seul celui de main fait foi.
  [ "$REF" = refs/heads/main ] || { echo "Lancer ce workflow depuis main, pas ${REF}." >&2; exit 1; }
  sha="$INPUT_SHA"
  require_sha "$sha"
  git merge-base --is-ancestor "$sha" origin/main ||
    { echo "${sha} n'est pas un commit de main." >&2; exit 1; }
  ci_green_on_main "$sha" || { echo "Aucun run CI vert sur main pour ${sha}." >&2; exit 1; }
  output sha "$sha"
  build
fi

sha="$RUN_SHA"
require_sha "$sha"
output sha "$sha"

changed=$("$scripts/code-changes.sh" "${sha}^" "$sha")
[ -z "$changed" ] || build

source=$(git log -1 --format=%H "${sha}^" -- . ':(exclude,glob)*.md' ':(exclude)docs')
require_sha "$source"

missing=false
for service in web api realtime worker; do
  if error=$(docker buildx imagetools inspect "${IMAGE_PREFIX}-${service}:${source}" 2>&1 > /dev/null); then
    continue
  fi
  # Une image absente se rattrape ; une autre erreur du registre (droits,
  # réseau) ne doit pas passer pour une absence.
  grep -qiE 'not found|manifest unknown' <<< "$error" || { echo "$error" >&2; exit 1; }
  missing=true
done

if [ "$missing" = false ]; then
  output mode retag
  output source "$source"
  exit 0
fi

# Les images de la source manquent quand elle est arrivée dans le même push
# que ce commit, ou quand son propre run Images n'a pas abouti. Reconstruire
# ce commit n'est sûr que si son code a passé la pile complète : soit la CI
# de la source est verte, soit celle de ce commit a fait tourner les jobs
# lourds (le push couvrait alors aussi la source).
heavy_passed=$(gh run view "$RUN_ID" --json jobs --jq \
  "[.jobs[] | select((.name | IN(${heavy_jobs})) and .conclusion == \"success\")] | length")
if [ "$heavy_passed" -eq 4 ] || ci_green_on_main "$source"; then
  echo "Images de ${source} introuvables : reconstruction de ${sha}."
  build
fi

echo "Images de ${source} introuvables et son code n'a pas passé la CI complète." >&2
echo "Relancer ce run une fois la CI de ${source} verte (gh run rerun)." >&2
exit 1
