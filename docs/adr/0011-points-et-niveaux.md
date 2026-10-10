# 0011 — Points et niveaux

## Contexte

Le lot 8 pose le socle de `docs/CONTEXTE.md`, section « Points et niveaux » :
un registre en ajout seul (`points_ledger`), le calcul des niveaux (Apprenti,
Artisan, Scribe, Architecte, Légende) et les garde-fous anti-abus. Plusieurs
lots précédents ont volontairement laissé un trou en attendant ce lot :
le quota de l'assistant identique pour tout le monde (lot 6,
`apps/server/src/ai/quota.ts`), l'auto-récompense non bloquée sur le fil
(lot 7, `docs/adr/0010-fil-de-posts.md`) et le câblage des points vers
l'auteur d'un skill jugé utile (lot 6, `apps/server/src/api/routes/assistant.ts`).

## Décisions

**Seules les sources déjà câblées entrent au registre** : solution marquée,
retour structuré, et réponse de l'assistant jugée utile. Le parcours
vérifié (`docs/CONTEXTE.md` : diplôme, expérience, poste, stage, formation)
n'a toujours aucun écran de vérification des crédentials (lot 3) : il n'y a
rien à déclencher. L'aide confirmée sur un projet (lot 9) et les résultats
de compétition (lot 10) n'existent pas encore. `points_source` est un enum
Postgres ; chaque lot futur qui attribue des points y ajoute sa valeur au
moment où il est codé, comme prévu.

**La table `badges` initialement prévue n'est pas créée.** Rien dans
`docs/CONTEXTE.md` ni `DESIGN.md` ne décrit de catalogue de badges (critères,
déclenchement, affichage) : les seuls éléments concrets mentionnés ("A aidé
312 devs", "48 fiches validées") sont des faits comptés directement sur les
tables existantes, pas des badges à décerner. Créer la table maintenant
aurait été deviner un schéma sans lecteur ni écrivain. À reprendre quand ce
catalogue sera précisé.

**Idempotence par un index unique, pas par une logique applicative.** Chaque
ligne du registre porte `(source, source_id, profile_id)`, unique. Donner
deux fois les mêmes points pour le même événement (une réponse marquée
solution deux fois, un "Utile" retiré puis remis) ne redonne rien, grâce à
`onConflictDoNothing` — même mécanisme que les réactions et les retours
structurés du fil (lot 7). Conséquence acceptée : retirer un "Utile" ou une
marque solution ne retire pas les points déjà donnés. Les reprendre
demanderait une ligne négative explicite, qu'aucune action du produit ne
déclenche aujourd'hui ; la colonne `amount` accepte déjà des valeurs
négatives pour qu'une annulation manuelle future (un modérateur face à un
tricheur, `docs/CONTEXTE.md`) reste possible sans changer le schéma.

**Le total de points se recalcule à chaque lecture, jamais stocké.** Comme
les soldes de l'ancien projet de trésorerie dont ce principe est hérité : on
peut toujours expliquer un total, et annuler une ligne le corrige
automatiquement au prochain calcul. Trois catégories, trois traitements :
- Parcours (plafond 1 500) : vide pour l'instant, aucune source ne verse ici.
- Entraide (sans plafond) : somme directe des trois sources câblées.
- Régularité (+5 par jour actif, sur 90 jours, plafond 500) : comptée en
  JavaScript à partir des dates distinctes déjà présentes dans le registre,
  jamais comme des lignes à part. Une ligne annulée fait disparaître le jour
  correspondant si c'était la seule action de ce jour-là, sans action
  supplémentaire.

**Plafond : 50 points par jour et par binôme** (donneur, receveur).
`docs/CONTEXTE.md` demande un plafond sans en fixer le montant : ce chiffre
est le nôtre. Il borne par exemple
un auteur de post qui marquerait solution plusieurs réponses de la même
personne dans la même journée. Le montant est réduit à ce qui reste plutôt
que l'action entière refusée, pour ne pas perdre les points encore
disponibles ce jour-là. À ajuster si ce chiffre se révèle trop
bas ou trop haut. La lecture du total déjà donné puis l'écriture se font
sous un verrou consultatif Postgres posé sur le binôme (donneur, receveur)
(`pg_advisory_xact_lock`, `apps/server/src/api/repositories/points.ts`) :
sans lui, deux requêtes concurrentes avec des événements distincts (donc
jamais bloquées par l'index unique d'idempotence) pourraient chacune lire le
même total avant qu'aucune n'ait écrit, et dépasser le plafond — relevé par
la revue de sécurité de ce lot, corrigé avant fusion plutôt que consigné
comme limitation.

