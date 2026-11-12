# Performance

Kemet vise un téléphone d'entrée de gamme sur une connexion mobile lente.
Toutes les mesures ci-dessous sont faites dans ces conditions, jamais sur
une connexion d'ordinateur. Elles ont été prises du 09 au 11/11/2026.

## Conditions de mesure

- Chrome piloté par Playwright, écran de 360x740 (ou 390x844), facteur 2,
  tactile, agent d'un téléphone Android.
- Réseau limité par le protocole de Chrome DevTools
  (`Network.emulateNetworkConditions`), profils de DevTools :
  - **Slow 4G** : latence 562,5 ms, 1,44 Mbit/s en réception, 675 kbit/s en
    émission ;
  - **3G** : latence 2 s, 400 kbit/s dans les deux sens.
- Processeur ralenti quatre fois (`Emulation.setCPUThrottlingRate`, rate 4).
- Cache vide et service worker bloqué pour un premier chargement ; cache
  conservé pour une navigation de retour.
- Trois passages pour les mesures de retour en arrière ; un intervalle
  donne le plus rapide et le plus lent.

"Premier affichage" est le premier rendu de contenu (FCP). "Page qui
répond" est la fin des requêtes et des tâches longues pendant 5 s, la même
approche que Lighthouse pour le temps d'interactivité.

## 1. Premier chargement (09/11)

Après le passage des drapeaux en images, la sortie de zod du premier script,
la coloration du code différée et la compression Brotli du serveur web.
Slow 4G, CPU x4, 360x740 :

| Page | Premier affichage | Page qui répond | Téléchargé |
| --- | --- | --- | --- |
| Accueil | 5,2 → 4,3 s | 5,2 → 4,3 s | 466 → 230 Ko |
| Fil | 4,9 → 4,0 s | 13,9 → 6,4 s | 1 441 → 524 Ko |
| Salon | 5,0 → 4,0 s | 10,9 → 6,5 s | 570 → 340 Ko |
| Skills | 4,7 → 3,6 s | 6,2 → 5,0 s | 434 → 242 Ko |

En 3G, le premier affichage passe de 15 s à 11 à 12,5 s sur ces quatre
pages, et le salon répond en 19,3 s au lieu de 29,4 s. Le précache du
service worker passe de 970 à 469 Ko. Le CSS principal passe de 494 à
68 Ko, le premier script de 433 à 358 Ko.

## 2. Retour en arrière (10 et 11/11)

Aller du fil à une autre page puis revenir. Slow 4G, CPU x4, 360x740.

Première série, cache des lectures par TanStack Query :

| Parcours | Retour affiché | Squelettes visibles | Lectures d'API |
| --- | --- | --- | --- |
| Fil, Skills, retour | 1,3 → 0,7 s | 0,74 s → aucun | 3 → 1 |
| Fil, un post, retour | 1,4 → 0,7 s | 0,88 s → aucun | 6 → 1 |

La position de lecture est rendue au retour, et aucune image déjà vue n'est
redemandée.

Seconde série, après la construction des posts visibles d'abord et la
mémoire de la hauteur de chaque ligne (`apps/web/src/lib/feed/useVisibleFirst.ts`,
`apps/web/src/lib/navigation/rememberedHeights.ts`) :

| Parcours | Avant | Après |
| --- | --- | --- |
| Fil, Skills, retour | 1,00 à 1,15 s | 0,56 à 0,76 s |
| Fil, un post, retour | 0,68 à 0,97 s | 0,44 à 0,53 s |

Sans ralentissement du processeur, le même retour prend 145 à 150 ms.

## 3. Premier post lisible (11/11)

Visiteur, cache vide, 390x844, Slow 4G, CPU x4, en local : 9,0 à 9,6 s
avant le premier post lisible, pour 83 requêtes dont 50 fichiers JavaScript
(249 Ko), tous nécessaires au fil lui-même. Sous Slow 4G, Chrome annonce une
connexion "3g" et l'application coupe déjà tout préchargement des autres
pages (`apps/web/src/lib/network.ts`) : différer davantage le précache ne
gagnait rien.

La cause relevée est l'ordre des requêtes : la lecture du fil ne part
qu'après le code du fil, et le rendu Markdown après les données. Mesurée en
local en HTTP/1.1, où six connexions seulement sont ouvertes ; la production
est en HTTP/2, ce qui réduit cet effet. Prochaine étape : mesurer en ligne,
puis lancer la lecture du fil en même temps que le chargement de son code.

## Ce qui reste lent

- En 3G, le fil met encore une douzaine de secondes avant son premier
  affichage : quatre allers-retours de 2 s chacun. Seul un rendu côté
  serveur ferait nettement mieux.
- Un rendu complet du fil après une longue absence coûte environ 1,5 s de
  React sous CPU x4.

## Refaire une mesure

Le principe tient en quelques lignes de Playwright :

```js
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: "block",
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 562.5,
  downloadThroughput: ((1.6 * 1e6) / 8) * 0.9,
  uploadThroughput: ((750 * 1e3) / 8) * 0.9,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await page.goto("https://kemetlabs.dev/fil", { waitUntil: "load" });
const fcp = await page.evaluate(
  () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
);
console.log(`premier affichage : ${Math.round(fcp)} ms`);
await browser.close();
```

Pour les tâches longues et le plus grand élément affiché, poser un
`PerformanceObserver` (types `longtask` et `largest-contentful-paint`) par
`context.addInitScript` avant le chargement, puis attendre 5 s sans requête
ni tâche longue. Pour un retour en arrière, garder le même contexte, cliquer
vers une autre page, puis `page.goBack()` et mesurer le temps jusqu'à ce que
le premier post soit de nouveau visible.
