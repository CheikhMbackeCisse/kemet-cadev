# 0021 : Rendu Markdown et coloration du code

## Contexte

Messages, posts, réponses, retours structurés, skills et réponses de
l'assistant s'affichaient en texte brut. Un skill comme `wave-paiements`
montrait ses balises de code telles quelles, alors que "code coloré" est un
P0 de `docs/CONTEXTE.md` et que `DESIGN.md` demande Shiki et un bouton
Copier. Ces contenus sont écrits par des utilisateurs ou par un modèle de
langage : ils sont non fiables.

## Décision

Un seul composant, `apps/web/src/components/content/RichText.tsx`, rend tout
contenu écrit.

- **Markdown** avec `react-markdown`, `remark-gfm` (tableaux, listes de
  tâches, liens automatiques) et `remark-breaks` (un retour à la ligne dans
  un message reste un retour à la ligne). Licences MIT, dépendances
  indirectes vérifiées par `pnpm licenses:check`.
- **Jamais de HTML interprété.** Pas de `rehype-raw`. Le HTML écrit dans un
  contenu est converti en texte (`remarkHtmlAsText`) plutôt que supprimé : un
  développeur qui écrit `<Button>` doit le voir. Les adresses `javascript:` et
  `data:` sont vidées par `react-markdown` et le lien devient du texte.
- **Liens externes** en `target="_blank"` avec
  `rel="noopener noreferrer nofollow"`. **Images Markdown** remplacées par un
  lien : afficher une image externe ferait charger chez chaque lecteur une
  adresse choisie par l'auteur (pistage, contenu jamais modéré). Les images
  envoyées par le formulaire restent affichées, elles passent par nos routes.
- **Mentions** : `@handle` devient un lien vers le profil, `@kemet` est mis
  en valeur sans lien. Une adresse email n'est pas une mention, une mention
  dans du code non plus.
- **Coloration** avec Shiki : moteur d'expressions régulières JavaScript
  (pas de WebAssembly), thèmes `github-light-high-contrast` et
  `github-dark-default`, retenus parce que leur couleur la plus pâle reste
  au-dessus de 4,5:1 sur `--surface-2` (3,2:1 pour `github-light` et
  `github-dark`), portés par des variables CSS pour suivre le thème choisi sans recalcul, et une liste
  fermée de 22 langages chargés un par un (`highlighter.ts`). Un langage
  inconnu ou une grammaire qui ne charge pas laisse le code en texte brut.

## Conséquences

Mesuré en gzip sur le build de production : le fichier d'entrée reste à
87 ko, le premier affichage du fil passe de 142 à 143 ko. Le moteur Markdown
(53 ko) se charge juste après, Shiki (55 ko) au premier bloc de code ; sans
ce découpage, le fil aurait pesé 195 ko. Le chiffre de 88 ko cité le 20/10
ne comptait que le fichier d'entrée. En attendant le moteur, une seule fois
par visite, le texte s'affiche brut, retours à la ligne compris.

- Tout nouvel écran qui affiche un texte écrit par un utilisateur passe par
  `RichText`, jamais par `dangerouslySetInnerHTML`.
- Dans le fil, le corps d'un post n'est plus un lien (il contient ses propres
  liens, et un lien dans un lien n'est pas valide). La date du post mène à
  sa page, au clavier comme à la souris, et un clic ailleurs dans le texte
  aussi.
- Un aperçu de post partagé reste en texte brut : il est lui-même un lien.
- La grammaire C++ pèse 800 ko non compressés. Elle n'est téléchargée que
  pour un bloc ` ```cpp `, mais Vite signale sa taille à chaque build.
