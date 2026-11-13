# DESIGN.md

Règles d'interface de Kemet. Elles s'appliquent à chaque écran, sans exception. En cas de doute, choisir la solution la plus sobre et la plus lisible.

## Principes

1. **Une application, pas une plaquette.** Kemet s'utilise tous les jours, comme GitHub ou Linear : interface dense, texte compact, peu de vide. Les grandes tailles sont réservées à la page d'accueil publique.
2. **Le contenu d'abord.** Messages, code, posts et profils remplissent l'écran. La décoration n'ajoute rien.
3. **Un seul élément marquant.** Le bloc de réponse de l'assistant Kocc est le seul élément visuellement fort. Tout le reste est discret.
4. **Pensé pour le téléphone et les connexions lentes.** Chaque écran est conçu en taille mobile en même temps qu'en taille bureau.
5. **L'ergonomie partout**, pas seulement dans les formulaires : états vides, chargements, erreurs, clavier, premier lancement.
6. **Pas d'originalité à tout prix.** On peut reprendre un mécanisme _et_ une apparence d'un autre produit (Discord, X, LinkedIn, GitHub, Linear, Slack…) quand ça rend l'écran plus clair ou plus soigné, au cas par cas. Ce qui ne bouge jamais : les tokens de couleur, Plus Jakarta Sans/Space Grotesk/Geist Mono, les icônes Lucide, la grille 4px, et la liste « Ce qui est interdit » ci-dessous — ces interdits visent à éviter l'air générique IA, pas la ressemblance avec un produit existant, donc ils restent en vigueur même quand on copie. Jamais le logo, les couleurs de marque ou les assets d'un autre produit. Autorisation donnée le 14/10/2026, plus large que celle du lot du rail des espaces : cette fois l'apparence elle-même peut être reprise, pas seulement le mécanisme.

## Couleurs

Le thème suit le réglage du système (`prefers-color-scheme`), avec un choix manuel dans les paramètres : Système, Clair, Sombre. Toutes les couleurs passent par des variables CSS. Aucune couleur écrite en dur dans un composant.

| Variable                                                  | Clair                                                | Sombre     | Usage                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `--bg`                                                    | #FFFFFF                                              | #0D1320    | Fond principal                                                                                        |
| `--surface`                                               | #F8FAFD                                              | #141B2A    | Barres latérales, panneaux                                                                            |
| `--surface-2`                                             | #F2F6FB                                              | #1B2436    | Survol, zones secondaires                                                                             |
| `--nav-active`                                            | #E1E7EF                                              | #283553    | Salon ouvert dans le panneau Salons                                                                   |
| `--action-strong`                                         | #1F1F1F                                              | #E8ECF4    | État actif fort : section ouverte de la barre latérale, espace choisi, action d'en-tête (Publier…)    |
| `--action-strong-hover`                                   | #3A3A3A                                              | #FFFFFF    | Survol d'une action d'en-tête                                                                         |
| `--on-action-strong`                                      | #FFFFFF                                              | #0D1320    | Texte et icône posés sur `--action-strong` (16:1 et 15:1)                                             |
| `--border`                                                | #E5E7EB                                              | #263049    | Séparateurs                                                                                           |
| `--border-strong`                                         | #D1D5DC                                              | #34405C    | Champs, boutons secondaires                                                                           |
| `--text`                                                  | #1F1F1F                                              | #E8ECF4    | Texte principal                                                                                       |
| `--text-2`                                                | #364153                                              | #C3CBDA    | Texte secondaire                                                                                      |
| `--muted`                                                 | #4A5565                                              | #A9B3C6    | Métadonnées                                                                                           |
| `--subtle`                                                | #6A7282                                              | #8792A8    | Heures, aides discrètes                                                                               |
| `--primary`                                               | #1265DD                                              | #1F6FE5    | Boutons principaux                                                                                    |
| `--primary-hover`                                         | #0F56BD                                              | #3B82F0    | Survol                                                                                                |
| `--link`                                                  | #1265DD                                              | #7FB0F7    | Liens, mentions                                                                                       |
| `--accent-soft`                                           | #ECF3FF                                              | #16233D    | Élément actif, mention                                                                                |
| `--accent-soft-2`                                         | #DBE9FD                                              | #1D2E50    | Badges, bouton pressé                                                                                 |
| `--level-badge-text`                                      | #0F56BD                                              | #7FB0F7    | Texte accent sur `--accent-soft-2` (5,5:1 et 6,1:1)                                                   |
| `--level-apprenti`                                        | #2E7D32                                              | #5CC46B    | Icône et nom du niveau Apprenti                                                                       |
| `--level-artisan`                                         | #A14F00                                              | #E8A33C    | Icône et nom du niveau Artisan                                                                        |
| `--level-scribe`                                          | #0E7490                                              | #3CC0D8    | Icône et nom du niveau Scribe                                                                         |
| `--level-architecte`                                      | #1265DD                                              | #7FB0F7    | Icône et nom du niveau Architecte                                                                     |
| `--level-legende`                                         | #7C3AED                                              | #B794F6    | Icône et nom du niveau Légende                                                                        |
| `--rating-star`                                           | #A14F00                                              | #E8A33C    | Étoile remplie de la note d'un skill                                                                  |
| `--assistant-bg`                                          | #F5F8FF                                              | #121C30    | Fond du bloc de réponse de l'assistant                                                                |
| `--assistant-border`                                      | #D0E2FF                                              | #26406E    | Bordure du bloc de l'assistant                                                                        |
| `--success`                                               | #1E8205                                              | #4CC26A    | Vérifié, actif                                                                                        |
| `--success-soft`                                          | #EAF5E6                                              | #12301B    | Fond des pastilles de succès                                                                          |
| `--danger`                                                | #C4320A                                              | #F07856    | Erreurs, suppression                                                                                  |
| `--danger-soft`                                           | #FBE9E3                                              | #3A1B14    | Fond des pastilles d'erreur                                                                           |
| `--on-danger`                                             | #FFFFFF                                              | #0D1320    | Texte d'un bouton rouge plein (contraste AA dans les deux thèmes)                                     |
| `--space-tint-1` à `-6`                                   | #1565C0, #2E7D32, #6A1B9A, #AD1457, #00695C, #A14F00 | identiques | Fond d'un logo d'espace sans image ni technologie (icône blanche à 4,5:1), et d'un avatar à initiales |
| `--code-cover-bg` / `-bar`                                | #0D1320 / #141B2A                                    | identiques | Fenêtre d'éditeur de la couverture d'un skill                                                         |
| `--code-cover-text` / `-keyword` / `-string` / `-comment` | #C3CBDA / #7FB0F7 / #5CC46B / #8792A8                | identiques | Texte de cette couverture                                                                             |

Vérifier chaque couple texte/fond avec un outil de contraste : 4,5:1 minimum pour le texte courant, 3:1 pour le texte de 24 px et plus.

Le bleu (`--primary`, `--link`) est réservé aux liens, à la mention @kocc, aux pastilles de non-lus, aux boutons d'envoi et aux petits accents. Un état actif ou une action de page ne sont plus bleus : ils prennent `--action-strong`, le noir de l'onglet actif de la barre du bas (son équivalent clair en thème sombre). Décidé le 13/11/2026, il y avait trop de bleu dans l'application.

## Typographie

- **Plus Jakarta Sans** pour le texte courant de l'interface : très lisible en petite taille. **Space Grotesk** pour les titres (`h1` à `h3`) et les textes importants (classe `font-display` : nom d'un niveau, montants). **Geist Mono** uniquement pour le code et les durées. Les trois sont sous licence OFL-1.1, servies depuis notre serveur (`@fontsource`), jamais depuis un service tiers.
- Space Grotesk ajoutée le 08/11/2026 : Plus Jakarta Sans seule donnait des titres sans caractère. Elle ne sert jamais pour un paragraphe, où ses formes géométriques fatiguent la lecture.
- Taille de base : **14 px**. Interligne de 1,5 pour le texte, 1,25 pour les titres.

| Rôle                               | Taille     | Graisse |
| ---------------------------------- | ---------- | ------- |
| Métadonnées, heures                | 12 px      | 500     |
| Texte secondaire                   | 13 px      | 400     |
| Texte courant, messages            | 14 px      | 400     |
| Titre de section                   | 16 px      | 600     |
| Titre de page                      | 20 px      | 700     |
| Grand titre (profil, compétition)  | 24 px      | 700     |
| Page d'accueil publique uniquement | 40 à 56 px | 800     |

Pas plus de trois tailles sur un même écran d'application. Les chiffres alignés utilisent `font-variant-numeric: tabular-nums`.

## Espacement, tailles, formes

