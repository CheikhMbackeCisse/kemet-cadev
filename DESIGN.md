# DESIGN.md

Règles d'interface de Kemet. Elles s'appliquent à chaque écran, sans exception. En cas de doute, choisir la solution la plus sobre et la plus lisible.

## Principes

1. **Une application, pas une plaquette.** Kemet s'utilise tous les jours, comme GitHub ou Linear : interface dense, texte compact, peu de vide. Les grandes tailles sont réservées à la page d'accueil publique.
2. **Le contenu d'abord.** Messages, code, posts et profils remplissent l'écran. La décoration n'ajoute rien.
3. **Un seul élément marquant.** Le bloc de réponse de l'assistant @kemet est le seul élément visuellement fort. Tout le reste est discret.
4. **Pensé pour le téléphone et les connexions lentes.** Chaque écran est conçu en taille mobile en même temps qu'en taille bureau.
5. **L'ergonomie partout**, pas seulement dans les formulaires : états vides, chargements, erreurs, clavier, premier lancement.
6. **Pas d'originalité à tout prix.** On peut reprendre un mécanisme *et* une apparence d'un autre produit (Discord, X, LinkedIn, GitHub, Linear, Slack…) quand ça rend l'écran plus clair ou plus soigné, au cas par cas. Ce qui ne bouge jamais : les tokens de couleur, Plus Jakarta Sans/Space Grotesk/Geist Mono, les icônes Lucide, la grille 4px, et la liste « Ce qui est interdit » ci-dessous — ces interdits visent à éviter l'air générique IA, pas la ressemblance avec un produit existant, donc ils restent en vigueur même quand on copie. Jamais le logo, les couleurs de marque ou les assets d'un autre produit. Autorisation donnée le 14/10/2026, plus large que celle du lot du rail des espaces : cette fois l'apparence elle-même peut être reprise, pas seulement le mécanisme.

## Couleurs

Le thème suit le réglage du système (`prefers-color-scheme`), avec un choix manuel dans les paramètres : Système, Clair, Sombre. Toutes les couleurs passent par des variables CSS. Aucune couleur écrite en dur dans un composant.

| Variable | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| `--bg` | #FFFFFF | #0D1320 | Fond principal |
| `--surface` | #F8FAFD | #141B2A | Barres latérales, panneaux |
| `--surface-2` | #F2F6FB | #1B2436 | Survol, zones secondaires |
| `--border` | #E5E7EB | #263049 | Séparateurs |
| `--border-strong` | #D1D5DC | #34405C | Champs, boutons secondaires |
| `--text` | #1F1F1F | #E8ECF4 | Texte principal |
| `--text-2` | #364153 | #C3CBDA | Texte secondaire |
| `--muted` | #4A5565 | #A9B3C6 | Métadonnées |
| `--subtle` | #6A7282 | #8792A8 | Heures, aides discrètes |
| `--primary` | #1265DD | #1F6FE5 | Boutons principaux |
| `--primary-hover` | #0F56BD | #3B82F0 | Survol |
| `--link` | #1265DD | #7FB0F7 | Liens, mentions |
| `--accent-soft` | #ECF3FF | #16233D | Élément actif, mention |
| `--accent-soft-2` | #DBE9FD | #1D2E50 | Badges, bouton pressé |
| `--level-badge-text` | #0F56BD | #7FB0F7 | Texte accent sur `--accent-soft-2` (5,5:1 et 6,1:1) |
| `--level-apprenti` | #2E7D32 | #5CC46B | Icône et nom du niveau Apprenti |
| `--level-artisan` | #A14F00 | #E8A33C | Icône et nom du niveau Artisan |
| `--level-scribe` | #0E7490 | #3CC0D8 | Icône et nom du niveau Scribe |
| `--level-architecte` | #1265DD | #7FB0F7 | Icône et nom du niveau Architecte |
| `--level-legende` | #7C3AED | #B794F6 | Icône et nom du niveau Légende |
| `--rating-star` | #A14F00 | #E8A33C | Étoile remplie de la note d'un skill |
| `--assistant-bg` | #F5F8FF | #121C30 | Fond du bloc de réponse de l'assistant |
| `--assistant-border` | #D0E2FF | #26406E | Bordure du bloc de l'assistant |
| `--success` | #1E8205 | #4CC26A | Vérifié, actif |
| `--success-soft` | #EAF5E6 | #12301B | Fond des pastilles de succès |
| `--danger` | #C4320A | #F07856 | Erreurs, suppression |
| `--danger-soft` | #FBE9E3 | #3A1B14 | Fond des pastilles d'erreur |
| `--on-danger` | #FFFFFF | #0D1320 | Texte d'un bouton rouge plein (contraste AA dans les deux thèmes) |
| `--space-tint-1` à `-6` | #1565C0, #2E7D32, #6A1B9A, #AD1457, #00695C, #A14F00 | identiques | Fond d'un logo d'espace sans image ni technologie (icône blanche à 4,5:1), et d'un avatar à initiales |
| `--code-cover-bg` / `-bar` | #0D1320 / #141B2A | identiques | Fenêtre d'éditeur de la couverture d'un skill |
| `--code-cover-text` / `-keyword` / `-string` / `-comment` | #C3CBDA / #7FB0F7 / #5CC46B / #8792A8 | identiques | Texte de cette couverture |

