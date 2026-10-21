# 0017 — Images sur les posts

## Contexte

Le fil de posts (lot 7) ne portait jusqu'ici aucune image : un post n'était
que du texte, un format optionnel et un lien de démo. Pour ressembler
davantage à un fil professionnel (LinkedIn plutôt que X, voir principe 6 de
`DESIGN.md`), la plupart des posts doivent pouvoir être accompagnés d'une ou
plusieurs images, uploadées par l'auteur.

Le mécanisme de pièce jointe existe déjà pour les messages de salon (lot 5
bis, `docs/adr/0008-fichiers-messages.md`) : détection du type par contenu,
upload en deux temps (fichier envoyé puis rattaché à l'envoi effectif),
nettoyage différé des orphelins, quota par utilisateur. Ce lot reprend ce
mécanisme pour les posts plutôt que d'en inventer un nouveau, avec deux
différences dictées par le contexte du fil : seules des images sont
acceptées, et la route de service est publique.

## Décision

**Table séparée, `post_attachments`, pas de réutilisation de
`message_attachments`.** Un post n'a pas de salon ni de notion de membre : la
colonne `channel_id`, obligatoire sur une pièce jointe de message, n'aurait
aucun sens ici. Même schéma de nullabilité temporaire que pour les messages
(`post_id` nul tant que l'image n'est pas rattachée à un post publié).

**Images uniquement, pas de colonne `kind`.** `docs/CONTEXTE.md` et la
demande de ce lot ne parlent que d'images façon LinkedIn, jamais de PDF ou
d'archive sur un post. `detectAttachment` (réutilisé tel quel) reste la seule
source de vérité sur le type réel du fichier ; la route d'upload rejette tout
ce qui n'est pas `kind === "image"`. Plafond de 4 images par post
(`MAX_POST_ATTACHMENTS`, `packages/shared/src/schemas/attachment.ts`).

**Quota de stockage unifié avec les fichiers de salon.** Un deuxième quota
indépendant aurait doublé l'espace réel disponible à un utilisateur sans le
dire. La route d'upload des images de post somme `message_attachments` et
`post_attachments` pour le même `authorId` avant de comparer au même
`MAX_USER_STORAGE_BYTES`, sous le même verrou consultatif par utilisateur
(`lockUserStorageQuota`, déjà partagé) pour rester correct sous upload
concurrent, salon et post confondus.

**Route de service publique, à la différence des fichiers de salon.** Le fil
est lisible sans session en mode visiteur (lot 11a) ; ses images le sont donc
aussi. `GET /api/post-attachments/:id/content` ne vérifie que deux choses :
l'image est bien rattachée à un post (`post_id` non nul, sinon composeur
abandonné jamais publié) et ce post n'est ni introuvable ni supprimé. Mêmes
en-têtes de défense que la route de salon (`X-Content-Type-Options: nosniff`,
`Content-Security-Policy: default-src 'none'`), héritées telles quelles.

**Suppression du `CHECK posts_body_or_share`.** Cette contrainte
(`length(body) > 0 or shared_post_id is not null`) interdirait un post
composé uniquement d'images. Un `CHECK` ne peut pas voir une autre table
(`post_attachments`), donc il ne peut pas non plus être étendu pour
l'autoriser. La règle « texte ou pièce jointe » reste appliquée côté
`createPostSchema` (Zod), exactement comme pour les messages
(`createMessageSchema`) où elle n'a jamais été un `CHECK` SQL non plus.

**Rattachement validé dans une transaction, comme pour les messages.** La
création d'un post avec des `attachmentIds` vérifie que chaque image
appartient bien à l'auteur et n'est pas déjà rattachée, dans la même
transaction que l'insertion du post : si une image n'est plus disponible,
tout est annulé plutôt que de créer un post à moitié rattaché.

**Nettoyage des orphelins, job séparé.** `post_attachments` et
`message_attachments` ont des schémas différents : plutôt que de généraliser
`cleanupOrphanAttachments` avec des branches par table, un second job
(`cleanup-orphan-post-attachments`) tourne sur la même queue `maintenance`,
même cadence horaire, même délai de grâce d'une heure.

## Conséquences

- Un futur format accepté sur les posts (par exemple une courte vidéo)
  demanderait de revoir cette décision, pas seulement d'ajouter une
  signature à `detect-attachment.ts`.
- Si le fil devait un jour devenir privé par espace, la route de service
  publique redeviendrait à revoir en même temps.
- Le risque résiduel d'un fichier malveillant inerte reste le même que celui
  déjà accepté pour les fichiers de salon (`docs/adr/0008-fichiers-messages.md`) :
  pas d'antivirus, protection par liste blanche de formats et absence
  d'exécution côté serveur.
