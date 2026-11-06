# 0026 : Messagerie privée

## Contexte

Les échanges entre membres doivent pouvoir rester sur Kemet plutôt que
partir sur WhatsApp ou par email : demander de l'aide sur un projet,
contacter l'auteur d'un skill, écrire à une équipe. Une messagerie privée
ouvre aussi la porte au harcèlement et au spam, et contient les données les
plus sensibles de la plateforme. Le module des salons (lot 5) gère déjà
messages, fils, réactions, fichiers, non-lus, temps réel, Markdown et code.

## Décision

**Une conversation privée est un salon sans espace.** `channels.space_id`
devient nullable et `channels.conversation_id` apparaît, avec une contrainte
`CHECK` qui exige exactement l'un des deux. Messages, pièces jointes,
réactions, états de lecture et salles Socket.IO sont ceux des salons, sans
table dédiée. Les autres options écartées :

- des tables `conversation_messages`, `conversation_attachments`, etc. :
  tout le code des salons (pagination par curseur, idempotence par
  `clientId`, détection du type de fichier, quota, nettoyage des orphelins,
  rendu) aurait été recopié, et chaque correction future à faire deux fois ;
- un espace privé caché par conversation : les règles des espaces (rôles,
  invitations, salons par défaut, liste des espaces) ne s'appliquent pas, et
  il aurait fallu les exclure une à une.

Le prix : toute route qui part d'un salon distingue maintenant deux cas.
`requireChannelAccess` (`apps/server/src/api/routes/channels.ts`) renvoie un
type union `space` ou `conversation`, et le compilateur oblige chaque appelant
à traiter les deux. `canAccessChannel` (temps réel) suit la même règle.

**Tables.** `conversations` (créateur, `direct_key`), `conversation_members`
(statut `accepted`, `pending` ou `left`) et `profile_blocks`. Une conversation
réunit 2 à 8 personnes. Pour une conversation à deux, `direct_key` contient
les deux identifiants triés, unique en base : écrire à quelqu'un rouvre
toujours la même conversation, même sous deux clics simultanés.

**Demandes de message.** À la création d'une conversation à deux, le
destinataire est `accepted` s'il suit l'expéditeur, partage un espace
**privé** avec lui ou a signé avec lui un travail encore publié (publieur ou
coauteur accepté), `pending` sinon. Une invitation de coauteur en attente ne
compte pas : n'importe qui peut en envoyer une. Un espace public ne compte pas :
n'importe qui y entre, il ne dit rien de qui se connaît, et "CADEV 2026"
aurait suffi à contourner toutes les demandes. Un groupe ne réunit que des
personnes qui connaissent déjà son créateur et ne se bloquent pas entre
elles : sinon un complice qui accepte lèverait la limite d'un message pour
tous les autres membres. Une
conversation n'apparaît chez un destinataire `pending` que dans ses
"Demandes", et seulement après un premier message. Tant que personne en face
n'a accepté, l'expéditeur ne peut envoyer qu'un message (`findWriteBlock`,
`apps/server/src/messaging/write-block.ts`), vérifié une seconde fois dans
la transaction d'insertion sous un verrou par conversation, pour que deux
envois parallèles ne passent pas tous deux. Modifier un message ou réagir
suivent la même règle. Un membre `pending` lit mais
n'écrit pas et ne réagit pas. Refuser une demande ou quitter une conversation
passe le membre à `left` : il n'y a plus accès, et ses connexions ouvertes
quittent la salle Socket.IO (`conversation:member-left`).

