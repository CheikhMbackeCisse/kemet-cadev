# Fonctions partagées par les scripts de infra/server/, à sourcer depuis la
# racine du dépôt.

# .env.deployed (écrit par infra/deploy.sh) porte KEMET_IMAGE_TAG, le commit
# déployé : sans lui, une commande lancée à la main sur le serveur
# chercherait les images kemet-<service>:local, qui n'y existent pas.
compose() {
  local env_files=(--env-file .env)
  if [[ -f .env.deployed ]]; then
    env_files+=(--env-file .env.deployed)
  fi
  docker compose -f infra/docker-compose.yml "${env_files[@]}" "$@"
}

# Lit une variable de .env sans le sourcer : une valeur comme
# EMAIL_FROM=Kemet <kemet@example.com> serait interprétée par le shell.
env_value() {
  grep -E "^$1=" .env | tail -n 1 | cut -d= -f2-
}
