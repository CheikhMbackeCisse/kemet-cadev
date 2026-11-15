# Déclaration d'usage de l'IA

## L'équipe

Kemet est développé par l'équipe Kemet Labs. Notre travail couvre la conception du produit, la direction de l'interface, les choix techniques, les tests et le pilotage du développement avec l'IA.

Nous avons défini le produit et ses priorités, et décidé de l'interface (références visuelles, navigation, formulaires, page de connexion inspirée de celle de Systalink). Nous avons arbitré les choix techniques : la recherche plein texte PostgreSQL plutôt que des embeddings, aucune dépendance sous licence copyleft, le déploiement sur Datacloud. Nous avons testé l'application sur téléphone et sur ordinateur, et nos retours ont guidé plusieurs lots de corrections (navigation, formulaires, performances). Les règles du projet (licences, tests, revue de sécurité avant fusion) sont celles que nous avons approuvées. Chaque lot est testé (tests automatiques, relecture, captures avant et après) avant sa mise en ligne.

## Ce que fait l'IA

- Claude Code (Anthropic) a écrit le code, les tests et la documentation, lot par lot, d'après nos instructions.
- L'assistant Claude a servi à discuter le design et à planifier le travail.
- Manus AI a réalisé les logos.
- Claude a fait le montage de la vidéo de présentation.

## Dans le produit

L'assistant de Kemet s'appelle Kocc. On l'appelle en écrivant `@kocc` dans un salon ou dans une réponse sous un post (l'ancien `@kemet` reste reconnu). Il ne répond jamais de lui-même.

Kocc appelle des modèles de langage hébergés par des tiers, sur leurs offres gratuites. Une question part chez un seul fournisseur à la fois et passe au suivant si celui-ci ne répond pas : quota atteint, panne, délai dépassé, prompt trop long ou réponse JSON invalide. L'ordre est fixé dans `apps/server/src/ai/create-llm-provider.ts` :

1. **Google Gemini**, par `@ai-sdk/google` : le modèle de `GEMINI_MODEL` (`gemini-3.5-flash` dans `.env.example`, `gemini-flash-latest` si la variable est vide), puis celui de `GEMINI_LITE_MODEL` (`gemini-flash-lite-latest` par défaut), qui a son propre quota.
2. **Groq**, par un appel HTTP au format OpenAI : `openai/gpt-oss-120b`, puis `openai/gpt-oss-20b`, modèles à poids ouverts publiés par OpenAI et hébergés par Groq. Une demande plus grosse que la limite de Groq (8 000 tokens par minute) saute ce maillon.
3. **OpenRouter**, en dernier recours, même format : `google/gemma-4-26b-a4b-it:free` par défaut (`.env.example` ajoute `google/gemma-4-31b-it:free`), modèles gratuits hébergés par d'autres fournisseurs. Au plus 45 appels par jour, comptés dans Valkey.

Une clé absente retire son fournisseur de la chaîne. Si personne ne répond, la personne voit un message d'indisponibilité.

Ce qui part chez le fournisseur :

- **Dans un salon** : la consigne de l'assistant, le texte des 10 derniers messages du salon (sans le nom de leurs auteurs), le contenu du skill retenu et la question. Avant cela, un appel court ne reçoit que la question, avec le nom et la description d'au plus 20 skills présélectionnés par la recherche plein texte de PostgreSQL, pour choisir le skill.
- **Sous un post** : le texte du post, les 10 réponses précédentes, le skill retenu (public uniquement) et la question.
- **Pour "Qui a travaillé sur ce sujet ?"** : le texte du sujet, puis pour chaque travail présélectionné son titre, son type, son année, ses tags, sa stack, un extrait de son résumé, et l'identifiant et le nom affiché de ses auteurs.
- **Jamais** : une conversation privée, un mot de passe, une adresse email. Un visiteur sans compte ne déclenche aucun appel.

Le contenu des messages, posts et skills est passé comme donnée, jamais dans la consigne, et la réponse est affichée comme un contenu non fiable qui cite le skill et son auteur. La page de confidentialité de l'application dit ce qui est envoyé et à qui.

L'application ne dépend pas d'un fournisseur : chaque modèle passe par une interface unique (`LlmProvider` et `StreamingLlmProvider`, `apps/server/src/ai/llm-provider.ts`) et peut être remplacé sans toucher au reste du code. À terme, Kocc pourrait tourner sur des modèles ouverts hébergés sur l'infrastructure de Systalink, si elle le permet.

## Données de démonstration

- Les comptes, posts, réponses, skills, travaux, projets, compétitions et conversations de démonstration sont produits par le script de seed (`packages/db/src/seed/`). Les comptes portent `is_demo = true` et une adresse en `@demo.kemetlabs.dev`, qui ne reçoit jamais d'email. Le site affiche la mention "Données de démonstration" quand la variable `DEMO_CONTENT_NOTICE` est active.
- Les réponses de Kocc présentes dans ces données sont des réponses enregistrées, écrites à l'avance (`packages/db/src/assistant-recordings.ts`). Elles sont marquées en base (`assistant_invocations.recorded`) et affichées avec la mention "Réponse enregistrée".
- Les images et les vidéos de démonstration sont des pages HTML écrites à la main puis capturées (`packages/db/seed-assets/`) ; les avatars sont des motifs calculés (`packages/db/src/seed/avatar.ts`). Les avatars des comptes de démonstration ne sont pas générés par un modèle d'IA.
