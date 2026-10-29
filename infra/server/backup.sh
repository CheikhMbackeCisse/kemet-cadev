#!/usr/bin/env bash
# Sauvegarde chiffrée de la base PostgreSQL et des fichiers envoyés.
# Usage (depuis la racine du dépôt, sur le serveur) : infra/server/backup.sh
#
# Écrit deux fichiers dans BACKUP_DIR et affiche leurs chemins, un par ligne :
#   kemet-<horodatage>.dump.age          pg_dump au format custom
#   kemet-<horodatage>.uploads.tar.age   contenu du volume des fichiers envoyés
# Chiffrés avec age pour la clé publique BACKUP_AGE_RECIPIENT (.env) : la
# clé privée ne vit jamais sur le serveur, une copie volée est illisible.
# Les sauvegardes locales de plus de BACKUP_RETENTION_DAYS jours sont
# supprimées ; la copie hors du serveur est faite par le workflow Backup.

set -euo pipefail

# shellcheck source=infra/server/compose.sh
. infra/server/compose.sh

BACKUP_DIR=${BACKUP_DIR:-/var/backups/kemet}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
recipient=$(env_value BACKUP_AGE_RECIPIENT)
if [[ -z $recipient ]]; then
  echo "BACKUP_AGE_RECIPIENT manquant dans .env" >&2
  exit 1
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
dump=$BACKUP_DIR/kemet-$stamp.dump.age
uploads=$BACKUP_DIR/kemet-$stamp.uploads.tar.age

mkdir -p "$BACKUP_DIR"

# Écrire dans un fichier temporaire puis renommer : une sauvegarde
# interrompue ne laisse jamais un fichier tronqué sous un nom valide. Les
# variables entre apostrophes sont celles du conteneur, pas de ce shell.
compose exec -T postgres sh -c 'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | age -r "$recipient" > "$dump.partial"
mv "$dump.partial" "$dump"

compose exec -T api sh -c 'tar -C "$UPLOADS_DIR" -cf - .' \
  | age -r "$recipient" > "$uploads.partial"
mv "$uploads.partial" "$uploads"

find "$BACKUP_DIR" -name 'kemet-*.age' -mtime +"$BACKUP_RETENTION_DAYS" -delete

echo "$dump"
echo "$uploads"