Vérifier chaque couple texte/fond avec un outil de contraste : 4,5:1 minimum pour le texte courant, 3:1 pour le texte de 24 px et plus.

## Typographie

- **Plus Jakarta Sans** pour le texte courant de l'interface : très lisible en petite taille. **Space Grotesk** pour les titres (`h1` à `h3`) et les textes importants (classe `font-display` : nom d'un niveau, montants). **Geist Mono** uniquement pour le code et les durées. Les trois sont sous licence OFL-1.1, servies depuis notre serveur (`@fontsource`), jamais depuis un service tiers.
- Space Grotesk ajoutée le 08/11/2026 : Plus Jakarta Sans seule donnait des titres sans caractère. Elle ne sert jamais pour un paragraphe, où ses formes géométriques fatiguent la lecture.
- Taille de base : **14 px**. Interligne de 1,5 pour le texte, 1,25 pour les titres.

| Rôle | Taille | Graisse |
| --- | --- | --- |
| Métadonnées, heures | 12 px | 500 |
| Texte secondaire | 13 px | 400 |
| Texte courant, messages | 14 px | 400 |
| Titre de section | 16 px | 600 |
| Titre de page | 20 px | 700 |
| Grand titre (profil, compétition) | 24 px | 700 |
| Page d'accueil publique uniquement | 40 à 56 px | 800 |

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
- Cadres : un cadre sépare un objet du reste de la page (champ de saisie, bloc de code, réponse de `@kemet`, menu flottant, dialogue, feuille, image). Il ne sert jamais à regrouper : les éléments d'une liste (posts, projets, travaux, compétitions, équipes, soumissions) sont des lignes séparées par un filet `--border`, sauf les skills et les travaux de la page Travaux, en cartes (voir « Skill » et « Travail »), et les pastilles sont remplies, sans bordure.
- Ombres : aucune sur les éléments posés dans la page. Une seule ombre douce pour ce qui flotte (menus, fenêtres, notifications). Un menu porte en plus un filet `--border-strong` : en clair, son fond `--surface` se distingue à peine du blanc de la page.

## Mise en page

**Bureau (à partir de 1024 px) :**

