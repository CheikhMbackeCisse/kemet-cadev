# 0027. Chaîne de secours entre fournisseurs d'IA

## Contexte

L'assistant reposait sur deux fournisseurs : Gemini, puis OpenRouter en
secours (ADR 0009). Deux limites sont apparues le 03/11/2026 :

- l'offre gratuite de `gemini-3.5-flash` s'arrête à 5 requêtes par minute ;
- l'offre gratuite d'OpenRouter s'arrête à 50 requêtes par jour, tous
  modèles gratuits confondus.

En vérifiant la bascule contre un faux serveur HTTP, un défaut plus grave
est apparu : avec le SDK `ai` en version 7, `textStream` se termine sans
rien lever quand l'appel échoue. Une erreur 429 de Gemini donnait donc une
réponse vide, jamais la réponse d'OpenRouter. Le SDK refaisait aussi deux
tentatives sur chaque erreur, et sans `onError` il écrivait l'erreur
entière dans la console, corps de la requête compris, donc le prompt. Enfin,
la version 7 refuse un message `system` dans `messages` : chaque appel à
Gemini, qui porte toujours la consigne de l'assistant, échouait avant de
partir.

## Décision

Une chaîne de maillons, chacun étant un modèle chez un fournisseur, appelés
dans cet ordre (`apps/server/src/ai/llm-chain.ts`) :

1. Gemini (`GEMINI_MODEL`) ;
2. Gemini Lite (`GEMINI_LITE_MODEL`, par défaut
   `gemini-flash-lite-latest`) : le quota gratuit de Gemini est compté par
   modèle (`GenerateRequestsPerMinutePerProjectPerModel`), vérifié par un
   appel réel pendant que `gemini-3.5-flash` répondait 429 ;
3. Groq (`GROQ_MODELS`, par défaut `openai/gpt-oss-120b` puis
   `openai/gpt-oss-20b`) : quotas séparés par modèle, 1 000 requêtes par
   jour et 8 000 tokens par minute chacun ;
4. OpenRouter (`OPENROUTER_MODELS`), en dernier à cause de son quota du jour.

On passe au maillon suivant sur un 429, un 402, un 5xx, une coupure réseau,
un modèle introuvable, un délai dépassé, un prompt refusé parce que trop
long, une réponse vide, et une réponse JSON qui ne passe pas la validation
Zod quand on en demande une. Une fois un morceau de réponse affiché, on ne
change plus de maillon.

- **Consigne système de Gemini** passée par l'option `instructions` du SDK.
- **Délais par fournisseur**, fixés d'après des mesures réelles avec une
  marge de deux à trois fois : 15 s avant le premier morceau pour Gemini,
  8 s pour Gemini Lite, 10 s pour Groq, 20 s pour OpenRouter. Une réponse
  JSON, qui n'est affichée qu'entière, a un délai pour la réponse complète.
- **Délai d'attente annoncé** : un 429 met le maillon en pause pendant le
  délai donné par `retry-after`, par le `RetryInfo` de Gemini ou par
  `X-RateLimit-Reset` d'OpenRouter. Le délai est plafonné à une heure,
  sauf la remise à zéro du quota du jour d'OpenRouter (24 h au plus). Les questions suivantes
  sautent le maillon sans l'appeler. Le `retry-after` que Groq joint au
  refus d'un prompt trop long n'est pas appliqué : un prompt plus court
  passerait.
- **Prompt trop long pour Groq** : la taille est estimée avant l'envoi
  (3 caractères par token, plus prudent que les 3,6 mesurés) ; au-delà de
  8 000, Groq est sauté sans appel. Un 429 qui parle de tokens par minute
  reste un quota épuisé, avec sa pause.
- **Budget OpenRouter** : un compteur par jour UTC dans Valkey
  (`OPENROUTER_DAILY_LIMIT`, 45 par défaut). Une fois atteint, la chaîne
  saute OpenRouter, sans bloquer Gemini ni Groq. Si Valkey ne répond pas en
  une seconde, OpenRouter est aussi sauté : son quota reste protégé.
- **Clé absente** : son fournisseur est retiré de la chaîne. L'assistant
  démarre avec n'importe laquelle des trois clés.
- **Groq et OpenRouter sans SDK** : un appel `fetch` au format OpenAI
  (`openai-compatible-provider.ts`), qui lit lui-même statut et en-têtes et
  ne relance jamais un appel. `@ai-sdk/openai` est retiré des dépendances.
- **Sorties structurées** : stricte (`json_schema`, décodage contraint) pour
  les modèles gpt-oss chez Groq, qui ne la permettent pas en streaming ;
  mode JSON simple pour les autres ; `Output.object` pour Gemini. Dans tous
  les cas, la validation Zod de la chaîne décide.
- **Réflexion de gpt-oss** : `reasoning_effort: "low"` et
  `include_reasoning: false`, pour une première phrase plus rapide et moins
  de tokens comptés dans la limite par minute.
- **Journaux** : seulement l'événement, le fournisseur, le modèle, la cause
  et la durée de pause. Jamais le prompt, la réponse ni une clé ; le message
  d'une erreur de fournisseur se limite au statut HTTP.

Quand toute la chaîne échoue, l'assistant affiche « L'assistant est très
sollicité, réessaie dans quelques minutes. », et les réponses enregistrées
(ADR 0022) restent le dernier recours.

## Conséquences

- Les tests de `llm-chain.http.test.ts` lancent les vrais clients contre un
  serveur HTTP local (429, 5xx, silence, flux vide, prompt trop long) :
  c'est ce niveau de test qui montre une erreur avalée par un SDK.
- La valeur `groq` est ajoutée à l'enum `llm_provider_name` (migration
  additive) pour garder le fournisseur qui a répondu.
- Les pauses vivent en mémoire de chaque processus `api` : après un
  redémarrage, un modèle en pause est rappelé une fois avant d'être de
  nouveau mis en pause.
- Le pire cas, quand tous les fournisseurs se taisent sans répondre, dépasse
  une minute avant le message d'indisponibilité. En pratique, un quota
  épuisé répond en moins de deux secondes.
- Chaque fournisseur ajouté reçoit le texte des questions : la page de
  confidentialité les nomme tous les trois.
