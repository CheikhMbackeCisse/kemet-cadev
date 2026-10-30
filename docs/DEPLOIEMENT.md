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

2. Construire les images et démarrer tous les services. Ajouter
   `--profile dev` pour démarrer en plus Mailpit, qui capture les emails
   envoyés par l'API (vérification, réinitialisation de mot de passe) sans
   les livrer réellement ; son interface est sur `http://localhost:8025`.
   Ce profil ne doit jamais être utilisé en production.

   ```
   docker compose -f infra/docker-compose.yml --env-file .env --profile dev up -d --build
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

## Production : vue d'ensemble

Rien n'est construit sur le serveur. À chaque commit de `main` dont la CI
est verte, le workflow `Images` (`.github/workflows/images.yml`) publie
quatre images sur GitHub Container Registry, étiquetées par le SHA du
commit : `ghcr.io/cheikhmbackecisse/kemet-web`, `-api`, `-realtime`,
`-worker`. `infra/deploy.sh` demande au serveur de télécharger celles d'un
commit précis et de redémarrer dessus. Les migrations Drizzle tournent au
démarrage de l'api.

Voir `docs/adr/0020-deploiement-production.md` pour le pourquoi.

Ce document n'a pas encore été déroulé sur le vrai serveur Datacloud : les
étapes ci-dessous seront corrigées là où la réalité diffère (version
d'Ubuntu, ports ouverts par Systalink, WebSockets).

## Production : premier déploiement

Cette section suppose un serveur Ubuntu tout neuf fourni par Datacloud, un
compte utilisateur avec `sudo`, et la clé SSH publique de l'administrateur posée dans
`~/.ssh/authorized_keys` de ce compte.

1. Se connecter au serveur et cloner le dépôt :

   ```
   ssh <utilisateur>@<hôte>
   git clone <url du dépôt> /tmp/kemet-setup
   sudo /tmp/kemet-setup/infra/server/setup.sh
   ```

   `setup.sh` installe Docker (dépôt officiel) et `age`, ferme tous les
   ports entrants sauf 22, 80 et 443 avec ufw, désactive la connexion SSH
   par mot de passe, et crée `/opt/kemet` et `/var/backups/kemet`. Il
   refuse de tourner si aucune clé SSH n'est posée, pour ne pas enfermer
   dehors l'utilisateur. Se déconnecter puis se reconnecter ensuite.

2. Cloner le dépôt à son emplacement définitif :

   ```
   git clone <url du dépôt> /opt/kemet
   cd /opt/kemet
   ```

   Tant que le dépôt est privé, le clone demande un jeton GitHub (ou une
   clé de déploiement en lecture seule).

3. Autoriser le serveur à télécharger les images. Tant que les paquets
   GHCR sont privés, se connecter avec un jeton GitHub qui n'a que la
   permission `read:packages` :

   ```
   docker login ghcr.io -u <compte GitHub>
   ```

   Une fois le dépôt et les paquets rendus publics pour le jury, cette
   étape n'est plus nécessaire.

4. Créer le fichier `.env` directement sur le serveur (ne jamais le
   commiter ni l'envoyer par un canal non chiffré) :

   ```
   cp .env.example .env
   nano .env
   ```

   Remplir en particulier :
   - `POSTGRES_PASSWORD` et `BETTER_AUTH_SECRET` : générés par exemple avec
     `openssl rand -base64 32`.
   - `PUBLIC_HOST` : le sous-domaine fourni par Datacloud, ou un nom
     `sslip.io` si aucun domaine n'est disponible (il encode l'IP du
     serveur, par exemple `203-0-113-10.sslip.io` pour l'IP
     `203.0.113.10`). Ne pas mettre `:80` ici : ce réglage n'est que pour le
     test en local.
   - `BETTER_AUTH_URL` et `WEB_APP_URL` : `https://<PUBLIC_HOST>`.
   - `KEMET_IMAGE_PREFIX=ghcr.io/cheikhmbackecisse/kemet`.
   - `BACKUP_AGE_RECIPIENT` : voir "Sauvegardes" plus bas.
   - les identifiants OAuth, SMTP et les clés d'IA
     (`GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`). `GEMINI_MODEL`
     et `OPENROUTER_MODEL` peuvent rester vides : le serveur prend alors
     `gemini-flash-latest` et `meta-llama/llama-3.3-70b-instruct:free`. Les
     renseigner seulement si un modèle est arrêté ou si son quota gratuit ne
     suffit plus, sans reconstruire les images : un redémarrage de `api`
     suffit.

