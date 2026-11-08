# DESIGN.md

Règles d'interface de Kemet. Elles s'appliquent à chaque écran, sans exception. En cas de doute, choisir la solution la plus sobre et la plus lisible.

## Principes

1. **Une application, pas une plaquette.** Kemet s'utilise tous les jours, comme GitHub ou Linear : interface dense, texte compact, peu de vide. Les grandes tailles sont réservées à la page d'accueil publique.
2. **Le contenu d'abord.** Messages, code, posts et profils remplissent l'écran. La décoration n'ajoute rien.
3. **Un seul élément marquant.** Le bloc de réponse de l'assistant @kemet est le seul élément visuellement fort. Tout le reste est discret.
4. **Pensé pour le téléphone et les connexions lentes.** Chaque écran est conçu en taille mobile en même temps qu'en taille bureau.
5. **L'ergonomie partout**, pas seulement dans les formulaires : états vides, chargements, erreurs, clavier, premier lancement.
6. **Pas d'originalité à tout prix.** On peut reprendre un mécanisme *et* une apparence d'un autre produit (Discord, X, LinkedIn, GitHub, Linear, Slack…) quand ça rend l'écran plus clair ou plus soigné, au cas par cas. Ce qui ne bouge jamais : les tokens de couleur, Plus Jakarta Sans/Geist Mono, les icônes Lucide, la grille 4px, et la liste « Ce qui est interdit » ci-dessous — ces interdits visent à éviter l'air générique IA, pas la ressemblance avec un produit existant, donc ils restent en vigueur même quand on copie. Jamais le logo, les couleurs de marque ou les assets d'un autre produit. Autorisation donnée le 14/10/2026, plus large que celle du lot du rail des espaces : cette fois l'apparence elle-même peut être reprise, pas seulement le mécanisme.

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
| `--level-badge-text` | #0F56BD | #7FB0F7 | Texte du badge de niveau, sur `--accent-soft-2` (5,5:1 et 6,1:1) |
| `--assistant-bg` | #F5F8FF | #121C30 | Fond du bloc de réponse de l'assistant |
| `--assistant-border` | #D0E2FF | #26406E | Bordure du bloc de l'assistant |
| `--success` | #1E8205 | #4CC26A | Vérifié, actif |
| `--success-soft` | #EAF5E6 | #12301B | Fond des pastilles de succès |
| `--danger` | #C4320A | #F07856 | Erreurs, suppression |
| `--danger-soft` | #FBE9E3 | #3A1B14 | Fond des pastilles d'erreur |
| `--on-danger` | #FFFFFF | #0D1320 | Texte d'un bouton rouge plein (contraste AA dans les deux thèmes) |

Vérifier chaque couple texte/fond avec un outil de contraste : 4,5:1 minimum pour le texte courant, 3:1 pour le texte de 24 px et plus.

## Typographie

- **Plus Jakarta Sans** pour toute l'interface. **Geist Mono** uniquement pour le code. Les deux sont sous licence OFL, à déclarer.
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
- Cadres : un cadre sépare un objet du reste de la page (champ de saisie, bloc de code, réponse de `@kemet`, menu flottant, dialogue, feuille, image). Il ne sert jamais à regrouper : les éléments d'une liste (posts, skills, projets, travaux, compétitions, équipes, soumissions) sont des lignes séparées par un filet `--border`, et les pastilles sont remplies, sans bordure.
- Ombres : aucune sur les éléments posés dans la page. Une seule ombre douce pour ce qui flotte (menus, fenêtres, notifications). Un menu porte en plus un filet `--border-strong` : en clair, son fond `--surface` se distingue à peine du blanc de la page.

## Mise en page

**Bureau (à partir de 1024 px) :**

