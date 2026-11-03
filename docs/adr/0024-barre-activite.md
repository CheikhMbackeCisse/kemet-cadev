# 0024 : Barre d'activité et panneau latéral sur bureau

Statut : acceptée le 30/10/2026, posée le 02/11/2026.

## Contexte

Sur bureau, un salon empilait trois colonnes de navigation avant le
contenu : le rail des espaces (64 px, sections puis monogrammes), la liste
des salons (240 px) et, à droite, le panneau des membres. Les autres pages
n'avaient que le rail. Deux défauts en découlaient :

- un espace n'était reconnaissable qu'à ses initiales, son nom n'apparaissant
  qu'au survol ;
- la liste des salons ne pouvait pas se replier, et les pages hors salon
  n'avaient aucune structure commune au-delà du rail.

## Décision

Le modèle de VS Code : une barre d'activité de 56 px (une icône par
section, le compte au pied) et, à côté, un panneau latéral de 264 px dont le
contenu dépend de la section. Un seul panneau à la fois, replié par un clic
sur l'icône de la section ouverte ou par Ctrl+B, choix mémorisé dans
`localStorage`, replié par défaut sous 1280 px.

- Un seul cadre, `AppFrame`, pour toutes les pages : `AppShell` (salons),
  `RailPage`, `ReadingPage` et `FormPage` passent par lui.
- Les sections viennent toujours de `railNav.ts`, la liste partagée avec la
  barre d'onglets mobile.
- Les URL ne changent pas : la section active se déduit de la page.
- Le panneau Salons montre les espaces en arbre, nom toujours visible.
  `SpaceRail` disparaît ; `ChannelList` reste pour le tiroir mobile.
- Sur une page sans panneau, l'icône de la section reste un lien et Ctrl+B
  n'est pas intercepté : le raccourci garde son sens dans le navigateur.
- Le panneau de droite (membres) reste permanent et propre aux salons.
- Aucune dépendance ajoutée : infobulles Radix existantes, état dans un
  petit contexte React.

Mobile et tablette ne changent pas.

## Conséquences

- Largeur prise à gauche dans un salon : 320 px au lieu de 304, mais
  récupérable d'un raccourci.
- Le menu du compte quitte l'en-tête des pages sur bureau pour le pied de la
  barre ; sous 1024 px il reste dans l'en-tête des pages qui en ont un, et
  la feuille "Moi" porte aussi "Se déconnecter" pour les autres.
- Les panneaux des autres sections (filtres du fil, des skills, des projets
  et des compétitions) restent à écrire. Tant qu'ils n'existent pas, ces
  pages n'ont pas de panneau.
- Ctrl+B est pris par l'application sur la page d'un salon. Le composeur
  n'a pas de mise en gras au clavier, le conflit n'existe pas aujourd'hui.
- Deux sections sont prévues et ont leur place réservée : Travaux en
  deuxième position, juste après le Fil, et Messages juste après Salons.
  La barre affiche déjà une pastille de non-lus par section ; sur mobile,
  Messages sera un segment en haut de l'onglet Salons plutôt qu'un onglet.
