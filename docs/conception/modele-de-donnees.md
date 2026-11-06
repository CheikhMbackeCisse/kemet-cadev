# Modèle de données

Tiré du schéma Drizzle (`packages/db/src/schema/`). Seules les tables
principales et leurs clés figurent ici ; les tables de Better Auth (`user`,
`session`, `account`, `verification`), `skill_files`, `skill_ratings`,
`mcp_servers`, `space_invites`, `message_mentions`, `post_attachments`,
`work_external_authors`, `work_links`, `work_attachments`, `credentials`,
`reports` et `moderation_actions` sont omises pour garder le schéma lisible.

Aucun total n'est stocké : points, niveau, phase d'une compétition, classement
et non-lus se calculent à la lecture.

```mermaid
erDiagram
  profiles ||--o{ follows : "suit"
  profiles ||--o{ space_members : "rejoint"
  spaces ||--o{ space_members : "a pour membres"
  spaces ||--o{ channels : "contient"
  conversations ||--o| channels : "a un salon"
  conversations ||--o{ conversation_members : "réunit"
  profiles ||--o{ conversation_members : "participe"
  profiles ||--o{ profile_blocks : "bloque"
  channels ||--o{ messages : "contient"
  messages ||--o{ messages : "fil de réponses"
  messages ||--o{ message_attachments : "joint"
  messages ||--o{ message_reactions : "reçoit"
  channels ||--o{ read_states : "lu jusqu'à"
  profiles ||--o{ messages : "écrit"
  profiles ||--o{ skills : "rédige"
  channels ||--o{ assistant_invocations : "appel à @kemet"
  messages ||--o| assistant_invocations : "déclenche"
  profiles ||--o{ posts : "publie"
  posts ||--o{ post_replies : "reçoit"
  posts ||--o{ post_reactions : "Utile"
  posts ||--o{ post_feedback : "retour structuré"
  profiles ||--o{ works : "publie"
  works ||--o{ work_authors : "coauteurs"
  works |o--o| channels : "discussion publique"
  works |o--o{ conversations : "équipe"
  works |o--o{ posts : "partagé dans"
  profiles ||--o{ work_match_requests : "demande"
  profiles ||--o{ projects : "possède"
  projects ||--o{ help_requests : "publie"
  help_requests ||--o{ applications : "reçoit"
  competitions ||--o{ teams : "inscrit"
  teams ||--o{ team_members : "compte"
  teams ||--o{ submissions : "soumet"
  projects ||--o{ submissions : "présenté par"
  submissions ||--o{ votes : "reçoit"
  submissions ||--o{ jury_scores : "noté par"
  profiles ||--o{ points_ledger : "gagne"

  profiles {
    uuid id PK
    text user_id FK "nullable après suppression"
    text handle UK
    text country
    profile_role role
    timestamp suspended_at
    timestamp deleted_at
    boolean is_demo
    boolean is_platform_admin
  }
  spaces {
    uuid id PK
    text slug UK
    space_visibility visibility "public ou private"
    space_kind kind
    timestamp archived_at
  }
  channels {
    uuid id PK
    uuid space_id FK "un des deux"
    uuid conversation_id FK "un des deux"
    text slug
  }
  conversations {
    uuid id PK
    uuid created_by FK
    text direct_key UK "conversation à deux"
    uuid work_id FK "conversation d'équipe"
  }
  conversation_members {
    uuid conversation_id FK
    uuid profile_id FK
    conversation_member_status status "accepted, pending, left"
  }
  messages {
    uuid id PK
    uuid channel_id FK
    uuid author_id FK
    uuid parent_message_id FK
    text client_id "idempotence de l'envoi"
    timestamp deleted_at
  }
  assistant_invocations {
    uuid id PK
    uuid trigger_message_id FK
    uuid response_message_id FK
    uuid_array skill_ids
    llm_provider_name provider "gemini, groq, openrouter"
    assistant_invocation_status status
    boolean recorded
    boolean helpful
  }
  skills {
    uuid id PK
    uuid author_id FK
    uuid space_id FK
    text slug UK
    skill_visibility visibility
    tsvector search_vector
  }
  posts {
    uuid id PK
    uuid author_id FK
    uuid shared_post_id FK
    post_format format
    uuid work_id FK
  }
  works {
    uuid id PK
    uuid publisher_id FK
    text slug UK
    work_type type
    work_status status
    uuid channel_id FK
    tsvector search_vector "tenu par un trigger"
  }
  work_authors {
    uuid work_id FK
    uuid profile_id FK
    work_author_status status
  }
  work_match_requests {
    uuid requested_by FK
    work_match_subject subject_type "work, project, post"
    uuid subject_id
    work_match_mode mode "assistant, recorded, full_text"
    llm_provider_name provider
  }
  points_ledger {
    uuid profile_id FK
    points_source source
    uuid source_id
    integer amount
    uuid given_by_profile_id FK
  }
  competitions {
    uuid id PK
    competition_status status
    timestamp registration_closes_at
    timestamp submission_closes_at
    timestamp voting_closes_at
  }
```

Contraintes à connaître :

- `channels` : `CHECK` sur `space_id` ou `conversation_id`, jamais les deux
  (`docs/adr/0026-messagerie-privee.md`).
- `points_ledger` : index unique sur `(source, source_id, profile_id)`, qui
  rend chaque attribution idempotente (`docs/adr/0011-points-et-niveaux.md`).
- `reports` et `moderation_actions` visent un message, un post ou un profil
  sans clé étrangère (`target_type`, `target_id`) : une cible supprimée ne
  fait pas disparaître le journal de modération.