5. Depuis le poste de l'administrateur (pas depuis le serveur), lancer le premier
   déploiement :

   ```
   infra/deploy.sh <utilisateur>@<hôte> https://<PUBLIC_HOST>
   ```

6. Visiter `https://<PUBLIC_HOST>` : Caddy doit avoir obtenu seul un
   certificat Let's Encrypt (peut prendre une minute la première fois). Si
   la page ne charge pas, lire les journaux de Caddy :

   ```
   docker compose -f infra/docker-compose.yml --env-file .env --env-file .env.deployed logs caddy
   ```

   Les causes les plus courantes : le port 80 ou 443 est bloqué par le
   pare-feu du panneau Datacloud, ou `PUBLIC_HOST` ne pointe pas réellement
   vers l'IP du serveur (vérifier avec `nslookup <PUBLIC_HOST>`).

## Comptes de démonstration et administrateur

Les comptes de démonstration ont un mot de passe public (`demonstration`)
pour que le jury puisse s'y connecter. Aucun n'est administrateur : un
mot de passe public ne doit jamais ouvrir la modération ni la validation
des compétitions.

Sur le serveur, dans le dossier où vivent `infra/docker-compose.yml`,
`.env` et `.env.deployed` :

```
docker compose -f infra/docker-compose.yml --env-file .env --env-file .env.deployed   exec api node node_modules/@kemet/db/dist/seed.js
```

Ce seed est sans risque à relancer : s'il trouve déjà les dix comptes de
démonstration, il ne fait rien, sauf échouer si l'un d'eux est
administrateur (base remplie par une ancienne version). Tout est créé dans une seule transaction,
et il échoue sans rien écrire s'il trouve une base où il ne reste qu'une
partie de ces comptes, ou si un compte de démonstration se retrouvait
administrateur.

Pour donner le rôle administrateur, créer d'abord un compte normal par la
page d'inscription (adresse vérifiée et profil complété), avec un mot de
passe qui n'est écrit nulle part ailleurs, puis :

```
docker compose -f infra/docker-compose.yml --env-file .env --env-file .env.deployed   exec api node node_modules/@kemet/db/dist/promote-admin.js <email>
```

La commande ne prend que l'adresse, jamais de mot de passe. Elle refuse une
adresse non vérifiée, un compte suspendu et un compte de démonstration. En local, les mêmes commandes s'écrivent
`pnpm db:seed:demo` (ou `pnpm db:seed`, identique) et
`pnpm db:promote-admin <email>`.

## Déploiements suivants

Depuis le poste de l'administrateur, à la racine du dépôt, une fois le workflow
`Images` du commit voulu terminé :

```
infra/deploy.sh <utilisateur>@<hôte> https://<PUBLIC_HOST>
```

Sans troisième argument, le script déploie le dernier commit de
`origin/main`. Pour un commit précis, passer son SHA complet en troisième
argument. Dans l'ordre, le script :

1. aligne le dépôt du serveur sur ce commit et écrit son SHA dans
   `.env.deployed` ;
2. télécharge les images (si ça échoue, les services en place continuent
   de tourner) ;
3. redémarre la pile et attend que chaque service soit `healthy` ;
4. lance le test de fumée Playwright `apps/web/e2e/prod-smoke.spec.ts`
   contre l'adresse publique (lecture seule : rien n'est écrit en base).
   `SKIP_SMOKE=1` le saute. Il demande Chromium pour Playwright sur le poste,
   installé une fois avec
   `pnpm --filter @kemet/web exec playwright install chromium`.

Si l'étape 3 ou 4 échoue, le script revient au commit déployé juste avant,
noté dans `.deploy-history` sur le serveur, et sort en erreur. Une
migration n'est jamais annulée par ce retour arrière : les migrations
restent additives pour que l'ancienne version tourne sur le nouveau schéma.

Sur le serveur, toute commande `docker compose` lancée à la main doit
inclure `--env-file .env.deployed` après `--env-file .env`, sinon elle
cherche des images `kemet-<service>:local` qui n'y existent pas.

Si le dépôt n'est pas dans `/opt/kemet` sur le serveur, le préciser avec
`KEMET_REMOTE_PATH=/chemin/vers/kemet`.

Une fois l'adresse connue, une sonde UptimeRobot gratuite vérifie `/` et
`/api/health` toutes les cinq minutes et prévient par email.

