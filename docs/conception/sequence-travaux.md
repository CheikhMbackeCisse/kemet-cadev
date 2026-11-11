# Séquence : "Qui a travaillé sur ce sujet ?"

Sur un travail, un projet ou un post Question, un bouton demande à Kocc de
proposer des personnes qui ont publié un travail proche. L'appel n'est jamais
fait au chargement de la page, seulement au clic, et jamais pour un visiteur :
sur un travail ou un projet, un visiteur voit à la place jusqu'à trois
personnes trouvées par tags et stack communs, sans le modèle
(`GET /api/works/:slug/related-people`, `GET /api/projects/:slug/related-people`,
`apps/server/src/api/repositories/related-people.ts`). Code :
`apps/server/src/api/routes/work-matches.ts`,
`apps/server/src/ai/work-matcher.ts`, `apps/server/src/ai/work-retriever.ts`.
Décisions : `docs/adr/0025-travaux.md`.

```mermaid
sequenceDiagram
  autonumber
  actor P as Personne
  participant W as App web
  participant API as api (Fastify)
  participant M as WorkMatcher
  participant DB as PostgreSQL
  participant C as LlmChain

  opt visiteur
    W->>API: GET /api/works/:slug/related-people
    API->>DB: findRelatedPeople : termes communs, sans figurants ni comptes suspendus
    API-->>W: total et trois personnes, lecture seule
  end
  P->>W: clic "Trouver qui a travaillé sur ce sujet"
  W->>API: POST /api/work-matches { subject: work, project ou post }
  API->>API: session, profil complet, compte non suspendu, limite de débit
  API->>M: match(subject, profil)
  M->>DB: texte du sujet (titre, résumé, tags)
  M->>DB: FullTextWorkRetriever : travaux proches, plein texte (ts_rank)
  note right of M: jamais la personne qui demande, jamais le travail lui-même
  alt aucun candidat
    M-->>W: mode full_text, liste vide
  else candidats trouvés
    M->>DB: checkDailyQuota (assistant et Travaux confondus)
    alt quota atteint
      M-->>W: mode full_text, raison quota_exceeded
    else
      M->>C: streamResponse(sujet et candidats en données, schéma JSON attendu)
      note right of C: la chaîne valide le JSON avec Zod et passe au modèle suivant s'il est invalide
      alt la chaîne répond
        C-->>M: JSON des suggestions
        M->>M: parseModelSuggestions : seulement des personnes de la présélection
        M->>DB: insert work_match_requests (mode assistant, fournisseur)
        M-->>W: suggestions avec une justification chacune
      else toute la chaîne échoue
        M->>M: réponse enregistrée si mode démo et sujet connu
        M-->>W: mode recorded, ou full_text avec raison unavailable
      end
    end
  end
  W-->>P: personnes proposées, liens vers leurs travaux
  P->>W: "Rejoindre la discussion" ou "Écrire à l'équipe en privé"
```

Points de conception :

- Le résumé d'un travail est un texte écrit par n'importe qui : il est passé
  comme donnée, et une suggestion hors de la présélection est rejetée (cas
  testé dans `evals/prompt-injection.ts`).
- Le prompt est coupé au-delà d'environ 6 000 tokens estimés, la limite par
  minute de Groq.
- Quand aucun fournisseur ne répond, rien ne compte dans le quota du jour.
