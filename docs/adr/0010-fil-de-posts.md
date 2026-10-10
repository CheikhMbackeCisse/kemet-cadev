# 0010 — Fil de posts

## Contexte

Le lot 7 ajoute le fil de posts : posts courts avec trois formats optionnels
(Astuce, À tester, Question), réponses, partages, onglets Abonnements et
Pour toi. `docs/CONTEXTE.md` fixe le modèle de données à quatre tables :
`posts`, `post_replies`, `post_reactions`, `post_feedback`. Deux mécanismes
du fil n'ont pourtant pas de table dédiée dans cette liste : le partage et le
classement du « Pour toi » pondéré par le niveau de celui qui réagit.

## Décisions

**Un partage est un post ordinaire, pas une table séparée.**
`posts.shared_post_id` référence un autre post de la même table (comme
`messages.parent_message_id` pour les fils de discussion du lot 5). Un
contrainte `posts_body_or_share` impose un texte non vide sauf si le post est
un partage, qui peut rester vide (partage simple, sans commentaire). Un
partage apparaît dans le fil Abonnements de ses propres followers exactement
comme n'importe quel post : aucune mécanique de diffusion supplémentaire à
écrire. Si l'original est supprimé, le partage disparaît avec lui
(`ON DELETE CASCADE`) plutôt que de rester orphelin avec une référence morte.

**Le format d'un post contraint ses propres champs, vérifié en base.** Seul
le format `a_tester` peut porter un `test_url` et un `test_ask` ; la
contrainte `posts_test_fields_require_a_tester_format` l'impose avec un
`coalesce` explicite. Sans ce `coalesce`, un `CHECK` Postgres qui compare une
colonne nulle (`format` non renseigné) à `'a_tester'` vaut `NULL`, pas
`false`, et Postgres considère une contrainte qui vaut `NULL` comme
respectée : un post sans format aurait pu porter un lien de démo sans jamais
être rejeté. `coalesce(format = 'a_tester', false)` referme ce cas.

**« Marqué comme solution » : un seul par post, imposé par le code, pas par
un index partiel.** Aucun index partiel n'existe encore ailleurs dans ce
schéma ; `setPostReplySolution`
(`apps/server/src/api/repositories/posts.ts`) retire toute marque existante
dans la même transaction avant de poser la nouvelle, pour ne jamais laisser
deux réponses marquées sous une écriture concurrente. Seul l'auteur du post
peut marquer une réponse, et seulement sur un post de format Question.

**« Pour toi » sans pondération par niveau, en attendant le lot 8.**
`docs/CONTEXTE.md` prévoit un classement pondéré par le niveau de celui qui
réagit. Les niveaux n'existent pas encore (lot 8, pas posé) : `listPourToiFeed`
classe par un score simple (nombre de réactions Utile, pondéré plus le
nombre de retours structurés) sur les posts des quatorze derniers jours,
sans curseur de pagination — une liste bornée plutôt qu'un flux infini,
parce que le score n'est pas monotone avec la date et qu'un curseur stable
demanderait de figer ce score au premier chargement. Simplification
provisoire du même genre que le quota quotidien identique pour tout le monde
posé au lot 6 : à revoir une fois les niveaux posés.

**Lire ou partager un post supprimé n'est pas bloqué, volontairement.**
`GET /api/posts/:id` et `POST /api/posts/:id/share` ne vérifient pas
`deletedAt`, à la différence de la modification et de la suppression. Même
motif de tombe que les messages de salon
(`apps/server/src/api/repositories/chat.ts`) : la ligne reste, son contenu
est vidé par le sérialiseur (`serializePostSummary`,
`serializeSharedPostPreview`). Un lien vers un post supprimé affiche donc
« Post supprimé » plutôt qu'une erreur 404 qui laisserait deviner qu'il a
existé ou non.

**Pas de visibilité ni d'espace pour les posts.** Contrairement aux skills
(`docs/adr/0007-recherche-skills.md`), le fil est unique et public à tous les
comptes : aucune colonne de visibilité, aucune vérification d'appartenance à
un espace. Les posts privés ou limités à un espace ne sont pas prévus par
`docs/CONTEXTE.md` pour ce module.

**Aucun temps réel.** Le fil se recharge par requête, comme les skills du
lot 6, pas par Socket.IO comme les salons du lot 5 : `docs/CONTEXTE.md` ne
demande pas de mise à jour en direct pour ce module, et l'ajouter aurait
dupliqué la mécanique de diffusion sans besoin démontré.

## Conséquences

- Une fois le lot 8 posé, `listPourToiFeed` devra pondérer par le niveau de
  l'auteur de chaque réaction, pas seulement les compter : la requête
  actuelle isole déjà ce calcul dans une seule fonction à remplacer.
- Attribuer des points (victoire au « J'ai testé », réponse marquée comme
  solution) reste au lot 8 : ce lot ne câble aucun appel au registre de
  points, qui n'existe pas encore.
- Rien n'empêche aujourd'hui l'auteur d'un post À tester de donner son
  propre retour structuré, ni de réagir Utile à son propre post : ce n'est
  pas un problème tant qu'aucun point n'y est attaché, mais le lot 8 devra
  exclure l'auto-récompense ici comme il le fait déjà pour la notation d'un
  skill (`docs/CONTEXTE.md`).
