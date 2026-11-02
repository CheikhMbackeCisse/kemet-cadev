# 0023 : Suppression d'un compte

Statut : acceptée le 31/10/2026. Implémentée après les lots regroupés du 1er
novembre.

## Contexte

La page `/confidentialite` promet l'export des données, déjà en place
(`GET /api/me/export`), et annonce la suppression du compte comme "en
préparation". Il faut décider ce que devient ce qu'une personne a écrit
quand elle part.

Le schéma actuel rend la suppression brute dangereuse. `profiles.user_id`
référence `user.id` avec `onDelete: "cascade"`, et 35 clés étrangères vers
`profiles.id` sont aussi en cascade. Supprimer la ligne `user` effacerait
donc, sans autre code :

- ses messages, et avec eux les fils de discussion où d'autres ont répondu ;
- ses posts Question, avec les réponses des autres et la solution marquée ;
- ses skills, que @kemet a cités dans des réponses encore visibles ;
- ses projets, demandes d'aide et candidatures reçues ;
- les lignes du registre de points dont elle est la bénéficiaire, ce qui
  est voulu, mais aussi la trace qu'elle a reçu ces points.

Les lignes où elle est donneuse passent à `given_by_profile_id = null` : les
points qu'elle a donnés restent acquis à leurs bénéficiaires. C'est déjà le
bon comportement.

## Décision proposée

**Anonymiser plutôt qu'effacer.**

1. Les données d'identification sont effacées : lignes `user`, `session` et
   `account` de Better Auth (adresse email, mot de passe haché, jetons des
   fournisseurs de connexion), crédentials, abonnements dans les deux sens,
   appartenances aux espaces, votes, notes de skills, serveurs MCP ajoutés.
2. Le profil reste, vidé : nom affiché "Compte supprimé", identifiant
   remplacé par une valeur aléatoire non réservable (`supprime-<8 caractères>`),
   avatar, spécialité, rôle, biographie, stack et liens remis à vide, pays
   remplacé par une valeur neutre. Une colonne `profiles.deleted_at` marque
   l'état, et l'interface n'affiche ni lien vers la page de profil ni badge de
   niveau pour un tel auteur.
3. Les contenus publics restent lisibles sous "Compte supprimé" : messages,
   posts, réponses, skills, projets. Une discussion garde son sens pour les
   personnes qui y ont participé, et une réponse de @kemet garde la source
   qu'elle cite.
4. Le registre de points est conservé tel quel. Il n'est plus rattaché qu'à un
   profil anonyme, donc plus à une personne. Les points que cette personne a
   donnés restent acquis à leurs bénéficiaires.
5. Les contenus que la personne avait déjà supprimés (`deleted_at` posé)
   voient leur texte vidé : aujourd'hui la suppression d'un message, d'un
   post, d'une réponse ou d'un projet ne fait que le masquer.
6. Les fichiers envoyés (pièces jointes de salon et images de post) sont
   effacés du disque, la ligne est gardée pour que le message affiche "fichier
   supprimé" au lieu d'un lien cassé.
7. Les signalements et le journal de modération sont conservés, que ce compte
   les ait envoyés, en soit la cible ou les ait traités. Ils
   restent rattachés au profil anonymisé : la décision reste lisible, le nom
   n'apparaît plus.

**Confirmation.** La suppression demande le mot de passe pour un compte
email, ou une connexion de moins de cinq minutes pour un compte GitHub,
Google ou LinkedIn (la session courante ne suffit pas). La route est limitée
en débit et ne prend aucun identifiant en paramètre : elle agit toujours sur
le compte de la session.

**Compte suspendu.** Une personne suspendue peut supprimer son compte. La
suspension bloque l'écriture (`requireOwnProfile`), la route de suppression
ne passe donc pas par cette vérification, mais exige la même confirmation.

**Pas de délai de grâce** en P0 : l'action est irréversible et l'écran le dit.
Un export est proposé juste avant.

## Conséquences

- Le comportement en cascade du schéma n'est plus utilisé pour ce cas. Une
  seule transaction applique les étapes 1 à 6, et un test vérifie qu'aucun
  message, post ou skill d'un autre compte ne disparaît.
- Quelqu'un qui veut aussi retirer ses contenus les supprime un par un avant,
  ce que les routes existantes permettent déjà. Une option "tout effacer"
  pourra s'ajouter plus tard sans changer ce modèle.
- Les sauvegardes chiffrées gardent les anciennes données 14 jours au plus
  (voir `docs/adr/0020-deploiement-production.md`). La page de
  confidentialité devra le dire.
- La migration ajoute une colonne nullable : elle ne modifie aucune donnée
  existante.
- Limite connue : une personne suspendue peut supprimer son compte puis se
  réinscrire avec la même adresse, puisque l'adresse est effacée. Les
  limites des comptes neufs (`ANTI_SPAM_NEW_ACCOUNT_FACTOR`, pondération
  d'un "Utile" par la fraîcheur du compte) freinent déjà ce cas. Garder une
  empreinte de l'adresse pour le bloquer reviendrait à conserver une donnée
  personnelle après une demande d'effacement : écarté en P0.

## Alternatives écartées

- **Suppression brute par cascade** : efface les réponses et solutions des
  autres, casse les citations de @kemet, fait disparaître des points
  légitimement gagnés par d'autres via des contenus qui n'existent plus.
- **Simple désactivation** (compte marqué inactif, données intactes) : ne
  répond pas à une demande d'effacement des données personnelles.
