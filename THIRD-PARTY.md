# Composants tiers

Les dépendances directes de Kemet et leur licence, avec les polices, les
icônes et les données de carte. La liste complète, dépendances indirectes
comprises (941 paquets le 11/11/2026), est générée dans
`THIRD_PARTY_LICENSES.md` par `pnpm licenses:check`, qui échoue sur toute
licence GPL, AGPL ou LGPL ; la CI vérifie qu'elle est à jour.

Versions installées au 11/11/2026, lues dans `node_modules`.

## Application web (`apps/web`)

| Paquet | Version | Licence |
| --- | --- | --- |
| react, react-dom | 18.3.1 | MIT |
| @tanstack/react-query | 5.107.1 | MIT |
| @radix-ui/react-checkbox, -dialog, -dropdown-menu, -label, -select, -switch, -tabs, -toast, -tooltip, -visually-hidden | 1.x à 2.x | MIT |
| lucide-react | 1.52.0 | ISC |
| react-markdown | 10.1.0 | MIT |
| remark-gfm | 4.0.1 | MIT |
| remark-breaks | 4.0.0 | MIT |
| mdast-util-find-and-replace | 3.0.4 | MIT |
| shiki | 4.5.0 | MIT |
| socket.io-client | 4.8.4 | MIT |
| pdfjs-dist | 6.4.299 | Apache-2.0 |
| flag-icons | 7.5.0 | MIT |
| clsx | 2.1.1 | MIT |
| tailwind-merge | 3.7.0 | MIT |

## Serveur (`apps/server`)

| Paquet | Version | Licence |
| --- | --- | --- |
| fastify | 5.12.5 | MIT |
| @fastify/helmet | 13.1.2 | MIT |
| @fastify/multipart | 10.1.3 | MIT |
| @fastify/rate-limit | 11.2.0 | MIT |
| socket.io | 4.8.4 | MIT |
| bullmq | 5.81.5 | MIT |
| ioredis | 5.11.1 | MIT |
| better-auth | 1.7.7 | MIT |
| @node-rs/argon2 | 2.2.2 | MIT |
| ai (Vercel AI SDK) | 7.0.137 | Apache-2.0 |
| @ai-sdk/google | 4.0.93 | Apache-2.0 |
| drizzle-orm | 0.45.3 | Apache-2.0 |
| file-type | 22.1.1 | MIT |
| nanoid | 6.0.2 | MIT |
| nodemailer | 10.0.16 | MIT-0 |
| zod | 3.25.76 | MIT |

## Base et schémas partagés (`packages/db`, `packages/shared`)

| Paquet | Version | Licence |
| --- | --- | --- |
| drizzle-orm | 0.45.3 | Apache-2.0 |
| postgres (client) | 3.4.9 | Unlicense |
| @node-rs/argon2 | 2.2.2 | MIT |
| zod | 3.25.76 | MIT |

## Outils de développement et de test

