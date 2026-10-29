# Kemet : contexte du projet

Ce fichier est la source de vérité du projet. Toute IA ou tout membre qui rejoint le travail le lit en premier. Il remplace l'ancien cahier des charges (nom de travail "Pénc").

## En une phrase

Kemet est la plateforme d'échange des développeurs africains : des salons de discussion hébergés sur un serveur Datacloud, un fil de posts détendu et utile, un assistant IA nourri par les skills que les seniors créent à partir de leurs notes, des projets à rejoindre et des compétitions.

## Le nom

Kemet est le nom que les anciens Égyptiens donnaient à leur pays : "la terre noire", la terre fertile du Nil où tout pousse. Cheikh Anta Diop, dont l'université de Dakar porte le nom, l'a popularisé dans ses travaux. La métaphore : une terre fertile où les idées et les projets des devs africains grandissent.

Dans l'écriture hiéroglyphique du mot, un signe représente la ville : un cercle traversé par deux routes qui se croisent. Un carrefour, un lieu de rencontre.

**Le logo** est le mot "kemet" en minuscules, dans un dessin géométrique et arrondi. Le "k" bleu est formé de deux chemins qui se croisent : la barre qui plie vers la droite passe par-dessus le second chemin, qui monte de bas en haut. Récit pour le jury : "Deux chemins qui se croisent dans le k : le carrefour où les devs africains se rencontrent." Les fichiers sont dans `brand/` (mot-symbole clair, sombre, noir, blanc ; symbole ; icône d'application ; favicons).

À vérifier avant la soumission : la base de marques de l'OAPI. Une société américaine d'électronique s'appelle KEMET.

## La compétition (CADEV 2026, organisée par Systalink)

- **Thème :** "Construire la plateforme d'échange africaine, pour les devs, par les devs. Livrez un projet utilisable et hébergé en ligne."
- **Livrables :** dépôt git et démo en ligne.
- **Équipe :** Kemet Labs, quatre membres.
- **Clôture des soumissions :** repoussée au 12 novembre 2026 (confirmé le 29/10). Gel des fonctionnalités le 9 novembre. L'ancienne date était le 25 octobre.
- **Vote des pairs :** dates à confirmer. Chaque membre reçoit jusqu'à 10 projets de son pays et vote pour un seul. Les 3 premiers de chaque pays passent devant le jury. **Chaque membre de l'équipe doit voter, sinon le projet est exclu.**
- **Jury :** dates à confirmer.

**Grille du jury :**

| Critère | Poids |
| --- | --- |
| Qualité technique : architecture, robustesse, sécurité, qualité du code, maîtrise par l'équipe (y compris du code produit avec l'IA), conformité des licences | 30 % |
| Pertinence par rapport au sujet | 25 % |
| Expérience utilisateur et ergonomie | 20 % |
| Innovation et originalité | 15 % |
| Vote du public (plafonné) | 10 % |

**Règles qui peuvent nous éliminer :**

- Toute dépendance sous GPL, AGPL ou LGPL rend le projet irrecevable, même indirecte.
- L'usage de l'IA est libre mais doit être déclaré : outils et parties concernées. Une déclaration inexacte disqualifie.
- "La soumission d'un projet suppose son déploiement sur la plateforme Datacloud." Le déploiement doit mobiliser au moins un produit Datacloud acheté avec le code promo.
- Chaque membre déclare que le projet n'est ni un projet de cours, ni une mission pour un employeur ou un client.
- Le gagnant cède ses droits d'exploitation à Systalink. Les non-lauréats gardent tous leurs droits.
- Réduction de 40 % sur Datacloud jusqu'à la clôture (code promo à venir), puis 70 % pour tous les participants jusqu'au 31 décembre 2026.

## Budget : tout gratuit, sauf un produit

Un seul produit payant : un serveur Datacloud (2 vCPU, 4 Go de RAM, 80 Go de SSD), acheté avec le code promo, qui héberge toute l'application. Le reste est gratuit : sous-domaine fourni ou adresse sslip.io pour le HTTPS, emails par une offre gratuite (Brevo ou Resend), modèles d'IA en offre gratuite. Email Pro seul est écarté : l'application tournerait hors de Datacloud.

## Les fonctionnalités et leurs priorités

P0 = indispensable, terminé, testé et déployé le 19 octobre. P1 = visé. P2 = seulement si on est en avance. Aucune fonctionnalité P1 ne commence tant que les P0 de son module ne sont pas déployés et testés.