- Barre d'activité : 56 px, sur le modèle de VS Code. Le logo (vers le fil), puis une icône par section (Fil, Travaux, Salons, Skills, Projets, Compétitions), et au pied Confidentialité, Paramètres et le compte (avatar qui ouvre le menu du compte, ou "Se connecter" pour un visiteur). Infobulle au survol et au focus, indicateur de 2 px `--primary` à gauche de l'icône active. Ses sections se parcourent aux flèches haut et bas, Début et Fin, en un seul arrêt de tabulation ; le logo et le compte sont deux arrêts à part. L'indicateur marque la page ouverte, le fond `--accent-soft` le panneau déplié. Une section qui a des non-lus porte une pastille `--primary` au texte blanc de 12 px, en haut à droite de l'icône, plafonnée à "9+" et annoncée dans le nom de l'icône. Kemet Pro n'y figure pas.
- Panneau latéral : 264 px, titré du nom de la section. Les salons y montrent leurs espaces en arbre : un espace par ligne (monogramme et nom, point de non-lus), l'espace ouvert déplié sur ses salons, "Créer un espace" en pied. Un clic sur l'icône de la section ouverte, ou Ctrl+B (Cmd+B sur Mac), le replie et le rouvre ; le choix est mémorisé. Replié par défaut sous 1280 px. Une page sans panneau garde ses icônes en liens, et Ctrl+B y garde son sens habituel. Pas de redimensionnement à la souris.
- Contenu : fluide. Toutes les pages partagent ce cadre (`AppFrame`).
- Panneau de détails à droite : 300 px, affiché en permanence sur grand écran. Sous 1024 px il devient une feuille, ouverte depuis la barre du haut. Il n'est pas refermable sur grand écran : sa bascule encombrait la barre du haut, et une fois fermé rien ne permettait de le rouvrir.
- Pages de lecture (profil, post, skill) : largeur de contenu maximale de 960 px.

**Mobile (moins de 768 px) :**

