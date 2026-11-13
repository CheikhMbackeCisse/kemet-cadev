# 0035. Opportunités : offres d'emploi, stages et missions

## Contexte

Kemet accueille des recruteurs et des entrepreneurs depuis l'onboarding,
mais ils n'avaient nulle part où publier un besoin. Les projets du lot 9
couvrent la collaboration entre développeurs, pas une offre d'emploi ni
une mission payée par une entreprise.

## Décision

- **Une seule table `opportunities`** (migration additive `0033`) pour les
  trois types : emploi, stage, mission. Leurs champs propres sont peu
  nombreux (contrat, date de début et rémunération d'un côté ; budget,
  date limite et critères de l'autre), et une contrainte `CHECK` garde
  chaque ligne cohérente avec son type. Les mêmes règles vivent dans
  `opportunityInputSchema` (`packages/shared`), pour des erreurs lisibles
  champ par champ.
- **Le projet collaboratif n'est pas une offre.** Le filtre "Projet
  collaboratif" affiche les projets existants qui ont une demande ouverte,
  sans les copier. Un projet n'a ni pays ni domaine : il suit le pays de son
  auteur et sort de la liste dès qu'un domaine est choisi.
- **La clôture n'est jamais stockée.** Une offre est clôturée le lendemain
  de sa date limite (date en UTC, celle de Dakar). La liste l'exclut par
  défaut ; `includeClosed=true` la fait revenir.
- **Pays limités aux 54 pays d'Afrique**, comme à l'inscription, ou "À
  distance". Domaines tirés de la liste de l'onboarding. Montants en FCFA,
  entiers.
- **Postuler, c'est écrire.** Pas de table de candidatures : "Postuler" ou
  "Proposer mes services" ouvre une demande de conversation privée avec
  l'auteur (ADR 0026) et prépare un brouillon avec le lien du profil, que
  la personne relit et envoie elle-même. Les règles de la messagerie
  (demande en attente, blocage) s'appliquent sans rien ajouter.
- **Droits.** Lecture publique (liste et page d'une offre, 120 requêtes par
  minute). Publier demande une session, un profil complet et un compte non
  suspendu, avec la limite des comptes neufs (`antiSpamMax`, 10 par
  minute). Seul l'auteur modifie (`PUT`, remplacement complet) ou supprime.
  Les offres d'un figurant, d'un compte supprimé ou d'un compte suspendu ne
  sont jamais lues : un compte suspendu ne peut plus répondre à qui postule.
  Elles reviennent à sa réintégration.
- **Modération.** Une fausse offre (frais de dossier demandés, CV collectés)
  est une arnaque connue. Une offre se signale comme un travail ou un post,
  nouvelle valeur `opportunity` de `report_target` (migration additive
  `0034`), et la modération la masque par `softDeleteOpportunity`.
- **Suppression du compte : les offres partent.** Une offre appelle à
  écrire à son auteur ; sans compte, elle n'a plus de sens. Elles figurent
  dans l'export des données.

## Conséquences

- Aucune nouvelle dépendance.
- Le fil "Pour toi" d'un compte RH ou entrepreneur alterne cartes offre et
  cartes projet entre les posts.
- Pas de candidature suivie (statut, tri des candidats) : l'échange se fait
  dans la messagerie. À revoir si les recruteurs en ont besoin.
