# 0004 — Salons et espaces

## Contexte

Le lot 5 pose les salons de discussion : des espaces publics ou privés, des
salons texte à l'intérieur, des fils de réponses, des mentions, des
réactions, le suivi des messages non lus, et un moyen de rejoindre un
espace privé sans que quelqu'un doive ajouter chaque membre à la main.

## Décision

**Pas de type de salon spécial.** Un salon est juste un nom et un
identifiant dans un espace, posé par qui crée l'espace. Créer un espace
propose par défaut deux salons modifiables, « général » et « mèmes » (`
DEFAULT_CHANNELS`, `apps/server/src/api/repositories/chat.ts`), plutôt
qu'un champ `kind` qui aurait figé la liste des types possibles. L'upload
d'images dans les salons devient son propre lot.

**Trois rôles par membre d'espace** : `owner` (celui qui l'a créé), `admin`
et `member`. Seuls les deux premiers peuvent créer un salon, ajouter ou
retirer un membre, gérer les liens d'invitation.

**Visibilité** : un espace `public` apparaît dans la liste de tout le monde.
Un espace `private` n'apparaît que pour ses membres ; toute route qui le
lirait sinon (`GET /api/spaces/:id`, ses salons, ses messages) renvoie une
404 plutôt qu'une 403 à qui n'en est pas membre, pour ne pas révéler son
existence à qui connaîtrait seulement son identifiant.

**Rejoindre un espace privé**, deux façons : un owner ou admin ajoute
directement un profil par son identifiant, ou crée un lien d'invitation
(`space_invites`) : un code aléatoire (`nanoid`, alphabet sans caractères
ambigus), une date d'expiration (7 jours par défaut), un nombre d'usages
maximum optionnel, révocable à tout moment. `GET /api/invites/:code` est
public et limité en débit (30 requêtes par minute) : il renvoie seulement
le nom de l'espace si le lien est valide, ou un motif distinct
(introuvable, expiré, révoqué, épuisé) sans jamais révéler le contenu de
l'espace. `POST /api/invites/:code/accept` (authentifié, 10 par minute) et
la mise à jour du compteur d'usages se font dans une même transaction pour
éviter qu'un lien à usage unique serve deux fois en cas de double clic.

**Suppression douce des messages** (`deleted_at`) plutôt qu'une suppression
réelle : un message supprimé garde sa place dans un fil et ses réactions
restent cohérentes, mais son corps et ses mentions sont masqués à la
sérialisation (`serializeMessage`, `apps/server/src/api/chat-serializers.ts`).

**Déduplication des messages par `client_id`** : chaque message envoyé
porte un identifiant généré par le client, unique par auteur
(`messages_author_client_idx`). Si le client renvoie le même message après
une coupure réseau, l'API retrouve le message déjà créé au lieu d'en créer
un second ; voir `docs/adr/0006-temps-reel.md` pour le rôle de ce champ
dans la reprise après reconnexion.

**Non lus calculés, pas stockés** : comme le reste du modèle de données,
le nombre de messages non lus d'un salon se recalcule à
la lecture à partir de `read_states.last_read_at`, jamais écrit à l'avance.

## Conséquences

- Un nouveau salon doit obtenir l'accord d'un owner ou admin : la route de
  création vérifie le rôle avant d'écrire, pas seulement l'appartenance à
  l'espace.
- Les mentions (`@handle`) ne résolvent que des profils déjà membres de
  l'espace (`resolveMentionableProfiles`) : mentionner un identifiant qui
  existe mais n'a pas rejoint l'espace ne notifie personne, volontairement.
- Révoquer un lien d'invitation ou en changer les limites agit uniquement
  sur les usages futurs : les membres déjà rejoints par ce lien restent
  membres.
- Les tests d'intégration (`apps/server/src/api/chat.integration.test.ts`,
  `packages/db/src/schema/chat.integration.test.ts`) couvrent le refus
  d'accès à un espace privé, la déduplication par `client_id`, et les
  quatre états d'un lien d'invitation.