| Paquet | Version | Licence |
| --- | --- | --- |
| typescript | 5.9.3 | Apache-2.0 |
| vite | 6.4.4 | MIT |
| @vitejs/plugin-react | 4.7.0 | MIT |
| vite-plugin-pwa | 0.21.2 | MIT |
| tailwindcss | 3.4.19 | MIT |
| postcss | 8.5.29 | MIT |
| autoprefixer | 10.6.1 | MIT |
| vitest | 2.1.9 | MIT |
| @playwright/test | 1.64.0 | Apache-2.0 |
| @testing-library/react | 16.3.3 | MIT |
| @testing-library/jest-dom | 6.10.0 | MIT |
| jsdom | 25.0.1 | MIT |
| drizzle-kit | 0.31.11 | MIT |
| eslint, @eslint/js | 9.39.5 | MIT |
| typescript-eslint | 8.71.1 | MIT |
| prettier | 3.9.9 | MIT |
| turbo | 2.11.7 | MIT |
| tsx | 4.23.15 | MIT |
| concurrently | 9.2.4 | MIT |
| d3-geo | 3.1.2 | ISC |
| topojson-client | 3.1.0 | ISC |
| world-atlas | 2.0.2 | ISC |
| @types/* (react, react-dom, hast, mdast, d3-geo, topojson-client) | | MIT |

`d3-geo`, `topojson-client` et `world-atlas` ne servent qu'au script
`scripts/build-africa-outline.ts`, qui génère le contour de l'Afrique une
fois ; aucun n'est livré dans l'application.

## Polices

| Police | Paquet | Licence | Usage |
| --- | --- | --- | --- |
| Plus Jakarta Sans | @fontsource/plus-jakarta-sans 5.3.0 | OFL-1.1 | Texte de l'interface |
| Space Grotesk | @fontsource-variable/space-grotesk 5.3.0 | OFL-1.1 | Titres |
| Geist Mono | @fontsource-variable/geist-mono 5.3.0 | OFL-1.1 | Code |

Les polices sont hébergées avec l'application, sans appel à un service
externe. OFL-1.1 n'est acceptée par `scripts/check-licenses.ts` que pour ces
trois paquets.

## Icônes, drapeaux et carte

| Ressource | Source | Licence | Usage |
| --- | --- | --- | --- |
| Icônes de l'interface | Lucide (lucide-react) | ISC | Toute l'interface |
| Logos de technologies | Simple Icons 16.37.0, 34 logos copiés par `scripts/build-tech-logos.ts` | CC0-1.0 | Décor de l'accueil, couvertures de skills, logos d'espace (`apps/web/src/components/ui/techLogos.ts`) |
| Logos de technologies en couleurs | Devicon 2.17.0, variantes « original », 17 fichiers SVG copiés par `scripts/build-devicon.ts` | MIT | Décor de l'accueil et de « Complète ton profil » (`apps/web/src/components/arrival/devicon/`). Les logos appartiennent à leurs propriétaires et servent seulement à désigner les technologies |
| Drapeaux des pays | flag-icons 7.5.0, fichiers SVG servis comme images | MIT | Avatars et listes de pays (`apps/web/src/components/ui/Flag.tsx`) |
| Contour de l'Afrique | Natural Earth (countries-50m) via world-atlas 2.0.2, généré par `scripts/build-africa-outline.ts` | Domaine public (Natural Earth), ISC (world-atlas) | Parcours d'arrivée (`apps/web/src/components/arrival/africaOutline.ts`) |

## Contenus de Systalink

Systalink, organisatrice de la CADEV 2026, a donné le 12/11/2026 son accord
écrit pour ces usages, et seulement ceux-là :

| Contenu | Source | Usage |
| --- | --- | --- |
| Visuel promotionnel de la CADEV 2026, repris sans retouche ni recadrage | Publication Instagram de Systalink (https://www.instagram.com/systalink/p/DewrHGNjtTM/) | Images du post « La CADEV 2026 en bref » (`packages/db/seed-assets/cadev/`) |
| Symbole de leur logo, deux tracés repris à l'identique de leur icône | https://systalink.com/icon0.svg | Photo de profil du compte Systalink du seed (`packages/db/src/seed/systalink.ts`) |
| Post « La CADEV 2026 en bref » publié à leur nom | Texte écrit par nous | Espace CADEV 2026, épinglé, avec un lien vers la publication d'origine (`packages/db/src/seed/cadev-post.ts`) |
| Logo « <cadev/> 2026 » de la compétition, redessiné en tracés vectoriels sans déformation (lettres de Plus Jakarta Sans 700, « dev » en vert, « 2026 » en dessous, fond bleu nuit) | Leur visuel promotionnel (ligne ci-dessus) | Icône de l'espace CADEV 2026, et de lui seul (`apps/web/src/components/ui/CadevLogo.tsx`) |

Le compte Systalink n'a ni bio, ni bannière, ni badge de vérification, et
aucun moyen de connexion. Tous droits réservés à Systalink sur ces contenus.

Les ressources copiées plutôt qu'installées sont listées dans
`scripts/vendored-assets.ts` et recopiées dans `THIRD_PARTY_LICENSES.md`.
Le logo de Kemet (`brand/`) est propre au projet.

## Images Docker de production

| Image | Licence |
| --- | --- |
| postgres:16-alpine | PostgreSQL License |
| valkey/valkey:8-alpine | BSD-3-Clause |
| caddy:2-alpine | Apache-2.0 |
| node (base des images web, api, realtime, worker) | MIT |

Valkey remplace Redis, dont les versions récentes ne sont plus sous une
licence libre acceptée par le projet.
