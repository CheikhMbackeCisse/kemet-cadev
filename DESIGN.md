# DESIGN.md

Règles d'interface de Kemet. Elles s'appliquent à chaque écran, sans exception. En cas de doute, choisir la solution la plus sobre et la plus lisible.

## Principes

1. **Une application, pas une plaquette.** Kemet s'utilise tous les jours, comme GitHub ou Linear : interface dense, texte compact, peu de vide. Les grandes tailles sont réservées à la page d'accueil publique.
2. **Le contenu d'abord.** Messages, code, posts et profils remplissent l'écran. La décoration n'ajoute rien.
3. **Un seul élément marquant.** Le bloc de réponse de l'assistant @kemet est le seul élément visuellement fort. Tout le reste est discret.
4. **Pensé pour le téléphone et les connexions lentes.** Chaque écran est conçu en taille mobile en même temps qu'en taille bureau.
5. **L'ergonomie partout**, pas seulement dans les formulaires : états vides, chargements, erreurs, clavier, premier lancement.
6. **Original.** On peut reprendre un mécanisme d'un autre produit, jamais son apparence. Le fil ne ressemble pas à X, les salons ne ressemblent pas à Discord.

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
| `--assistant-bg` | #F5F8FF | #121C30 | Fond du bloc de réponse de l'assistant |
| `--assistant-border` | #D0E2FF | #26406E | Bordure du bloc de l'assistant |
| `--success` | #1E8205 | #4CC26A | Vérifié, actif |
| `--success-soft` | #EAF5E6 | #12301B | Fond des pastilles de succès |
| `--danger` | #C4320A | #F07856 | Erreurs, suppression |
| `--danger-soft` | #FBE9E3 | #3A1B14 | Fond des pastilles d'erreur |

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
- Arrondis : 6 px pour les contrôles, 8 px pour les cartes, 12 px pour les panneaux et fenêtres, pastilles entièrement arrondies. Pas le même arrondi partout.
- Ombres : aucune sur les éléments posés dans la page. Une seule ombre douce pour ce qui flotte (menus, fenêtres, notifications).

## Mise en page

**Bureau (à partir de 1024 px) :**

- Rail des espaces : 64 px.
- Liste des salons : 240 px.
- Contenu : fluide.
- Panneau de détails à droite : 300 px, refermable.
- Pages de lecture (profil, post, skill) : largeur de contenu maximale de 960 px.

**Mobile (moins de 768 px) :**

- Barre d'onglets en bas : Fil, Salons, Projets, Compétitions, Moi.
- La liste des salons s'ouvre en tiroir depuis la gauche. Le panneau de détails devient une feuille qui monte du bas.
- Le champ de message reste collé en bas, au-dessus du clavier.
- Aucun survol nécessaire pour accéder à une action : tout ce qui apparaît au survol sur bureau est accessible par un appui long ou un menu sur mobile.

## Composants clés

- **Nom d'utilisateur :** prénom et nom, drapeau du pays (SVG flag-icons, 16 x 12 px, avec le nom du pays en `title` et pour les lecteurs d'écran), badge de niveau discret. Jamais de total de points à côté d'un nom.
- **Badge de niveau :** petite pastille avec le nom du niveau (Apprenti, Artisan, Scribe, Architecte, Légende). Couleur neutre, sauf Légende qui utilise `--primary`.
- **Message :** avatar de 32 px, nom, heure, contenu. Les messages successifs d'une même personne sont regroupés sous un seul avatar.
- **Bloc de réponse de l'assistant :** fond `--assistant-bg`, bordure `--assistant-border`, icône Kemet, nom "kemet", ligne "Basé sur le skill wave-paiements d'Awa Ndiaye" (lien vers le skill et le profil), mention de ce que l'assistant a lu, boutons "Utile" et "Pas utile". C'est le seul bloc coloré de l'interface.
- **Post du fil :** ton détendu, texte court, images et mèmes, code. Étiquette de format seulement si l'auteur en a choisi un (Astuce, À tester, Question). Actions : répondre, partager, "Utile", et "J'ai testé" sur les posts À tester. Nos propres icônes et notre propre mise en page : rien qui rappelle X.
- **Skill :** carte avec nom, description, auteur (avec drapeau et niveau), étoiles (moyenne et nombre de notes), nombre d'utilisations. Les étoiles n'existent que sur les skills.
- **Code :** Geist Mono 13 px, coloration syntaxique avec Shiki, bouton "Copier", défilement horizontal plutôt que retour à la ligne.

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

- dégradés décoratifs, effet verre dépoli, halos lumineux ;
- emojis utilisés comme icônes ;
- cartes toutes identiques avec la même ombre grise ;
- bordure colorée à gauche des cartes ;
- petits libellés en majuscules espacées au-dessus des titres ;
- chiffres ou statistiques décoratifs ;
- animations d'apparition sur chaque section ;
- polices Inter, Roboto, Arial.

## Mouvement

- 150 à 200 ms, uniquement pour montrer un changement d'état (ouverture d'un tiroir, envoi d'un message, nouvelle réaction).
- `prefers-reduced-motion` respecté partout.

## Accessibilité

- Vrais éléments : `<button>`, `<a href>`, `<input>` avec `<label>`. Jamais de `div` cliquable.
- Focus clavier toujours visible (contour de 2 px `--primary`).
- `aria-label` sur chaque bouton qui n'a qu'une icône.
- Palette de commandes avec Ctrl+K (Cmd+K sur Mac) pour aller à un salon, un profil ou une action.

## Icônes et logo

- Icônes Lucide uniquement, trait de 2 px, 16 ou 20 px.
- Logo Kemet : fichiers dans `apps/web/public/brand/`. Ne jamais les modifier, les déformer, changer leurs couleurs ou ajouter d'effet.
  - `kemet-wordmark.svg` sur fond clair, `kemet-wordmark-dark.svg` sur fond sombre, versions noire et blanche pour les cas en une couleur.
  - `kemet-symbol.svg` : le "k" seul, pour les petits espaces (rail des espaces, avatar de l'assistant).
  - `kemet-app-icon.svg` et PNG : icône de la web app ; `kemet-app-icon-maskable-512.png` pour Android ; `apple-touch-icon.png` pour iOS ; `favicon.svg`, `favicon-32.png`, `favicon-16.png`.
  - Zone de protection autour du logo : au moins la largeur du bras du "k". Hauteur minimale du mot-symbole : 16 px.
  - Sur fond sombre, le bleu du logo est #3B82F0.
