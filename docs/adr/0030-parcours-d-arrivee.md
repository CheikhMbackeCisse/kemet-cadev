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

## Complément du 10/11/2026 : le continent en fond, le décor autour de la carte

Contexte. Sur l'accueil, le continent et son réseau de trente-trois capitales
étaient devenus le sujet de l'écran, la carte était repoussée en bas, et des
logos passaient sous la carte ou se chevauchaient selon la taille de l'écran.
Sur les autres écrans, un morceau du continent sortait coupé en bas.

Décision.

- Le continent entier, centré, en filigrane sur tous les écrans du parcours.
  Contour régénéré depuis countries-50m de world-atlas en projection de
  Mercator par `scripts/build-africa-outline.ts` (d3-geo et topojson-client
  en dépendances de développement, ISC) : pays fusionnés, petites îles
  écartées, Madagascar gardée, 3,9 Ko. Plus de réseau ; cinq capitales sur
  l'accueil, placées par le même script.
- La carte revient au centre. La page devient une grille : bande de décor,
  carte, bande de décor, en lignes sur téléphone et en colonnes à partir de
  768 px. Chaque élément a une place en pourcentage de sa bande, et une
  requête de conteneur n'affiche une bande qu'au-dessus d'une taille
  minimale. `decorLayout.test.ts` vérifie, à cette taille minimale, qu'aucun
  élément ne touche un bord ni un autre élément, dérive comprise ; une bande
  plus grande ne peut que les éloigner.
- Dix éléments au plus sur ordinateur, six sur téléphone. Pastilles blanches
  pleines, plus de fondu ni de rotation : un logo reste net.
- Carte de l'accueil plus claire (teinte à 50 %, flou de 3 px) : sur
  téléphone, elle couvre presque tout le continent, qu'on doit pouvoir lire
  à travers.

- Une capitale que la carte couvre est cachée (`ArrivalLayout`, mesurée à
  chaque changement de taille) : un anneau qui bat sous le texte se lisait
  comme une poussière. Sur téléphone, la carte les couvre toutes.
- Sur téléphone, les écrans calmes ne montrent pas le continent : leur carte,
  plus opaque, n'en laissait dépasser qu'un bout de côte.

Conséquences. Sur un formulaire long ou un petit écran, les bandes sont trop
petites et le décor disparaît : c'est voulu. Le contraste du texte de la
carte est vérifié contre le contour du continent posé sur le halo le plus
clair (`tokens.test.ts`), seul élément du fond qui passe encore sous elle.

## Complément du 10/11/2026, suite : le réseau des capitales revient sur l'accueil

Contexte. Avec cinq capitales qui battaient seules, l'accueil ne disait plus
que l'Afrique est reliée, ce qui était le sens du réseau d'origine. Sur
Safari d'iPhone, le bouton Continuer des questions passait sous la barre du
navigateur dès que la carte dépassait de l'écran.

Décision.

- Un réseau vu comme de nuit, sur l'accueil seulement : quatorze capitales
  du pourtour reliées chacune à deux ou trois voisines (dix-sept arcs, un
  seul réseau, `networkLayout.test.ts`), dix-neuf autres villes en points
  pâles sans liaison. Sur ordinateur, la carte couvre le centre du
  continent : Abuja et Luanda, qui y tombaient toujours, sont devenues des
  villes, remplacées par Tripoli et Windhoek, et le réseau fait le tour de la
  carte au lieu de passer dessous. Capitales et villes placées par `scripts/build-africa-outline.ts`
  dans la projection du contour, liaisons écrites à la main dans
  `networkLayout.ts`, dans le sens qui courbe l'arc vers l'intérieur des
  terres.
- Les arcs ne sont jamais plus forts que le contour, ce que `tokens.test.ts`
  vérifie. Le continent de l'accueil est plus grand que celui des autres
  écrans, pour que le réseau se voie autour de la carte : toute la largeur
  sur téléphone, presque toute la hauteur sur ordinateur, avec une carte
  plus étroite.
- Plutôt que cacher ce que la carte couvre, `ArrivalLayout` l'atténue à
  25 % : les points par un attribut, les lueurs par un masque SVG dont il
  pose le rectangle de la carte, à chaque changement de taille et au
  défilement. Les arcs ne passent pas par ce masque : ils doivent se deviner
  à travers le verre, et le contraste du texte est déjà vérifié contre le
  contour, plus fort qu'eux. `tokens.test.ts` vérifie le contraste du
  texte de la carte avec une capitale ou une lueur dessous. Le même calcul
  cache un élément du décor posé sur un point ou un arc visible.
- Trois lueurs en CSS, décalées d'un tiers de cycle, qui passent d'un arc à
  l'autre à chaque fin de voyage (`animationiteration`) : trois animations
  au plus, pas de minuterie. Le réseau reste affiché, fixe, quand rien ne
  doit bouger.
- Le bouton principal des questions, de l'onboarding et des écrans de compte
  est collé au bas de l'écran quand la carte dépasse (`ArrivalAction`,
  `position: sticky`, zone sûre de l'iPhone), avec l'erreur d'envoi au-dessus
  de lui et un fond de verre posé seulement quand il a quitté sa place. Sa
  bande garde la même place dans la mise en page collée ou non : rien ne
  saute pendant le défilement.

Conséquences. Sur téléphone, la carte couvre le centre du réseau ; on lit
le nord au-dessus d'elle, l'Afrique australe au-dessous, et les arcs du
milieu à travers le verre. Le masque des lueurs coûte peu : mesuré en
processeur ralenti quatre fois, l'accueil reste entre 56 et 60 images par
seconde, avec ou sans lui.
