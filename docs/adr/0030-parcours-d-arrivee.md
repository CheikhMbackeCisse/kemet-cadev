# 0030 — Fond animé et carte en verre dépoli du parcours d'arrivée

Date : 08/11/2026

## Contexte

Le parcours d'arrivée d'un visiteur compte huit écrans : l'accueil
(`/decouvrir`), quatre questions, l'inscription, la connexion, et les écrans
de mot de passe qui partagent leur gabarit. Jusqu'ici, l'accueil et les écrans
de compte avaient le fond de marque de l'ADR 0019, mais les quatre questions
étaient des pages ordinaires : le visiteur changeait d'univers au milieu du
parcours.

J'ai demandé un fond commun à tout le parcours, plus vivant : des logos de
langages et d'outils, des symboles (IA, cybersécurité, IoT) et des bouts de
code qui flottent lentement, une silhouette de l'Afrique, et le contenu de
chaque écran sur une carte en verre dépoli. Trois points de `DESIGN.md`
s'y opposaient : l'effet verre dépoli est dans la liste « Ce qui est
interdit », le mouvement continu n'était permis que sur l'accueil, et le
principe 6 interdit d'utiliser le logo d'un autre produit.

## Décision

Les trois interdits sont levés **pour les seuls écrans du parcours
d'arrivée**, à ma demande explicite du 08/11/2026.

- **Verre dépoli.** La carte prend la teinte du fond à 60 %, un flou de 16 px
  et un bord blanc à 20 %. Le fond restant sombre dans les deux thèmes, le
  texte de la carte est blanc, les champs gardent leurs couleurs ordinaires.
  `tokens.test.ts` vérifie le contraste au pire cas, sans compter le flou : un
  élément flottant blanc à son opacité maximale posé sur le halo le plus clair.
- **Mouvement.** Deux intensités : riche sur l'accueil, calme ailleurs (moitié
  moins d'amplitude, presque deux fois plus lent, deux fois plus pâle). Seize
  éléments au plus, neuf sur téléphone. Seuls `transform` et `opacity`
  bougent, l'animation s'arrête quand l'onglet est caché et devient une image
  fixe si le système demande moins de mouvement.
- **Logos.** Huit logos de Simple Icons (licence CC0-1.0), tracés copiés dans
  `apps/web/src/components/arrival/techLogos.ts`, toujours en blanc, jamais
  dans les couleurs de leur marque. Ils disent les technologies dont on parle
  sur Kemet ; ils ne servent ni de bouton ni de lien.

La silhouette de l'Afrique vient de Natural Earth (domaine public) par
world-atlas, fusionnée et projetée une fois, puis copiée dans
`africaOutline.ts`. Aucune dépendance n'est ajoutée à l'application : les deux
ressources sont notées dans `THIRD_PARTY_LICENSES.md` par
`scripts/vendored-assets.ts`.

## Conséquences

- Mesure sur un téléphone simulé (Playwright, 360 x 740, processeur ralenti
  quatre fois, version de production) : 60 images par seconde sur l'accueil
  comme sur l'inscription, plus longue image de 17 ms.
- Les écrans de compte perdent leur carte opaque. Le texte posé sur la carte
  utilise les couleurs `--auth-*`, jamais les tokens de texte ordinaires.
- L'onboarding après l'inscription (`/completer-profil` et les six écrans
  de `/bienvenue`) a d'abord été une page ordinaire. Depuis le 08/11/2026,
  à la demande du porteur du projet, il partage le même fond et la même carte
  en verre, sans sous-titre ni "Étape X sur 6" visible : l'arrivée se lit
  comme un seul parcours jusqu'au fil.
- Le reste de la liste « Ce qui est interdit » s'applique toujours sur ces
  écrans, et aucun autre écran n'hérite de ces exceptions.
