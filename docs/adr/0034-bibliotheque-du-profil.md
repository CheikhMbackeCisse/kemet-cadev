# 0034. Bibliothèque du profil et CV

## Contexte

Un profil montrait le parcours et les travaux, mais rien de ce qu'un
recruteur ou une entrepreneure cherche en premier : un CV, les projets, les
liens vers ce que la personne a construit ailleurs. Le CV est un fichier
envoyé par l'utilisateur et lu par d'autres, donc un vecteur d'attaque, et
un PDF peut contenir des scripts, des formulaires XFA ou des liens piégés.

## Décision

- **Un onglet "Bibliothèque", premier du profil.** CV, travaux et projets
  en cartes, liens principaux, skills publiés. Une seule route de lecture,
  `GET /api/users/:handle/library`, publique comme le profil. Les projets
  reprennent la carte du fil (`ProjectFeedCard`), sans dégradé.
- **Un CV par profil, PDF seulement.** Table `profile_cvs` (migration
  additive `0031`), clé primaire sur le profil. Type lu sur le contenu
  (`detectAttachment`), 5 Mo au plus, quota de stockage commun aux autres
  envois, ancien fichier effacé après la transaction qui le remplace.
  Effacé avec le compte, présent dans l'export (sans clé de stockage).
- **Jamais affiché par le navigateur.** `GET /api/users/:handle/cv/content`
  répond toujours en pièce jointe, avec `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: default-src 'none'` et `Cache-Control: private,
  no-cache`. L'aperçu dans la page est dessiné par pdf.js dans un canvas,
  sans XFA, chargé seulement quand l'onglet l'affiche.
- **Visibilité choisie par la personne.** "Comptes connectés" par défaut,
  "Tout le monde" en option. Un visiteur reçoit 401 sur un CV réservé, et
  la Bibliothèque lui dit seulement qu'un CV existe.
- **Liens contrôlés.** GitHub, GitLab, LinkedIn, portfolio, site : https
  seulement, sans identifiants dans l'adresse, domaine vérifié pour les
  trois premiers (`isValidProfileLink`, partagé entre client et serveur).

## Conséquences

- pdf.js (`pdfjs-dist`, Apache-2.0) est la seule dépendance ajoutée. Sa
  dépendance facultative `@napi-rs/canvas`, utile seulement sous Node, est
  ignorée par pnpm (`pnpm.ignoredOptionalDependencies`).
- Pas d'aperçu de la première page en image côté serveur : il faudrait un
  moteur de rendu PDF sur le serveur, et sharp est interdit.
- Un seul CV : pas d'historique des versions, le remplacement efface
  l'ancien fichier.