- Barre d'activité : 56 px, sur le modèle de VS Code. Le logo (vers le fil), puis une icône par section (Fil, Travaux, Salons, Skills, Projets, Compétitions), et au pied Confidentialité, Paramètres, l'icône "Données de démonstration" quand elle est active, et le compte (avatar qui ouvre le menu du compte, ou "Se connecter" pour un visiteur). Infobulle au survol et au focus, indicateur de 2 px `--primary` à gauche de l'icône active. Ses sections se parcourent aux flèches haut et bas, Début et Fin, en un seul arrêt de tabulation ; le logo et le compte sont deux arrêts à part. L'indicateur marque la page ouverte, le fond `--accent-soft` le panneau déplié. Une section qui a des non-lus porte une pastille `--primary` au texte blanc de 12 px, en haut à droite de l'icône, plafonnée à "9+" et annoncée dans le nom de l'icône. Kemet Pro n'y figure pas.
- Panneau latéral : 264 px, titré du nom de la section. Les salons y montrent leurs espaces en arbre : un espace par ligne (logo d'espace et nom, point de non-lus), l'espace ouvert déplié sur ses salons, "Créer un espace" en pied. Un clic sur l'icône de la section ouverte, ou Ctrl+B (Cmd+B sur Mac), le replie et le rouvre ; le choix est mémorisé. Replié par défaut sous 1280 px. Une page sans panneau garde ses icônes en liens, et Ctrl+B y garde son sens habituel. Pas de redimensionnement à la souris.
- Contenu : fluide. Toutes les pages partagent ce cadre (`AppFrame`).
- Panneau de détails à droite : 300 px, affiché en permanence sur grand écran. Sous 1024 px il devient une feuille, ouverte depuis la barre du haut. Il n'est pas refermable sur grand écran : sa bascule encombrait la barre du haut, et une fois fermé rien ne permettait de le rouvrir.
- Pages de lecture (profil, skill) : largeur de contenu maximale de 960 px. Le fil et la page d'un post : colonne de 640 px, centrée (`ReadingPage width="feed"`).

**Mobile (moins de 768 px) :**

- Barre d'onglets en bas : Fil, Salons, Travaux, Skills, Moi. Ce sont les sections de la barre d'activité du bureau, tirées de la même liste (`railNav.ts`), dans un ordre propre au mobile qui garde Salons sous le pouce. "Moi" ouvre la page `/moi` : le même en-tête que le profil public (`ProfileHeader` : bannière ou bande `--accent-soft`, photo de 88 px qui chevauche son bord, chiffres à côté), avec trois chiffres Points (au point près), Travaux, Abonnés ; sous les chiffres, une barre de 4 px vers le niveau suivant à la couleur de l'insigne et "340 points · encore 160 pour Artisan" (au niveau Légende, son nom seul) ; puis nom, insigne et nom du niveau, @identifiant, drapeau et pays, bio sur deux lignes, et deux boutons de même largeur "Modifier le profil" et "Partager le profil". Un visiteur voit une carte avec le symbole Kemet, "Créer un compte" et "Se connecter", sans phrase. Puis une liste de lignes séparées par un filet : Mes travaux, Enregistrés, Messages, Projets, Compétitions, Niveaux, Paramètres, Confidentialité, Modération pour un administrateur, et la déconnexion en dernière ligne.
- Les messages privés n'ont pas d'onglet : un segment "Salons / Messages" en haut de l'onglet Salons y mène, avec la pastille des non-lus, reportée aussi sur l'onglet Salons. Sur bureau, "Messages" est une section de la barre d'activité.
- Un visiteur voit une seule invitation, une barre "Se connecter" / "Créer un compte" posée au-dessus des onglets, jamais une carte en haut de chaque page.
- L'onglet Salons montre une colonne étroite des espaces (logo d'espace, point de non-lus) et, à droite, les salons de l'espace choisi. "Créer un espace" se trouve en bas de la liste des salons, avec son libellé : jamais un "+" seul. Toucher un salon l'ouvre en plein écran ; la flèche de l'en-tête, un glissement depuis le bord gauche ou le retour du système ramènent à la liste (une entrée d'historique par salon ouvert). Le panneau de détails devient une feuille qui monte du bas, ouverte dans un salon par un bouton "Membres" avec son icône, jamais par une icône seule.
- Paramètres : une liste de sections avec une recherche, une page par section, et seulement des réglages qui fonctionnent.
- Le champ de message reste collé en bas, au-dessus du clavier et de la barre d'onglets. Dans un salon, la page fait la hauteur réellement visible (`100dvh`, repli `100vh`) et ne défile jamais en entier : seule la liste des messages défile. Le clavier réduit la page (`interactive-widget=resizes-content`) au lieu de la recouvrir.
- Les champs de saisie (`Input`, `Textarea`, `Select`) font 16 px de texte sur mobile : en dessous, Safari iOS zoome au focus et décale la page.
- Aucun survol nécessaire pour accéder à une action : tout ce qui apparaît au survol sur bureau est accessible par un appui long ou un menu sur mobile.

## Composants clés

