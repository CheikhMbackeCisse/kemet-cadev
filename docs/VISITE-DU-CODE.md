# Visite du code

Trois trajets suivis fichier par fichier, avec les noms réels du dépôt. Ils
couvrent le temps réel, l'assistant Kocc et la mise en relation des Travaux.
Le code garde le nom interne `kemet` pour l'assistant (classes, tables,
routes) : seul le nom affiché a changé. Les schémas de séquence
correspondants sont dans `docs/conception/`.

Repères : `apps/web` est l'application React, `apps/server` contient trois
processus (`api`, `realtime`, `worker`), `packages/shared` les schémas Zod
communs, `packages/db` le schéma Drizzle.

## 1. Un message dans un salon

**Côté web.** Le composeur de `apps/web/src/pages/SpacePage.tsx` appelle
`send` du hook `useChannelMessages` (`apps/web/src/lib/chat/useChannelMessages.ts`).
Le message s'affiche tout de suite comme "en cours d'envoi", avec un
`clientId` tiré au hasard, puis `sendMessage` (`apps/web/src/lib/chat/api.ts`)
fait `POST /api/channels/:id/messages`.

**Route.** `apps/server/src/api/routes/messages.ts` :

1. limite de débit par compte, plus basse pour un compte de moins de 24 h
   (`antiSpamMax`, `apps/server/src/moderation/anti-spam.ts`) ;
2. session obligatoire (`requireSessionUserId`), profil non suspendu
   (`requireOwnProfile`) ;
3. droit sur le salon : `requireChannelAccess`
   (`apps/server/src/api/routes/channels.ts`) renvoie soit un salon d'espace,
   soit une conversation privée ;
4. corps validé par `createMessageSchema` (`packages/shared`) ;
5. dans une transaction : règle d'écriture d'une conversation sous verrou
   (`requireCanWrite`, `apps/server/src/messaging/write-block.ts`),
   `insertMessage` (`apps/server/src/api/repositories/chat.ts`), qui ne crée
   rien si le même `clientId` existe déjà (un renvoi après une coupure ne
   double pas le message), mentions et fichiers rattachés.

**Diffusion.** La route publie `message:new` sur Valkey par le
`ChatPublisher` (`apps/server/src/chat/pubsub.ts`). Le processus
`realtime` (`apps/server/src/realtime/main.ts`) est abonné par
`subscribeChatEvents` et relaie l'événement à la room Socket.IO du salon.
Seules les connexions qui ont passé `canAccessChannel`
(`apps/server/src/realtime/access.ts`) au moment de `channel:join` sont dans
cette room : un visiteur peut lire un salon public, jamais un salon privé.

**Retour côté web.** `onChatEvent` (`apps/web/src/lib/chat/socket.ts`)
transmet l'événement à `useChannelMessages`, qui remplace la ligne "en
cours d'envoi" par le message reçu grâce au `clientId`. Les autres
personnes du salon reçoivent le même événement.

À retenir : `api` et `realtime` ne se parlent que par Valkey. L'un peut
redémarrer sans l'autre, et `realtime` ne fait jamais d'écriture.

## 2. Un appel à Kocc

**Déclenchement.** Toujours explicite. Après l'envoi du message, la même
route teste `mentionsAssistant` (`apps/server/src/chat/kemet-assistant.ts`)
et, dans un salon d'espace seulement, lance `handleMention` sans l'attendre.
Une conversation privée n'appelle jamais l'assistant. Sous un post, c'est une
réponse qui contient la mention qui déclenche `KemetPostAssistant`
(`apps/server/src/ai/post-assistant.ts`) ; le post seul ne l'appelle pas.

**Orchestration.** `KemetAssistantOrchestrator`
(`apps/server/src/ai/assistant-orchestrator.ts`) :

1. `parseAssistantRequest` sépare la question des skills demandés
   ("@kocc avec wave-paiements, ...") ;
2. `checkDailyQuota` (`apps/server/src/ai/quota.ts`) : quota du jour selon le
   niveau, compté de façon atomique dans Valkey (`RedisQuotaCounter`) ;
3. ligne `assistant_invocations` créée en attente, puis une place dans la
   file globale (`ConcurrencyLimiter`, trois réponses à la fois par défaut).

**Choix du skill.** `AssistantAnswerer`
(`apps/server/src/ai/assistant-answerer.ts`) est le cœur commun aux salons et
aux posts. Sans skill demandé, `FullTextRetriever`
(`apps/server/src/ai/skill-retriever.ts`) présélectionne jusqu'à 20 skills
visibles par la personne, par `plainto_tsquery` en français et en anglais
classé par `ts_rank`. Un premier appel court au modèle ne voit que leur nom
et leur description et répond par un identifiant ; un identifiant hors liste
est ignoré. Seul le skill retenu est chargé en entier.

