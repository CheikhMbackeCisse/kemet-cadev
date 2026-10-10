# 0008 — Fichiers et images dans les messages

## Contexte

Le lot 5 bis ajoute la possibilité de joindre un fichier à un message. Les
images s'affichent dans le salon ; les autres formats se proposent en
téléchargement. Un service qui accepte des fichiers arbitraires de ses
utilisateurs a trois risques à couvrir : qu'un fichier malveillant soit
exécuté ou interprété par le navigateur d'un autre membre, qu'il serve de
vecteur de logiciel malveillant classique, et qu'il remplisse le disque du
serveur sans limite.

## Décision

**Le type d'un fichier se lit dans son contenu**, jamais dans son extension
ni dans l'en-tête `Content-Type` envoyé par le client (les deux sont
falsifiables). `apps/server/src/storage/detect-attachment.ts` utilise
`file-type` (MIT) pour lire la signature binaire du fichier. Seuls quatre
formats image (PNG, JPEG, WebP, GIF) sont affichés dans le salon ; PDF, ZIP,
SVG et texte brut sont acceptés mais toujours proposés en téléchargement,
jamais affichés en page. Tout le reste est refusé.

**Exception inévitable : le texte et le code n'ont pas de signature
binaire.** Un fichier `.ts` et un fichier `.py` sont indiscernables par leur
contenu seul. Pour ce cas précis, l'extension participe à la décision, en
plus d'une vérification du contenu (UTF-8 valide, aucun octet nul, pour
écarter un binaire déguisé en `.txt`). Le SVG reste détecté uniquement par
contenu (présence d'une balise racine `<svg>`), sans dépendre de son
extension : voir `isSvg` dans `detect-attachment.ts`.

**Le SVG n'est jamais affiché en page**, même si son contenu est valide : un
SVG peut embarquer du script. Il est toujours servi avec
`Content-Disposition: attachment`, comme tous les formats non-image. La
route de service (`GET /api/attachments/:id/content`,
`apps/server/src/api/routes/attachments.ts`) ajoute aussi
`X-Content-Type-Options: nosniff` et une `Content-Security-Policy:
default-src 'none'` sur cette seule réponse, pour qu'un navigateur
n'essaie pas de deviner un autre type ou d'exécuter quoi que ce soit même
en cas d'erreur de classification.

**Pas d'antivirus.** ClamAV est GPL, exclu par nos règles de licence
(`scripts/check-licenses.ts`). La protection
vient de la combinaison des points précédents plutôt que d'une analyse de
signatures virales : liste blanche stricte de formats, aucun format
exécutable ou interprété par le serveur ou par Caddy, aucun fichier jamais
exécuté côté serveur, fichier servi depuis une route dédiée qui ne fait que
lire des octets et les renvoyer. Un fichier malveillant déguisé en PDF ou en
image reste un risque résiduel accepté pour l'instant (comme pour n'importe
quel service qui accepte des pièces jointes) : il resterait inerte tant que
personne ne l'exécute volontairement après téléchargement, ce qu'aucune
liste blanche de format ne peut empêcher.

**Accès par salon, pas par fichier.** Un fichier est rattaché à un
`channel_id` dès l'envoi, avant même d'être rattaché à un message
(`message_attachments.message_id` reste nul jusqu'à l'envoi effectif du
message, voir plus bas). La route de service revérifie l'appartenance au
salon exactement comme pour les messages (`requireChannelAccess`) : un
salon privé renvoie 404 à qui n'en est pas membre, jamais 403, comme pour
le reste du chat (`docs/adr/0004-salons-et-espaces.md`).

**Fichier envoyé puis composeur abandonné : nettoyage différé, pas
immédiat.** Un fichier reste « en attente » (`message_id` nul) tant que le
message n'est pas envoyé. L'insertion du message et le rattachement des
fichiers se font dans une même transaction PostgreSQL : si la validation
d'un fichier échoue, le message ne se crée pas non plus, ce qui garde une
relance réseau avec le même `clientId` rejouable (voir la déduplication par
`clientId` dans `docs/adr/0006-temps-reel.md`). Un job BullMQ répété toutes
les heures (`apps/server/src/chat/attachments-cleanup.ts`, lancé par
`apps/server/src/worker/main.ts`) supprime les fichiers restés orphelins
plus d'une heure plutôt que de les supprimer tout de suite : un utilisateur
qui compose un message avec une pièce jointe ne doit pas la perdre parce
qu'il a mis quelques minutes à écrire son texte.

**Deux limites, en configuration** : `MAX_ATTACHMENT_BYTES` (taille d'un
fichier, appliquée par `@fastify/multipart` au niveau du flux, avant même
de lire tout le fichier en mémoire) et `MAX_USER_STORAGE_BYTES` (quota total
par utilisateur, calculé à la volée par somme des tailles en base plutôt
que stocké et recalculé à chaque écriture, cohérent avec la règle du projet
de ne jamais stocker une valeur agrégée).

**Stockage sur disque local (`LocalDiskStorage`), pas d'objet distant.**
Cohérent avec la décision déjà prise dans `.env.example`
(`UPLOADS_DIR`, volume Docker monté sur `api` et `worker`) : une seule
machine, pas de service de stockage à ajouter ni à payer. La clé de
stockage d'un fichier est toujours un UUID généré par le serveur, jamais le
nom fourni par le client : aucune entrée utilisateur n'atteint le système
de fichiers (`apps/server/src/storage/file-storage.ts`).

## Conséquences

- Un nouveau format accepté demande d'ajouter sa signature à
  `detect-attachment.ts`, jamais seulement une extension à une liste.
- Changer de stockage (par exemple vers un object storage, si le volume
  disque devenait trop petit) demande seulement une nouvelle implémentation
  de l'interface `FileStorage`, pas de changement des routes ni du schéma.
- Le risque résiduel d'un fichier malveillant inerte (PDF ou image piégés)
  n'est pas couvert par ce lot. À revisiter si le produit grandit au-delà
  d'une compétition étudiante.
