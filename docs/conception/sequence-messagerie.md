# Séquence : messagerie privée

Une conversation privée est un salon sans espace : elle réutilise les
messages, fichiers, réactions et non-lus des salons. Ce qui change, c'est qui
peut écrire. Code : `apps/server/src/api/routes/conversations.ts`,
`apps/server/src/messaging/write-block.ts`,
`apps/server/src/api/repositories/conversations.ts`. Décisions :
`docs/adr/0026-messagerie-privee.md`.

"Se connaître" (`knowsSender`) veut dire : la destinataire suit la personne
qui écrit, ou elles partagent un espace privé, ou elles ont signé un même
travail.

```mermaid
sequenceDiagram
  autonumber
  actor A as Awa (écrit)
  actor B as Bilal (reçoit)
  participant API as api (Fastify)
  participant DB as PostgreSQL
  participant RT as realtime, via Valkey

  rect rgba(127,127,127,0.08)
  note over A,RT: Demande
  A->>API: POST /api/conversations { handles: [bilal] }
  API->>DB: blocage dans un sens ou l'autre ?
  alt bloqué
    API-->>A: 403
  else
    API->>DB: conversation déjà ouverte (direct_key) ?
    API->>DB: knowsSender(Bilal, Awa)
    API->>DB: insertConversation : Awa accepted, Bilal accepted si connu, sinon pending
    API-->>A: 200 { conversation }
  end
  A->>API: POST /api/channels/:id/messages (premier message)
  API->>DB: verrou par conversation, findWriteBlock
  API->>DB: insertMessage
  API->>RT: message:new, activité de conversation
  RT-->>B: demande dans "Messages", pastille
  A->>API: deuxième message avant acceptation
  API->>DB: findWriteBlock = awaiting_acceptance
  API-->>A: 403 "Votre premier message attend que la personne accepte"
  end

  rect rgba(127,127,127,0.08)
  note over A,RT: Acceptation
  B->>API: POST /api/conversations/:id/accept
  API->>DB: Bilal passe en accepted
  API->>RT: activité de conversation
  RT-->>A: la conversation s'ouvre, chacun écrit librement
  end

  rect rgba(127,127,127,0.08)
  note over A,RT: Blocage
  B->>API: PUT /api/users/awa/block
  API->>DB: blockProfile
  opt Bilal avait une demande en attente d'Awa
    API->>DB: Bilal passe en left
    API->>RT: conversation:member-left
  end
  A->>API: POST /api/channels/:id/messages
  API->>DB: findWriteBlock = blocked
  API-->>A: 403 "Vous ne pouvez plus écrire dans cette conversation."
  end
```

Variantes :

- **Groupe** (plusieurs destinataires) : pas de demande. Chaque destinataire
  doit déjà connaître la personne qui écrit, et aucun destinataire ne doit en
  avoir bloqué un autre, sinon refus. Sans cette règle, un complice qui
  accepte lèverait la limite d'un message pour tous.
- **Équipe d'un travail** (`POST /api/conversations/team`) : chaque auteur
  reçoit une demande, même s'il connaît la personne, et un blocage entre
  deux auteurs n'est jamais opposé à la personne qui écrit.
- Kocc n'est jamais appelé dans une conversation privée.