**Prompt.** `buildAssistantMessages` met la consigne fixe
(`SYSTEM_PROMPT_PREFIX`) dans le message système, et les données dans des
messages utilisateur balisés : `<historique>` (10 derniers messages),
`<skill>`, et `<post>` sous un post. Rien qui vient d'un utilisateur n'entre
dans la consigne. Une réponse déjà donnée pour la même question, les mêmes
skills et le même salon sort du cache (`apps/server/src/ai/response-cache.ts`).

**Chaîne de secours.** `LlmChain` (`apps/server/src/ai/llm-chain.ts`),
construite par `createLlmChainFromEnv`
(`apps/server/src/ai/create-llm-provider.ts`), essaie les maillons dans
l'ordre : Gemini (`gemini-provider.ts`, `@ai-sdk/google`), Gemini Lite, Groq
puis OpenRouter (`openai-compatible-provider.ts`, `fetch` au format OpenAI).
Un 429, une erreur 5xx, un délai dépassé avant le premier morceau ou un
prompt trop long fait passer au suivant ; un modèle à 429 est mis en pause
pendant le délai annoncé. Le budget du jour d'OpenRouter est compté dans
Valkey (`daily-budget.ts`). Une fois le premier morceau reçu, la chaîne ne
change plus de fournisseur.

**Streaming.** Chaque morceau part en `assistant:chunk` par le même chemin
Valkey puis Socket.IO que les messages. À la fin, la réponse est enregistrée
comme un message du profil système de l'assistant
(`KEMET_ASSISTANT_PROFILE_ID`), l'invocation est complétée (fournisseur,
skills) et `assistant:done` porte la citation : le skill et son auteur
(`serializeSkillCitation`, `apps/server/src/api/skill-serializers.ts`).
Côté web, `useChannelMessages` assemble les morceaux et
`apps/web/src/components/assistant/AssistantMessage.tsx` affiche la bulle,
la citation en haut et, pour une réponse enregistrée, la mention "Réponse
enregistrée".

**Si tout échoue.** Avec `ASSISTANT_RECORDED_ANSWERS=true`, une question de
démonstration connue (`packages/db/src/assistant-recordings.ts`) reçoit sa
réponse enregistrée, rejouée par morceaux et marquée `recorded`. Toute autre
question publie `assistant:failed`, visible par la seule personne qui a
demandé.

## 3. "Qui a travaillé sur ce sujet ?"

**Visiteur.** Sur la page d'un travail ou d'un projet, `WorkMatchPanel`
(`apps/web/src/components/works/WorkMatchPanel.tsx`) lit
`GET /api/works/:slug/related-people` (ou `/api/projects/:slug/...`,
`apps/server/src/api/routes/related-people.ts`). `findRelatedPeople`
(`apps/server/src/api/repositories/related-people.ts`) classe en SQL les
auteurs des travaux qui partagent le plus de tags et d'éléments de stack,
sans figurant ni compte suspendu, sans les auteurs déjà affichés. Aucun appel
au modèle : trois avatars et un nombre.

**Membre connecté.** Le bouton "Trouver qui a travaillé sur ce sujet" fait
`POST /api/work-matches` (`apps/server/src/api/routes/work-matches.ts`) :
session, profil non suspendu, limite de débit, corps validé par Zod. Puis
`WorkMatcher.match` (`apps/server/src/ai/work-matcher.ts`) :

1. lit le texte du sujet (travail, projet ou post Question) ;
2. `FullTextWorkRetriever` (`apps/server/src/ai/work-retriever.ts`)
   présélectionne jusqu'à 20 travaux par `ts_rank`, jamais ceux de la
   personne qui demande ni le sujet lui-même ;
3. vérifie le quota du jour, partagé avec l'assistant ;
4. `buildMatchMessages` place le sujet et les candidats dans `<sujet>` et
   `<travaux>`, chevrons des données neutralisés, et retire des candidats
   tant que le prompt dépasse son budget de tokens ;
5. la chaîne répond en JSON ; `parseModelSuggestions` ne garde que des
   couples (travail, personne) présents dans la présélection. Une personne
   inventée ou imposée par un texte piégé est donc toujours rejetée ;
6. une ligne `work_match_requests` garde le mode (`assistant`, `recorded`
   ou `full_text`) et le fournisseur.

Si aucun fournisseur ne répond, le résultat retombe sur la présélection
plein texte (`fullTextSuggestions`) et rien n'est compté dans le quota.

**Suite.** Depuis le résultat, "Rejoindre la discussion" ouvre le salon
public du travail ; "Écrire à l'équipe en privé" crée une conversation de
groupe rattachée au travail (`POST /api/conversations/team`,
`apps/server/src/api/routes/conversations.ts`).

## Où sont les tests de ces trajets

- Messages et accès : `apps/server/src/api/*.integration.test.ts` (base
  PostgreSQL réelle), `apps/web/e2e/` pour les parcours complets.
- Assistant : `apps/server/src/ai/assistant-orchestrator.integration.test.ts`,
  `post-assistant.integration.test.ts`, `llm-chain.test.ts` et
  `llm-chain.http.test.ts` (vrais clients HTTP contre un serveur local).
- Attaques par injection : `evals/prompt-injection.ts`, lancé à la main,
  jamais en CI.
