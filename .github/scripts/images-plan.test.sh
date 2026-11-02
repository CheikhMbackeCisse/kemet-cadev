#!/usr/bin/env bash
# Teste images-plan.sh et code-changes.sh sur un dépôt git jetable. Le faux
# `docker` ne connaît que les images des commits listés dans $BUILT, le faux
# `gh` ne voit une CI verte que pour les commits listés dans $CI_GREEN, et
# répond $HEAVY_PASSED jobs lourds réussis pour le run courant.
set -euo pipefail

plan="$(cd "$(dirname "$0")" && pwd)/images-plan.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir "$work/bin" "$work/repo"
cat > "$work/bin/docker" << 'EOF'
#!/usr/bin/env bash
[ -z "${REGISTRY_ERROR:-}" ] || { echo "$REGISTRY_ERROR" >&2; exit 1; }
grep -qx "${4##*:}" "$BUILT" || { echo "ERROR: ${4}: not found" >&2; exit 1; }
EOF
cat > "$work/bin/gh" << 'EOF'
#!/usr/bin/env bash
if [ "$2" = view ]; then
  echo "$HEAVY_PASSED"
  exit 0
fi
while [ "$1" != --commit ]; do shift; done
if grep -qx "$2" "$CI_GREEN"; then echo 1; else echo 0; fi
EOF
chmod +x "$work/bin/docker" "$work/bin/gh"
export PATH="$work/bin:$PATH" BUILT="$work/built" CI_GREEN="$work/ci-green" \
  IMAGE_PREFIX=ghcr.io/test/kemet EVENT=workflow_run REF=refs/heads/main RUN_ID=1 HEAVY_PASSED=0
: > "$BUILT"
: > "$CI_GREEN"

cd "$work/repo"
git init -q
git config user.email test@example.com
git config user.name test
git config core.autocrlf false

commit() {
  mkdir -p "$(dirname "$1")"
  echo "$RANDOM" >> "$1"
  git add "$1"
  git commit -q -m "$1"
  git rev-parse HEAD
}

built() {
  echo "$1" >> "$BUILT"
  echo "$1" >> "$CI_GREEN"
}

failures=0
report() {
  if [ "$2" = "$3" ]; then
    echo "ok - $1"
  else
    echo "not ok - $1 : obtenu [$2], attendu [$3]"
    failures=$((failures + 1))
  fi
}

# Résultat attendu : "build", "retag <source>" ou "échec".
expect() {
  local name=$1 sha=$2 expected=$3 got
  export GITHUB_OUTPUT="$work/output" RUN_SHA="$sha"
  : > "$GITHUB_OUTPUT"
  if bash "$plan" > /dev/null 2>&1; then
    got=$(sed -n 's/^mode=//p' "$GITHUB_OUTPUT")
    [ "$got" != retag ] || got="retag $(sed -n 's/^source=//p' "$GITHUB_OUTPUT")"
  else
    got=échec
  fi
  report "$name" "$got" "$expected"
}

commit README.md > /dev/null
code=$(commit apps/web/src/main.ts)
built "$code"
expect "un commit de code est construit" "$code" build

docs=$(commit docs/guide.md)
expect "un commit de documentation réétiquette le dernier commit construit" "$docs" "retag $code"

root_md=$(commit CHANGELOG.md)
expect "un .md de la racine est de la documentation" "$root_md" "retag $code"

nested=$(commit apps/web/NOTES.md)
expect "un .md sous apps/ entre dans l'image : construit" "$nested" build
built "$nested"

workflow=$(commit .github/workflows/ci.yml)
expect "un workflow modifié est construit" "$workflow" build
built "$workflow"

unbuilt=$(commit packages/db/src/schema.ts)
docs_after=$(commit docs/adr/0001.md)
expect "source sans images ni CI verte, jobs lourds sautés : échec" "$docs_after" échec

HEAVY_PASSED=4
expect "source sans images, jobs lourds passés sur ce commit (même push) : construit" \
  "$docs_after" build
HEAVY_PASSED=0

echo "$unbuilt" >> "$CI_GREEN"
expect "source sans images mais CI verte (Images de la source en retard) : construit" \
  "$docs_after" build

echo "$unbuilt" >> "$BUILT"
expect "images de la source publiées : réétiquette" "$docs_after" "retag $unbuilt"

export REGISTRY_ERROR="ERROR: unauthorized: authentication required"
expect "erreur du registre autre qu'une absence : échec" "$docs_after" échec
unset REGISTRY_ERROR

EVENT=workflow_dispatch REF=refs/heads/feature INPUT_SHA="$code"
expect "déclenchement manuel hors de main : échec" "$code" échec
EVENT=workflow_run REF=refs/heads/main

report "code-changes.sh ignore la documentation" \
  "$("$(dirname "$plan")/code-changes.sh" "$code" "$root_md")" ""
report "code-changes.sh garde le reste" \
  "$("$(dirname "$plan")/code-changes.sh" "$nested" "$unbuilt")" \
  "$(printf '%s\n' .github/workflows/ci.yml packages/db/src/schema.ts)"

[ "$failures" -eq 0 ]
