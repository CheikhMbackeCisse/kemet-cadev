#!/usr/bin/env bash
# Préparation d'un serveur Ubuntu neuf pour Kemet, à lancer une seule fois
# avec sudo, depuis la session de l'utilisateur qui déploiera :
#   sudo infra/server/setup.sh
# Garder une seconde session SSH ouverte pendant l'exécution, pour pouvoir
# corriger si la connexion par clé ne passait pas.
#
# Installe Docker (dépôt officiel), age (chiffrement des sauvegardes),
# ferme tous les ports entrants sauf 22, 80 et 443 avec ufw, et n'accepte
# plus que les connexions SSH par clé. Relancer le script ne casse rien.

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "À lancer avec sudo." >&2
  exit 1
fi

DEPLOY_USER=${SUDO_USER:?"À lancer avec sudo depuis le compte de déploiement, pas en root direct."}
DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)

# Couper l'authentification par mot de passe sans clé posée enfermerait
# dehors l'utilisateur qui lance ce script.
if [[ ! -s $DEPLOY_HOME/.ssh/authorized_keys ]]; then
  echo "Aucune clé dans $DEPLOY_HOME/.ssh/authorized_keys : poser la clé publique d'abord." >&2
  exit 1
fi

echo "Paquets système"
apt-get update -q
apt-get install -y -q ca-certificates curl git ufw age

if ! command -v docker > /dev/null; then
  echo "Docker (dépôt officiel, pas le paquet docker.io de la distribution)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker "$DEPLOY_USER"

echo "Pare-feu"
# Docker publie ses ports par ses propres règles iptables, sans passer par
# ufw : seul infra/docker-compose.yml décide de ce qui est exposé, et il ne
# publie que 80 et 443 (caddy) ; Mailpit, profil dev, reste lié à
# 127.0.0.1. ufw protège le reste de la machine.
ufw default deny incoming
ufw default allow outgoing
# Le port SSH réellement écouté, pas 22 supposé : sinon ufw fermerait la
# session en cours.
ssh_ports=$(sshd -T | awk '/^port /{print $2}')
if [[ -z $ssh_ports ]]; then
  echo "Port SSH introuvable (sshd -T) : pare-feu non activé." >&2
  exit 1
fi
for port in $ssh_ports; do
  ufw allow "$port/tcp"
done
ufw allow 80/tcp
# Pas de 443/udp : infra/docker-compose.yml ne publie Caddy qu'en TCP,
# HTTP/3 n'est donc pas servi.
ufw allow 443/tcp
ufw --force enable

echo "SSH par clé uniquement"
cat > /etc/ssh/sshd_config.d/10-kemet.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sshd -t
systemctl reload ssh

echo "Dossiers de l'application et des sauvegardes"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/kemet
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 /var/backups/kemet

echo "Terminé. Se reconnecter pour que l'appartenance au groupe docker prenne effet."