- Grille de 4 px. Espacements utilisés : 4, 8, 12, 16, 24, 32.
- Hauteur des contrôles : 32 px (compact), 36 px (par défaut sur bureau), 44 px minimum sur mobile pour tout ce qui se touche.
- Arrondis, trois variables CSS reliées à Tailwind (`rounded-control`, `rounded-card`, `rounded-panel`) :
  - 8 px (`--radius-control`) : boutons, champs, selects ;
  - 12 px (`--radius-card`) : cartes, blocs de code, bloc de l'assistant, images, composeur ;
  - 16 px (`--radius-panel`) : dialogues, feuilles, menus, popovers ;
  - pastilles et avatars entièrement arrondis.
- Un élément posé dans un autre garde un rayon concentrique : rayon extérieur moins le rembourrage, 6 px au minimum (les éléments d'un menu de 16 px avec 4 px de rembourrage ont 12 px).
- Cadres : un cadre sépare un objet du reste de la page (champ de saisie, bloc de code, réponse de Kocc, menu flottant, dialogue, feuille, image). Il ne sert jamais à regrouper : les éléments d'une liste (posts, projets, travaux, compétitions, équipes, soumissions) sont des lignes séparées par un filet `--border`, sauf les skills et les travaux de la page Travaux, en cartes (voir « Skill » et « Travail »), et les pastilles sont remplies, sans bordure.
- Ombres : aucune sur les éléments posés dans la page. Une seule ombre douce pour ce qui flotte (menus, fenêtres, notifications). Un menu porte en plus un filet `--border-strong` : en clair, son fond `--surface` se distingue à peine du blanc de la page.

## Mise en page

**Bureau (à partir de 1024 px) :**

- Barre latérale : les icônes Lucide de la barre du bas du téléphone, tirées de la même liste (`railNav.ts`), en 22 px dans des cases de 40 px, espacées de 4 px. Elle ne défile jamais : tout tient dans un écran de 768 px de haut (mesuré jusqu'à 1024 x 600). Deux groupes, séparés par un espace vide qui pousse le second en bas : en haut, le logo (mot-symbole ou symbole, vers le fil) puis les sections (Fil, Travaux, Salons, Messages, Skills, Projets, Compétitions) ; en bas, "Données de démonstration" quand elle est active (une icône et un mot dans la barre resserrée), Confidentialité, Paramètres, Modération pour un administrateur, et le compte : sa photo, plus son nom et son @ dans la barre large, qui mène tout droit au profil (ou "Se connecter" pour un visiteur). Enregistrés est un onglet de son propre profil, Sécurité un lien de Paramètres > Aide, Se déconnecter vit dans Paramètres : aucune entrée en double. Dès 1280 px de large et 760 px de haut, la barre s'élargit à 232 px, libellé de 16 px à côté de l'icône. Section ouverte : fond arrondi plein `--action-strong`, icône et libellé `--on-action-strong`, libellé en gras, icône pleine (seulement pour celles qui se remplissent proprement : maison, livre, bulle, avion en papier, clé, drapeau ; les autres gardent leur contour au trait de 2,25) ; survol : fond arrondi `--surface-2`. Le compte prend le même fond plein sur son propre profil et sur Moi. Entre lg et 1280 px, sous 760 px de haut, et sur une page à panneau latéral (Salons, Messages), la barre se resserre à 56 px, icônes seules avec infobulle à droite, sur le modèle de VS Code : l'icône de la section ouverte replie ou rouvre le panneau (Ctrl+B), et perd son fond quand il est replié. Ses lignes se parcourent aux flèches haut et bas, Début et Fin, en un seul arrêt de tabulation ; le logo et le compte sont deux arrêts à part. Une section qui a des non-lus porte une pastille `--primary` au texte blanc de 12 px, en haut à droite de l'icône, plafonnée à "9+" et annoncée dans le nom de la ligne. Kemet Pro n'y figure pas.
- Panneau latéral : 264 px, titré du nom de la section. Salons y reprend la logique du téléphone, sur le modèle de Discord (`SpaceNavigator`, le même composant) : une colonne étroite de 60 px avec les logos de tous les espaces (40 px, nom en infobulle, point de non-lus), l'espace choisi entouré d'un anneau `--action-strong` avec sa petite barre à gauche ; à côté, sous le nom de l'espace choisi, ses seuls salons, le salon ouvert sur un fond `--nav-active` en `--text`, jamais en bleu. "Créer un espace" en pied. Jamais d'arbre qui liste les salons sous chaque espace : avec trente salons dans un espace, on ne verrait plus les autres (retiré le 13/11/2026). Un clic sur l'icône de la section ouverte, ou Ctrl+B (Cmd+B sur Mac), le replie et le rouvre ; le choix est mémorisé. Replié par défaut sous 1280 px. Une page sans panneau garde ses icônes en liens, et Ctrl+B y garde son sens habituel. Pas de redimensionnement à la souris.
- Contenu : fluide. Toutes les pages partagent ce cadre (`AppFrame`).
- Panneau de détails à droite : 300 px, affiché en permanence sur grand écran. Sous 1024 px il devient une feuille, ouverte depuis la barre du haut. Il n'est pas refermable sur grand écran : sa bascule encombrait la barre du haut, et une fois fermé rien ne permettait de le rouvrir.
- Pages de lecture (profil, skill) : largeur de contenu maximale de 960 px. Le fil et la page d'un post : colonne de 640 px, centrée (`ReadingPage width="feed"`).

**Mobile (moins de 768 px) :**

- Barre d'onglets en bas : Fil, Salons, Travaux, Skills, Moi. Icônes de 24 px : pleine et libellé en graisse 600 en `--text` pour l'onglet actif, en contour et `--muted` pour les autres. Les icônes de section sont choisies pour se remplir proprement (maison pour le Fil, bulle pour les Salons, livre ouvert, clé, silhouette) ; les messages privés prennent l'avion en papier. Ce sont les sections de la barre d'activité du bureau, tirées de la même liste (`railNav.ts`), dans un ordre propre au mobile qui garde Salons sous le pouce. "Moi" ouvre la page `/moi` : le même en-tête que le profil public (`ProfileHeader` : bannière ou bande `--accent-soft`, photo de 88 px qui chevauche son bord, chiffres à côté), avec trois chiffres Points (au point près), Travaux, Abonnés ; sous les chiffres, une barre de 4 px vers le niveau suivant à la couleur de l'insigne et "340 points · encore 160 pour Artisan" (au niveau Légende, son nom seul) ; puis nom, insigne et nom du niveau, @identifiant, drapeau et pays, bio sur deux lignes, et deux boutons de même largeur "Modifier le profil" et "Partager le profil". Un visiteur voit une carte avec le symbole Kemet, "Créer un compte" et "Se connecter", sans phrase. Moi est son propre profil : sous l'en-tête, les onglets du profil (Travaux, Bibliothèque, Skills, Parcours, Enregistrés), dans une rangée qui défile au doigt. Tout le reste (Mes travaux, Messages, Projets, Compétitions, Niveaux, Paramètres, Confidentialité, Sécurité, Kemet Pro, Modération pour un administrateur, Données de démonstration, puis la déconnexion sous un filet) vit dans un menu ouvert par l'icône à trois traits en haut à droite : une feuille qui monte du bas sur téléphone, un panneau à droite sur bureau. Cette rangée du haut répond à celle du profil public, qui porte "Retour" à gauche. "Mes travaux" (ligne du menu, ou le chiffre Travaux) ouvre `/moi/travaux` : la grille de ses travaux en cartes et "Publier un travail", sans l'en-tête du profil. Aucune liste de liens sous le profil.
- Les messages privés n'ont pas d'onglet : un segment "Salons / Messages" en haut de l'onglet Salons y mène, avec la pastille des non-lus, reportée aussi sur l'onglet Salons. La loupe de la recherche partage sa ligne, à droite (voir « Recherche »). Sur bureau, "Messages" est une section de la barre d'activité.
- Un visiteur voit une seule invitation, une barre "Se connecter" / "Créer un compte" posée au-dessus des onglets, jamais une carte en haut de chaque page.
- L'onglet Salons montre une colonne étroite des espaces (logo d'espace, point de non-lus) et, à droite, les salons de l'espace choisi. L'espace choisi porte un anneau de 2 px `--action-strong` (décalé de 2 px) et une petite barre de 4 px de la même couleur sur le bord gauche de la colonne. "Créer un espace" se trouve en bas de la liste des salons, avec son libellé : jamais un "+" seul. Toucher un salon l'ouvre en plein écran ; la flèche de l'en-tête, un glissement depuis le bord gauche ou le retour du système ramènent à la liste (une entrée d'historique par salon ouvert). Le panneau de détails devient une feuille qui monte du bas, ouverte dans un salon par un bouton "Membres" avec son icône, jamais par une icône seule.
- Glisser entre onglets : sur la page d'entrée d'un onglet du bas (Fil, Salons et sa liste de messages, Travaux, Skills, Moi), un glissement horizontal franc (72 px au moins, deux fois plus horizontal que vertical, en moins de 0,6 s, hors des 24 px du bord gauche réservés au retour) passe à l'onglet voisin. Les onglets internes (Pour toi, Projets, Opportunités ; ceux du profil) passent d'abord, la barre du bas ne reprend la main qu'au premier ou au dernier. La page qui arrive entre en 180 ms du côté d'où vient le doigt. Jamais dans un salon ou une conversation ouverts, sur un formulaire, ni quand le geste part d'un champ, d'un bloc de code, d'une galerie, d'une rangée qui défile de côté ou d'un dialogue ; coupé avec `prefers-reduced-motion`.
- Paramètres : une liste de sections avec une recherche, une page par section, et seulement des réglages qui fonctionnent.
- Le champ de message reste collé en bas, au-dessus du clavier et de la barre d'onglets. Dans un salon, la page fait la hauteur réellement visible (`100dvh`, repli `100vh`) et ne défile jamais en entier : seule la liste des messages défile. Le clavier réduit la page (`interactive-widget=resizes-content`) au lieu de la recouvrir.
- Les champs de saisie (`Input`, `Textarea`, `Select`) font 16 px de texte sur mobile : en dessous, Safari iOS zoome au focus et décale la page.
- Aucun survol nécessaire pour accéder à une action : tout ce qui apparaît au survol sur bureau est accessible par un appui long ou un menu sur mobile.

## Composants clés

- **Nom d'utilisateur :** prénom et nom, icône de niveau. Pas de drapeau ici : il est porté par l'avatar (voir ci-dessous). Jamais de total de points à côté d'un nom.
- **Avatar :** photo, ou initiales blanches sur une teinte `--space-tint-*` choisie d'après le nom (toujours la même pour une personne ; jamais une couleur de niveau, qui laisserait croire à un niveau), en 24, 32, 40 px, et 88 px dans l'en-tête d'un profil. À 32 et 40 px, le drapeau du pays s'ajoute en badge sur le coin inférieur droit de la photo (SVG flag-icons, avec le nom du pays en `title` et pour les lecteurs d'écran). Jamais à 24 px, où le badge ne laisserait plus voir la photo. À 88 px, pas de badge : le drapeau et le nom du pays sont écrits sous le nom. Ailleurs, c'est le seul endroit où le drapeau apparaît : la règle précédente le mettait aussi à côté du nom, ce qui affichait deux drapeaux par message et par post. Corrigé le 20/10/2026. Là où aucun avatar n'est rendu (aperçu d'un post partagé, retour structuré), on affiche un avatar de 32 px plutôt qu'un drapeau isolé.
- **Bannière de profil :** sur le profil public et sur Moi, en tête de page, au format 4:1 (160 px de haut au plus), coins `--radius-card`, fond `--surface-2` pendant le chargement. Image décorative (`alt` vide) : le nom et l'avatar juste en dessous portent l'information. Pas de texte posé dessus. La photo de 88 px chevauche son bord bas. Elle n'apparaît ni dans le fil, ni dans un salon. Un profil sans bannière garde une bande `--accent-soft` de 96 px, sur laquelle la photo se pose de la même façon. Aujourd'hui posée seulement par les données de démonstration : aucun envoi par l'utilisateur. La photo, elle, s'envoie depuis Moi et son propre profil (un "+" rond de 28 px sur le coin bas de la photo de 88 px, zone d'appui de 44 px) et depuis Paramètres > Profil (section Photo, bouton "Ajouter une photo" ou "Changer la photo") : PNG, JPEG ou WebP de 2 Mo au plus, affichée en cercle sans recadrage. Un nom vide ou égal à l'identifiant n'est pas répété : "@identifiant" devient le titre, et un lien "Ajouter ton nom" (44 px de haut sur téléphone) mène à Paramètres > Profil.
- **Niveau :** un insigne dessiné pour Kemet (`LevelInsignia`), de 16 px à côté du nom, de la couleur propre au niveau. Chaque niveau a sa forme et son motif, pour rester reconnaissable sans compter sur la couleur : Apprenti, une feuille et sa nervure (pas un cercle, qui se lisait comme une coche "vérifié") ; Artisan, un carré arrondi et un outil ; Scribe, un hexagone et une plume ; Architecte, un écu et une pyramide ; Légende, un soleil. Le motif prend la couleur du fond de page. Le nom du niveau est en `title` au survol et en `aria-label` ("Niveau Scribe"). Il n'est écrit en toutes lettres, à côté de l'insigne, que sur le profil. Toucher un insigne mène à `/niveaux` (zone d'appui élargie à 44 px sur mobile) : les cinq niveaux avec leurs insignes, les points nécessaires (sans nombre de membres), ce qui rapporte des points, et la position de la personne connectée (barre de progression vers le niveau suivant). Chaque couleur garde 4,5:1 sur `--bg`, `--surface` et `--surface-2` dans les deux thèmes (`tokens.test.ts`). Les pastilles de format (Astuce, À tester, Question) restent neutres, en `--surface-2`.
- **Organisation :** une entreprise, une école, une communauté ou un organisateur d'événements porte, à la place de l'insigne de niveau, une étiquette "Organisation" : icône immeuble de 12 px et le mot en `text-xs` graisse 500, `--text-2` sur `--surface-2`, arrondi `--radius-control`, sans bordure. Elle reste neutre partout : jamais de coche, jamais de bleu ni de vert, jamais le mot "vérifié", pour ne pas se lire comme une certification. Une organisation n'a ni niveau, ni points, ni barre de progression, et ne compte pas dans `/niveaux` ; Kocc non plus, sans étiquette. Son logo est un carré arrondi (22 % du côté) là où une personne a un rond. Sa page reprend l'en-tête du profil (logo de 88 px, nom et étiquette, type, drapeau et pays, lien du site, description sur trois lignes, chiffres Abonnés et Opportunités publiées, "S'abonner" et "Partager"), puis les onglets Posts et Opportunités avec les cartes du fil ; un onglet vide n'apparaît pas. Une offre publiée par une organisation montre son logo et son nom à la place de l'icône du type d'offre. Un gestionnaire choisit "Publier en tant que" (Moi ou l'organisation) en tête du formulaire d'un post et d'une offre ; ce champ n'existe pas pour qui ne gère aucune organisation.
- **Message :** avatar de 32 px, nom, heure, contenu. Les messages successifs d'une même personne sont regroupés sous un seul avatar, jamais par-delà minuit. Un séparateur nomme chaque jour ("Aujourd'hui", "Hier", "18 octobre"). Les actions (réagir, signaler) vivent dans une petite barre posée sur le coin du message, visible au survol et au focus sur bureau, à l'appui sur écran tactile : jamais en permanence sous chaque message. Les réactions déjà posées restent affichées, elles font partie du contenu.
- **Fil d'un salon :** il s'ouvre sur le dernier message, ou sur le premier message non lu précédé d'un séparateur "Nouveaux messages" : traits en `--primary`, libellé en `--link`, qui garde 4,5:1 sur `--bg` en sombre (seul séparateur coloré, il signale une position et non une erreur). Les messages plus anciens se chargent en remontant, sans déplacer ce qui est à l'écran ni les annoncer comme nouveaux ; un bouton "Charger les messages précédents" en tête de liste les rend joignables au clavier et au lecteur d'écran. Un message qui arrive pendant qu'on lit plus haut ne fait pas défiler la liste : un bouton flottant "Aller au dernier message" apparaît, sur fond `--surface` ; il rend le focus à la liste, ou au composeur s'il est activé au clavier (au toucher, le clavier virtuel cacherait les messages atteints). Le composeur (voir « Champ de message ») garde un brouillon par salon et le focus après l'envoi.
- **Bloc de réponse de l'assistant :** fond `--assistant-bg`, bordure `--assistant-border`, symbole de Kocc, nom "Kocc", ligne "Basé sur le skill wave-paiements d'Awa Ndiaye" (lien vers le skill et le profil), mention de ce que l'assistant a lu, boutons "Utile" et "Pas utile". Au-delà d'environ huit lignes, la réponse est coupée par un fondu, suivie de "Voir plus" ; toucher la réponse ou "Voir plus" la déplie, "Voir moins" la replie. La citation reste en haut, toujours visible ; un bloc de code coupé garde son bouton Copier dans son en-tête. Une réponse qui ne dépasse que d'une ou deux lignes reste entière, et une réponse en train d'arriver n'est jamais repliée. C'est le seul bloc coloré de l'interface.
- **Kocc :** l'assistant s'appelle Kocc partout dans l'interface, et se mentionne "@kocc". L'ancien "@kemet" l'appelle toujours mais ne s'affiche jamais : une mention "@kemet" d'un message déjà écrit se lit "@kocc". Son profil s'appelle Kocc, sans bio. Un seul symbole partout (bloc de réponse, attente, bouton, étiquette) : dessiné au trait comme une icône Lucide, en `--primary`, une tête et quatre touffes avec deux yeux pleins en pilules debout qui disent "assistant" au premier regard, lisibles de 16 à 32 px. Sobre : jamais un personnage, ni des étincelles. Le symbole de Kemet reste celui de la plateforme.
- **Bouton Kocc :** dans le champ de message d'un salon et des réponses sous un post, à gauche du champ : un bouton rond de 44 px qui ne porte que le symbole de Kocc (22 px), nommé "Poser une question à Kocc" au survol et pour les lecteurs d'écran. Il met "@kocc " en tête du champ, curseur juste après, et n'envoie rien. Tant que le champ commence par la mention, une étiquette "Question à Kocc" (pastille `--accent-soft`, texte `--link`, croix qui retire la mention) se tient au-dessus du champ, suivie sur la même ligne de la seule phrase sur la confidentialité, "Envoyé à Gemini · Confidentialité" (lien), en `--subtle` de 12 px ; la phrase reste seule si la mention est plus loin dans le texte. Jamais de paragraphe sous le champ. Pas de pastille "Demander à Kocc d'expliquer" sous les posts.
- **Champ de message (`ComposerBar`) :** un seul composant pour les salons, leurs fils, les réponses sous un post, les discussions des travaux et la messagerie. De gauche à droite : le bouton Kocc (seulement là où Kocc répond), un champ en pilule (bordure `--border-strong`, `--primary` au focus, 44 px de haut pour une ligne, texte d'attente centré, il grandit jusqu'à 5 lignes puis défile) qui porte à l'intérieur, à droite, Code puis Pièce jointe, et hors du champ un bouton rond de 44 px. Ce bouton envoie (triangle plein orienté vers la droite, pas d'avion en papier) : `--surface-2` et icône `--subtle` tant qu'il n'y a rien à envoyer, `--primary` et icône blanche dès qu'il y a du texte. Là où les messages vocaux existent (salons, messagerie), le micro, rond de 44 px en `--surface-2`, tient sa place tant que le champ est vide. Toutes les icônes du champ font 22 px au trait de 1,75 et tombent sur la ligne du texte ; quand le texte grandit, les boutons restent sur sa dernière ligne.
- **Échec de l'assistant :** jamais dans le fil du salon, où il se lirait comme une réponse. Notice au-dessus du composeur, vue seulement par la personne qui a posé la question : fond `--danger-soft`, icône en `--danger`, texte en `--text` de taille normale, bouton "Reposer la question" (masqué pour un quota atteint) et croix pour la masquer. Le focus revient au composeur après l'un ou l'autre.
- **Post du fil :** ton détendu, texte court, images et mèmes, code. Étiquette de format seulement si l'auteur en a choisi un (Astuce, À tester, Question). Actions, sous le texte, sur une barre de 448 px au plus dont les places sont réparties régulièrement : répondre, republier, cœur, enregistrer, partager. Icônes de 20 px en `--muted` avec leur compteur à côté (rien quand il vaut zéro) ; la couleur n'apparaît que sur une action faite : republication `--success`, cœur `--danger` rempli, signet `--primary` rempli. "J'ai testé" n'est pas dans la barre : bouton secondaire avec son mot, sous le lien de démo, sur les posts À tester seulement. Un visiteur voit les compteurs sans pouvoir agir ; la date en temps relatif ("il y a 3 h", date complète au survol) sur la ligne du nom ("Ghizlane Amrani · il y a 3 j"). Le menu à trois points verticaux, en haut à droite du post, porte S'abonner ou Se désabonner, Voir son profil, Copier le lien et Signaler ; sur son propre post, Supprimer à la place de l'abonnement et du signalement. Signaler n'apparaît nulle part ailleurs sur un post. Les aperçus d'un post partagé ou d'un travail, qui sont des liens, prennent `--nav-active` au survol (neutre, jamais bleu). Un post n'est pas une carte : c'est une ligne de la colonne de lecture, séparée de la suivante par un filet `--border`, sans fond au survol (le bleuté de `--surface-2` y faisait une tache bleue, retiré le 13/11/2026). Même composant (`PostCard`) dans le fil et sur la page du post. Sur un post, "Utile" se marque d'un cœur (`--danger`, rempli une fois donné) : même sens et mêmes points qu'avant, "Utile" en `title` et dans l'`aria-label`. Les réponses de Kocc gardent le pouce levé. Enregistrer (signet, rempli une fois fait) range le post dans l'onglet "Enregistrés" de son propre profil. Partager ouvre la feuille de partage du téléphone, sinon copie le lien. Republier, sans citation, se fait d'un appui et s'annule de même ; on ne republie pas son propre post. Dans "Pour toi", un post republié par une personne suivie porte au-dessus de lui une ligne en `--muted` de 12 px : l'icône de republication alignée sur l'avatar, puis "Nom a republié" (lien vers le profil) ou "Tu as republié". En tête de "Pour toi", pour tout le monde (visiteurs compris), les posts épinglés par l'équipe (`feed_pinned_posts`) portent une ligne de même forme, une punaise puis "Épinglé" ; la réponse de Kocc d'un post épinglé est montrée dépliée, "Voir moins" la replie. L'image d'un post épinglé garde sa taille ordinaire. Les étincelles restent l'icône de Kemet Pro.
- **Images d'un post :** une image seule dans un cadre aux proportions de l'image, ramenées entre 4:5 et 16:9, de `min(512px, 70vh)` de haut au plus, image entière (`object-contain`, jamais recadrée), coins `--radius-card`, bordure `--border`. Le cadre a sa taille avant l'arrivée de l'image (dimensions lues à l'envoi) : le fil ne saute pas. Deux images ou plus : un carrousel, jamais une grille. Il glisse au doigt (défilement natif aimanté, une image par cran), compteur "2/4" en pastille noire à 60 % en haut à droite, points de 6 px sous l'image (`--primary` pour l'image visible, `--border-strong` pour les autres), flèches rondes au survol sur un appareil qui a une souris, flèches du clavier quand il a le focus. Le glissement entre onglets ne part jamais d'un carrousel. Dans l'aperçu d'un post partagé, la première image et "1/N", sans bouton.
- **Vidéo d'un post :** une seule par post, sans image à côté. Cadre aux proportions de son image d'aperçu (une vidéo verticale prend 4:5), fond noir, même hauteur maximale qu'une image. Avant d'être à l'écran, seule l'image d'aperçu est chargée, avec la durée en pastille en bas à droite. Visible aux trois cinquièmes, elle joue en muet et en boucle avec les commandes du navigateur ; une seule vidéo joue à la fois. En 3G, en économie de données ou avec `prefers-reduced-motion`, rien ne joue tout seul : l'aperçu et un bouton Lire rond de 56 px au centre. Un bouton rond en haut à droite (36 px sur bureau, 44 px sur mobile), "Voir en plein écran", ouvre la vue plein écran. Une vidéo illisible laisse une phrase et un lien vers le fichier dans son cadre. Elle se nomme "Vidéo de X" pour un lecteur d'écran, jamais par son nom de fichier.
- **Vue plein écran des vidéos (`/videos/:id`) :** fond noir, une vidéo par hauteur d'écran, défilement vertical aimanté ; ouverte depuis le fil, elle fait défiler les vidéos de ce fil dans son ordre, ouverte par un lien, la seule vidéo du lien. La vidéo à l'écran joue avec le son (le toucher qui a ouvert la vue le permet) ; si le navigateur refuse, elle repart en muet et le bouton du son le montre. Toucher la vidéo la met en pause, un bouton Lire au centre la relance ; ce bouton existe aussi pendant la lecture, invisible sauf au focus, pour mettre en pause au clavier. Seule la vidéo à l'écran est joignable au clavier, et Fermer vient en premier. En haut, Fermer à gauche et Son à droite ; sur le bord droit de la vidéo, cœur (rempli de `--danger`, trait blanc), répondre (ouvre la page du post), enregistrer et partager, en boutons ronds de 44 px sur noir à 55 %, compteur en dessous sur une pastille noire à 55 % pour rester lisible sur une vidéo claire ; un visiteur voit le cœur sans son rond, à 70 % ; en bas à gauche, l'auteur et deux lignes du texte sur un fond noir à 80 %, jamais un dégradé. Sur un grand écran, tout tient dans une colonne aux proportions d'une vidéo verticale, centrée, Fermer et Son compris. Échap ferme, flèches haut et bas passent d'une vidéo à l'autre, Espace ou K met en pause, M coupe ou rend le son. Avec `prefers-reduced-motion`, seule la vidéo ouverte joue seule. Une erreur de chargement se distingue d'une vidéo disparue : "Réessayer" pour la première.
- **Post épinglé d'un espace :** un bandeau au-dessus des messages de chaque salon de l'espace : vignette, "Épinglé", première ligne du post, le tout un lien vers le post. Rien pendant le chargement ni en cas d'erreur. Un crédit de visuel ("Visuel : Systalink" et un lien vers la source) se lit sous les images du post, en `--text-2` de 12 px.
- **Mention "Données de démonstration" :** tant que `DEMO_CONTENT_NOTICE` vaut `true`, une icône `FlaskConical` en `--subtle` au pied de la barre d'activité sur bureau, une ligne du menu de Moi sur mobile, toutes deux liées à `/donnees-de-demo`.
- **Skill :** carte en grille sur le modèle de Travail (une colonne sur mobile, deux puis trois sur bureau), même bordure, même survol, sans ombre ni bouton "Voir" : le nom porte le lien étiré sur la carte. Couverture 16:9 dessinée en HTML, une petite fenêtre d'éditeur sombre (variables `--code-cover-*`, identiques dans les deux thèmes) avec une barre au nom du fichier (`slug.md`), les six premières lignes du premier bloc de code du skill en Geist Mono avec trois couleurs (mots-clés, chaînes, commentaires), et le logo Simple Icons de la technologie principale sur une pastille blanche dans un coin. Pas de Shiki dans une liste. Dessous : domaine en petit, nom, avatar de l'auteur en 24 px et "par X", deux lignes de description, puis "4,8 · 2,3k avis · 11,2k utilisations". La page d'un skill reprend la même couverture en tête. Une barre de recherche au-dessus de la grille. Les étoiles n'existent que sur les skills.
- **Onglets :** un seul composant (`Tabs`) partout. L'onglet actif est souligné de 2 px `--primary`, texte `--text` ; les autres sont en `--muted`. Pas de conteneur gris ni de fond plein sous l'onglet actif. Variante `centered` pour les trois onglets du fil ("Pour toi", "Projets", "Opportunités") : centrés, 48 px de haut, texte de 14 px en graisse 600, soulignement de 3 px.
- **En-tête de page :** pas de grand espace au-dessus du titre (12 px sur mobile, 24 px sur bureau). Le bouton d'action de l'en-tête (Publier, Créer un skill…) est un bouton de taille normale (`HeaderActionLink`, hauteur de contrôle, texte de 13 px), plein en `--action-strong`, texte `--on-action-strong`, jamais bleu. En tête du fil : le titre "Fil" à gauche, au centre exact le mot-symbole complet de Kemet (`KemetWordmark`, versions claire et sombre, 22 px de haut), l'action de l'onglet ouvert à droite ("Publier", "Publier un projet", "Publier une offre" ; "Publier" seul sous 640 px, le nom complet restant lu). Pas d'avatar du compte en haut à droite du fil ni d'un salon : le compte vit au pied de la barre latérale sur bureau et dans l'onglet Moi sur mobile.
- **Message vocal :** un micro rond de 44 px à la place du bouton d'envoi tant que le message est vide, dans un salon comme dans un message privé. Sur écran tactile, on le maintient pour enregistrer et on relâche pour envoyer ; glisser vers la gauche annule. Un appui bref (moins de 0,3 s, double appui d'un lecteur d'écran) démarre l'enregistrement comme un clic. À la souris ou au clavier, un clic démarre, puis "Envoyer" ou la corbeille (ou Échap). Pendant l'enregistrement, une barre recouvre le composeur : point `--danger` qui clignote (fixe avec `prefers-reduced-motion`), durée en Geist Mono. Deux minutes au plus, arrêt et envoi automatiques. Un micro refusé s'explique en une ligne sous le composeur. Le lecteur : bouton rond `--primary` lecture et pause, barre de progression qui permet d'avancer, durée ; rien n'est téléchargé avant l'appui, jamais de lecture automatique, un seul message vocal joue à la fois.
- **Code :** Geist Mono 13 px, coloration syntaxique avec Shiki, bouton "Copier", défilement horizontal plutôt que retour à la ligne.
- **Champ de texte long :** un seul composant (`Textarea`). Il part d'une ligne dans un salon ou un fil, de trois dans un formulaire, grandit avec le texte sans barre de défilement jusqu'à 5 lignes (champ de message) ou 10 (formulaire), puis défile à l'intérieur, et redescend quand on efface. Jamais de poignée de redimensionnement. Dans un salon, la liste des messages rétrécit quand le composeur grandit et garde le dernier message visible.
- **Page d'un travail :** titre (20 px), pastille de statut ("Terminé" neutre, "En cours" accent), puis trois onglets soulignés, liés à `?onglet=` : Présentation (résumé, liens avec une icône Lucide par type : GitHub `GitBranch`, GitLab `GitMerge`, Drive `HardDrive`, site `Globe`, vidéo `Video`, article `Newspaper`, autre `Link` ; PDF en téléchargement, tags, stack), Discussion et Équipe (auteurs avec leur niveau, auteurs sans compte). Sur bureau, une colonne de droite (17 rem, séparée par un filet) porte "Rejoindre la discussion" (bouton principal) avec le nombre de personnes qui y ont écrit, "Écrire à l'équipe en privé" (bouton secondaire, pour un compte qui n'est pas le seul auteur) et le bouton "Qui a travaillé sur ce sujet ?". Une seule colonne sur mobile, la colonne de droite passe sous les onglets ; "Rejoindre la discussion" ramène les onglets à l'écran.
- **Discussion d'un travail :** le rendu d'un salon dans l'onglet, sans liste des salons ni panneau. Les auteurs portent une pastille neutre "Auteur" à côté du nom et du badge de niveau. Signaler un message depuis une icône visible au survol et au focus sur bureau, en permanence sur écran tactile. Trois débuts de message en pastilles remplies, sans bordure, proposés à un compte qui n'a encore rien écrit et qui n'est pas auteur : un appui remplit le composeur, rien ne part tout seul.
- **"Qui a travaillé sur ce sujet ?" :** un bouton secondaire, jamais un appel au chargement. Résultat en lignes (avatar, nom, une phrase de justification, lien vers le travail cité). La marque "Réponse enregistrée" ou "Sans l'assistant" est une pastille neutre, suivie d'une phrase qui dit pourquoi.
- **Opportunité :** troisième onglet du fil ("Pour toi", "Projets", "Opportunités"), qui ne montre que les offres (Emploi, Stage, Mission), de la plus récente à la plus ancienne ; les projets ont leur onglet. Il n'y a plus d'onglet "Abonnements" (retiré le 12/11/2026) : les posts des personnes suivies restent favorisés dans "Pour toi". Une offre est une ligne de liste, comme un post : pastille de 40 px en `--surface-2` avec l'icône du type (mallette, toque, poignée de main), pastille du type et du contrat ("Emploi · CDI"), titre en lien étiré, organisation et lieu en `--text-2`, puis la rémunération ou le budget et la date limite en `--muted`. Aucun logo d'organisation. Une offre dont la date limite est passée porte une pastille "Clôturée" en `--danger-soft`, son icône passe à 70 % d'opacité et son texte en `--subtle` (contraste gardé à 4,5:1) ; elle sort de la liste par défaut, un bouton discret sous la liste la fait revenir. Filtres Type, Pays, Domaine sur une ligne qui défile, gardés dans l'adresse avec l'onglet pour que le retour depuis une offre les retrouve, en pastilles de 36 px (plus basses qu'un champ de formulaire), chacune lisant "Type : Tous" tant qu'elle n'est pas choisie. Page d'une offre : en-tête avec l'icône du type, puis un seul bouton principal ("Postuler" pour un emploi ou un stage, "Proposer mes services" pour une mission), la date limite, un bloc "En bref" en `--surface-2` (lieu, contrat, début, rémunération ou budget, date limite, domaines), la description en Markdown, les critères attendus en liste, et l'auteur en pied de page. Menu "…" à côté du titre : Modifier et Supprimer pour l'auteur, Signaler pour un autre compte connecté. Le bouton ouvre une demande de conversation avec l'auteur, brouillon prérempli dans le composeur, jamais envoyé seul. Dans "Pour toi" d'un compte RH ou entrepreneur, des cartes offre alternent avec les cartes projet, encadrées comme elles.
- **Travail :** sur /travaux, carte en grille comme les skills, même bordure et même survol, sans bannière en dégradé : la couverture du travail en 16:9 (sinon un fond `--surface-2` avec une icône livre), le type et l'année en petit, le titre (lien étiré sur la carte), les avatars des auteurs en 24 px avec "par X et N autres", quatre tags au plus, qui filtrent la liste. Filtres sur une seule ligne au-dessus de la grille : type, tri, tag, sans libellé visible (nom accessible sur chaque champ). Sur /travaux comme dans la Bibliothèque d'un profil, les travaux sont des cartes. La page d'un travail montre la couverture en tête, puis sous le résumé les vidéos (lecteur du navigateur pour un fichier ; pour YouTube, un bouton "Lire la vidéo YouTube" qui ne charge le lecteur youtube-nocookie qu'au clic) et la galerie en vignettes qui ouvrent l'image en grand.
- **Projet dans le fil :** dans le fil mélangé, une carte projet est encadrée (bordure `--border`, `--radius-card`, sans ombre ni bannière) : c'est un objet d'une autre nature que les posts qui l'entourent, le cadre le sépare. Une carte au plus tous les cinq posts. Icône du domaine tirée de la stack, nom, auteur, pitch sur deux lignes, quatre éléments de stack au plus, deux demandes ouvertes au plus, "Proposer mon aide" (absent pour l'auteur, "Créer un compte pour aider" pour un visiteur) et "Voir le projet". Dans l'onglet Projets du fil, les mêmes cartes redeviennent des lignes séparées par un filet, avec "Publier un projet" en tête.
- **Profil :** onglets soulignés, les mêmes sur Moi et sur le profil public : Travaux, Bibliothèque, Skills, Parcours, et Enregistrés en dernier sur son propre profil seulement (Moi sur téléphone, `/u/<soi>` sur bureau), sous la carte « Complète ton profil » ; jamais sur le profil d'une autre personne. L'ancienne adresse `/enregistres` mène à cet onglet. Un onglet vide ne s'affiche pas ; le profil d'une autre personne qui n'a rien publié tient en une ligne en `--subtle`. Sur son propre profil, ce qui manque (CV, liens, un travail, un projet, un skill) est réuni dans une seule carte "Complète ton profil" encadrée, une ligne de 44 px par élément (icône de 18 px, libellé, bouton secondaire de 32 px aligné à droite, texte de 13 px, zone d'appui de 44 px), qui disparaît quand tout est rempli. Kemet Pro n'a plus de carte sur le profil : une ligne du menu de Moi suffit. Les demandes de coauteur reçues s'affichent au-dessus des onglets, sur son propre profil seulement, avec "Refuser" et "Accepter". Sous le nom, deux pastilles possibles : "Disponible pour des opportunités" et "Aide les débutants" (icône `HeartHandshake`), neutres.
- **Bibliothèque :** sections dans cet ordre, chacune sous un titre de section, seulement si elle est remplie : CV, Projets (la carte encadrée du fil, en grille de deux colonnes sur bureau), Liens. Travaux et Skills ont leur propre onglet, en cartes. 24 px entre deux sections, 12 px entre deux cartes. Le CV : nom du fichier, date, "Télécharger" ; dessous, l'aperçu des pages dans un cadre blanc (le papier du PDF, dans les deux thèmes), 448 px de large au plus sur bureau, pleine largeur sur mobile, avec "Page précédente" et "Page suivante". Un CV réservé aux comptes connectés se résume pour un visiteur à une phrase et "Créer un compte pour le voir". Liens : une ligne par lien, icône Lucide (GitHub `GitBranch`, GitLab `GitMerge`, LinkedIn `UserRound`, portfolio `Briefcase`, site `Globe`), nom du service et adresse raccourcie ; jamais de logo de marque.
- **Débutants :** rien de visible pour les autres. Un compte débutant voit les posts marqués débutant favorisés dans « Pour toi », sans étiquette, filtre ni carte. L'espace « Débuter en informatique » est proposé à l'onboarding et ouvre la liste des espaces, suivi de « CADEV 2026 », pour tout le monde, visiteurs compris ; l'interrupteur « J'aide les débutants » vit dans Paramètres > Profil.
- **Recherche (`SearchField`) :** loupe à gauche, croix pour vider à droite dès qu'il y a du texte, Échap vide aussi. Salons et Messages partagent une seule recherche (`ChatSearch`), qui cherche à la fois les espaces et les personnes ; les résultats remplacent la liste en dessous le temps de la recherche, sans autre page, groupés sous deux titres de section, "Espaces" puis "Personnes". Espaces : tous les espaces publics par nom, description, salons et sujets, les miens d'abord, chaque ligne avec "Rejoindre" (32 px, 44 au doigt) ou "Membre" ; jamais un espace privé. Personnes : tout le monde, celles que je suis d'abord, jamais un compte bloqué (dans un sens ou dans l'autre), un figurant, Kocc ou une organisation ; toucher un nom ouvre la conversation (ou la demande, mêmes règles qu'"Écrire" sur un profil). Un visiteur ne cherche que des espaces. Sur bureau, le champ est en tête du panneau Salons ou Messages. Sur téléphone, une loupe à droite des onglets "Salons" et "Messages" (sur la même ligne) ; la toucher déploie en 180 ms, depuis la loupe, une barre de recherche par-dessus les onglets, clavier ouvert, avec "Fermer" à droite (Échap sur le champ vide ferme aussi, le focus revient à la loupe) ; rien ne bouge avec `prefers-reduced-motion`. État vide par groupe : "Aucun espace public pour « … »" ou "Personne ne correspond à « … »". Il n'y a plus de champ "Chercher un espace" à part. Sous la barre ouverte, onglets et loupe sont `inert` (Maj+Tab ne tombe pas sur un bouton caché) ; la croix qui vide le champ fait 32 px à l'œil et 44 au doigt. "Espaces" et "Personnes", comme le nom de l'espace en tête des salons du panneau, sont des titres de panneau en 13 ou 14 px, graisse 600 : exception assumée à la taille des titres de section, faute de place dans 264 px. Pour un visiteur, "Rejoindre" se nomme "Se connecter pour rejoindre …" pour les lecteurs d'écran et mène à la connexion.
- **Ligne d'identité du profil :** sous le nom, sur le profil public et sur Moi : en verbes, pour n'avoir aucun accord à faire : "Étudie l'informatique à l'EPT", "Code en freelance", "Code chez X", "Recrute chez X", "Dirige X" ; le rôle seul, en verbe, sans précision ("Étudie l'informatique", "Code", "Recrute", "Dirige une entreprise", "Fait du design", "Pilote des projets"), jamais un nom de métier accordé ; rien pour "Autre" ; la spécialité suit, après un point médian (`lib/profileIdentity.ts`). La précision a son propre écran d'onboarding juste après le rôle, sauté pour un rôle qui n'en a pas, et vit dans Paramètres > Profil sous le rôle ; changer de rôle l'efface. Établissement et entreprise en saisie libre, avec en suggestion les noms déjà saisis par d'autres.
- **Profils disponibles pour des opportunités :** pour un compte RH ou entrepreneur, une bande en tête du fil "Pour toi" : des cartes encadrées (avatar, nom, niveau, spécialité), défilement horizontal sur mobile.
- **Action destructive :** "Supprimer" un skill, un post ou un projet vit dans le menu "…" de l'objet, en élément de danger, et passe par une confirmation. Jamais de bouton rouge plein posé seul ; le bouton rouge n'existe que dans la confirmation.
- **Formulaire :** sur bureau, tous les champs ont la même largeur, celle du formulaire. Le bouton d'envoi reste actif (`SubmitButton`) ; à l'envoi, chaque champ manquant ou trop court affiche son erreur juste sous lui en `--danger` (`FormField`, bordure du champ en `--danger`, `aria-invalid`), et le focus va au premier champ en erreur. Aucun sous-titre sous le titre d'un formulaire, aucun texte d'aide sous un champ : un exemple va dans le placeholder, une contrainte ne s'affiche que comme erreur. L'identifiant d'un skill, d'un projet, d'une compétition, d'un travail ou d'un espace se fabrique depuis le titre (suffixe "-2", "-3"... s'il est pris). Sur téléphone, le bouton d'envoi d'un formulaire en page reste collé en bas, au-dessus des onglets.