## Sauvegardes

Chaque nuit à 2h30 (heure de Dakar), le workflow `Backup`
(`.github/workflows/backup.yml`) se connecte au serveur, lance
`infra/server/backup.sh`, récupère les deux fichiers produits et les garde
14 jours en artefact GitHub :

- `kemet-<date>.dump.age` : la base, `pg_dump` au format custom ;
- `kemet-<date>.uploads.tar.age` : les fichiers envoyés.

Les deux sont chiffrés avec `age` sur le serveur, avant d'en sortir. Le
serveur n'a que la clé publique : un fichier volé, sur le serveur ou chez
GitHub, est illisible sans la clé privée, qui reste chez l'administrateur.

Mise en place, une seule fois :

1. Sur le poste de l'administrateur : `age-keygen -o kemet-backup.key`. Garder ce
   fichier hors du dépôt, en deux exemplaires (sans lui, aucune sauvegarde
   ne peut être restaurée). Sa ligne `# public key: age1...` est la valeur
   de `BACKUP_AGE_RECIPIENT` dans le `.env` du serveur.
2. Créer une paire de clés SSH dédiée au workflow (`ssh-keygen -t ed25519
-f kemet-backup-ssh`), distincte de la clé de déploiement de l'administrateur. Le
   compte de déploiement est dans le groupe `docker`, donc équivalent à
   root : cette clé, stockée chez GitHub, ne doit ouvrir aucun shell. Poser
   sa clé publique dans `~/.ssh/authorized_keys` du serveur avec ce
   préfixe, sur la même ligne :

   ```
   restrict,command="/opt/kemet/infra/server/backup-gate.sh" ssh-ed25519 AAAA...
   ```

   `infra/server/backup-gate.sh` n'accepte alors que deux commandes :
   lancer une sauvegarde, et lire un fichier de `/var/backups/kemet`.

3. Dans les réglages du dépôt GitHub :
   - variables `DEPLOY_HOST` et `DEPLOY_USER` (le workflow ne tourne pas
     tant que `DEPLOY_HOST` n'existe pas) ;
   - un environnement `production`, limité à la branche `main` ("Deployment
     branches and tags"), pour qu'un workflow modifié sur une autre branche
     ne puisse pas lire ses secrets ;
   - dans cet environnement, les secrets `BACKUP_SSH_KEY` (clé privée créée
     à l'étape 2) et `DEPLOY_KNOWN_HOSTS` (sortie de `ssh-keyscan <hôte>`,
     comparée une fois à l'empreinte affichée sur le serveur par
     `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`).

Une fois le dépôt public, les artefacts sont téléchargeables par tout
compte GitHub. Leur contenu reste illisible sans la clé privée, mais leur
nom (la date) et leur taille sont visibles.

Restauration, à ne lancer en production qu'avec l'accord de l'administrateur. Le
déchiffrement se fait sur le poste de l'administrateur et le flux part par SSH : la
clé privée ne va jamais sur le serveur, et aucun fichier en clair n'y est
écrit hors du volume concerné.

```
age -d -i kemet-backup.key kemet-<date>.dump.age   | ssh <utilisateur>@<hôte> 'cd /opt/kemet && infra/server/restore.sh --confirm database'
age -d -i kemet-backup.key kemet-<date>.uploads.tar.age   | ssh <utilisateur>@<hôte> 'cd /opt/kemet && infra/server/restore.sh --confirm uploads'
```

Le script arrête api, realtime et worker, remplace la base ou les fichiers,
puis redémarre la pile, y compris en cas d'échec. La base est restaurée
dans une seule transaction : un flux tronqué (mauvaise clé, coupure) ne
change rien. Les fichiers sont extraits à côté des fichiers en place, qui
ne sont remplacés qu'une fois l'extraction réussie, et une archive qui
contient un chemin absolu ou `..` est refusée. Le job CI `backup-restore`
joue cet aller-retour pour de vrai à chaque pull request.

## Problèmes courants

Un service qui reste `unhealthy` se diagnostique par ses journaux
(`docker compose ... logs <service>`) ; pour `api`, `realtime` et `worker`,
la cause habituelle est un `postgres` ou un `valkey` pas encore prêt. Si
`docker compose` est introuvable, l'ancienne commande `docker-compose`
accepte les mêmes arguments. Pour un certificat HTTPS qui n'arrive pas, voir
l'étape 6 du premier déploiement.
