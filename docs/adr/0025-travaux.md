# 0025 : Travaux et "Qui a travaillé sur ce sujet ?"

## Contexte

Un développeur africain qui sort d'une école ou d'un stage a déjà produit :
un projet de classe, un rapport de stage, un mémoire, une application, un
article. Ces travaux dorment dans un Drive ou un dépôt GitHub que personne
ne trouve. Kemet n'avait que les projets (lot 9), pensés pour demander de
l'aide sur un travail en cours, pas pour montrer un travail fini.

Deux besoins en découlent : publier un travail avec ses auteurs, et
retrouver qui a déjà travaillé sur un sujet pour lui poser une question.

## Décision

**Un module "Travaux", distinct des projets.** Table `works` avec un type
parmi `class_project`, `internship`, `thesis_research`, `application`,
`article`, `other`, un résumé en Markdown, des tags, une stack, une année et
un établissement facultatifs. Un projet du lot 9 vit et attend de l'aide, un
travail est terminé et se cite : les fusionner aurait mélangé deux cycles de
vie et deux formulaires.

**Le droit de publier est vérifié deux fois.** La case "j'ai le droit de
publier ce travail" est un `z.literal(true)` côté schéma et un `CHECK
(publish_right_confirmed = true)` en base. Un mémoire peut contenir des
données d'entreprise : la personne qui publie s'engage explicitement.

**Coauteurs avec un compte : invitation, puis accord.** `work_authors`
porte un statut `pending`, `accepted` ou `declined`. Un coauteur n'apparaît
sur le travail et sur son profil qu'une fois `accepted` : la sérialisation
publique ne lit que ce statut, et seul le publieur voit les invitations en
attente ou refusées. Se retirer passe la ligne à `declined` au lieu de la
supprimer, pour que le publieur ne puisse pas relancer la même invitation
en boucle. Le publieur n'est jamais dans `work_authors` : il est auteur par
`works.publisher_id`. Un coauteur ne peut ni modifier, ni supprimer, ni
inviter.

**Auteurs sans compte en texte libre** (`work_external_authors`), sans lien
vers un profil : un encadrant ou un camarade qui n'est pas sur Kemet reste
crédité.

**Liens typés, en https seulement.** `work_links` avec un type parmi
`github`, `gitlab`, `drive`, `site`, `video`, `article`, `other`, refusé par
Zod et par un `CHECK` en base si l'adresse ne commence pas par `https://`.
Le formulaire rappelle qu'un lien Drive doit être ouvert en lecture.

**Un PDF au plus, en téléchargement seulement.** `work_attachments` reprend
le stockage, la détection par le contenu (`detect-attachment.ts`) et le
nettoyage horaire des fichiers de salon et des images de post. Un index
unique partiel sur `work_id` garantit un seul PDF par travail. La route de
service est publique comme la page du travail, mais répond toujours en
`Content-Disposition: attachment` avec `nosniff` et `default-src 'none'` :
un PDF peut embarquer du script, il n'est jamais affiché dans la page.

**Un seul quota de stockage, pour de vrai.** Le quota des images de post
(ADR 0017) se disait commun avec les fichiers de salon, mais la route des
fichiers de salon ne comptait que les siens. `sumTotalUserStorageBytes`
additionne fichiers de salon, images de post et PDF de travaux, et sert aux
trois routes d'envoi.

**Publier un travail crée un post.** `posts.work_id` (nullable) relie le
post d'annonce à son travail. Le post n'a pas de texte, la carte du fil
affiche le travail. Supprimer ou masquer le travail masque le post. Aucun
point n'est versé pour une publication : les points récompensent l'aide
apportée aux autres (ADR 0011), pas le volume publié.

**Modération.** `report_target` reçoit la valeur `work` (migration
additive). Un administrateur peut masquer un travail signalé, ce qui le
supprime en douceur avec son post.

**"Qui a travaillé sur ce sujet ?", en deux temps, seulement sur un clic.**

1. Présélection plein texte d'au plus 20 travaux publics
   (`FullTextWorkRetriever`, derrière une interface `WorkRetriever` comme
   `SkillRetriever`). Index `search_vector` tenu par trigger, french et
   english, pondéré titre et tags, puis stack, puis résumé. Le sujet est un
   texte long : ses mots sont reliés par OU et classés par `ts_rank`. Jamais
   les travaux de la personne qui demande (publiés ou co-signés acceptés),
   jamais le travail affiché, jamais un publieur suspendu. Les auteurs de
   l'élément affiché ne sont pas proposés non plus.
2. @kemet, par le `StreamingLlmProvider` existant, choisit de 0 à 5
   personnes et donne une phrase de justification qui cite le travail. Le
   sujet et les travaux sont dans un message `user` entre balises
   `<sujet>` et `<travaux>`, jamais dans le message système, et tout
   chevron écrit dans un sujet ou un résumé est remplacé, pour qu'aucune
   balise ne puisse être refermée de l'intérieur. La réponse est
   un JSON validé par `workMatchModelOutputSchema`, puis chaque couple
   (travail, personne) est comparé à la présélection : un identifiant
   inventé, une personne qui n'est pas autrice du travail cité ou la
   personne qui demande sont écartés.

