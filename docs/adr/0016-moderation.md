# 0016 — Modération

## Contexte

Lot 7 bis : signaler un message, un post ou un profil ;
file de signalements réservée aux admins ; masquer un contenu signalé ;
suspendre un compte ; journal d'audit des actions de modération. Dernier
lot P0 qui ne dépend pas de l'existence du serveur Datacloud : posé en
avance sur le calendrier du 19 au 22 octobre, comme l'audit de sécurité au
lot précédent. `profiles.isPlatformAdmin` existait déjà depuis le lot 10
et portait un commentaire l'anticipant explicitement.

## Décision

**Deux tables plutôt qu'une.** `reports` (signalements, cycle de vie
`pending` → `resolved`/`dismissed`) et `moderation_actions` (journal
d'audit, en ajout seul, même esprit que `points_ledger`). Les séparer
évite de mélanger l'état mutable d'une file de travail avec un historique
qui ne doit jamais changer une fois écrit. Un report porte une cible
polymorphe (`targetType` + `targetId`, sans clé étrangère : la cible est
un message, un post ou un profil selon le cas) ; son existence et son
auteur sont résolus côté application (`resolveReportTarget`,
`apps/server/src/api/repositories/moderation.ts`), jamais en base.

**Masquer un contenu réutilise le soft-delete existant.** `hide` appelle
`softDeleteMessage`/`softDeletePost`, déjà posés aux lots 5 et 7 pour la
suppression par l'auteur. Un contenu masqué par modération et un contenu
supprimé par son auteur sont donc indiscernables pour un lecteur (les deux
affichent "message supprimé"/"post supprimé") ; la distinction vit dans le
journal d'audit, pas dans l'état du contenu. Pas de nouvelle colonne
`hiddenAt` qui aurait dupliqué `deletedAt` pour un résultat identique côté
lecture.

**Suspendre un compte bloque l'écriture, pas la lecture ni la connexion.**
`profiles.suspendedAt`, vérifié à l'endroit où chaque route vérifie déjà
l'existence du profil (`requireOwnProfile`, dupliqué dans dix fichiers de
routes avant ce lot, un fichier par module). Une ligne ajoutée à chacun
plutôt qu'un mécanisme central : `requireSessionUserId`/`getSessionUserId`
(`apps/server/src/auth/session.ts`) sont appelés 77 fois dans 15 fichiers,
changer leur signature pour y glisser une vérification aurait été un
refactor sans rapport avec ce lot. Un compte suspendu reste donc connecté
et peut tout lire, comme un visiteur peut déjà lire sans compte ; bloquer
aussi la connexion aurait demandé le greffon admin de Better Auth
(colonnes `banned`/`banReason` sur `user`, son propre système de rôle) en
plus de `isPlatformAdmin`, deux mécanismes d'autorisation en parallèle pour
un seul lot.

**Un signalement par personne et par cible**, comme les réactions
(`message_reactions`) : index unique sur `(reporterId, targetType,
targetId)`. Masquer un contenu referme tous les signalements en attente
sur la même cible (`resolvePendingReportsForTarget`) ; rejeter un
signalement ne ferme que celui-là, les autres signalements sur le même
contenu restant à juger.

**Réintégrer un compte suspendu**, au-delà du texte strict de
l'objectif ("suspendre un compte") : sans action symétrique, une
suspension par erreur ne serait réparable qu'à la main en base. Décidé
avant d'écrire le code.

**Deux fonctions de résolution de cible, pas une.** `resolveReportTarget`
(création d'un signalement) respecte la visibilité par espace : signaler un
message d'un espace privé dont on n'est pas membre échoue en `notFound`,
comme le reste de l'application pour une ressource invisible. Trouvé par
la relecture de sécurité avant la pull request : la première version
résolvait la cible sans vérifier l'appartenance à l'espace, ce qui
permettait d'extraire un extrait d'un message privé en le signalant.
`describeReportTarget` (file et journal, réservés aux admins) ignore
volontairement cette visibilité : un admin doit pouvoir instruire un
signalement sur un espace privé dont il n'est pas membre, sans quoi ce cas
serait impossible à juger.

## Conséquences

- Aucune nouvelle dépendance, aucun nouveau système d'autorisation : la
  modération s'appuie entièrement sur `isPlatformAdmin` et le soft-delete
  existants.
- La vérification de suspension touche onze fichiers de routes (les dix
  modules déjà dotés d'un `requireOwnProfile`, plus le nouveau module de
  modération). Si un futur module ajoute sa propre route d'écriture avec
  un nouveau `requireOwnProfile`, il doit reprendre la même ligne : rien
  ne l'impose mécaniquement, ce n'est pas un hook central.
- Pas de test Playwright, comme pour la validation des compétitions au
  lot 10 (`docs/adr/0013-competitions.md`) : un parcours réservé aux
  admins sans détour possible avec un compte de test est couvert par les
  tests d'intégration plutôt qu'un parcours bout en bout.
- Un contenu masqué par modération et un contenu supprimé par son auteur
  restent indiscernables pour un lecteur ; seul le journal d'audit permet
  de retrouver qu'une action de modération a eu lieu.
