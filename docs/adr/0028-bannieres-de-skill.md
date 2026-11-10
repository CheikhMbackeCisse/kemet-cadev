# 0028 : Dégradé dans les bannières de skill

## Contexte

`DESIGN.md` interdit les dégradés décoratifs, avec une seule exception, les
écrans de compte (ADR 0019). La page Skills devait passer en cartes sur le
modèle des Quêtes de Discord, avec une bannière colorée en tête de chaque
carte. Un skill n'a pas d'image, et aucune image externe n'était voulue.

## Décision

La bannière d'un skill est un dégradé propre à son domaine (paiements, IA,
données, infra, front, back, autre), déduit de ses tags et de son texte au
moment de l'affichage, avec un motif de caractères de code en blanc à 20 %.
L'exception a été demandée explicitement le 08/11/2026, pour ces seules
bannières.

Le périmètre est strict : aucun texte n'est posé sur le dégradé, le reste
de la carte (nom, auteur, note, bouton) est ordinaire, sans ombre. Les
teintes vivent dans `tokens.css` (`--skill-*-from`, `--skill-*-to`) et sont
les mêmes dans les deux thèmes.

## Conséquences

- La liste des interdits de `DESIGN.md` compte maintenant deux exceptions.
- Le domaine n'est pas stocké : changer les tags d'un skill change sa
  bannière.
- Aucune autre carte du produit ne prend de dégradé par analogie.

## Complément du 10/11/2026 : fin des dégradés

Les bannières en dégradé coupaient l'icône du domaine et ne disaient rien du
skill. Elles sont remplacées par une couverture de code dessinée en HTML : une
fenêtre d'éditeur sombre avec le début du premier bloc de code du skill
(`skillCodeExcerpt`, renvoyé par l'API dans `codeExcerpt`) et le logo de la
technologie principale. L'exception à l'interdit des dégradés est retirée de
`DESIGN.md` ; il ne reste que celle du parcours d'arrivée. Le domaine reste
déduit des tags et du texte, il ne sert plus qu'au libellé de la carte.
