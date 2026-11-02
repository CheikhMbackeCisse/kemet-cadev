# 0022 : Réponses enregistrées de l'assistant

## Contexte

Le bloc de réponse de @kemet est l'élément le plus marquant de l'interface,
mais rien dans les données de démonstration ne le montrait : un visiteur ne
le voyait jamais. Et le jour d'une démonstration, Gemini et OpenRouter
peuvent être saturés en même temps, sur leurs offres gratuites : un appel à
@kemet échouerait alors devant le public.

Montrer une réponse écrite à l'avance comme si elle venait d'être générée
serait mentir sur ce que fait le produit.

## Décision

**Une seule marque, sur l'invocation.** `assistant_invocations.recorded`
(booléen, faux par défaut, migration additive) dit qu'une réponse a été
rejouée depuis un enregistrement. Elle est renvoyée avec la citation du
skill (`GET /api/messages/:id/assistant-invocation`) et portée par les
événements `assistant:chunk` et `assistant:done`. Le bloc de réponse affiche
alors "Réponse enregistrée", y compris pendant qu'elle s'écrit.

**Les enregistrements vivent dans le code.**
`packages/db/src/assistant-recordings.ts` contient quatre questions de
démonstration, chacune liée à un skill de démo, et leur réponse. Le seed et
le serveur lisent le même fichier : la réponse affichée dans le salon de
démonstration est exactement celle que rejoue le secours.

**Seed.** Trois de ces échanges sont posés dans le salon "général" de
CADEV 2026, juste après les messages qui posent déjà ces questions, avec
leur invocation marquée `recorded`. Deux sont marqués "Utile" : l'auteur du
skill reçoit les points correspondants (montant de base, sans la
pondération par niveau). Personne n'y interroge l'assistant sur son propre
skill. Le quatrième enregistrement (signature d'un webhook Wave) reste
libre pour une démonstration en direct.

**Secours, `ASSISTANT_RECORDED_ANSWERS=true`.** Désactivé par défaut. Quand
aucun fournisseur ne répond (`LlmProviderError` ou
`BothProvidersUnavailableError`) et qu'aucun morceau de réponse n'est encore
parti, l'orchestrateur cherche un enregistrement dont la question est
exactement celle posée, à la casse, aux accents et à la ponctuation près.
S'il y en a un, il le rejoue en streaming et cite son skill. Sinon, l'échec
reste celui d'avant. Une question approchante ne reçoit jamais de réponse
enregistrée. Sans clés d'API mais avec la variable activée, l'assistant
utilise `UnavailableLlmProvider`, qui échoue toujours : seules les questions
de démonstration reçoivent une réponse.

**Lecture par un visiteur.** Le détail d'une invocation et les skills
publics deviennent lisibles sans compte, comme les messages d'un salon
public depuis l'ADR 0014 : la réponse vue par un visiteur cite un skill, le
lien doit mener à sa page. Un salon privé et un skill qui n'est pas public
restent introuvables (404). Noter un skill, le supprimer ou marquer une
réponse "Utile" demandent toujours un compte.

## Conséquences

- Un enregistrement n'est jamais présenté comme une réponse en direct, ni
  dans le salon, ni pendant le rejeu.
- Le cache des réponses n'enregistre jamais une réponse rejouée.
- Un rejeu compte dans le quota quotidien comme un appel normal : il passe
  par la même invocation.
- Ajouter une question de démonstration demande une modification du code
  et un déploiement, ce qui est voulu : la liste reste courte et relue.
