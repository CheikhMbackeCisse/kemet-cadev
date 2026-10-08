# Déploiement

Ce document explique comment faire tourner Kemet avec Docker, en local pour
tester, puis sur le serveur Datacloud de production. Écrit pour quelqu'un qui
n'a jamais déployé ce projet.

Voir `docs/adr/0002-hebergement.md` pour le pourquoi des choix décrits ici.

Il faut Docker avec le plugin Compose (`docker compose version` doit
répondre ; sur Ubuntu, le dépôt officiel de Docker plutôt que le paquet
`docker.io`) et le dépôt cloné.

## Local : tester en une fois

Cette vérification tourne aussi automatiquement à chaque pull request et
sur `main`, dans le job CI `infra-smoke` (`.github/workflows/ci.yml`) :
les étapes ci-dessous servent à la reproduire sur son propre poste, par
exemple pour déboguer un échec de ce job.

1. Copier le fichier d'exemple et laisser les valeurs par défaut pour un
   essai local :

   ```
   cp .env.example .env
   ```

   `PUBLIC_HOST=:80` par défaut : Caddy écoute en HTTP simple sur le port 80
   de la machine, pas de certificat à gérer pour tester.

2. Construire les images et démarrer tous les services :

   ```
   docker compose -f infra/docker-compose.yml --env-file .env up -d --build
   ```

   La première fois, la construction des images peut prendre plusieurs
   minutes (installation des dépendances du monorepo). Les fois suivantes
   sont plus rapides grâce au cache Docker.

3. Vérifier que tout a démarré et que chaque service est en bonne santé :

   ```
   docker compose -f infra/docker-compose.yml --env-file .env ps
   ```

   Chaque ligne doit afficher `healthy` dans la colonne d'état. Si un
   service reste `starting` plus d'une minute ou passe à `unhealthy`,
   regarder ses journaux (étape suivante) avant d'aller plus loin.

4. Ouvrir `http://localhost` dans un navigateur : la page d'accueil de
   Kemet s'affiche. `curl http://localhost/api/health` et
   `curl http://localhost/realtime/health` vérifient `api` et `realtime` à
   travers Caddy. Le service `worker` n'a pas d'adresse HTTP ; son état se
   vérifie avec la commande `ps` ci-dessus ou avec ses journaux.

5. Lire les journaux d'un service en particulier :

   ```
   docker compose -f infra/docker-compose.yml --env-file .env logs -f api
   ```

   (remplacer `api` par `web`, `realtime`, `worker`, `postgres`, `valkey`
   ou `caddy`).

6. Vérifier la mémoire réellement utilisée par chaque service :

   ```
   docker stats --no-stream
   ```

   La colonne `MEM USAGE / LIMIT` doit rester sous la limite posée pour
   chaque service dans `infra/docker-compose.yml`, et le total sous les
   3,2 Go visés (voir `docs/adr/0002-hebergement.md` pour le détail du
   budget).

7. Tout arrêter et nettoyer :

   ```
   docker compose -f infra/docker-compose.yml --env-file .env down
   ```

   Ajouter `-v` à cette commande seulement si on veut aussi supprimer les
   données (base PostgreSQL, fichiers envoyés, certificats Caddy) : à
   utiliser avec prudence, surtout en production.

## Production : premier déploiement sur le serveur Datacloud

Cette section suppose un serveur Ubuntu tout neuf fourni par Datacloud,
avec Docker déjà installé.

1. Se connecter en SSH au serveur et cloner le dépôt au même endroit que
   celui attendu par `infra/deploy.sh` :

   ```
   ssh <utilisateur>@<hôte>
   sudo mkdir -p /opt/kemet && sudo chown $USER /opt/kemet
   git clone <url du dépôt> /opt/kemet
   cd /opt/kemet
   ```

2. Créer le fichier `.env` directement sur le serveur (ne jamais le
   commiter ni l'envoyer par un canal non chiffré) :

   ```
   cp .env.example .env
   nano .env
   ```

   Remplir en particulier :
   - `POSTGRES_PASSWORD` : un mot de passe fort, généré par exemple avec
     `openssl rand -base64 24`.
   - `PUBLIC_HOST` : le sous-domaine fourni par Datacloud, ou un nom
     `sslip.io` si aucun domaine n'est encore disponible (il encode l'IP du
     serveur, par exemple `203-0-113-10.sslip.io` pour l'IP
     `203.0.113.10`). Ne pas mettre `:80` ici : ce réglage n'est que pour le
     test en local.

3. S'assurer que les ports 80 et 443 sont ouverts dans le pare-feu du
   serveur (le panneau Datacloud, ou `ufw allow 80,443/tcp` sur Ubuntu).

4. Démarrer les services, comme en local :

   ```
   docker compose -f infra/docker-compose.yml --env-file .env up -d --build
   docker compose -f infra/docker-compose.yml --env-file .env ps
   ```

5. Visiter `https://<PUBLIC_HOST>` : Caddy doit avoir obtenu seul un
   certificat Let's Encrypt (peut prendre une minute la première fois). Si
   la page ne charge pas, lire les journaux de Caddy :

   ```
   docker compose -f infra/docker-compose.yml --env-file .env logs caddy
   ```

   Les causes les plus courantes : le port 80 ou 443 est bloqué par le
   pare-feu, ou `PUBLIC_HOST` ne pointe pas réellement vers l'IP du
   serveur (vérifier avec `dig <PUBLIC_HOST>` ou `nslookup`).

## Déploiements suivants

Une fois le premier déploiement fait, chaque mise à jour se fait avec le
script `infra/deploy.sh`, lancé depuis un poste qui a accès SSH au
serveur (pas besoin d'être connecté au serveur lui-même) :

```
infra/deploy.sh <utilisateur>@<hôte>
```

Le script se connecte en SSH, récupère la dernière version de `main`,
reconstruit et redémarre les services, puis nettoie les images Docker
devenues inutiles. Il affiche l'état des services à la fin : vérifier que
tout est `healthy` avant de considérer le déploiement terminé.

Si le chemin du dépôt sur le serveur n'est pas `/opt/kemet`, le donner en
second argument : `infra/deploy.sh <utilisateur>@<hôte> /chemin/vers/kemet`.

## Problèmes courants

Un service qui reste `unhealthy` se diagnostique par ses journaux
(`docker compose ... logs <service>`) ; pour `api`, `realtime` et `worker`,
la cause habituelle est un `postgres` ou un `valkey` pas encore prêt. Si
`docker compose` est introuvable, l'ancienne commande `docker-compose`
accepte les mêmes arguments. Pour un certificat HTTPS qui n'arrive pas, voir
l'étape 6 du premier déploiement.
