# Séquence : un appel à Kocc

Une personne écrit `@kocc` (ou l'ancien `@kemet`, gardé comme alias) dans
un salon d'espace. Le code garde le nom interne `kemet` (classes, tables). La route d'envoi répond
tout de suite avec le message enregistré ; la réponse de l'assistant arrive
ensuite morceau par morceau par Socket.IO. Code :
`apps/server/src/api/routes/messages.ts`,
`apps/server/src/ai/assistant-orchestrator.ts`,
`apps/server/src/ai/assistant-answerer.ts`, `apps/server/src/ai/llm-chain.ts`.
Un appel sous un post suit le même cœur (`AssistantAnswerer`) par
`KemetPostAssistant` (`apps/server/src/ai/post-assistant.ts`).

```mermaid
sequenceDiagram
  autonumber
  actor P as Personne
  participant W as App web
  participant API as api (Fastify)
  participant DB as PostgreSQL
  participant V as Valkey
  participant RT as realtime (Socket.IO)
  participant O as KemetAssistantOrchestrator
  participant C as LlmChain

  P->>W: écrit "@kocc ..." et envoie
  W->>API: POST /api/channels/:id/messages
  API->>DB: insertMessage (transaction)
  API->>V: publish message:new
  V-->>RT: relais pub/sub
  RT-->>W: message:new (room du salon)
  API-->>W: 200 { message }
  API->>O: handleMention (non attendu)

  O->>V: checkDailyQuota (selon le niveau, compteur atomique RedisQuotaCounter)
  alt quota atteint
    O->>V: publish assistant:failed (quota_exceeded)
    V-->>RT: relais
    RT-->>W: avis visible par la seule personne qui a demandé
  else quota disponible
    O->>DB: insertInvocation (pending)
    O->>O: ConcurrencyLimiter : attend une place (3 réponses à la fois par défaut)
    O->>DB: markInvocationStreaming
    O->>DB: FullTextRetriever : présélection plein texte des skills
    O->>C: choix du skill (nom et description seulement)
    O->>V: cache de réponse (clé : salon, question, skills)
    alt réponse en cache
      O->>V: publish assistant:chunk (texte entier)
    else pas en cache
      O->>C: streamResponse(historique du salon, skill retenu)
      loop chaque maillon : Gemini, Gemini Lite, Groq, OpenRouter
        C->>C: maillon en pause après un 429 ? prompt trop long pour Groq ?
        opt OpenRouter
          C->>V: budget du jour (tryConsume)
        end
        alt 429, 5xx, délai dépassé, JSON invalide, avant le premier morceau
          C->>C: pause du modèle, log llm_fallback, maillon suivant
        else premier morceau reçu
          C-->>O: morceaux de texte
          O->>V: publish assistant:chunk
          V-->>RT: relais
          RT-->>W: texte qui s'affiche au fil de l'eau
        end
      end
      opt toute la chaîne a échoué
        C-->>O: AllProvidersUnavailableError
        O->>O: réponse enregistrée si ASSISTANT_RECORDED_ANSWERS et question de démo connue
      end
      O->>V: met la réponse en cache
    end
    O->>DB: insertMessage (réponse), completeInvocation (fournisseur, skills)
    O->>V: publish assistant:done
    V-->>RT: relais
    RT-->>W: réponse finale, skill cité et son auteur
  end
```

Points de conception :

- Le quota se vérifie avant de créer la ligne d'invocation, sinon elle
  compterait dans son propre total.
- Le contenu des skills et l'historique du salon sont passés comme données,
  jamais dans la consigne système (`docs/adr/0009-assistant-kemet.md`).
- Les pauses après un 429 vivent en mémoire du processus `api` ; seul le
  budget OpenRouter est partagé, dans Valkey
  (`docs/adr/0027-chaine-de-secours-ia.md`).
- Si un fournisseur échoue après le premier morceau, la réponse n'est pas
  recommencée ailleurs : l'invocation échoue et la personne voit l'erreur.