- **Logo d'espace (`SpaceIcon`) :** l'image de l'espace s'il en a une ; sinon le logo Simple Icons de la technologie que cite son nom, en couleur sur pastille blanche ; sinon une seule icône Lucide blanche, un objet concret choisi par mots-clés (Data et IA : base de données ; Backend et API : accolades ; Cloud et DevOps : nuage ; Cybersécurité : cadenas, jamais un bouclier coché ; Jeux vidéo : manette ; Frontend et design : fenêtre de navigateur ; Carrière et freelance : mallette ; Débuter : jeune pousse ; Hackathons et concours : trophée ; CADEV 2026 : drapeau ; Startups : fusée ; Code et développement : chevrons ; autre : deux bulles), jamais de robot ni d'étincelles, sur sa teinte : douze teintes `--space-tint-1` à `--space-tint-12`, une par icône, la même partout ; les espaces à deux bulles prennent les douze tour à tour (blanc à 4,5:1 sur chacune dans les deux thèmes, testé). Toujours un carré arrondi plein, logo ou icône à 55 % de sa taille, quelle que soit la taille de la pastille. Même logo dans le panneau Salons, la colonne mobile, les listes, la recherche et l'onboarding. Planche de toutes les icônes sur `/dev/ui`.
- **Bouton à icône seule (`IconButton`) :** son nom accessible sert aussi d'infobulle au survol (`title`). Une icône dont le sens n'est pas évident pour quelqu'un qui découvre l'informatique reçoit un mot à côté (Code au-dessus d'un champ de formulaire, J'ai testé, Membres, Démo) ; dans le champ de message, la place manque et les icônes sont seules, nommées au survol.
- **Compétition d'exemple :** une pastille neutre "Exemple" à côté du titre, jamais un paragraphe. Les personnes (proposée par, capitaine, membres) sont montrées par leur avatar de 24 px et leur nom, jamais par leur identifiant.
- **Bandeau d'installation :** une ligne fine sous l'en-tête du fil (icône, "Installer Kemet", croix), jamais une carte.

