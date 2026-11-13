# 0033. @kemet dans les réponses d'un post

## Contexte

@kemet ne répondait que dans les salons. Le fil a des réponses sous chaque
post, mais pas de temps réel (ADR 0010) : la réponse de l'assistant ne peut
pas arriver par Socket.IO comme dans un salon. La table
`assistant_invocations` imposait un salon et un message déclencheur, alors
que le quota du jour, le compteur d'utilisations d'un skill, le droit de le
noter et les points d'un "Utile" se calculent tous à partir d'elle.

## Décision

- **Une seule table d'invocations.** `assistant_invocations` répond soit
  dans un salon (`channel_id`, `trigger_message_id`, `response_message_id`),
  soit sous un post (`post_id`, `trigger_reply_id`, `response_reply_id`).
  La contrainte `assistant_invocations_one_target` exige l'un ou l'autre,
  jamais les deux. Migration additive `0030_post_assistant_replies.sql` :
  deux colonnes deviennent nullables, trois sont ajoutées, aucune ligne
  existante n'est modifiée. Quota, utilisations et notes d'un skill, points
  d'un "Utile" restent donc communs sans code en plus.
- **Un seul cœur pour répondre.** `AssistantAnswerer`
  (`apps/server/src/ai/assistant-answerer.ts`) regroupe le choix du skill,
  le cache, la chaîne de fournisseurs et la réponse enregistrée de secours.
  L'orchestrateur des salons et `KemetPostAssistant` ne font plus que le
  quota, l'invocation et la publication. Le contexte est passé en blocs
  balisés (`<post>`, `<historique>`, `<skill>`) dans un message `user`,
  jamais dans le message système.
- **Appel explicite seulement.** Seule une réponse qui contient `@kemet`
  déclenche l'assistant. Le texte du post lui-même n'en déclenche jamais.
- **Pas de streaming sous un post.** La route de réponse vérifie le quota,
  crée l'invocation et rend la main ; la réponse est rédigée en arrière-plan
  puis publiée comme une réponse ordinaire de @kemet. La personne qui a posé
  la question relit l'état de l'invocation toutes les 1,5 s
  (`GET /api/post-assistant-invocations/:id`, réservé à elle) et voit les
  mêmes messages d'échec que dans un salon.
- **Une réponse de @kemet peut être la solution** d'une question, sans
  points : le registre ne crédite jamais le profil de l'assistant.
- **Skills publics seulement.** Une réponse sous un post est lisible par
  tous, visiteurs compris : seuls les skills publics peuvent la nourrir
  (`publicSkillsOnly`, `FullTextRetriever.findCandidates(..., { publicOnly })`),
  sinon le contenu d'un skill privé ou réservé à un espace sortirait de son
  cercle. Le cache est propre au post (`post:<id>`).
- **Relancer sans doublon.** `POST /api/post-assistant-invocations/:id/retry`
  relance une invocation en échec sur la même réponse déclencheuse, au lieu
  de publier la question une seconde fois.
- **Qui décide.** Noter une réponse (Utile, Pas utile) et la supprimer est
  réservé à la personne qui l'a demandée et à l'auteur du post. Si le post
  ou la réponse déclencheuse disparaît pendant la rédaction, la réponse
  n'est pas publiée.

## Conséquences

- La réponse n'apparaît qu'en entier, après quelques secondes d'attente
  affichées sous les réponses. Le temps réel du fil reste à faire s'il
  devient nécessaire.
- Un lecteur qui recharge la page pendant l'attente ne voit plus
  l'indicateur ; la réponse apparaît à son prochain chargement.
- Aucun plafond global de rédactions simultanées : le quota par personne
  borne le volume. Le quota se compte sans verrou, comme dans les salons ;
  deux appels exactement simultanés peuvent le dépasser d'une unité.
