# 0018 — Permission de copie visuelle

## Contexte

`DESIGN.md` (principe 6) et les règles de contribution interdisaient explicitement, depuis le
début du projet, de reprendre l'apparence d'un autre produit : seul un mécanisme générique
(navigation, disposition) pouvait être repris, jamais une mise en page, des icônes ou des
couleurs. Un premier assouplissement ponctuel avait déjà eu lieu au lot du rail des espaces
pour reprendre le
mécanisme du rail à indicateur actif de Discord, en gardant entièrement l'apparence propre à
Kemet (couleurs, formes, typographie).

Le 14/10/2026, j'ai jugé que le rendu de l'application n'était pas assez soigné pour la
CADEV 2026 et j'ai donné une autorisation plus large que celle du lot du rail : cette fois,
l'apparence elle-même peut être reprise d'un autre produit (Discord, X, LinkedIn, GitHub,
Linear, Slack), pas seulement le mécanisme, au cas par cas, partout où ça rend un écran plus
clair ou plus soigné. Ce changement est documenté pour que
la suite du projet comprenne la bascule plutôt que de retomber sur l'ancienne règle par
réflexe.

## Décision

**Le principe 6 de `DESIGN.md` et la règle correspondante des règles de contribution sont réécrits**, pas supprimés.
L'originalité n'est plus une contrainte absolue, mais elle reste encadrée :

- Les tokens de couleur, Plus Jakarta Sans/Geist Mono, les icônes Lucide, la grille de 4px
  et le vocabulaire (`points`/`level`, jamais "réputation") restent entièrement ceux de
  Kemet : on ne copie jamais la palette, les polices ou les icônes d'un autre produit.
- La liste « Ce qui est interdit » de `DESIGN.md` (dégradés décoratifs, verre dépoli, halos,
  cartes toutes identiques à ombre grise, bordure colorée à gauche des cartes, majuscules
  espacées, stats décoratives, animations d'apparition, polices Inter/Roboto/Arial) reste
  entièrement en vigueur. Cette liste vise à éviter l'air générique d'une interface produite
  par une IA, un problème distinct de la ressemblance avec un produit existant : les deux
  règles ne se recouvrent pas, assouplir l'une ne touche pas l'autre.
- Jamais le logo, les couleurs de marque ou un asset d'un autre produit.
- La marque Kemet (`apps/web/public/brand/`) n'est jamais touchée, comme avant.

Premier lot appliquant cette permission élargie : refonte des écrans Fil, Post, Salon et
Profil public, choisis
comme les plus visibles à la démo.

## Conséquences

- Un futur lot peut s'appuyer directement sur le principe 6 réécrit sans redemander
  l'autorisation à chaque fois, tant qu'il respecte les limites ci-dessus. Il reste
  recommandé de documenter, comme pour ce lot et celui du rail des espaces, les cas où un
  écran reprend concrètement l'apparence d'un produit nommé, pour que la trace reste lisible
  dans l'historique du projet plutôt que diffuse dans le code.
- Cette décision ne change rien aux autres règles du projet (licences, secrets,
  autorisations serveur, tests, documentation de fin de lot).