Disponible sur la page d'un travail, d'un projet et d'un post Question.
Réservé aux comptes connectés, avec une limite de débit et la limite
réduite des comptes neufs.

**Quota de l'assistant partagé.** Chaque appel auquel un fournisseur répond écrit
une ligne dans `work_match_requests`, comptée avec les invocations de salon
par `checkDailyQuota`. Pas de colonne nullable ajoutée à
`assistant_invocations`, dont toute la logique suppose un salon.

**Repli honnête.** Fournisseurs saturés, quota du jour atteint ou réponse
illisible : le résultat de la recherche plein texte seule est renvoyé
(`mode: "full_text"` et la raison), affiché "Sans l'assistant", sans
justification inventée. Avec `ASSISTANT_RECORDED_ANSWERS=true`, un travail
de démonstration connu (`packages/db/src/work-match-recordings.ts`) reçoit
sa réponse enregistrée, filtrée par les mêmes règles et affichée "Réponse
enregistrée", comme pour l'ADR 0022.

## Conséquences

- Deux évaluations manuelles couvrent la fonction : un cas d'injection
  dans `evals/prompt-injection.ts` (un résumé hors sujet qui tente de se
  faire proposer et de faire fuiter la consigne) et
  `evals/work-matching.ts` (bonnes personnes, ou personne).
- La recherche plein texte ne comprend pas les synonymes : "hors ligne" et
  "offline" ne se retrouvent que si un travail porte les deux. Les tags
  compensent en partie. Des embeddings restent exclus en P0 (ADR 0007).
- Pas de notification : une demande de coauteur n'apparaît que sur le
  profil de la personne invitée, et sur la page du travail.
- Le profil s'ouvre désormais sur l'onglet "Travaux", le parcours passe
  dans un second onglet.

## Compléments du 03/11

- **Recherche.** `GET /api/works?q=` cherche en plein texte (français et
  anglais) sur le titre, le résumé, les tags et la stack, ou par sous-chaîne
  sur le nom et l'identifiant d'un auteur (publieur, coauteur accepté, auteur
  sans compte). Filtres par type, statut et tag, tri "récents" (curseur
  composite) ou "les plus discutés" (curseur par position : le nombre de
  messages bouge pendant qu'on pagine).
- **Statut.** `works.status`, "terminé" ou "en cours", "terminé" par défaut
  pour les travaux déjà publiés.
- **Discussion.** Chaque travail a un salon public, créé dans la même
  transaction que la publication. Les salons appartiennent à un espace : ils
  vivent dans un espace système unique (`spaces.kind = 'work_discussions'`),
  jamais listé, plutôt que dans une nouvelle table. Le travail garde son
  salon (`works.channel_id`). Toutes les règles des salons publics
  s'appliquent sans code nouveau : lecture par un visiteur, écriture par un
  compte, temps réel, limites de débit, modération des messages. Les
  auteurs y portent l'étiquette "Auteur". Trois débuts de message sont
  proposés à qui n'a encore rien écrit ; aucun envoi automatique.
- **Espace système.** Créé par la migration `0018_work_discussions_space`
  avec un identifiant fixe (`WORK_DISCUSSIONS_SPACE_ID`), au nom du profil de
  l'assistant. Une première version le créait à la première publication :
  un compte qui prenait son slug avant bloquait toute publication. Il n'a
  aucun membre, donc personne n'y crée, ne renomme ni n'invite (403, testé).
  Le publieur ne modère pas sa discussion : seuls les auteurs d'un message
  le retirent, et la file de modération reste le recours.
- **Cycle de vie.** Renommer un travail renomme son salon. Supprimer un
  travail, ou le masquer après un signalement, supprime son salon et ses
  messages dans la même transaction : un titre masqué ne reste pas public
  par sa discussion. Les fichiers envoyés dans la discussion restent sur le
  disque : limite connue.
- **Suppression de compte.** Le PDF d'un travail porte en général le nom de
  son auteur : il est effacé avec le compte, comme les images de post. Le
  travail reste, sans pièce jointe. Les invitations de coauteur en attente
  sont supprimées. La recherche par nom et "Qui a travaillé sur ce sujet ?"
  ignorent les comptes supprimés.
- **Page d'un travail.** Onglets Présentation, Discussion et Équipe ;
  colonne de droite avec le lien vers la discussion et "Qui a travaillé sur
  ce sujet ?". Les auteurs ne sont listés que dans l'onglet Équipe, pour ne
  pas les lire deux fois sur mobile. "Écrire à l'équipe" attend la
  messagerie privée.
- **Navigation.** Travaux passe en deuxième place sur bureau. Sur mobile, la
  barre devient Fil, Salons, Travaux, Skills, Moi ; Projets et Compétitions
  passent dans la feuille "Moi".
- **Niveau des auteurs.** `WorkPerson` porte le niveau, affiché à côté du
  nom sur la page du travail et dans "Qui a travaillé sur ce sujet ?".
- Pas encore fait : "Discussions suivies" dans le panneau Travaux, et le
  signalement d'une discussion entière (un message se signale déjà).

