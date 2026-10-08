# 0007 — Recherche et sélection des skills

## Contexte

L'assistant @kemet doit choisir, parmi les skills que la communauté a
publiés, celui ou ceux pertinents pour une question posée dans un salon. Le
choix initial (voir `docs/CONTEXTE.md`) était de charger seulement les
passages pertinents des notes d'un skill, retrouvés par recherche
sémantique avec des embeddings calculés localement par transformers.js
(modèle multilingual-e5-small), stockés dans pgvector.

En posant le lot 1, cette approche s'est heurtée à un conflit de licence :
transformers.js (et son successeur `@huggingface/transformers`) dépend en
dur de `sharp`, qui embarque `libvips` sous licence LGPL — une licence
explicitement interdite par nos règles de licence (`scripts/check-licenses.ts`). Aucune version de la librairie ne
permet d'éviter cette dépendance.

## Décision

Les embeddings et pgvector sont retirés des priorités P0. La sélection des
skills se fait en trois étapes, toutes avec des outils déjà dans la pile :

1. **Présélection par recherche plein texte PostgreSQL.** Une colonne
   `tsvector` sur chaque skill, calculée à partir du nom, de la description
   et des tags, avec deux configurations de recherche (`french` et
   `english`, la communauté écrit dans les deux langues). La requête retourne
   au plus 20 candidats, filtrés aux skills que l'utilisateur courant a le
   droit d'utiliser (skills privés à leur auteur ou à son espace, skills
   publics accessibles à tous).
2. **Choix du skill par le modèle.** Le modèle reçoit le nom et la
   description des candidats présélectionnés, et choisit celui ou ceux
   pertinents pour la question, ou aucun si rien ne correspond.
3. **Chargement intégral du skill retenu.** Pas de découpage en passages ni
   de recherche de similarité à l'intérieur du skill : tout son contenu est
   envoyé au modèle. Une taille maximale de 20 000 caractères est imposée et
   vérifiée à l'enregistrement d'un skill, pour que ce chargement reste
   prévisible en coût et en tokens.

Le code vit derrière une interface `SkillRetriever` dans
`apps/server/src/ai/`, avec une implémentation `FullTextRetriever` pour le
P0 :

```ts
interface SkillRetriever {
  findCandidates(query: string, userId: string, limit?: number): Promise<SkillCandidate[]>;
}
```

`FullTextRetriever` est la seule implémentation en P0. Elle encapsule la
requête `tsvector`/`tsquery` et le filtre de droits. Rien dans
`apps/server/src/ai/` ni dans les appelants ne doit supposer que la
présélection vient forcément d'une recherche plein texte : le choix du skill
par le modèle (étape 2) et le chargement intégral (étape 3) ne changent pas
si l'implémentation change.

La table `skill_chunks`, prévue pour stocker des passages découpés avec leur
embedding, est abandonnée : elle n'a plus de rôle sans recherche
sémantique interne au skill.

PostgreSQL passe à l'image officielle 16 (sans l'extension pgvector, qui
n'est plus utilisée nulle part dans le P0).

## Conséquences

- Plus simple à expliquer au jury et à déboguer : une requête SQL lisible
  plutôt qu'un modèle d'embeddings et son pipeline d'ingestion.
- Plus rapide à livrer : pas de choix de modèle de remplacement à faire
  dans l'urgence, pas de dépendance supplémentaire à auditer.
- Moins précis qu'une recherche sémantique quand la question reformule un
  besoin sans reprendre les mots du nom ou de la description d'un skill.
  Les auteurs de skills doivent soigner leur nom, leur description et leurs
  tags : ce sont maintenant les seuls leviers de la présélection.
- La limite de 20 000 caractères par skill borne le coût d'un appel, mais
  interdit les skills très longs tels quels : un auteur doit scinder un
  sujet trop large en plusieurs skills.
- **Possible en P2** : une implémentation `VectorRetriever` de
  `SkillRetriever`, par exemple avec des embeddings calculés via l'API
  Mistral plutôt qu'en local (évite le problème de licence de transformers.js),
  combinée à la présélection plein texte ou à sa place. L'interface
  `SkillRetriever` est conçue pour ce remplacement sans toucher au reste de
  l'assistant.
