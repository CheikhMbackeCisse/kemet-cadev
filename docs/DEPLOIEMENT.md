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
`-worker`. Un commit qui ne touche que la documentation (`*.md` de la racine, `docs/`)
n'est pas reconstruit : il reçoit les images du dernier commit qui a changé
autre chose, sous son propre SHA, ou il est reconstruit si ces images
n'existent pas et que son code a passé la CI complète. Pour reconstruire les images d'un commit
de `main` déjà vert (une image purgée, par exemple) :
`gh workflow run images.yml -f sha=<SHA complet>`. `infra/deploy.sh`
demande au serveur de télécharger celles d'un commit précis et de
redémarrer dessus. Les migrations Drizzle tournent au
démarrage de l'api.

Voir `docs/adr/0020-deploiement-production.md` pour le pourquoi.

Ces étapes ont été déroulées le 07/11/2026 sur le serveur Datacloud
(Ubuntu 24.04, 4 Go de RAM) et corrigées là où la réalité différait.

## Production : premier déploiement

Cette section suppose un serveur Ubuntu tout neuf fourni par Datacloud, un
compte utilisateur avec `sudo`, et la clé SSH publique de l'administrateur posée dans
`~/.ssh/authorized_keys` de ce compte.

1. Se connecter au serveur et cloner le dépôt :

   ```
   ssh <utilisateur>@kemetlabs.dev
   sudo apt-get install -y git   # si git manque : setup.sh ne l'installe qu'après ce clone
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

   Le dépôt est privé : le clone demande une clé de déploiement en lecture
   seule (ou un jeton GitHub).

3. Autoriser le serveur à télécharger les images, privées elles aussi :
   se connecter avec un jeton GitHub (classique) qui n'a que la permission
   `read:packages`, saisi quand `docker login` demande le mot de passe :

   ```
   docker login ghcr.io -u <compte GitHub>
   ```

   GHCR garde les 10 dernières versions de chaque image et toutes celles de
   moins de 30 jours : un commit plus ancien peut ne plus être déployable.

4. Créer le fichier `.env` directement sur le serveur (ne jamais le
   commiter ni l'envoyer par un canal non chiffré) :

   ```
   cp .env.example .env
   nano .env
   ```

   Si le fichier est préparé sur Windows puis copié, retirer les fins de
   ligne CRLF sur le serveur (`sed -i 's/$//' .env`) et le protéger
   (`chmod 600 .env`).

   Remplir en particulier :
   - `POSTGRES_PASSWORD` : `openssl rand -hex 32`. Pas `-base64` : un `/`
     dans le mot de passe casse l'adresse `postgres://` que
     `infra/docker-compose.yml` construit avec, et l'api ne démarre pas. À
     fixer avant le premier démarrage : Postgres ne lit cette variable qu'à
     la création du volume.
   - `BETTER_AUTH_SECRET` : `openssl rand -base64 32`.
   - `PUBLIC_HOST=kemetlabs.dev`. L'enregistrement DNS `A` du domaine doit
     déjà pointer vers l'IP du serveur, sinon Caddy ne peut pas obtenir son
     certificat. En attendant le DNS, un nom `sslip.io` fait l'affaire (il
     encode l'IP du serveur, par exemple `203-0-113-10.sslip.io` pour l'IP
     `203.0.113.10`). Ne pas mettre `:80` ici : ce réglage n'est que pour le
     test en local.
   - `BETTER_AUTH_URL` et `WEB_APP_URL` : `https://kemetlabs.dev`.
   - `KEMET_IMAGE_PREFIX=ghcr.io/cheikhmbackecisse/kemet`.
   - `WWW_HOST=www.kemetlabs.dev` si l'enregistrement DNS `www` existe :
     Caddy obtient un second certificat et redirige vers `PUBLIC_HOST`.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` et `EMAIL_FROM`
     (une adresse du domaine validé chez l'expéditeur, par exemple
     `Kemet <noreply@kemetlabs.dev>`). Pas facultatifs : avec `SMTP_HOST`
     vide, aucun email de vérification ne part et personne ne peut finir
     son inscription par email.
   - `PRIVACY_CONTACT_NAME` et `PRIVACY_CONTACT_EMAIL` : sans les deux, la
     section Contact de `/confidentialite` est masquée.
   - `BACKUP_AGE_RECIPIENT` : voir "Sauvegardes" plus bas.
   - les identifiants OAuth et les clés d'IA
     (`GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`).
     L'assistant passe d'un fournisseur au suivant dans cet ordre : Gemini,
     Gemini Lite, Groq, OpenRouter. Une clé vide retire son fournisseur sans
     empêcher le démarrage ; avec une seule clé, l'assistant fonctionne déjà.
   - les modèles, qui peuvent rester vides :
     - `GEMINI_MODEL` (vide : `gemini-flash-latest`). Le 03/11/2026,
       `gemini-flash-latest` ne répondait plus avant 60 secondes sur l'offre
       gratuite et `gemini-3.5-flash` répondait en moins de 7 secondes :
       renseigner `GEMINI_MODEL=gemini-3.5-flash` en production.
     - `GEMINI_LITE_MODEL` (vide : `gemini-flash-lite-latest`), appelé quand
       le premier modèle Gemini ne répond pas. Son quota gratuit est séparé.
     - `GROQ_MODELS` (vide : `openai/gpt-oss-120b,openai/gpt-oss-20b`).
     - `OPENROUTER_MODELS` (vide : `google/gemma-4-26b-a4b-it:free`), liste
       de modèles gratuits dans l'ordre d'appel.
     - Les anciens noms `GROQ_MODEL` et `OPENROUTER_MODEL` sont encore lus
       quand le nom au pluriel est vide.

     Changer un modèle ne demande pas de reconstruire les images : un
     redémarrage de `api` suffit.
   - `OPENROUTER_DAILY_LIMIT` (vide : 45) : appels OpenRouter permis par jour,
     sous les 50 de l'offre gratuite. Le compteur vit dans Valkey et repart à
     minuit UTC. Une fois atteint, la chaîne saute OpenRouter, sans bloquer
     Gemini ni Groq.
   - `ASSISTANT_RECORDED_ANSWERS` : vide en temps normal. `true` le jour
     d'une démonstration, pour qu'une question de démo connue reçoive sa
     réponse enregistrée si toute la chaîne de fournisseurs est saturée
     (voir `docs/adr/0022-reponses-enregistrees.md`). Un redémarrage de
     `api` suffit à l'activer ou la couper.

5. Depuis le poste de l'administrateur (pas depuis le serveur), lancer le premier
   déploiement :

   ```
   infra/deploy.sh <utilisateur>@kemetlabs.dev https://kemetlabs.dev
   ```

   Il n'y a pas d'étape de migration à lancer : l'api joue les migrations
   à son démarrage, et le script attend qu'elle soit saine. Au tout premier
   déploiement, `.deploy-history` est vide : si les services ne deviennent
   pas sains ou si le test de fumée échoue, le script sort en erreur sans
   retour arrière possible. Lire alors les journaux (`logs api`).

6. Visiter `https://kemetlabs.dev` : Caddy doit avoir obtenu seul un
   certificat Let's Encrypt (peut prendre une minute la première fois). Si
   la page ne charge pas, lire les journaux de Caddy :

   ```
   docker compose -f infra/docker-compose.yml --env-file .env --env-file .env.deployed logs caddy
   ```

   Les causes les plus courantes : le port 80 ou 443 est bloqué par le
   pare-feu du panneau Datacloud, ou `PUBLIC_HOST` ne pointe pas réellement
   vers l'IP du serveur (vérifier avec `nslookup kemetlabs.dev`).

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
démonstration, il ne recrée rien, sauf échouer si l'un d'eux est
administrateur (base remplie par une ancienne version). Il rejoue ensuite
l'étape des médias de démonstration (images, vidéos, bannières, chiffres des
skills), qui ne complète que ce qui manque et ne touche qu'aux comptes,
posts, travaux et skills de démonstration. Les fichiers sont écrits dans
`UPLOADS_DIR`, déjà défini pour le service `api`. Chaque étape tient dans
sa propre transaction : la première échoue sans rien écrire si elle trouve une
base où il ne reste qu'une partie de ces comptes, ou si un compte de
démonstration se retrouvait administrateur. Si l'étape des médias échoue,
les fichiers déjà copiés restent sur le disque et sont réécrits au même nom
au passage suivant.

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
infra/deploy.sh <utilisateur>@kemetlabs.dev https://kemetlabs.dev
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
noté dans `.deploy-history` sur le serveur (une ligne par déploiement
devenu sain, `<commit>` pour GHCR, `<commit> server` pour une construction
sur place), et sort en erreur. `.deploy-pending` marque une activation en
cours : un commit qui n'est jamais devenu sain n'entre pas dans
l'historique, et un commit refusé par le test de fumée en est retiré.