## États

Chaque écran et chaque liste a quatre états dessinés :

- **Chargement :** squelettes à la forme du contenu, pas de spinner plein écran. Un squelette ne se montre qu'après 300 ms d'attente (sa place est réservée dès le début, rien ne saute). Une page déjà visitée s'affiche depuis le cache, sans squelette, puis se met à jour sans rien effacer ; au retour, la position de lecture revient.
- **Vide :** une phrase qui dit quoi faire et un bouton pour le faire ("Aucun salon pour l'instant. Créer le premier salon").
- **Erreur :** ce qui s'est passé et comment réparer, sans excuse ni flou ("Le message n'est pas parti : connexion perdue. Réessayer").
- **Rempli.**

## Écriture

- Français, phrases courtes, verbes d'action, majuscule uniquement au premier mot.
- Un bouton dit exactement ce qu'il fait : "Publier", "Envoyer", "Rejoindre le salon". Le message de confirmation reprend le même verbe : "Publié".
- Pas de tiret cadratin, pas d'emoji dans l'interface, pas de flèche ajoutée aux boutons.
- Pas de formules creuses : "Libérez votre potentiel", "Rejoignez une communauté vibrante", "Bienvenue dans l'aventure".
- On tutoie l'utilisateur.

## Ce qui est interdit