**Équipe d'un travail.** La page d'un travail porte deux boutons.
"Rejoindre la discussion", le principal, ouvre l'onglet Discussion : le
salon public du travail, partagé par tous les lecteurs et les auteurs, est
l'endroit mis en avant. "Écrire à l'équipe en privé", secondaire, ouvre un
groupe rattaché au travail (`conversations.work_id`, une seule conversation
par travail et par personne qui l'ouvre, `POST /api/conversations/team`).
C'est une exception à la règle des groupes, décidée le 03/11 : ses membres
sont la personne qui l'ouvre et exactement les auteurs du travail
(publieur et coauteurs acceptés, comptes supprimés exclus), fixés par le
serveur et jamais choisis par le client, donc aucun complice ne peut y faire
entrer un inconnu. Chaque auteur la reçoit dans ses "Demandes", même s'il
connaît déjà la personne : un auteur accepté d'office lèverait sinon la
limite d'un message pour tous les autres. Un seul message passe tant
qu'aucun auteur n'a accepté. Aucun membre ne s'ajoute ensuite. Un blocage
entre la personne et un auteur, ou une équipe de plus de huit personnes,
refuse la conversation : la discussion publique reste ouverte. Un blocage
entre deux auteurs n'est pas opposé à la personne, qui en apprendrait
l'existence. Sur mobile, le travail se rejoint par le menu de la
conversation.

**Blocage.** Bloquer quelqu'un empêche les nouvelles conversations avec lui
et son ajout à un groupe, dans les deux sens, et ferme l'écriture dans la
conversation à deux qui existe déjà. L'historique reste lisible. Une demande
en attente de la personne bloquée disparaît. Elle n'est pas prévenue.

**Confidentialité.** Aucun administrateur ne lit une conversation : l'accès
passe par l'appartenance, sans exception par rôle. La modération voit un
message privé signalé, comme un message de salon, ou, pour une conversation
signalée (nouvelle cible `conversation` de `reports`), les participants et
les dix derniers messages écrits avant le signalement, jamais ceux écrits
après (`reports.excerpt_until`), ou avant son départ si la personne qui
signale avait quitté la conversation : elle ne peut pas faire lire à la
modération ce qu'elle-même ne pouvait plus lire. Qui signale ne reçoit en
retour que les participants. Dans le journal de modération, une
conversation n'est décrite que par ses participants. La personne visée
(`reports.reported_profile_id`) est fixée au signalement : l'autre personne
d'une conversation à deux, ou dans un groupe la dernière à y avoir écrit
avant le signalement en dehors de qui signale. C'est elle que suspend la
modération. Les messages sont stockés
en clair sur notre serveur, sans chiffrement de bout en bout : c'est écrit sur
la page de confidentialité.

**@kemet** n'est jamais appelé dans une conversation privée, et les mentions
n'y sont pas enregistrées.

**Pastilles en temps réel.** À la connexion, chaque socket rejoint une salle
personnelle `profile:<id>`. Un nouveau message, une acceptation ou un départ
y envoient `conversation:activity`, sans contenu : le client relit le compte
des non-lus (`GET /api/conversations/unread`) et sa liste. Le compte de la
pastille est "conversations avec un non-lu, plus demandes en attente".

**Abus.** Ouvrir une conversation est limité à 10 par minute, et à un quart
de cette limite pour un compte de moins d'un jour (mécanisme du lot 11).
Envoyer un message garde la limite des salons.

## Conséquences

- La migration `0015_private_conversations` est additive (dont deux colonnes
  nullables sur `reports`), sauf `channels.space_id` qui perd son
  `NOT NULL` : aucune donnée existante ne change.
- L'indicateur de saisie n'est relayé que depuis une salle Socket.IO
  rejointe, donc après la vérification d'accès : il ne fuit plus vers un
  salon privé ou une conversation dont on ignore l'existence.
- Un salon de conversation ne doit jamais apparaître là où l'on part d'un
  espace : les requêtes qui joignent `channels` à `spaces` les écartent
  naturellement, et les deux points qui lisaient `channels.space_id` sans
  jointure ont été revus.
- Liste des conversations en une requête SQL (dernier message par
  `LATERAL`, pagination par curseur sur l'activité), puis un comptage de
  non-lus par conversation de la page : acceptable pour 30 conversations par
  page, à regrouper en une requête si la liste grandit.
- Limites connues : pas d'ajout de membre à un groupe existant (on en crée
  un nouveau), pas de nom de groupe, pas de fil de réponses dans
  l'interface d'une conversation (l'API l'accepte), pas d'indicateur de
  lecture côté expéditeur.