`infra/Caddyfile` est monté fichier par fichier dans le conteneur Caddy :
après `git checkout`, le conteneur en place lit toujours l'ancien fichier,
même rechargé. Le script compare la configuration lue par Caddy à celle du
commit et recrée le conteneur quand elles diffèrent (quelques secondes
d'interruption). Sans ça, l'en-tête `Permissions-Policy` du 11/11 n'a jamais
été servi, ce que le test de fumée a relevé le 12/11. Une
migration n'est jamais annulée par ce retour arrière : les migrations
restent additives pour que l'ancienne version tourne sur le nouveau schéma.

Sur le serveur, toute commande `docker compose` lancée à la main doit
inclure `--env-file .env.deployed` après `--env-file .env`, sinon elle
cherche des images `kemet-<service>:local` qui n'y existent pas.

Si le dépôt n'est pas dans `/opt/kemet` sur le serveur, le préciser avec
`KEMET_REMOTE_PATH=/chemin/vers/kemet`.

Une fois l'adresse connue, une sonde UptimeRobot gratuite vérifie `/` et
`/api/health` toutes les cinq minutes et prévient par email.

## Secours : construction sur le serveur

Quand les images GHCR ne sont pas disponibles (CI indisponible ou épuisée,
aperçu d'une branche qui n'est pas encore sur `main`), le même script
construit les images sur le serveur au lieu de les télécharger. La branche
doit être poussée sur `origin`, sans pull request ouverte : aucun workflow
ne se déclenche alors (`ci.yml` ne réagit qu'à `main` et aux pull requests,
`images.yml` qu'à la CI de `main`).

```
KEMET_BUILD_ON_SERVER=1 infra/deploy.sh <utilisateur>@kemetlabs.dev https://kemetlabs.dev $(git rev-parse <branche>)
```

Différences avec le déploiement normal :

- les quatre images (api, realtime, worker, web) sont construites une par
  une pendant que la pile tourne, pour ménager la mémoire (4 Go, pas de
  swap). Compter une dizaine de minutes la première fois, moins ensuite
  grâce au cache de construction ;
- elles portent le préfixe `kemet-local` au lieu de
  `ghcr.io/cheikhmbackecisse/kemet`, écrit avec le commit dans
  `.env.deployed` ;
- le commit, troisième argument, est obligatoire : sans lui le script
  s'arrête avant toute connexion au serveur, plutôt que de construire
  `origin/main` sans le dire ;
- le commit est noté `<commit> server` dans `.deploy-history`. Un retour
  arrière vers lui reconstruit ses images sur le serveur au lieu de les
  chercher sur GHCR. Un déploiement en place avant cette règle est noté au
  déploiement suivant, d'après `.env.deployed`.

Le seed se lance ensuite comme d'habitude (commande de la section
"Comptes de démonstration et administrateur", qui lit `.env.deployed`).

Pour revenir aux images GHCR, il suffit d'un déploiement normal :
`infra/deploy.sh` sans `KEMET_BUILD_ON_SERVER` réécrit `.env.deployed` sans
le préfixe local, et supprime les images `kemet-local-*`.

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
     à l'étape 2) et `DEPLOY_KNOWN_HOSTS` (sortie de `ssh-keyscan kemetlabs.dev`,
     comparée une fois à l'empreinte affichée sur le serveur par
     `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`).