Ces choix font "interface générée par une IA" :

- dégradés décoratifs, effet verre dépoli, halos lumineux (une exception, le parcours d'arrivée, voir ci-dessous) ;
- emojis utilisés comme icônes ;
- cartes toutes identiques avec la même ombre grise ;
- bordure colorée à gauche des cartes ;
- petits libellés en majuscules espacées au-dessus des titres ;
- chiffres ou statistiques décoratifs ;
- animations d'apparition sur chaque section ;
- polices Inter, Roboto, Arial.

### Les exceptions

#### Parcours d'arrivée

L'accueil d'une première visite (`/decouvrir`), les trois questions posées
avant l'inscription, la connexion, l'inscription, les écrans de mot de passe,
et depuis le 08/11/2026 (demandé explicitement) la fin du profil
(`/completer-profil`) et les écrans d'onboarding (`/bienvenue`)
partagent un même fond de marque : dégradé et halos (levés le 20/10/2026, voir
`docs/adr/0019-fond-des-ecrans-de-compte.md`), et le continent africain
entier, centré, en filigrane derrière la carte (remplissage à 6 %, contour
d'un pixel à 40 %). On reconnaît la forme sans qu'elle attire l'oeil ;
jamais un morceau coupé par le bord de l'écran. Sur téléphone, les écrans
calmes n'en montrent rien : leur carte, plus opaque, le couvrirait presque
entièrement et seul un bout de côte dépasserait. Le logo Kemet est en haut à
gauche, sauf sur l'accueil.

La carte est au centre de l'écran, entre deux bandes de décor : au-dessus et
au-dessous sur téléphone, à gauche et à droite à partir de 768 px. Le décor
ne passe donc jamais sous la carte, ne touche ni elle ni le bord de l'écran
(16 px au moins, dérive comprise) et deux éléments ne se chevauchent jamais
(`decorLayout.test.ts`). Une bande trop petite reste vide : moins de 110 px
de haut sur téléphone, moins de 280 x 420 px sur ordinateur (avant le
13/11/2026, 150 et 560 px : la hauteur réelle d'un navigateur, barres
comprises, les dépassait rarement et le décor avait disparu). Onze éléments
sur ordinateur, six sur téléphone, plus petits (pastille de 38 px) : cinq
logos de langages (Python, JavaScript, TypeScript, React, Flutter ; Kotlin
retiré le 11/11, son K violet se confondait avec le k de Kemet), trois
icônes Lucide (terminal, base de données, réseau, 26 ou 30 px, trait de
1,5 px : à cette taille, il pèse autant que le trait de 2 px des icônes de
20 px) et trois bouts de code en Geist Mono (`print("Hello, World!")`,
`git push origin main`, `const kemet = new Communaute()`) ; trois logos,
une icône et deux bouts de code sur téléphone.

Sur l'accueil, les logos sont dans leurs vraies couleurs (Devicon, variantes
« original » : Python bleu et jaune) sur une pastille blanche pleine, sans
flou ni ombre ; ailleurs, la silhouette blanche de Simple Icons, qui garde
les lettres de JS et TS. Ils peuvent passer près d'un arc pâle, jamais sur
une capitale ou une ville, et le continent, plus
grand, porte un réseau vu comme de nuit : quatorze capitales du pourtour
du continent en points lumineux à petit halo, chacune reliée à deux ou
trois voisines par un arc fin et légèrement courbe, du Maghreb au Cap et de
Dakar à la Corne, et dix-neuf autres grandes villes (dont Abuja, Lagos,
Kinshasa, Luanda) en points plus petits et plus pâles, sans liaison. Le
réseau fait le tour du centre, que la carte couvre sur ordinateur, au lieu
de passer dessous. Les arcs
ne sont jamais plus forts que le contour (même teinte, 38 % au lieu de
40 %). Sur téléphone, le continent prend toute la largeur moins 8 px de
chaque côté : Rabat, Alger, Tunis et Le Caire passent au-dessus de la
carte, Pretoria et Maputo au-dessous ; sur ordinateur, il prend presque
toute la hauteur et la carte, plus étroite (25 rem), laisse le réseau
entier autour d'elle à partir de 1440 x 900 ; plus bas (1280 x 720), l'est
passe sous la carte. Ce que la carte couvre s'atténue à 25 % (points,
lueurs) ; les arcs gardent leur intensité, déjà sous celle du contour, et se
devinent à travers le verre. Un élément du décor
posé sur une capitale ou une ville visible est caché ; les places du décor
sont choisies pour que ça n'arrive pas aux tailles courantes. La
carte de l'accueil est plus claire (teinte à 50 %, flou de 1 px). Tout en
bas de l'écran, "Propulsé par" en petit et en blanc atténué, puis
"Systalink" en blanc, graisse moyenne, S majuscule, sur la même ligne : ni
pastille, ni leur symbole, ni leur police.

