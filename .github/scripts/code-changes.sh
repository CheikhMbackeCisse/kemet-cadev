#!/usr/bin/env bash
# Liste les fichiers modifiés entre deux commits ($1 et $2) qui ne sont pas de
# la documentation. Documentation : les *.md de la racine et docs/, que
# .dockerignore exclut des images ; un .md sous apps/ entre dans l'image et
# compte donc comme du code. Seule définition partagée par ci.yml et
# images.yml, pour que la CI ne saute jamais les tests d'un commit
# qu'Images construit.
set -euo pipefail

# Liste lue d'abord, filtrée ensuite : sous pipefail, un `grep -q` en bout de
# tube peut tuer l'amont par SIGPIPE, et un `|| true` sur le tube entier
# masquerait un échec de git.
files=$(git diff --name-only "$1" "$2")
grep -vE '^$|^[^/]+\.md$|^docs/' <<< "$files" || true
