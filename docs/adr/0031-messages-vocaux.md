# ADR 0031 : messages vocaux

Date : 08/11/2026

## Contexte

Les salons et les messages privés doivent accepter des messages vocaux,
enregistrés depuis le navigateur, sur téléphone comme sur ordinateur.
Chaque navigateur enregistre dans son format : WebM/Opus pour Chrome,
Firefox et Android, MP4/AAC pour Safari et l'iPhone. Les deux se lisent
partout aujourd'hui. Convertir côté serveur demanderait ffmpeg, sous LGPL
ou GPL selon sa construction, interdit par la règle des licences.

## Décision

- Le fichier part tel que le navigateur l'a enregistré (`MediaRecorder`,
  32 kbit/s demandés), sans aucune conversion. Ogg/Opus est aussi accepté
  pour les anciens Firefox.
- Une route à part, `POST /api/channels/:id/messages/voice`, plutôt que la
  route des fichiers : l'audio n'y est jamais accepté, et une vidéo ou un
  autre fichier n'est jamais accepté ici. Mêmes droits d'écriture que pour
  un message (`requireChannelWriteAccess`), donc la même règle pour un
  salon d'espace et pour une conversation privée (demande en attente,
  blocage, membre parti), et le même quota de stockage.
- Le type vient du contenu : `file-type` reconnaît le conteneur, puis
  `storage/detect-voice.ts` lit ses pistes (élément Tracks d'un WebM, boîtes
  `hdlr` d'un MP4) et refuse tout fichier sans piste audio ou avec une piste
  vidéo. Le type servi est toujours `audio/*`.
- 4 Mio au plus, deux minutes au plus. Un WebM de `MediaRecorder` n'annonce
  pas sa durée : le navigateur l'envoie dans un champ `durationMs`, borné à
  deux minutes par `voiceDurationSchema`. Elle ne sert qu'à l'affichage du
  lecteur ; la taille, elle, est contrôlée par le serveur.
- Un vocal est une pièce jointe de type `voice` (`message_attachments`,
  nouvelle colonne `duration_ms`, migration additive `0028`). Il est servi
  `inline`, avec `nosniff`, la même CSP que les fichiers, et par plages
  (`206`), que Safari exige pour lire un fichier audio.
- Côté client, pas de lecture automatique, rien de téléchargé avant
  l'appui (`preload="none"`), un seul vocal joue à la fois.

## Conséquences

- Un navigateur qui ne lit pas le format d'un autre (très ancien Safari et
  WebM) n'entendra pas ce message. Accepté : les versions concernées ne
  sont plus maintenues.
- La durée affichée peut être fausse si un client la falsifie ; elle reste
  sous deux minutes et la taille du fichier, elle, est bornée.
- Pas de transcription ni de forme d'onde : il faudrait décoder l'audio
  côté serveur.