Le fond (dégradé, grille, continent, réseau) est posé une seule fois, sous
la page, par le routeur (`ArrivalBackdrop`) : il ne se démonte pas d'un
écran du parcours à l'autre, seule la carte change, et le décor reprend sa
dérive là où il en était. Pendant le chargement d'une étape, la précédente
reste affichée avec la barre fine du haut, jamais un écran blanc ; le code
de l'étape suivante se télécharge pendant qu'on lit la page en cours.

Le contenu de chaque écran est posé sur une carte en verre dépoli (teinte du
fond à 60 %, flou de 3 px, bord blanc à 20 %), demandée explicitement le
08/11/2026. Le texte de la carte est blanc dans les deux thèmes (`--auth-*`),
les champs gardent leurs couleurs ordinaires, le bouton principal est blanc.
Aucun texte descriptif sous les titres, sauf la phrase de promesse de
l'accueil (une ligne plus petite, en `--auth-text-muted`, décidée le
11/11/2026), une barre de progression sans
« Étape X sur N » sur les questions et l'onboarding. Sur l'onboarding seulement,
la raison d'un bouton Continuer bloqué est écrite sous lui (une liste longue
peut la cacher). Un insigne de niveau posé sur la carte prend les couleurs
du thème sombre dans les deux thèmes (`LevelBadge tone="onDark"`), et les
couleurs propres au fond (continent, capitales, décor, séparateurs) sont des
variables `--auth-*` de `tokens.css`. Le fond de `html` est écrit en dur dans
`index.html`, la feuille de style n'étant pas encore chargée au premier
octet. Voir
`docs/adr/0030-parcours-d-arrivee.md`.

