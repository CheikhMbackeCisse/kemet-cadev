# 0029. Images et vidéos des travaux

Date : 08/11/2026

## Contexte

Un travail n'avait qu'un résumé, des liens et un PDF. La page Travaux devait
passer en cartes avec une image, et un travail devait pouvoir montrer des
captures et une démonstration en vidéo, envoyée ou sur YouTube. Contraintes :
pas de ffmpeg (pas de transcodage, pas de vignette générée), le quota de
stockage par compte, et une CSP qui n'acceptait aucune origine tierce.

## Décision

- Une table `work_media` (migration additive `0025_work_media.sql`) pour la
  couverture, la galerie et les vidéos, plutôt que trois tables. `kind`
  (image, vidéo, YouTube) et `role` (couverture, galerie, vidéo) sont liés
  par une contrainte en base, une seule couverture par travail par un index
  unique partiel.
- Envoi en deux temps, comme le PDF : `POST /api/works/media` renvoie un
  identifiant, le travail le rattache à sa création ou à sa modification. Le
  type vient du contenu du fichier (`file-type`) : PNG, JPEG, WebP, GIF, MP4
  ou WebM. Une vidéo fait au plus 50 Mo (`WORK_VIDEO_MAX_BYTES`), une image
  la taille d'une pièce jointe. Le tout compte dans le quota commun.
- Service par `GET /api/work-media/:id/content`, public comme la page du
  travail, seulement pour un média rattaché à un travail non supprimé. Les
  requêtes partielles (`Range`, réponses 206 et 416) laissent le lecteur du
  navigateur avancer dans une vidéo. `nosniff` et `default-src 'none'` comme
  pour les autres fichiers.
- YouTube : seul l'identifiant de 11 caractères est gardé
  (`parseYoutubeId`), jamais le lien donné. La page construit elle-même
  l'adresse `https://www.youtube-nocookie.com/embed/<id>` et ne charge le
  lecteur qu'au clic : aucune requête vers Google tant que la personne ne
  l'a pas demandé. L'iframe est en `sandbox`, sans navigation de la page.
- CSP de l'application : `media-src 'self'` et
  `frame-src https://www.youtube-nocookie.com`, rien d'autre.

## Conséquences

- Pas de vignette générée pour une vidéo envoyée : le lecteur affiche sa
  première image (`preload="metadata"`). Une vidéo dans un format que le
  navigateur ne lit pas (codec exotique dans un MP4) reste illisible, faute
  de transcodage.
- Un fichier retiré d'un travail redevient libre et part avec le nettoyage
  horaire des orphelins, après une heure.
- Les médias sont effacés avec le compte de leur auteur, comme le PDF.