| Module | P0 | P1 | P2 |
| --- | --- | --- | --- |
| Comptes et profils | Inscription email et GitHub, profil, pays avec drapeau, abonnés, parcours (déclaré ou vérifié), niveau | Vérification par email pro et par attestations | Import des dépôts GitHub |
| Salons | Espaces publics et privés, salons texte, fils, mentions, réactions (emojis du système), non-lus, code coloré, deux salons par défaut à la création d'un espace ("général", "mèmes") | Messages privés, stickers maison | Messages épinglés |
| Fichiers et images dans les messages | Images (PNG, JPEG, WebP, GIF) affichées dans le salon et les fils ; PDF, texte, code, zip proposés en téléchargement ; type vérifié par le contenu, jamais par l'extension | | |
| Fil de posts | Posts courts, réponses, partages, mèmes, onglets "Abonnements" et "Pour toi", formats optionnels (Astuce, À tester, Question) | Recherche dans le fil, retours structurés sur les posts "À tester" | |
| Assistant et skills | Assistant @kemet, création de skills, appel explicite ou automatique, réponse en streaming qui cite le skill et son auteur, page publique du skill, étoiles, bouton "Utile" | Fiches de connaissance, outils MCP | Modèle hébergé chez Systalink |
| Projets | Page projet, demandes d'aide et de collaboration, candidatures | Recherche par stack et par pays | |
| Compétitions | Compétitions de projets : inscription, soumission, vote, jury, résultats sur le profil | Défis de code sans exécution | Défis avec correction automatique |
| Appels | | Audio en privé et en groupe | Vidéo |
| Interface | Thème clair ou sombre selon le système, mobile soigné, notifications dans l'app | Notifications push, palette de commandes Ctrl+K | |
| Kemet Pro | Page de présentation de l'offre (sans paiement réel) | | Paiement par mobile money |

Le fil a l'ambiance de X plutôt que le sérieux de LinkedIn : posts courts, conseils, humour, mèmes, discussions sous chaque post. Il en reprend les mécanismes (abonnements, réponses, partages, onglets "Abonnements" et "Pour toi") ; pour l'apparence, voir `docs/adr/0018-permission-de-copie-visuelle.md`.

Des formats optionnels donnent de la structure quand c'est utile :

- **Astuce :** un conseil, une commande, un bout de code.
- **À tester :** un lien de démo ou de dépôt, et ce qu'on veut comme retour. Un retour structuré rapporte des points à celui qui le donne.
- **Question :** une question à la communauté. Une réponse marquée comme solution rapporte des points.

Le "Pour toi" met en avant les posts marqués "Utile" et les retours de test, pondérés par le niveau de ceux qui réagissent. Pas d'algorithme qui récompense la polémique.

## Points et niveaux

**Le mot "réputation" n'apparaît nulle part dans l'interface.** On parle de points et de niveaux. Le but est de reconnaître l'entraide sans créer de course malsaine.

**D'où viennent les points :**

| Source | Détail | Plafond |
| --- | --- | --- |
| Parcours vérifié | Diplôme +150, année d'expérience +100, poste senior ou lead +300, stage +30, formation en cours +20 | 1 500 |
| Entraide | Victoire en compétition +200 (2e +100, 3e +50), aide confirmée sur un projet +20, fiche validée +15, réponse marquée comme solution +10, retour structuré sur un post "À tester" +10, réponse utile basée sur ton skill +5, participation à une compétition +10 | Aucun |
| Régularité | +5 par jour avec une action utile, sur les 90 derniers jours | 500 |

Un élément de parcours seulement déclaré s'affiche mais rapporte 0 point. On ne classe pas les entreprises par prestige.

**Les niveaux :**

| Niveau | Points | Ce qu'il débloque |
| --- | --- | --- |
| Apprenti | 0 | Tout l'essentiel : salons, posts, assistant, skills privés, projets |
| Artisan | 300 | Apparaît dans l'annuaire des talents, bouton "Ouvert aux missions" |
| Scribe | 1 000 | Peut publier des skills pour toute la communauté, quota d'IA plus élevé |
| Architecte | 2 500 | Peut créer des compétitions publiques, être juré |
| Légende | 5 000 | Mis en avant sur l'accueil, quota d'IA maximal |

Le parcours seul permet d'atteindre Scribe. Seule l'entraide fait passer Architecte puis Légende.

**Garde-fous :**

- Pas de classement individuel global. Le seul classement est celui des pays, collectif : "les pays les plus actifs ce mois-ci".
- Le profil met en avant le niveau et des faits concrets ("A aidé 312 devs", "48 fiches validées"). Le total de points reste discret.
- Un "Utile" vaut plus s'il vient d'un niveau élevé, et presque rien s'il vient d'un compte récent : créer de faux comptes ne rapporte rien.
- Plafond de points qu'une même personne peut te donner par jour. Impossible de se noter soi-même ou de noter son propre skill.
- Chaque gain de points est une ligne dans un registre où l'on ne fait qu'ajouter : on peut toujours expliquer un total et annuler les points d'un tricheur.