Deux intensités : sur l'accueil, décor en couleur et réseau ; ailleurs,
décor blanc à 16 %, sans réseau. Les éléments dérivent de 6 px au plus,
sans rotation ni fondu. Sur l'accueil, trois lueurs voyagent le long des
arcs, une nouvelle toutes les 3 s, chacune 6 s environ, puis passent à un
autre arc. Seuls `transform`, `opacity` et le tracé des lueurs
(`stroke-dashoffset`) bougent ; l'animation s'arrête quand l'onglet est
caché. Sur connexion lente, en économie de données ou avec
`prefers-reduced-motion`, rien ne bouge : le réseau reste affiché, fixe,
sans lueurs.

« Complète ton profil » a son propre fond, tout autour de la carte au lieu
de deux bandes : l'univers de l'informatique à trois profondeurs
(`ProfileUniverse`). Au fond, petit, flou (1,5 px) et à 30 % ; au milieu,
à 60 % ; au premier plan, net, les logos sur la pastille blanche de
l'accueil. Les seize logos Devicon en couleurs (Python, JavaScript,
TypeScript, React, Flutter, Dart, Node.js, Go, Java, PHP, HTML, CSS,
Docker, PostgreSQL, Git, Linux ; jamais Kotlin), cinq bouts de code en
Geist Mono colorés par `--code-cover-keyword` et `--code-cover-string`
(`print("Hello, World!")`, `git push origin main`,
`const kemet = new Communaute()`, `SELECT * FROM devs WHERE pays = 'SN';`,
`flutter run`) et quatre icônes Lucide (terminal, base de données, réseau,
puce) : vingt-cinq éléments sur ordinateur, dix sur téléphone, plus petits,
surtout en haut et en bas. Seul l'arrière-plan passe derrière le verre ; un
élément du premier plan qui toucherait la carte est caché. Flottaison lente
et légère parallaxe à la souris (plus forte au premier plan), coupées avec
`prefers-reduced-motion` et sur connexion lente, où le logo de Linux
(190 Ko) n'est pas chargé. Aucune phrase, aucun nom, aucun témoignage.
Au-dessus du champ « Ton nom », la carte de profil de la personne se
construit pendant qu'elle tape : initiales, nom, ligne de profil choisie
aux questions, @. « Ton @ » porte le « @ » dans le champ, suit le nom
(minuscules, sans accents ni espaces) jusqu'à ce qu'on le modifie, et
montre dessous l'adresse du profil et « Libre », « Déjà pris » ou
« Réservé » : seule ligne sous un champ du parcours, parce qu'elle répond
pendant la frappe. Bouton Continuer sur toute la largeur de la carte.