**« Utile » pondéré par celui qui le donne.** Son niveau et l'âge de son
compte comptent, pas ceux du receveur. `docs/CONTEXTE.md` : « vaut plus
s'il vient d'un niveau
élevé, et presque rien s'il vient d'un compte récent ». Deux simplifications
chiffrées, toutes deux à ajuster :
- Compte de moins de 7 jours : 0 point, pas « presque rien ». Plus simple à
  expliquer et à tester qu'un dégressif continu, et conforme à l'exemple
  donné juste avant dans le même paragraphe (« créer de faux comptes ne
  rapporte rien »).
- Multiplicateur par niveau du donneur : ×1 jusqu'à Scribe, ×1,5 à
  Architecte, ×2 à Légende. Seuls deux paliers distingués plutôt qu'une
  courbe à cinq valeurs, pour limiter le nombre de chiffres inventés.

**Auto-récompense bloquée à la source, pas seulement au registre.**
`awardPoints` refuse tout gain où le donneur et le receveur sont la même
personne (marquer sa propre réponse comme solution, juger utile sa propre
réponse d'assistant). Pour le retour structuré, où le donneur et le receveur
sont déjà la même personne par construction (« rapporte des points à celui
qui le donne »), le trou relevé par `docs/adr/0010-fil-de-posts.md` — rien
n'empêchait l'auteur d'un post À tester de se donner son propre retour — est
refermé directement dans la route (`POST /api/posts/:id/feedback` refuse
maintenant l'auteur du post), pas seulement en mettant les points à zéro :
se donner son propre retour n'a de sens dans aucun cas. Le même trou sur la
réaction "Utile" d'un post (réagir à son propre post) reste ouvert : aucun
point n'y est attaché par `docs/CONTEXTE.md`, seul le classement "Pour toi"
en souffre, un problème distinct de ce lot.

**Quota de l'assistant par niveau, enfin câblé.** `apps/server/src/ai/quota.ts`
attendait explicitement ce lot. `docs/CONTEXTE.md` ne chiffre que deux
paliers (Scribe : « quota plus élevé », Légende : « quota maximal ») : Artisan
et Architecte restent au quota de base (30), Scribe et Architecte passent à
60, Légende à 150. Un paramètre d'appel permet toujours de fixer une limite
fixe pour les tests, qui ont besoin d'être déterministes.

**Niveau exposé publiquement, total de points discret.** `profiles.level`
figure dans toute réponse qui sérialise un profil, conformément à
`DESIGN.md` (le badge de niveau est visible de tous). Le total de points
n'apparaît que dans `GET /api/me`, jamais dans `GET /api/users/:handle` ni
dans les listes de profils : `docs/CONTEXTE.md` veut le total discret pour
les autres, pas pour soi-même.

## Conséquences

- Aucune page de `apps/web` n'affiche encore `level` ou un drapeau de pays à
  côté d'un nom, dans les messages, les posts ou les skills : ces pages sont
  restées ainsi depuis les lots 4 à 7, malgré `UserName`/`LevelBadge`/`Flag`
  déjà posés et malgré `profiles.country` disponible depuis le lot 3. Ce lot
  expose `level` dans l'API sans retoucher ces écrans, pour rester dans son
  périmètre ; une page de profil reste à construire.
- `listPourToiFeed` (`apps/server/src/api/repositories/posts.ts`) compte
  toujours les réactions et retours à plat, sans pondérer par le niveau de
  qui réagit, comme `docs/adr/0010-fil-de-posts.md` l'annonçait en attendant
  ce lot. Pondérer correctement demande de récupérer l'auteur de chaque
  réaction et retour des posts candidats, pas seulement un compte en SQL, et
  d'inventer une échelle de poids : un chantier à part, pas une simple
  valeur à câbler.
- `apps/server/src/api/repositories/points.ts` sera le point d'entrée des
  lots 9 et 10 pour l'aide confirmée sur un projet et les résultats de
  compétition, et d'un futur lot « vérification des crédentials » pour le
  parcours. Chacun y ajoute sa propre source dans l'enum et son propre appel
  à `awardPoints`.
