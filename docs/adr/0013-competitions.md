# 0013 — Compétitions

## Contexte

Le lot 10 ajoute le module Compétitions : inscription en équipe, soumission
d'un projet, vote public, notation du jury, résultats affichés sur le
profil. `docs/CONTEXTE.md` fixe le modèle de données à cinq tables
(`competitions`, `teams`, `submissions`, `votes`, `jury_scores`) et place la
création d'une compétition publique et le rôle de juré derrière le niveau
Architecte (`DESIGN.md`). Aucun de ces deux documents ne tranche cependant le
modèle d'équipe, qui valide une demande de création, comment combiner jury et
vote, ni le contenu exact d'une soumission : ces points ont été tranchés
avant de coder.

## Décisions

**Équipes réelles, pas des inscriptions solo.** Un capitaine crée une
équipe, les autres la rejoignent. Une personne n'appartient qu'à une seule
équipe par compétition : contrainte unique `(competition_id, profile_id)`
sur `team_members`, vérifiée dans la même transaction que la création d'une
équipe pour ne jamais laisser une équipe orpheline sans capitaine inscrit
comme membre si la contrainte se déclenche après coup.

**Création validée par un administrateur, pas réservée à l'Architecte.**
`DESIGN.md` réserve la création de compétitions
publiques à l'Architecte, mais j'ai préféré un circuit de validation
manuelle à la place : n'importe quel profil propose une compétition
(`status = pending_review`), un administrateur l'approuve ou la refuse
(`status = published` ou `rejected`, avec une note optionnelle). Comme aucun
rôle admin n'existait avant ce lot, une colonne `profiles.is_platform_admin`
est ajoutée, sans aucune interface pour la changer : affectée directement en
base, comme le parcours vérifié avant son écran (lot 3). Le niveau Architecte
reste le seul critère pour noter en jury, lui, conformément à `DESIGN.md`.

**La phase d'une compétition ne se stocke jamais.** Trois échéances
(`registration_closes_at`, `submission_closes_at`, `voting_closes_at`)
suffisent : `computeCompetitionPhase` compare l'instant présent à ces trois
dates pour dériver "registration", "submission", "voting" ou "closed",
exactement comme les soldes et les niveaux se recalculent à la lecture
ailleurs dans ce projet. Une contrainte `CHECK` impose que les trois
échéances soient dans l'ordre.

**Le classement officiel combine jury et vote public, 70 % / 30 %.**
`docs/CONTEXTE.md` liste les deux sans dire comment les combiner. Chaque
soumission reçoit une part de jury (moyenne des notes sur 20, ramenée à une
échelle 0-1) et une part de vote (sa proportion des voix de la compétition),
combinées en `JURY_WEIGHT * juryShare + VOTE_WEIGHT * voteShare`. La
pondération est arbitraire et documentée comme telle dans
`apps/server/src/api/repositories/competitions.ts`, dans le même esprit que
`POINTS_DAILY_GIVER_CAP` (lot 8) : à ajuster si l'usage réel la
montre mal calibrée. Le classement se recalcule à chaque lecture, jamais
stocké.

**Une soumission référence un projet existant, avec un contenu rédigé à
part.** Le lot 9 (projets) donne déjà un titre, un lien de dépôt et une
description à un projet. Plutôt que de copier ces champs automatiquement
dans la soumission, `submissions` porte son propre titre, sa présentation et
ses liens, remplis par le candidat au moment de la soumission : le
propriétaire du projet choisit ce qu'il donne pour cette compétition précise
plutôt que d'exposer tout le projet tel quel. Seul le propriétaire du projet
peut le soumettre (`project.ownerId === profile.id`), et une équipe ne
soumet qu'une fois (`submissions.team_id` unique).

**Le vote élit un favori, il ne distribue pas des "j'aime".** Un seul choix
par personne et par compétition (`votes_competition_voter_idx`, unique sur
`(competition_id, voter_id)`) : revoter met à jour la ligne existante plutôt
que d'en ajouter une. Voter ou noter la soumission de sa propre équipe est
refusé, même garde-fou que l'auto-récompense bloquée ailleurs dans ce
projet (fil, lot 7 ; points, lot 8).

**Points de compétition versés par le registre idempotent**, pas par un job
qui tourne une fois. `+10` à la soumission pour
chaque membre de l'équipe ("participation à une compétition",
`docs/CONTEXTE.md`), `+200 / +100 / +50` pour les trois premières équipes une
fois le vote clos ("victoire en compétition"). `GET
/api/competitions/:slug/results` recalcule le classement et appelle
`awardPoints` pour le podium à chaque lecture : l'index unique
`(source, source_id, profile_id)` de `points_ledger` (lot 8) absorbe les
appels répétés sans jamais redonner les points deux fois, comme pour les
autres sources. Aucun job planifié n'est nécessaire.

**Soumissions cachées aux équipes rivales** pendant la phase de soumission.
Relevé en relecture de sécurité : sans ce
masquage, une équipe qui soumet tôt dans la fenêtre laisse son lien de
dépôt, son lien de démo et sa description visibles à toutes les équipes
concurrentes avant leur propre date limite. `GET
/api/competitions/:slug/submissions` ne renvoie ces trois champs qu'aux
membres de l'équipe propriétaire tant que la phase est "submission" ;
`description` et `repoUrl` deviennent nuls pour tout autre lecteur (titre,
présentation en une phrase et nom d'équipe restent visibles, pour que la
liste ait un sens). Visibles pour tout le monde dès la phase de vote.

## Conséquences

- Pas de recherche ni de défis de code sans exécution (P1, `docs/CONTEXTE.md`)
  dans ce lot.
- Pas d'écran de modification d'une soumission dans l'interface : la route
  `PATCH /api/submissions/:id` existe et est testée, mais seule la création
  est câblée côté `apps/web`.
- **Aucun test Playwright pour le parcours de vote**, à la différence des
  autres parcours critiques listés dans ce fichier. La validation admin
  n'a ni API ni interface de contournement pour un compte créé à la volée
  dans un test, et exposer le port Postgres ou modifier l'image de
  production pour lancer `pnpm db:seed` dans la pile Docker du job
  `e2e-tests` aurait touché à l'infrastructure partagée par tous les autres
  parcours pour un seul lot. Le parcours est couvert à la place par des
  tests d'intégration qui passent par les vraies routes HTTP
  (`apps/server/src/api/competitions.integration.test.ts`) : création,
  validation admin, équipes, soumission, vote, notation du jury et
  résultats, y compris les refus d'auto-évaluation. Un compte de
  démonstration (`amina-diallo`, `pnpm db:seed`) porte le rôle admin pour
  les essais manuels et ceux du jury.
