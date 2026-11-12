# 0036. Organisations

## Contexte

Les offres d'emploi, de stage et de mission (ADR 0035) étaient publiées par des personnes, avec le nom de l'entreprise tapé dans un champ libre. Une entreprise, une école, une communauté ou un organisateur d'événements n'avait pas de page à elle, et le compte Systalink (post CADEV, accord du 12/11) recevait un niveau Apprenti comme une personne.

## Décision

Une organisation est un profil, pas une table à part : `profiles.kind` vaut `person` ou `organization`, avec `profiles.organization_type` (entreprise, école ou université, communauté, organisateur d'événements), une contrainte en base liant les deux. Elle réutilise tout ce qu'un profil a déjà : identifiant, page publique, abonnés, posts, offres, signalement, suspension.

- Une organisation n'a pas de compte de connexion (`user_id` nul). Des personnes la gèrent (`organization_managers`).
- Ni niveau, ni points : `shownLevel` renvoie `null` pour une organisation et pour Kocc, `awardPoints` ne verse rien à une organisation, `/niveaux` ne la compte pas.
- Étiquette neutre "Organisation" à côté du nom, jamais "vérifié" : Kemet ne vérifie pas l'identité d'une organisation, il enregistre une demande relue par l'administration.
- Référencement : une demande (`organization_requests`) en attente, une seule à la fois par personne (index unique partiel), acceptée ou refusée par un administrateur. L'acceptation crée le profil et fait de la personne qui l'a demandé sa gestionnaire. Un refus n'est jamais public, son logo est effacé.
- Publier au nom d'une organisation : `asOrganizationId` sur un post ou une offre, vérifié côté serveur à chaque envoi. L'auteur est l'organisation, la personne qui a publié est gardée dans `published_by_id`. Un gestionnaire modifie et supprime ce que l'organisation a publié (`canActForAuthor`). Une candidature arrive dans la messagerie d'un gestionnaire, avec le nom de l'organisation dans le brouillon.

## Conséquences

- Migrations additives 0039 (types, colonnes, tables) et 0040 (`published_by_id`).
- Une seule page pour une personne et pour une organisation (`/u/:handle`), qui change d'en-tête et d'onglets selon `kind`.
- Le nom d'une organisation est unique sans tenir compte de la casse ni des espaces répétés, vérifié à l'envoi et à l'acceptation.
- Le logo envoyé avec la demande ne compte pas dans le quota de stockage commun : 1 Mo au plus, une demande en attente à la fois, effacé au refus et à la suppression du compte. Un plantage entre l'écriture du fichier et l'insertion laisserait un fichier orphelin, aucun nettoyage ne le couvre encore.
- Les trois organisations du seed (Lagune Logiciels, Cayor Distribution, Code des Collines) sont inventées, avec un monogramme pour logo. Aucun logo d'entreprise réelle n'est utilisé sans accord ; seul Systalink a donné le sien.
- Le nom est comparé après normalisation NFKC et repli des espaces. Un caractère d'un autre alphabet qui ressemble à une lettre latine passe ce contrôle : la relecture par l'administration le rattrape.
- Quand le seul gestionnaire d'une organisation supprime son compte, l'organisation reste, sans gestionnaire : ses offres n'ont plus de contact et "Postuler" disparaît. L'administration peut la suspendre.