## L'assistant @kemet et les skills

Il n'y a qu'un seul assistant sur la plateforme : **@kemet**. Ce sont les seniors qui le rendent utile, en créant des **skills** à partir de leurs notes. L'IA est un outil parmi d'autres dans Kemet, pas le centre du produit.

**Ce qu'est un skill :** un nom, une description d'une phrase (quand l'utiliser), des instructions, des notes, des exemples de code. Par exemple "wave-paiements", créé par une dev qui a fait quinze intégrations Wave.

**Comment l'assistant s'en sert :**

1. La recherche plein texte de PostgreSQL présélectionne jusqu'à 20 skills candidats à partir du nom, de la description et des tags, parmi ceux que l'utilisateur a le droit d'utiliser. Ça ne coûte presque rien.
2. Quand une question arrive, le modèle choisit le ou les skills utiles parmi ces candidats à partir de leurs descriptions : soit l'utilisateur l'a demandé ("@kemet avec wave-paiements, comment…"), soit l'assistant reconnaît qu'un skill correspond.
3. Il charge alors le contenu complet de ce skill retenu (voir `docs/adr/0007-recherche-skills.md`).
4. Il répond en streaming, et la réponse affiche "basé sur le skill wave-paiements d'Awa Ndiaye".
5. Les lecteurs peuvent marquer la réponse "Utile", ce qui rapporte des points à l'auteur du skill. Les skills reçoivent aussi des étoiles, données seulement par ceux qui les ont utilisés.

**Sécurité :** l'assistant ne lit que le salon où il est appelé et les skills choisis. Le contenu des messages et des skills est traité comme des données, jamais comme des ordres. Tout outil MCP demande l'accord de l'utilisateur.

@kemet passe par Google Gemini (famille Flash, offre gratuite), avec bascule automatique sur des modèles gratuits d'OpenRouter en cas de quota dépassé ou de panne, et un message clair si les deux sont saturés. Les deux passent par l'interface `LlmProvider`. Contrepartie de l'offre gratuite : Google peut utiliser les données envoyées, ce que dit la page de confidentialité. Le quota est protégé par un cache des réponses et une limite quotidienne par niveau. Après la compétition, l'assistant pourrait tourner sur des modèles ouverts hébergés par Systalink.

## Business model

Le jury, c'est Systalink : il voudra voir comment la plateforme peut rapporter. Principe : **on récompense l'utilité, jamais les vues ou les abonnés**. Payer à la vue pousse aux posts racoleurs et à la fraude, et casse la bonne ambiance.

| Source de revenus | Pour qui | Détail |
| --- | --- | --- |
| Kemet Pro | Devs | Abonnement à petit prix en FCFA, payable par Wave ou Orange Money : plus de quota d'IA, statistiques sur son profil et ses skills, mise en avant dans l'annuaire, espaces privés plus grands. La vérification d'identité n'est jamais payante. |
| Récompenses en crédits Datacloud | Systalink | Gagnants de compétitions, auteurs des skills les plus utiles, meilleurs testeurs reçoivent des crédits Datacloud. Coût faible pour Systalink, et les devs hébergent leurs projets chez eux. |
| Recrutement | Entreprises | Publication de missions et accès à l'annuaire des talents. Plus tard, commission sur les missions payées via la plateforme. |
| Compétitions sponsorisées | Opérateurs, banques, fintechs | Organiser un défi pour repérer des talents, sur l'infrastructure de Systalink. |
| Espaces écoles et entreprises | EPT, bootcamps, entreprises | Espace privé avec outils d'administration, sur abonnement. |
| Skills premium (plus tard) | Seniors | Un senior vend un skill avancé, la plateforme prend une commission. |

Pour la compétition : pas de paiement réel. Une page "Kemet Pro" et une section claire dans le README suffisent.

## Architecture

TypeScript partout. Un seul serveur Datacloud, tout en conteneurs Docker.

| Service | Choix | Licence |
| --- | --- | --- |
| Proxy et HTTPS | Caddy | Apache 2.0 |
| Interface | React, Vite, web app installable, Tailwind, Radix, icônes Lucide | MIT, ISC |
| API | Fastify, Zod | MIT |
| Temps réel | Socket.IO avec adaptateur Redis | MIT |
| Tâches de fond | BullMQ | MIT |
| Base de données | PostgreSQL 16, Drizzle ORM | PostgreSQL, Apache 2.0 |
| Cache et diffusion | Valkey (version libre de Redis) | BSD-3 |
| Authentification | Better Auth (email, GitHub) | MIT |
| IA | Vercel AI SDK, SDK MCP officiel | Apache 2.0, MIT |
| Appels (P1) | LiveKit, coturn | Apache 2.0, BSD |
| Drapeaux | flag-icons (SVG) | MIT |
| Tests | Vitest, Playwright | MIT, Apache 2.0 |

Les fichiers envoyés (images, mèmes) sont stockés sur un volume disque du serveur.

**Pièges de licence identifiés :** sharp (libvips en LGPL), Judge0 (GPL), MinIO (AGPL), Redis 8 auto-hébergé (licences non libres ou AGPL, d'où Valkey), modèles Llama (licence propre), Twemoji (CC-BY, non listée : on garde les emojis du système).

**Domaines du modèle de données :** utilisateurs (users, profiles, credentials, follows), discussion (spaces, members, channels, messages, threads, reactions, read_states), fil (posts, post_replies, post_reactions, post_feedback), assistant (skills, skill_files, skill_ratings, assistant_invocations, mcp_servers), projets (projects, help_requests, applications), points (points_ledger, badges), compétitions (competitions, teams, submissions, votes, jury_scores).

## Sécurité (résumé)

- Le serveur ne fait jamais confiance au client : chaque requête et chaque événement temps réel vérifie l'identité et les droits.
- Sessions en cookies httpOnly, Secure, SameSite. Mots de passe hachés avec Argon2. Limite de tentatives.
- Validation de toutes les entrées avec Zod. Markdown rendu sans HTML brut. En-têtes de sécurité stricts.
- Assistant isolé par salon, contenus des skills et des messages traités comme des données, protection contre l'injection de prompt, accord de l'utilisateur avant tout outil.
- Serveurs MCP : HTTPS obligatoire, blocage des adresses internes, délais et tailles limités.
- Secrets en variables d'environnement, jamais dans le dépôt. Scan des secrets et des licences dans l'intégration continue.
- Données personnelles : loi sénégalaise 2008-12, politique de confidentialité, export et suppression des données.

## Équipe et méthode

Quatre membres. Chacun doit pouvoir expliquer chaque module devant le jury : produit et interface, temps réel, IA, points et DevOps.

Chaque modification est relue sous l'angle de la sécurité et, si elle touche l'interface, de `DESIGN.md`, avant d'être fusionnée. L'intégration continue doit passer avant toute fusion.

## Planning

Le calendrier à partir du 29 octobre :

| Dates | Étape |
| --- | --- |
| 6 au 22 octobre | Développement des P0, audit de sécurité, données de démo (fait) |
| 29 octobre au 8 novembre | Déploiement sur Datacloud, puis finitions par ordre d'impact |
| 9 novembre | Gel des fonctionnalités |
| 9 au 11 novembre | Finitions, vidéo, README, déclarations |
| 12 novembre | Soumission |
| À confirmer | Vote des pairs (vote obligatoire) |
| À confirmer | Jury et résultats |

## Vérifications à faire tout de suite

1. Support Systalink : WebSockets acceptés ? Sous-domaine fourni avec le serveur ? Domaine .africa inclus ? Date du code promo ?
2. Compte Google AI Studio (Gemini) gratuit et compte OpenRouter : création, limites réelles affichées dans chaque console.
3. Service d'emails gratuit : création du compte, test d'arrivée dans Gmail sans passer en spam.
4. Appels : test d'un appel LiveKit sur la 4G d'Orange, Free et Expresso.
5. GitHub : test de la vérification "membre d'une organisation" avec de vrais comptes.
6. OAPI : recherche de la marque Kemet.

## Décisions prises

- Nom : Kemet (sous réserve OAPI).
- Thème clair ou sombre selon le système, avec un choix manuel.
- Drapeau du pays en SVG sur l'avatar, jamais à côté du nom.
- Pas de mot "réputation" : points et niveaux, jusqu'à Légende.
- Un seul produit Datacloud : le serveur cloud.
- IA gratuite uniquement.
- Un seul assistant, @kemet, nourri par les skills des seniors.
- Fil détendu façon X ; l'apparence suit `docs/adr/0018-permission-de-copie-visuelle.md`.
- Business model : récompenser l'utilité, pas les vues. Kemet Pro, crédits Datacloud, recrutement, compétitions sponsorisées.
- Logo redessiné en vectoriel, fichiers dans `brand/`.
- Pas d'embeddings ni de pgvector en P0 : sélection des skills par recherche plein texte PostgreSQL (`docs/adr/0007-recherche-skills.md`).