Quand une carte dépasse de l'écran (petit téléphone, Safari et ses barres),
son bouton principal reste collé au bas de l'écran, au-dessus de la zone
sûre de l'iPhone, avec l'erreur d'envoi juste au-dessus de lui, sur un fond
de verre plus dense qui prend toute la largeur de la carte ; il retrouve sa
place à la fin du défilement, sans que rien d'autre ne bouge.

Les logos de Simple Icons et de Devicon sont la seule exception au « jamais
le logo d'un autre produit » du principe 6 : décor qui dit de quoi on parle,
jamais cliquable, en blanc sur les écrans calmes et dans leurs vraies
couleurs sur l'accueil et derrière « Complète ton profil » (demandé le
08/11/2026, puis le 13/11/2026 pour Devicon). Aucun autre écran
n'hérite de ces exceptions.

## Mouvement

- 150 à 200 ms, uniquement pour montrer un changement d'état (ouverture d'un tiroir, envoi d'un message, nouvelle réaction).
- Une seule exception, le fond du parcours d'arrivée (voir « Les exceptions »).
- `prefers-reduced-motion` respecté partout, jusqu'aux vidéos du fil, qui ne jouent alors plus toutes seules.

## Accessibilité

- Vrais éléments : `<button>`, `<a href>`, `<input>` avec `<label>`. Jamais de `div` cliquable.
- Focus visible au clavier (`:focus-visible`) : contour de 2 px `--primary`, décalé de 2 px, sur les boutons, liens, onglets, interrupteurs, éléments de menu et lignes cliquables. Jamais au clic ni au toucher, ni sur un focus donné par le code après un clic (titre d'une nouvelle page) : `data-input` sur `<html>` (`lib/inputModality.ts`) suit la dernière action, clavier ou pointeur. Champs de saisie à 16 px au moins sur téléphone (pas de zoom à la saisie), `touch-action: manipulation` sur les contrôles, zoom à deux doigts jamais bloqué.
- Un champ de saisie (`Input`, `Textarea`, `Select`, composeur) n'a jamais de contour autour de lui : au focus, sa bordure de 1 px passe de `--border-strong` à `--primary`.
- À l'ouverture d'un dialogue ou d'une feuille, le focus va sur son contenu, pas sur le bouton de fermeture. Dans une autocomplétion ou un menu, l'élément actif se montre par un fond `--accent-soft`, sans bordure.
- `aria-label` sur chaque bouton qui n'a qu'une icône.
- Palette de commandes avec Ctrl+K (Cmd+K sur Mac) pour aller à un salon, un profil ou une action.

## Icônes et logo

- Icônes Lucide uniquement, trait de 1,75 px partout (posé une fois par `LucideProvider` dans `main.tsx`). Tailles : 24 px dans la barre du bas, 20 px dans la barre d'actions d'un post et les menus, 16 px dans le texte et les petits boutons. Une icône ne change de trait que pour marquer un état actif (republication faite).
- Logo Kemet : fichiers dans `apps/web/public/brand/`. Ne jamais les modifier, les déformer, changer leurs couleurs ou ajouter d'effet.
  - `kemet-wordmark.svg` sur fond clair, `kemet-wordmark-dark.svg` sur fond sombre, versions noire et blanche pour les cas en une couleur.
  - `kemet-symbol.svg` : le "k" seul, pour les petits espaces (barre d'activité). L'assistant a son propre symbole (`KoccSymbol`).
  - Icône de l'écran d'accueil du téléphone (`public/icons/`, fabriquée par `pnpm --filter @kemet/web icons:render` à partir de `kemet-wordmark-dark.svg`, jamais retouchée à la main) : le mot entier "kemet" sur le fond sombre `--bg` (#0D1320), à 74 % de la largeur, et à 60 % dans la version maskable d'Android pour rester dans la zone sûre ; lisible à 48 px. 192 et 512 px, maskable 512, `apple-touch-icon.png` (180 px). L'onglet du navigateur garde le "k" seul (`favicon.svg`, `favicon-32.png`, `favicon-16.png`) : le mot y serait illisible. Les anciennes icônes `kemet-app-icon*` restent dans `brand/`, plus référencées.
  - Zone de protection autour du logo : au moins la largeur du bras du "k". Hauteur minimale du mot-symbole : 16 px.
  - Sur fond sombre, le bleu du logo est #3B82F0.
- Exception à la règle "aucune couleur écrite en dur" : les logos des fournisseurs de connexion sociale (Google, LinkedIn, GitHub) dans `apps/web/src/components/auth/SocialProviderIcon.tsx` gardent leurs couleurs de marque officielles, hors de notre contrôle, identiques dans les deux thèmes.
- Exception à la même règle : les couleurs de la coloration syntaxique viennent des thèmes Shiki `github-light-high-contrast` et `github-dark-default` (`apps/web/src/components/content/highlighter.ts`), choisis pour leur contraste sur `--surface-2` (au moins 4,5:1). Elles passent quand même par des variables CSS (`--shiki-light`, `--shiki-dark`) pour suivre le thème actif.
