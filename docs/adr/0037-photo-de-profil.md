# 0037. Photo de profil envoyée par la personne

## Contexte

Jusqu'ici, `profiles.avatar_url` n'était posé que par le seed, ou par le logo d'une organisation acceptée. Une personne inscrite gardait ses initiales sans pouvoir les changer. Le lot G15 demande un "+" sur la photo de Moi et de son profil, avec la même vérification que dans Paramètres.

## Décision

- Table `profile_avatars` (une ligne par profil, migration additive `0041_profile_avatars.sql`), sur le modèle de `profile_cvs` : clé de stockage, type, taille.
- `PUT /api/me/avatar` (session, compte non suspendu, 20 envois par heure) : PNG, JPEG ou WebP lu sur le contenu (`file-type`), 2 Mo au plus, 4096 pixels de côté au plus (en-tête lu par `readImageSize`, jamais décodé). Compté dans le quota de stockage commun, sous le même verrou. Pose `profiles.avatar_url` sur `/api/avatars/<clé>` dans la même transaction ; l'ancien fichier est effacé après la validation.
- `GET /api/avatars/:clé` est public, comme les avatars déjà lus partout : `nosniff`, `default-src 'none'`, cache d'un an (la clé change à chaque envoi).
- La suppression du compte efface la ligne et le fichier.
- Côté interface, un seul composant (`AvatarChangeButton`) pour le "+" de Moi et du profil et le bouton de Paramètres > Profil, qui refait les vérifications de type et de taille avant l'envoi.

## Conséquences

- `avatar_url` n'est toujours jamais accepté tel quel du client : seule l'adresse de la route de service est écrite, par le serveur.
- Pas de recadrage ni de réduction côté serveur (aucune bibliothèque d'image dont la licence convienne, voir la règle sur sharp) : la photo est affichée en cercle par `object-cover`, comme celles du seed.
- Pas de retrait de la photo sans la remplacer : non demandé, à ajouter si le besoin se présente.