- Barre d'onglets en bas : Fil, Salons, Travaux, Skills, Moi. Ce sont les sections de la barre d'activité du bureau, tirées de la même liste (`railNav.ts`), dans un ordre propre au mobile qui garde Salons sous le pouce. "Moi" ouvre la page `/moi` : le compte en haut (avatar, nom, niveau, une ligne de compteurs, "Modifier le profil"), puis une liste de lignes séparées par un filet : Mes travaux, Enregistrés, Messages, Projets, Compétitions, Paramètres, Confidentialité, Modération pour un administrateur, et la déconnexion en dernière ligne.
- Les messages privés n'ont pas d'onglet : un segment "Salons / Messages" en haut de l'onglet Salons y mène, avec la pastille des non-lus, reportée aussi sur l'onglet Salons. Sur bureau, "Messages" est une section de la barre d'activité.
- Un visiteur voit une seule invitation, une barre "Se connecter" / "Créer un compte" posée au-dessus des onglets, jamais une carte en haut de chaque page.
- L'onglet Salons montre une colonne étroite des espaces (monogramme ou image, point de non-lus) et, à droite, les salons de l'espace choisi. "Créer un espace" se trouve en bas de la liste des salons, avec son libellé : jamais un "+" seul. Toucher un salon l'ouvre en plein écran ; la flèche de l'en-tête, un glissement depuis le bord gauche ou le retour du système ramènent à la liste (une entrée d'historique par salon ouvert). Le panneau de détails devient une feuille qui monte du bas.
- Paramètres : une liste de sections avec une recherche, une page par section, et seulement des réglages qui fonctionnent.
- Le champ de message reste collé en bas, au-dessus du clavier et de la barre d'onglets. Dans un salon, la page fait la hauteur réellement visible (`100dvh`, repli `100vh`) et ne défile jamais en entier : seule la liste des messages défile. Le clavier réduit la page (`interactive-widget=resizes-content`) au lieu de la recouvrir.
- Les champs de saisie (`Input`, `Textarea`, `Select`) font 16 px de texte sur mobile : en dessous, Safari iOS zoome au focus et décale la page.
- Aucun survol nécessaire pour accéder à une action : tout ce qui apparaît au survol sur bureau est accessible par un appui long ou un menu sur mobile.

## Composants clés

- **Nom d'utilisateur :** prénom et nom, badge de niveau discret. Pas de drapeau ici : il est porté par l'avatar (voir ci-dessous). Jamais de total de points à côté d'un nom.
- **Avatar :** photo ou motif généré, en 24, 32 ou 40 px. À 32 et 40 px, le drapeau du pays s'ajoute en badge sur le coin inférieur droit de la photo (SVG flag-icons, avec le nom du pays en `title` et pour les lecteurs d'écran). Jamais à 24 px, où le badge ne laisserait plus voir la photo. C'est le seul endroit où le drapeau apparaît : la règle précédente le mettait aussi à côté du nom, ce qui affichait deux drapeaux par message et par post. Corrigé le 20/10/2026. Là où aucun avatar n'est rendu (aperçu d'un post partagé, retour structuré), on affiche un avatar de 32 px plutôt qu'un drapeau isolé.
- **Badge de niveau :** petite pastille remplie, sans bordure, avec le nom du niveau (Apprenti, Artisan, Scribe, Architecte, Légende). Fond `--accent-soft-2` et texte `--level-badge-text`, le même pour tous les niveaux sauf Légende (fond `--primary`, texte blanc). Pas d'exception en contour. Les pastilles de format (Astuce, À tester, Question) restent neutres, en `--surface-2` : niveau et format se distinguent par la teinte. `--primary` ne sert pas de texte ici, il n'atteint que 4,35:1 en clair et 2,86:1 en sombre sur ce fond.
- **Message :** avatar de 32 px, nom, heure, contenu. Les messages successifs d'une même personne sont regroupés sous un seul avatar, jamais par-delà minuit. Un séparateur nomme chaque jour ("Aujourd'hui", "Hier", "18 octobre"). Les actions (réagir, signaler) vivent dans une petite barre posée sur le coin du message, visible au survol et au focus sur bureau, à l'appui sur écran tactile : jamais en permanence sous chaque message. Les réactions déjà posées restent affichées, elles font partie du contenu.
- **Fil d'un salon :** il s'ouvre sur le dernier message, ou sur le premier message non lu précédé d'un séparateur "Nouveaux messages" : traits en `--primary`, libellé en `--link`, qui garde 4,5:1 sur `--bg` en sombre (seul séparateur coloré, il signale une position et non une erreur). Les messages plus anciens se chargent en remontant, sans déplacer ce qui est à l'écran ni les annoncer comme nouveaux ; un bouton "Charger les messages précédents" en tête de liste les rend joignables au clavier et au lecteur d'écran. Un message qui arrive pendant qu'on lit plus haut ne fait pas défiler la liste : un bouton flottant "Aller au dernier message" apparaît, sur fond `--surface` ; il rend le focus à la liste, ou au composeur s'il est activé au clavier (au toucher, le clavier virtuel cacherait les messages atteints). Le composeur garde un brouillon par salon et le focus après l'envoi ; son bouton d'envoi fait 44 px sur mobile.
- **Bloc de réponse de l'assistant :** fond `--assistant-bg`, bordure `--assistant-border`, icône Kemet, nom "kemet", ligne "Basé sur le skill wave-paiements d'Awa Ndiaye" (lien vers le skill et le profil), mention de ce que l'assistant a lu, boutons "Utile" et "Pas utile". C'est le seul bloc coloré de l'interface.
- **Échec de l'assistant :** jamais dans le fil du salon, où il se lirait comme une réponse. Notice au-dessus du composeur, vue seulement par la personne qui a posé la question : fond `--danger-soft`, icône en `--danger`, texte en `--text` de taille normale, bouton "Reposer la question" (masqué pour un quota atteint) et croix pour la masquer. Le focus revient au composeur après l'un ou l'autre.
- **Post du fil :** ton détendu, texte court, images et mèmes, code. Étiquette de format seulement si l'auteur en a choisi un (Astuce, À tester, Question). Actions : répondre, partager, "Utile", et "J'ai testé" sur les posts À tester. Nos propres icônes et notre propre mise en page : rien qui rappelle X. Un post n'est pas une carte : c'est une ligne de la colonne de lecture, séparée de la suivante par un filet `--border`, fond `--surface-2` au survol sur bureau seulement. Même composant (`PostCard`) dans le fil et sur la page du post. "Utile" se marque d'un pouce levé, comme sur les réponses de `@kemet`, libellé visible sur bureau ; les étincelles restent l'icône de Kemet Pro.
- **Skill :** ligne de liste (comme un post) avec nom, description, auteur (avec drapeau et niveau), étoiles (moyenne et nombre de notes), nombre d'utilisations. Les étoiles n'existent que sur les skills.
- **Onglets :** un seul composant (`Tabs`) partout. L'onglet actif est souligné de 2 px `--primary`, texte `--text` ; les autres sont en `--muted`. Pas de conteneur gris ni de fond plein sous l'onglet actif.
- **Code :** Geist Mono 13 px, coloration syntaxique avec Shiki, bouton "Copier", défilement horizontal plutôt que retour à la ligne.
- **Champ de texte long :** un seul composant (`Textarea`). Il part d'une ligne dans un salon ou un fil, de trois dans un formulaire, grandit avec le texte sans barre de défilement jusqu'à 6 lignes (salon) ou 10 (formulaire), puis défile à l'intérieur, et redescend quand on efface. Jamais de poignée de redimensionnement. Dans un salon, la liste des messages rétrécit quand le composeur grandit et garde le dernier message visible.
- **Page d'un travail :** titre (20 px), pastille de statut ("Terminé" neutre, "En cours" accent), puis trois onglets soulignés, liés à `?onglet=` : Présentation (résumé, liens avec une icône Lucide par type : GitHub `GitBranch`, GitLab `GitMerge`, Drive `HardDrive`, site `Globe`, vidéo `Video`, article `Newspaper`, autre `Link` ; PDF en téléchargement, tags, stack), Discussion et Équipe (auteurs avec leur niveau, auteurs sans compte). Sur bureau, une colonne de droite (17 rem, séparée par un filet) porte "Rejoindre la discussion" (bouton principal) avec le nombre de personnes qui y ont écrit, "Écrire à l'équipe en privé" (bouton secondaire, pour un compte qui n'est pas le seul auteur) et le bouton "Qui a travaillé sur ce sujet ?". Une seule colonne sur mobile, la colonne de droite passe sous les onglets ; "Rejoindre la discussion" ramène les onglets à l'écran.
- **Discussion d'un travail :** le rendu d'un salon dans l'onglet, sans liste des salons ni panneau. Les auteurs portent une pastille neutre "Auteur" à côté du nom et du badge de niveau. Signaler un message depuis une icône visible au survol et au focus sur bureau, en permanence sur écran tactile. Trois débuts de message en pastilles remplies, sans bordure, proposés à un compte qui n'a encore rien écrit et qui n'est pas auteur : un appui remplit le composeur, rien ne part tout seul.
- **"Qui a travaillé sur ce sujet ?" :** un bouton secondaire, jamais un appel au chargement. Résultat en lignes (avatar, nom, une phrase de justification, lien vers le travail cité). La marque "Réponse enregistrée" ou "Sans l'assistant" est une pastille neutre, suivie d'une phrase qui dit pourquoi.
- **Profil :** onglets soulignés, "Travaux" en premier, puis "Parcours". Les demandes de coauteur reçues s'affichent au-dessus des onglets, sur son propre profil seulement, avec "Refuser" et "Accepter".
- **Action destructive :** "Supprimer" un skill, un post ou un projet vit dans le menu "…" de l'objet, en élément de danger, et passe par une confirmation. Jamais de bouton rouge plein posé seul ; le bouton rouge n'existe que dans la confirmation.
- **Formulaire :** sur bureau, tous les champs ont la même largeur, celle du formulaire. Un bouton principal désactivé dit pourquoi, à côté de lui ("À remplir : Nom, Identifiant.").

## États

Chaque écran et chaque liste a quatre états dessinés :

- **Chargement :** squelettes à la forme du contenu, pas de spinner plein écran.
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

- dégradés décoratifs, effet verre dépoli, halos lumineux (une seule exception, les écrans de compte, voir ci-dessous) ;
- emojis utilisés comme icônes ;
- cartes toutes identiques avec la même ombre grise ;
- bordure colorée à gauche des cartes ;
- petits libellés en majuscules espacées au-dessus des titres ;
- chiffres ou statistiques décoratifs ;
- animations d'apparition sur chaque section ;
- polices Inter, Roboto, Arial.

### La seule exception : les écrans de compte

Les écrans de compte (connexion, inscription, mot de passe oublié, réinitialisation)
ont droit à un fond de marque avec dégradé et halos lumineux. L'interdit a été levé
pour ces écrans le 20/10/2026, après comparaison avec la page de
connexion de Systalink. Voir `docs/adr/0019-fond-des-ecrans-de-compte.md`.

Le périmètre est strict : le dégradé et les halos vivent dans le fond, derrière
une carte opaque qui porte le formulaire. Le formulaire lui-même, ses champs, ses
boutons et ses textes restent des composants Kemet ordinaires, sans dégradé ni
halo. Aucun autre écran du produit ne bénéficie de cette exception.

L'écran d'accueil d'une première visite (`/decouvrir`) partage ce fond depuis
le 08/11/2026 : il est la porte d'entrée vers l'inscription. Il n'a pas de
carte, son contenu est court (logo, titre, une phrase, deux actions) et posé
directement sur le fond, en blanc. C'est aussi le seul écran avec une
animation continue : des symboles de code qui montent lentement dans les
marges, demandés explicitement pour cet écran, arrêtés par
`prefers-reduced-motion`.

## Mouvement

- 150 à 200 ms, uniquement pour montrer un changement d'état (ouverture d'un tiroir, envoi d'un message, nouvelle réaction).
- Une seule exception, l'écran d'accueil d'une première visite (voir « La seule exception : les écrans de compte »).
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
