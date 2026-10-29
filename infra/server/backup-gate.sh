#!/usr/bin/env bash
# Commande forcée de la clé SSH du workflow Backup, posée dans
# authorized_keys avec :
#   restrict,command="/opt/kemet/infra/server/backup-gate.sh" ssh-ed25519 AAAA...
#
# Le compte de déploiement est dans le groupe docker, donc équivalent à root :
# un shell complet pour cette clé, stockée dans les secrets GitHub, serait un
# accès root au serveur. Elle ne peut que lancer une sauvegarde et lire une
# sauvegarde, rien d'autre.
#   backup          lance infra/server/backup.sh, affiche les chemins produits
#   fetch <chemin>  écrit sur la sortie standard un fichier de sauvegarde

set -euo pipefail

BACKUP_FILE_PATTERN='^/var/backups/kemet/kemet-[0-9]{8}T[0-9]{6}Z\.(dump|uploads\.tar)\.age$'

read -r action argument extra <<< "${SSH_ORIGINAL_COMMAND:-}"

if [[ -n ${extra:-} ]]; then
  echo "Commande refusée." >&2
  exit 1
fi

case $action in
  backup)
    if [[ -n ${argument:-} ]]; then
      echo "Commande refusée." >&2
      exit 1
    fi
    cd /opt/kemet
    exec infra/server/backup.sh
    ;;
  fetch)
    if [[ ! ${argument:-} =~ $BACKUP_FILE_PATTERN ]]; then
      echo "Chemin refusé." >&2
      exit 1
    fi
    exec cat -- "$argument"
    ;;
  *)
    echo "Commande refusée." >&2
    exit 1
    ;;
esac