- **Nom d'utilisateur :** prénom et nom, icône de niveau. Pas de drapeau ici : il est porté par l'avatar (voir ci-dessous). Jamais de total de points à côté d'un nom.
- **Avatar :** photo, ou initiales blanches sur une teinte `--space-tint-*` choisie d'après le nom (toujours la même pour une personne ; jamais une couleur de niveau, qui laisserait croire à un niveau), en 24, 32, 40 px, et 88 px dans l'en-tête d'un profil. À 32 et 40 px, le drapeau du pays s'ajoute en badge sur le coin inférieur droit de la photo (SVG flag-icons, avec le nom du pays en `title` et pour les lecteurs d'écran). Jamais à 24 px, où le badge ne laisserait plus voir la photo. À 88 px, pas de badge : le drapeau et le nom du pays sont écrits sous le nom. Ailleurs, c'est le seul endroit où le drapeau apparaît : la règle précédente le mettait aussi à côté du nom, ce qui affichait deux drapeaux par message et par post. Corrigé le 20/10/2026. Là où aucun avatar n'est rendu (aperçu d'un post partagé, retour structuré), on affiche un avatar de 32 px plutôt qu'un drapeau isolé.
- **Bannière de profil :** sur le profil public et sur Moi, en tête de page, au format 4:1 (160 px de haut au plus), coins `--radius-card`, fond `--surface-2` pendant le chargement. Image décorative (`alt` vide) : le nom et l'avatar juste en dessous portent l'information. Pas de texte posé dessus. La photo de 88 px chevauche son bord bas. Elle n'apparaît ni dans le fil, ni dans un salon. Un profil sans bannière garde une bande `--accent-soft` de 96 px, sur laquelle la photo se pose de la même façon. Aujourd'hui posée seulement par les données de démonstration : aucun envoi par l'utilisateur.
- **Niveau :** un insigne dessiné pour Kemet (`LevelInsignia`), de 16 px à côté du nom, de la couleur propre au niveau. Chaque niveau a sa forme et son motif, pour rester reconnaissable sans compter sur la couleur : Apprenti, une feuille et sa nervure (pas un cercle, qui se lisait comme une coche "vérifié") ; Artisan, un carré arrondi et un outil ; Scribe, un hexagone et une plume ; Architecte, un écu et une pyramide ; Légende, un soleil. Le motif prend la couleur du fond de page. Le nom du niveau est en `title` au survol et en `aria-label` ("Niveau Scribe"). Il n'est écrit en toutes lettres, à côté de l'insigne, que sur le profil. Toucher un insigne mène à `/niveaux` (zone d'appui élargie à 44 px sur mobile) : les cinq niveaux avec leurs insignes, les points nécessaires (sans nombre de membres), ce qui rapporte des points, et la position de la personne connectée (barre de progression vers le niveau suivant). Chaque couleur garde 4,5:1 sur `--bg`, `--surface` et `--surface-2` dans les deux thèmes (`tokens.test.ts`). Les pastilles de format (Astuce, À tester, Question) restent neutres, en `--surface-2`.
- **Message :** avatar de 32 px, nom, heure, contenu. Les messages successifs d'une même personne sont regroupés sous un seul avatar, jamais par-delà minuit. Un séparateur nomme chaque jour ("Aujourd'hui", "Hier", "18 octobre"). Les actions (réagir, signaler) vivent dans une petite barre posée sur le coin du message, visible au survol et au focus sur bureau, à l'appui sur écran tactile : jamais en permanence sous chaque message. Les réactions déjà posées restent affichées, elles font partie du contenu.
- **Fil d'un salon :** il s'ouvre sur le dernier message, ou sur le premier message non lu précédé d'un séparateur "Nouveaux messages" : traits en `--primary`, libellé en `--link`, qui garde 4,5:1 sur `--bg` en sombre (seul séparateur coloré, il signale une position et non une erreur). Les messages plus anciens se chargent en remontant, sans déplacer ce qui est à l'écran ni les annoncer comme nouveaux ; un bouton "Charger les messages précédents" en tête de liste les rend joignables au clavier et au lecteur d'écran. Un message qui arrive pendant qu'on lit plus haut ne fait pas défiler la liste : un bouton flottant "Aller au dernier message" apparaît, sur fond `--surface` ; il rend le focus à la liste, ou au composeur s'il est activé au clavier (au toucher, le clavier virtuel cacherait les messages atteints). Le composeur garde un brouillon par salon et le focus après l'envoi ; son bouton d'envoi fait 44 px sur mobile.
- **Bloc de réponse de l'assistant :** fond `--assistant-bg`, bordure `--assistant-border`, icône Kemet, nom "kemet", ligne "Basé sur le skill wave-paiements d'Awa Ndiaye" (lien vers le skill et le profil), mention de ce que l'assistant a lu, boutons "Utile" et "Pas utile". C'est le seul bloc coloré de l'interface.
- **Échec de l'assistant :** jamais dans le fil du salon, où il se lirait comme une réponse. Notice au-dessus du composeur, vue seulement par la personne qui a posé la question : fond `--danger-soft`, icône en `--danger`, texte en `--text` de taille normale, bouton "Reposer la question" (masqué pour un quota atteint) et croix pour la masquer. Le focus revient au composeur après l'un ou l'autre.
- **Post du fil :** ton détendu, texte court, images et mèmes, code. Étiquette de format seulement si l'auteur en a choisi un (Astuce, À tester, Question). Actions, sous le texte : répondre, cœur, enregistrer, partager, et "J'ai testé" sur les posts À tester ; la date en temps relatif ("il y a 3 h", date complète au survol) sur la ligne du nom ("Ghizlane Amrani · il y a 3 j"). Signaler, ou Supprimer pour son auteur, vit dans le menu "…" en haut à droite du post, hors de la rangée d'actions. Un post n'est pas une carte : c'est une ligne de la colonne de lecture, séparée de la suivante par un filet `--border`, fond `--surface-2` au survol sur bureau seulement. Même composant (`PostCard`) dans le fil et sur la page du post. Sur un post, "Utile" se marque d'un cœur (`--danger`, rempli une fois donné) : même sens et mêmes points qu'avant, "Utile" en `title` et dans l'`aria-label`. Les réponses de `@kemet` gardent le pouce levé. Enregistrer (signet, rempli une fois fait) range le post dans "Enregistrés", sous Moi. Partager ouvre la feuille de partage du téléphone, sinon copie le lien ; il n'y a pas de republication. Les étincelles restent l'icône de Kemet Pro.
- **Mention "Données de démonstration" :** tant que `DEMO_CONTENT_NOTICE` vaut `true`, une icône `FlaskConical` en `--subtle` au pied de la barre d'activité sur bureau, une ligne en 12 px au bas de la page Moi sur mobile, toutes deux liées à `/donnees-de-demo`.
- **Skill :** carte en grille sur le modèle de Travail (une colonne sur mobile, deux puis trois sur bureau), même bordure, même survol, sans ombre ni bouton "Voir" : le nom porte le lien étiré sur la carte. Couverture 16:9 dessinée en HTML, une petite fenêtre d'éditeur sombre (variables `--code-cover-*`, identiques dans les deux thèmes) avec une barre au nom du fichier (`slug.md`), les six premières lignes du premier bloc de code du skill en Geist Mono avec trois couleurs (mots-clés, chaînes, commentaires), et le logo Simple Icons de la technologie principale sur une pastille blanche dans un coin. Pas de Shiki dans une liste. Dessous : domaine en petit, nom, avatar de l'auteur en 24 px et "par X", deux lignes de description, puis "4,8 · 2,3k avis · 11,2k utilisations". La page d'un skill reprend la même couverture en tête. Une barre de recherche au-dessus de la grille. Les étoiles n'existent que sur les skills.
- **Onglets :** un seul composant (`Tabs`) partout. L'onglet actif est souligné de 2 px `--primary`, texte `--text` ; les autres sont en `--muted`. Pas de conteneur gris ni de fond plein sous l'onglet actif. Variante `centered` pour les deux onglets du fil ("Pour toi", "Abonnements") : centrés, 48 px de haut, texte de 14 px en graisse 600, soulignement de 3 px.
- **En-tête de page :** pas de grand espace au-dessus du titre (12 px sur mobile, 24 px sur bureau). Le bouton d'action de l'en-tête (Publier, Créer un skill…) est un bouton de taille normale (`HeaderActionLink`, hauteur de contrôle, texte de 13 px). Pas d'avatar du compte en haut à droite du fil ni d'un salon : le compte vit au pied de la barre d'activité sur bureau et dans l'onglet Moi sur mobile.
- **Message vocal :** un micro à la place du bouton d'envoi tant que le message est vide, dans un salon comme dans un message privé. Sur écran tactile, on le maintient pour enregistrer et on relâche pour envoyer ; glisser vers la gauche annule. Un appui bref (moins de 0,3 s, double appui d'un lecteur d'écran) démarre l'enregistrement comme un clic. À la souris ou au clavier, un clic démarre, puis "Envoyer" ou la corbeille (ou Échap). Pendant l'enregistrement, une barre recouvre le composeur : point `--danger` qui clignote (fixe avec `prefers-reduced-motion`), durée en Geist Mono. Deux minutes au plus, arrêt et envoi automatiques. Un micro refusé s'explique en une ligne sous le composeur. Le lecteur : bouton rond `--primary` lecture et pause, barre de progression qui permet d'avancer, durée ; rien n'est téléchargé avant l'appui, jamais de lecture automatique, un seul message vocal joue à la fois.
- **Code :** Geist Mono 13 px, coloration syntaxique avec Shiki, bouton "Copier", défilement horizontal plutôt que retour à la ligne.
- **Champ de texte long :** un seul composant (`Textarea`). Il part d'une ligne dans un salon ou un fil, de trois dans un formulaire, grandit avec le texte sans barre de défilement jusqu'à 6 lignes (salon) ou 10 (formulaire), puis défile à l'intérieur, et redescend quand on efface. Jamais de poignée de redimensionnement. Dans un salon, la liste des messages rétrécit quand le composeur grandit et garde le dernier message visible.
- **Page d'un travail :** titre (20 px), pastille de statut ("Terminé" neutre, "En cours" accent), puis trois onglets soulignés, liés à `?onglet=` : Présentation (résumé, liens avec une icône Lucide par type : GitHub `GitBranch`, GitLab `GitMerge`, Drive `HardDrive`, site `Globe`, vidéo `Video`, article `Newspaper`, autre `Link` ; PDF en téléchargement, tags, stack), Discussion et Équipe (auteurs avec leur niveau, auteurs sans compte). Sur bureau, une colonne de droite (17 rem, séparée par un filet) porte "Rejoindre la discussion" (bouton principal) avec le nombre de personnes qui y ont écrit, "Écrire à l'équipe en privé" (bouton secondaire, pour un compte qui n'est pas le seul auteur) et le bouton "Qui a travaillé sur ce sujet ?". Une seule colonne sur mobile, la colonne de droite passe sous les onglets ; "Rejoindre la discussion" ramène les onglets à l'écran.
- **Discussion d'un travail :** le rendu d'un salon dans l'onglet, sans liste des salons ni panneau. Les auteurs portent une pastille neutre "Auteur" à côté du nom et du badge de niveau. Signaler un message depuis une icône visible au survol et au focus sur bureau, en permanence sur écran tactile. Trois débuts de message en pastilles remplies, sans bordure, proposés à un compte qui n'a encore rien écrit et qui n'est pas auteur : un appui remplit le composeur, rien ne part tout seul.
- **"Qui a travaillé sur ce sujet ?" :** un bouton secondaire, jamais un appel au chargement. Résultat en lignes (avatar, nom, une phrase de justification, lien vers le travail cité). La marque "Réponse enregistrée" ou "Sans l'assistant" est une pastille neutre, suivie d'une phrase qui dit pourquoi.
- **Travail :** sur /travaux, carte en grille comme les skills, même bordure et même survol, sans bannière en dégradé : la couverture du travail en 16:9 (sinon un fond `--surface-2` avec une icône livre), le type et l'année en petit, le titre (lien étiré sur la carte), les avatars des auteurs en 24 px avec "par X et N autres", quatre tags au plus, qui filtrent la liste. Filtres sur une seule ligne au-dessus de la grille : type, tri, tag, sans libellé visible (nom accessible sur chaque champ). Sur /travaux comme dans la Bibliothèque d'un profil, les travaux sont des cartes. La page d'un travail montre la couverture en tête, puis sous le résumé les vidéos (lecteur du navigateur pour un fichier ; pour YouTube, un bouton "Lire la vidéo YouTube" qui ne charge le lecteur youtube-nocookie qu'au clic) et la galerie en vignettes qui ouvrent l'image en grand.
- **Projet dans le fil :** dans le fil mélangé, une carte projet est encadrée (bordure `--border`, `--radius-card`, sans ombre ni bannière) : c'est un objet d'une autre nature que les posts qui l'entourent, le cadre le sépare. Une carte au plus tous les cinq posts. Icône du domaine tirée de la stack, nom, auteur, pitch sur deux lignes, quatre éléments de stack au plus, deux demandes ouvertes au plus, "Proposer mon aide" (absent pour l'auteur, "Créer un compte pour aider" pour un visiteur) et "Voir le projet". Dans l'onglet Projets, les mêmes cartes redeviennent des lignes séparées par un filet.
- **Profil :** onglets soulignés, "Bibliothèque" en premier, puis "Parcours". Les demandes de coauteur reçues s'affichent au-dessus des onglets, sur son propre profil seulement, avec "Refuser" et "Accepter". Sous le nom, deux pastilles possibles : "Disponible pour des opportunités" et "Aide les débutants" (icône `HeartHandshake`), neutres.
- **Bibliothèque :** sections dans cet ordre, chacune sous un titre de section : CV, Travaux (cartes de /travaux), Projets (la carte encadrée du fil, en grille de deux colonnes sur bureau), Liens, Skills (cartes de skill). Sur le profil d'une autre personne, une section vide tient en une ligne en `--subtle` ; sur son propre profil, un état vide avec une action ("Ajouter mon CV", "Ajouter mes liens"). Le CV : nom du fichier, date, "Télécharger" ; dessous, l'aperçu des pages dans un cadre blanc (le papier du PDF, dans les deux thèmes), 448 px de large au plus sur bureau, pleine largeur sur mobile, avec "Page précédente" et "Page suivante". Un CV réservé aux comptes connectés se résume pour un visiteur à une phrase et "Créer un compte pour le voir". Liens : une ligne par lien, icône Lucide (GitHub `GitBranch`, GitLab `GitMerge`, LinkedIn `UserRound`, portfolio `Briefcase`, site `Globe`), nom du service et adresse raccourcie ; jamais de logo de marque.
- **Débutants :** rien de visible pour les autres. Un compte débutant voit les posts marqués débutant favorisés dans « Pour toi », sans étiquette, filtre ni carte. L'espace « Débuter en informatique » est proposé à l'onboarding et reste dans la liste des espaces ; l'interrupteur « J'aide les débutants » vit dans Paramètres > Profil.
- **Profils disponibles pour des opportunités :** pour un compte RH ou entrepreneur, une bande en tête du fil "Pour toi" : des cartes encadrées (avatar, nom, niveau, spécialité), défilement horizontal sur mobile.
- **Action destructive :** "Supprimer" un skill, un post ou un projet vit dans le menu "…" de l'objet, en élément de danger, et passe par une confirmation. Jamais de bouton rouge plein posé seul ; le bouton rouge n'existe que dans la confirmation.
- **Formulaire :** sur bureau, tous les champs ont la même largeur, celle du formulaire. Le bouton d'envoi reste actif (`SubmitButton`) ; à l'envoi, chaque champ manquant ou trop court affiche son erreur juste sous lui en `--danger` (`FormField`, bordure du champ en `--danger`, `aria-invalid`), et le focus va au premier champ en erreur. Aucun sous-titre sous le titre d'un formulaire, aucun texte d'aide sous un champ : un exemple va dans le placeholder, une contrainte ne s'affiche que comme erreur. L'identifiant d'un skill, d'un projet, d'une compétition, d'un travail ou d'un espace se fabrique depuis le titre (suffixe "-2", "-3"... s'il est pris). Sur téléphone, le bouton d'envoi d'un formulaire en page reste collé en bas, au-dessus des onglets.

