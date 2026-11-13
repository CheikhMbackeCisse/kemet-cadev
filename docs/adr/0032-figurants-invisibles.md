# ADR 0032 : figurants invisibles

Date : 09/11/2026

## Contexte

Le seed de démonstration crée environ 12 300 profils figurants
(`packages/db/src/seed/filler-profiles.ts`) pour que les compteurs aient
l'air d'une communauté réelle : membres d'un espace, abonnés, votes,
utilisations et avis des skills, nombre de membres par niveau. Jusqu'ici
rien ne les distinguait des dix comptes de démonstration : ils sortaient
dans "Suis quelques personnes", dans la liste des membres d'un espace et
dans les listes d'abonnés, avec un profil public cliquable. Une personne
qui les ouvrait voyait des comptes vides, ce qui faisait faux.

## Décision

- Les figurants restent en base, marqués par une colonne
  `profiles.is_filler` (migration `0029_filler_profiles.sql`, qui marque
  les profils de démonstration sans aucun compte de connexion, et le seed
  pose la valeur à la création).
- Ils restent comptés : nombre d'abonnés et d'abonnements, nombre de
  membres d'un espace, nombre de membres par niveau sur `/niveaux`, votes,
  utilisations et notes des skills.
- Ils ne sont jamais montrés. `findProfileByHandle` ne les trouve pas, donc
  profil public, suivre, écrire, bloquer, ajouter à un espace, coauteur d'un
  travail et signalement répondent 404 comme pour un identifiant inconnu.
  Les listes (abonnés, abonnements, membres d'un espace, suggestions de
  l'onboarding, mentions, recherche d'un travail par auteur, export des
  données) les filtrent. Leurs posts, réponses et retours ne sortent dans
  aucun fil (`repositories/fillers.ts`).
- Une liste d'abonnés ou d'abonnements renvoie `hiddenCount`, que la page
  de profil affiche à la fin de la liste : "Et 4 210 autres.", ou
  "4 210 personnes." quand aucun nom n'est visible.
- Un figurant ne peut jamais se connecter. Il n'a ni mot de passe ni compte
  GitHub, Google ou LinkedIn, et deux crochets de Better Auth le
  garantissent même si quelqu'un tentait d'en créer un : la création d'un
  compte de connexion (réinitialisation du mot de passe, liaison sociale)
  et la création d'une session sont refusées avec un 403. Ses adresses sont
  sur le domaine de démonstration, qui ne reçoit jamais d'email.

## Conséquences

- Toute nouvelle requête qui liste des profils doit filtrer `is_filler`.
  `apps/server/src/api/fillers.integration.test.ts` crée un figurant,
  appelle les routes publiques et connectées et échoue si l'une renvoie son
  identifiant, son nom, son adresse ou le texte de son post : une route
  ajoutée là sans filtre se voit.
- Les compteurs montrent plus de personnes que les listes. C'est voulu et
  dit à l'écran par "N autres".
- Le choix de l'unicité d'un identifiant tient compte des figurants
  (`findProfileOwningHandle`) : personne ne peut prendre l'identifiant d'un
  figurant.