Les artefacts ne sont téléchargeables que par les comptes qui ont accès au
dépôt privé. Leur contenu reste de toute façon illisible sans la clé privée.

Restauration, à ne lancer en production qu'avec l'accord de l'administrateur. Le
déchiffrement se fait sur le poste de l'administrateur et le flux part par SSH : la
clé privée ne va jamais sur le serveur, et aucun fichier en clair n'y est
écrit hors du volume concerné.

```
age -d -i kemet-backup.key kemet-<date>.dump.age   | ssh <utilisateur>@kemetlabs.dev 'cd /opt/kemet && infra/server/restore.sh --confirm database'
age -d -i kemet-backup.key kemet-<date>.uploads.tar.age   | ssh <utilisateur>@kemetlabs.dev 'cd /opt/kemet && infra/server/restore.sh --confirm uploads'
```

Le script arrête api, realtime et worker, remplace la base ou les fichiers,
puis redémarre la pile, y compris en cas d'échec. La base est restaurée
dans une seule transaction : un flux tronqué (mauvaise clé, coupure) ne
change rien. Les fichiers sont extraits à côté des fichiers en place, qui
ne sont remplacés qu'une fois l'extraction réussie, et une archive qui
contient un chemin absolu ou `..` est refusée. Le job CI `backup-restore`
joue cet aller-retour pour de vrai à chaque pull request.

## Supervision

Une sonde externe gratuite (UptimeRobot, offre gratuite, vérification
toutes les 5 minutes) surveille `https://kemetlabs.dev/` et
`https://kemetlabs.dev/api/health`, avec une alerte par email. Compte à
créer par l'administrateur une fois l'adresse de production connue.

## Problèmes courants

Un service qui reste `unhealthy` se diagnostique par ses journaux
(`docker compose ... logs <service>`) ; pour `api`, `realtime` et `worker`,
la cause habituelle est un `postgres` ou un `valkey` pas encore prêt. Si
`docker compose` est introuvable, l'ancienne commande `docker-compose`
accepte les mêmes arguments. Pour un certificat HTTPS qui n'arrive pas, voir
l'étape 6 du premier déploiement.