- **Logo d'espace (`SpaceIcon`) :** l'image de l'espace s'il en a une ; sinon le logo Simple Icons de la technologie que cite son nom, en couleur sur pastille blanche ; sinon une icône Lucide blanche, choisie par mots-clés, sur une des six teintes `--space-tint-1` à `--space-tint-6`, choisie d'après l'icône et le rang dans la liste pour que deux espaces de même icône n'aient jamais la même teinte (blanc à 4,5:1 sur chacune, testé). Même logo dans le panneau Salons, la colonne mobile, les listes et l'onboarding.
- **Bouton à icône seule (`IconButton`) :** son nom accessible sert aussi d'infobulle au survol (`title`). Une icône dont le sens n'est pas évident pour quelqu'un qui découvre l'informatique reçoit un mot à côté (Code, J'ai testé, Membres, Démo).
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
(`/completer-profil`) et les six écrans d'onboarding (`/bienvenue`)
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
(`decorLayout.test.ts`) ; une bande trop petite reste vide, un formulaire
long sur un petit écran n'a aucun décor. Dix éléments au plus sur ordinateur,
six sur téléphone : quatre logos de langages (Python, JavaScript,
TypeScript, Kotlin), trois icônes Lucide (terminal, base de données, réseau,
26 ou 30 px, trait de 1,5 px : à cette taille, il pèse autant que le trait de
2 px des icônes de 20 px) et trois bouts de code en Geist Mono.

Sur l'accueil, les logos sont dans leurs vraies couleurs (Simple Icons) sur
une pastille blanche pleine, sans flou ni ombre, et le continent, plus
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
posé sur une capitale, une ville ou un arc visible est caché ; les places
du décor sont choisies pour que ça n'arrive pas aux tailles courantes. La
carte de l'accueil est plus claire (teinte à 50 %, flou de 1 px). Tout en
bas de l'écran, "Propulsé par" en petit et en blanc atténué, puis
"Systalink" en blanc, graisse moyenne, S majuscule, sur la même ligne : ni
pastille, ni leur symbole, ni leur police.

Le contenu de chaque écran est posé sur une carte en verre dépoli (teinte du
fond à 60 %, flou de 3 px, bord blanc à 20 %), demandée explicitement le
08/11/2026. Le texte de la carte est blanc dans les deux thèmes (`--auth-*`),
les champs gardent leurs couleurs ordinaires, le bouton principal est blanc.
Aucun texte descriptif sous les titres, une barre de progression sans
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

Quand une carte dépasse de l'écran (petit téléphone, Safari et ses barres),
son bouton principal reste collé au bas de l'écran, au-dessus de la zone
sûre de l'iPhone, avec l'erreur d'envoi juste au-dessus de lui, sur un fond
de verre plus dense qui prend toute la largeur de la carte ; il retrouve sa
place à la fin du défilement, sans que rien d'autre ne bouge.

Les logos de Simple Icons sont la seule exception au « jamais le logo d'un
autre produit » du principe 6 : décor qui dit de quoi on parle, jamais
cliquable, en blanc sur les écrans calmes et dans leurs vraies couleurs sur
l'accueil seulement (demandé le 08/11/2026). Aucun autre écran
n'hérite de ces exceptions.

## Mouvement

- 150 à 200 ms, uniquement pour montrer un changement d'état (ouverture d'un tiroir, envoi d'un message, nouvelle réaction).
- Une seule exception, le fond du parcours d'arrivée (voir « Les exceptions »).
- `prefers-reduced-motion` respecté partout.

## Accessibilité

- Vrais éléments : `<button>`, `<a href>`, `<input>` avec `<label>`. Jamais de `div` cliquable.
- Focus visible au clavier (`:focus-visible`) : contour de 2 px `--primary`, décalé de 2 px, sur les boutons, liens, onglets, interrupteurs, éléments de menu et lignes cliquables. Jamais au clic ni au toucher.
- Un champ de saisie (`Input`, `Textarea`, `Select`, composeur) n'a jamais de contour autour de lui : au focus, sa bordure de 1 px passe de `--border-strong` à `--primary`.
- À l'ouverture d'un dialogue ou d'une feuille, le focus va sur son contenu, pas sur le bouton de fermeture. Dans une autocomplétion ou un menu, l'élément actif se montre par un fond `--accent-soft`, sans bordure.
- `aria-label` sur chaque bouton qui n'a qu'une icône.
- Palette de commandes avec Ctrl+K (Cmd+K sur Mac) pour aller à un salon, un profil ou une action.

## Icônes et logo

- Icônes Lucide uniquement, trait de 2 px, 16 ou 20 px.
- Logo Kemet : fichiers dans `apps/web/public/brand/`. Ne jamais les modifier, les déformer, changer leurs couleurs ou ajouter d'effet.
  - `kemet-wordmark.svg` sur fond clair, `kemet-wordmark-dark.svg` sur fond sombre, versions noire et blanche pour les cas en une couleur.
  - `kemet-symbol.svg` : le "k" seul, pour les petits espaces (barre d'activité, avatar de l'assistant).
  - `kemet-app-icon.svg` et PNG : icône de la web app ; `kemet-app-icon-maskable-512.png` pour Android ; `apple-touch-icon.png` pour iOS ; `favicon.svg`, `favicon-32.png`, `favicon-16.png`.
  - Zone de protection autour du logo : au moins la largeur du bras du "k". Hauteur minimale du mot-symbole : 16 px.
  - Sur fond sombre, le bleu du logo est #3B82F0.
- Exception à la règle "aucune couleur écrite en dur" : les logos des fournisseurs de connexion sociale (Google, LinkedIn, GitHub) dans `apps/web/src/components/auth/SocialProviderIcon.tsx` gardent leurs couleurs de marque officielles, hors de notre contrôle, identiques dans les deux thèmes.
- Exception à la même règle : les couleurs de la coloration syntaxique viennent des thèmes Shiki `github-light-high-contrast` et `github-dark-default` (`apps/web/src/components/content/highlighter.ts`), choisis pour leur contraste sur `--surface-2` (au moins 4,5:1). Elles passent quand même par des variables CSS (`--shiki-light`, `--shiki-dark`) pour suivre le thème actif.
