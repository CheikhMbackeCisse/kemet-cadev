#!/usr/bin/env bash
# Restauration d'une sauvegarde produite par infra/server/backup.sh, lue sur
# l'entrée standard déjà déchiffrée. Le déchiffrement se fait sur le poste
# de l'administrateur : la clé privée age ne va jamais sur le serveur.
#
#   age -d -i kemet-backup.key kemet-<date>.dump.age \
#     | ssh <serveur> 'cd /opt/kemet && infra/server/restore.sh --confirm database'
#   age -d -i kemet-backup.key kemet-<date>.uploads.tar.age \
#     | ssh <serveur> 'cd /opt/kemet && infra/server/restore.sh --confirm uploads'
#
# REMPLACE le contenu de la base ou des fichiers envoyés de la pile en
# cours. En production, ne jamais lancer sans accord explicite.
# --confirm est obligatoire pour qu'une faute de frappe ne suffise pas.

set -euo pipefail

usage="usage: <flux déchiffré> | infra/server/restore.sh --confirm database|uploads"
if [[ $# -ne 2 || $1 != --confirm || ! $2 =~ ^(database|uploads)$ ]]; then
  echo "$usage" >&2
  exit 1
fi
TARGET=$2

# shellcheck source=infra/server/compose.sh
. infra/server/compose.sh

echo "Arrêt des services qui écrivent dans la base et les fichiers" >&2
compose stop api realtime worker < /dev/null >&2
# Redémarrer aussi en cas d'échec : la restauration ratée n'a rien changé
# (transaction annulée, fichiers en place intacts), le site doit revenir.
trap 'echo "Redémarrage des services" >&2; compose up -d --no-build --wait --wait-timeout 180 >&2' EXIT

case $TARGET in
  database)
    echo "Restauration de la base" >&2
    # --single-transaction : un flux tronqué (mauvaise clé, coupure SSH)
    # annule tout, la base reste dans son état d'avant.
    compose exec -T postgres sh -c \
      'pg_restore --clean --if-exists --no-owner --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    ;;
  uploads)
    echo "Restauration des fichiers envoyés" >&2
    # api est arrêté : un conteneur jetable de la même image monte le même
    # volume. L'archive est d'abord écrite dans le volume, vérifiée, puis
    # extraite à côté : les fichiers en place ne sont remplacés qu'une fois
    # l'extraction réussie. age chiffre sans authentifier l'émetteur : une
    # archive qui sortirait du volume par un chemin absolu ou ".." est refusée.
    compose run --rm -T --no-deps --entrypoint sh api -c '
      set -eu
      staging="$UPLOADS_DIR/.restore"
      rm -rf "$staging" "$UPLOADS_DIR/.restore.tar"
      cat > "$UPLOADS_DIR/.restore.tar"
      if tar -tf "$UPLOADS_DIR/.restore.tar" | grep -qE "^/|(^|/)\.\.(/|$)"; then
        echo "Archive refusée : chemin hors du dossier." >&2
        rm -f "$UPLOADS_DIR/.restore.tar"
        exit 1
      fi
      mkdir "$staging"
      tar -C "$staging" -xf "$UPLOADS_DIR/.restore.tar"
      rm "$UPLOADS_DIR/.restore.tar"
      find "$UPLOADS_DIR" -mindepth 1 -maxdepth 1 ! -name .restore -exec rm -rf {} +
      find "$staging" -mindepth 1 -maxdepth 1 -exec mv {} "$UPLOADS_DIR/" \;
      rmdir "$staging"
    '
    ;;
esac
