# 0012 — Projets

## Contexte

Le lot 9 ajoute le module Projets : page projet, demandes d'aide et de
collaboration, candidatures, et un bouton "Déployer sur Datacloud" avec un
lien de parrainage configurable. `docs/CONTEXTE.md` fixe le modèle de
données à trois tables : `projects`, `help_requests`, `applications`.

Ce lot a été développé dans un worktree séparé, basé sur `main`, en
parallèle du lot 8 (points et niveaux, PR #11 ouverte au moment de démarrer
ce lot) : ce parallélisme est possible puisque le lot 9 ne dépend
que des lots 3 et 4, déjà posés. Le lot 8 a fusionné sur `main` avant la fin
de ce lot ; la branche a été rebasée dessus pour câbler le gain de points
plutôt que de le laisser en suspens (voir plus bas).

## Décisions

**Une seule table pour les demandes d'aide et de collaboration.**
`docs/CONTEXTE.md` ne liste qu'une table `help_requests` pour les deux
notions ("demandes d'aide et de collaboration"). Un champ `kind` (`help` /
`collaboration`) distingue une demande ponctuelle (ex. relire une pull
request) d'une recherche de collaborateur durable, sans dupliquer le reste
du schéma ni la logique de candidature : les deux se comportent de façon
identique une fois publiées.

**Le propriétaire publie, tout profil candidate.** Le propriétaire ne peut pas postuler à sa propre demande (même
garde-fou que l'auto-retour structuré du fil, lot 7). Une personne ne
postule qu'une fois par demande : contrainte unique `(help_request_id,
applicant_id)`, avec `onConflictDoNothing` côté écriture pour fermer la
course entre deux requêtes concurrentes de la même personne, même mécanisme
que `insertPostFeedback`.

**Accepter une candidature ferme la demande et refuse les autres
candidatures en attente, dans une transaction.** Une seule personne
confirmée par demande : accepter and déclarer "aide confirmée" sur plusieurs
candidatures en même temps n'aurait pas de sens. La transaction empêche
qu'une écriture concurrente laisse deux candidatures acceptées à la fois,
même précaution que `setPostReplySolution` pour la marque "solution" du fil.

**Les candidatures restent privées**, entre le candidat et le propriétaire
du projet. `GET /api/help-requests/:id/applications` est réservé au
propriétaire : un dossier de candidature n'est pas un contenu public, à la
différence d'un post ou d'un skill. Le candidat connaît le statut de sa
propre candidature par la réponse de sa requête de création (`POST
.../applications`) et par le message d'erreur 409 s'il retente de postuler ;
il n'a pas d'écran "mes candidatures" en P0 (non demandé par
`docs/CONTEXTE.md`).

**Le bouton "Déployer sur Datacloud" vient d'une configuration serveur
globale, pas d'une colonne en base.** Le lien de parrainage est le même pour
tous les projets de la plateforme (`DATACLOUD_REFERRAL_URL`,
`apps/server/src/config/projects-config.ts`, même mécanique que
`loadAttachmentLimits`) : stocker cette valeur par projet aurait suggéré à
tort qu'elle peut varier d'un projet à l'autre. Non définie, le bouton ne
s'affiche simplement pas (pas d'état d'erreur à inventer pour un réglage
optionnel).

**Le câblage du registre de points a attendu la fusion du lot 8.**
`docs/CONTEXTE.md` prévoit "aide confirmée sur un projet +20" déclenchée
par l'acceptation d'une candidature. Ce lot a commencé dans un worktree basé
sur `main` avant que le lot 8 (registre de points, `points_ledger`) n'y soit
fusionné : `apps/server/src/api/repositories/points.ts` n'existait pas
encore. Une fois le lot 8 fusionné, la branche a été rebasée sur `main` et
une nouvelle source `project_help_confirmed` a été ajoutée à
`pointsSourceEnum` (`packages/db/src/schema/points.ts`, migration
`0007_sturdy_fenris.sql`, un simple `ALTER TYPE ... ADD VALUE` après la
migration `0006_huge_the_hood.sql` qui pose les trois tables de ce lot). La
décision d'acceptation d'une candidature (`PUT /api/applications/:id/
decision`) verse +20 points à l'applicant accepté, `givenByProfileId` le
propriétaire du projet qui a pris la décision — même situation que le lot 7
avant le lot 8 (`docs/adr/0010-fil-de-posts.md`), à la différence que la
fusion est arrivée à temps ici.

## Conséquences

- Pas d'écran "mes candidatures" ni de recherche par stack et par pays (P1,
  `docs/CONTEXTE.md`) dans ce lot.
- Pas de garde-fou contre les demandes multiples ouvertes en parallèle sur
  un même projet : un propriétaire peut publier plusieurs demandes actives à
  la fois, ce qui correspond à l'usage attendu (plusieurs besoins distincts).
