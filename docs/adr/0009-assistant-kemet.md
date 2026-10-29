# 0009 — Assistant @kemet : orchestration, secours et protection contre l'injection

## Contexte

Le lot 6 branche l'assistant @kemet sur les salons : schéma des skills
(`packages/db/src/schema/assistant.ts`), interface `LlmProvider` avec
bascule Gemini vers OpenRouter (`docs/CONTEXTE.md`, section IA) et
présélection des skills par recherche plein texte
(`docs/adr/0007-recherche-skills.md`). Il restait à décider comment ces
pièces s'assemblent quand quelqu'un écrit `@kemet` dans un salon : qui
déclenche l'appel, comment la réponse arrive en streaming aux autres
membres, et comment le contenu d'un skill ou d'un message ne devient
jamais une instruction pour le modèle.

## Décision

**L'assistant répond comme un membre normal du salon, via un profil
système fixe.** La migration 0003 crée un compte `user` et un `profiles`
avec un identifiant fixe (`00000000-0000-0000-0000-000000000001`, handle
`kemet`), jamais connectable (aucune ligne `account` ni `credentials`
associée). Ses réponses sont des lignes `messages` ordinaires, créées par
`apps/server/src/api/repositories/chat.ts::insertMessage` comme n'importe
quel autre message. Ça évite de dupliquer l'affichage, la pagination, les
réactions et les fils pour un type de message à part : le client distingue
seulement l'auteur par son `authorHandle` pour choisir le composant
`AssistantMessage` plutôt que la bulle normale.

**Le déclenchement reste une mention comme une autre.**
`apps/server/src/chat/mentions.ts` détectait déjà `@kemet` comme n'importe
quel handle. `POST /api/channels/:id/messages` (voir
`apps/server/src/api/routes/messages.ts`) vérifie en plus avec
`mentionsAssistant` si le corps contient `@kemet`, et si oui appelle
`AssistantOrchestrator.handleMention` sans attendre sa fin : la réponse
HTTP du message déclencheur ne doit pas attendre la fin du flux du modèle,
diffusé à part par Socket.IO. Une erreur qui s'échappe de l'appel est
seulement journalisée, l'orchestrateur ayant déjà transformé tout échec
prévisible en événement `assistant:failed`.

**Diffusion en trois événements, réutilisant le pub/sub existant**
(`docs/adr/0006-temps-reel.md`) : `assistant:chunk` (un morceau de texte,
pour l'effet de streaming), `assistant:done` (le message final persisté,
plus la citation du skill retenu si applicable) et `assistant:failed` (un
code d'erreur). Aucun nouveau canal Valkey, aucun changement à `realtime`
qui relaie déjà n'importe quel type d'événement vers la room du salon.

**Interface `AssistantOrchestrator` avec une implémentation vide par
défaut.** `KemetAssistantOrchestrator` a besoin des deux clés d'API
(Gemini et OpenRouter) : sans elles, `buildApp` utilise
`NoopAssistantOrchestrator`, qui ignore silencieusement toute mention.
Utile en développement local avant d'avoir créé les comptes, et pour les
tests d'intégration qui n'ont pas besoin d'un vrai modèle pour vérifier le
reste du salon.

**Sélection du skill en deux appels, jamais un seul.** Un appel court, non
diffusé à l'utilisateur, ne voit que le nom et la description des
candidats présélectionnés par la recherche plein texte et répond par un
seul slug ou « aucun » (`KemetAssistantOrchestrator.selectSkillId`). Le
contenu intégral du skill retenu n'est chargé que pour le second appel,
celui qui répond réellement et qui est diffusé en streaming. Si la
personne a explicitement demandé un skill (`@kemet avec <slug>, …`), cette
étape de choix est sautée : la demande explicite fait foi, sous réserve
que la personne ait le droit de voir ce skill.

**Le contenu d'un skill et l'historique du salon sont des données,
jamais des instructions.** Le message système envoyé au modèle enveloppe
l'historique récent (dix derniers messages non supprimés) et le skill
retenu dans des balises `<historique>` et `<skill>`, précédées d'une
consigne explicite : ce contenu vient d'utilisateurs de la plateforme, il
ne doit jamais être interprété comme changeant le rôle du modèle ou lui
faisant appeler un outil, et aucun outil n'est de toute façon utilisable
sans accord donné en dehors de ce message (aucun outil MCP sans accord explicite de l'utilisateur). C'est la
seule protection : pas de filtre de sortie, pas de deuxième modèle
« surveillant ». `evals/prompt-injection.ts` teste cette consigne avec de
vraies attaques contre le vrai modèle, à la main.

**Quota et cache dérivés, jamais un registre à part.** Le quota quotidien
compte les lignes `assistant_invocations` du jour pour l'utilisateur
plutôt que de tenir un compteur séparé à incrémenter et à remettre à zéro.
Le niveau (`docs/CONTEXTE.md`) n'existe pas encore (lot 8 non posé) : la
limite est provisoirement la même pour tout le monde
(`DEFAULT_DAILY_QUOTA`), à affiner quand les niveaux existeront. Le cache
des réponses (Valkey, `apps/server/src/ai/response-cache.ts`) est indexé
par un hachage de la question normalisée et de l'ensemble des skills
retenus : deux questions identiques avec des skills différents (donc des
droits différents) ne partagent jamais d'entrée, ce qui évite qu'une
réponse construite à partir d'un skill privé ou limité à un espace fuite
vers quelqu'un qui n'y a pas accès.

## Conséquences

- Le câblage aux points (lot 8) attend que son schéma existe : le bouton
  « Utile » et les étoiles fonctionnent déjà, mais ne rapportent encore
  rien à l'auteur du skill.
- La citation du skill n'est jamais stockée sur le message lui-même :
  `GET /api/messages/:id/assistant-invocation` la retrouve à la demande
  depuis `assistant_invocations`, pour qu'un rechargement de page la
  réaffiche sans dupliquer cette information sur deux tables.
- `StreamingLlmProvider` découple l'orchestrateur de la classe concrète
  `FallbackLlmProvider` : les tests d'intégration
  (`apps/server/src/ai/assistant-orchestrator.integration.test.ts`)
  injectent un faux fournisseur sans construire de vrais clients Gemini ou
  OpenRouter, tout en exerçant une vraie base Postgres pour le reste.
- Les modèles se choisissent par `GEMINI_MODEL` et `OPENROUTER_MODEL`
  (par défaut `gemini-flash-latest` et
  `meta-llama/llama-3.3-70b-instruct:free`) : l'arrêt de
  `gemini-2.0-flash` par Google le 1er juin 2026 se règle ainsi par une
  variable d'environnement, sans nouvelle image.
