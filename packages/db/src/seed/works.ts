import { eq } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import {
  channels,
  messages,
  posts,
  WORK_DISCUSSIONS_SPACE_ID,
  workAuthors,
  workExternalAuthors,
  workLinks,
  works,
} from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { daysAgo } from "./time.js";

type WorkType = (typeof works.$inferInsert)["type"];
type LinkType = (typeof workLinks.$inferInsert)["type"];

export interface DemoWork {
  publisher: keyof DemoAccountIds;
  slug: string;
  title: string;
  type: WorkType;
  summary: string;
  tags: string[];
  stack: string[];
  year: number;
  institution: string | null;
  links: { type: LinkType; url: string; label?: string }[];
  coauthors?: { key: keyof DemoAccountIds; status: "pending" | "accepted" }[];
  externalAuthors?: string[];
  status?: "completed" | "in_progress";
  /** Premiers échanges de la discussion du travail, du plus ancien au plus récent. */
  discussion?: { author: keyof DemoAccountIds; body: string; hoursAgo: number }[];
  daysAgo: number;
}

// Les tags se recoupent volontairement (hors-ligne, mobile, paiements,
// agriculture) : "Qui a travaillé sur ce sujet ?" doit trouver des voisins.
export const DEMO_WORKS: DemoWork[] = [
  {
    publisher: "eboQuansah",
    slug: "synchronisation-hors-ligne-banque-mobile",
    discussion: [
      {
        author: "lynaBouzid",
        body: "Bonjour, j'ai lu votre mémoire. Comment avez-vous testé la reprise sur un vrai réseau 2G ? Nous avons le même problème sur une application de microcrédit.",
        hoursAgo: 30,
      },
      {
        author: "eboQuansah",
        body: "Avec un téléphone d'entrée de gamme et un forfait 2G réel, pas un simulateur : le simulateur ne reproduit pas les coupures de plusieurs minutes. Le chapitre 4 décrit le protocole.",
        hoursAgo: 28,
      },
      {
        author: "kipronoLangat",
        body: "La file locale d'opérations, vous la purgez à quel moment ? Après l'accusé de réception du serveur ?",
        hoursAgo: 5,
      },
    ],
    title: "Synchronisation hors ligne d'une application bancaire mobile",
    type: "thesis_research",
    summary: [
      "Mémoire de master sur la résolution de conflits quand un client bancaire utilise l'application sans réseau pendant plusieurs jours.",
      "",
      "## Ce que j'ai étudié",
      "",
      "- une file locale d'opérations plutôt qu'un état final recopié ;",
      "- l'horodatage serveur pour trancher les conflits, l'horloge du téléphone dérivant après une longue coupure ;",
      "- la reprise progressive de la synchronisation sur un réseau 2G instable.",
      "",
      "Le prototype Flutter a été testé auprès de 40 utilisateurs en zone périurbaine, avec un taux de conflit mesuré à 0,8 % des opérations.",
    ].join("\n"),
    tags: ["hors-ligne", "synchronisation", "mobile", "conflits", "banque"],
    stack: ["Flutter", "Dart", "SQLite"],
    year: 2021,
    institution: "Kwame Nkrumah University of Science and Technology",
    links: [
      { type: "site", url: "https://code.demo.kemetlabs.dev/ebo-quansah/offline-sync-thesis" },
      {
        type: "drive",
        url: "https://docs.demo.kemetlabs.dev/demo-offline-sync-thesis",
        label: "Mémoire complet",
      },
    ],
    externalAuthors: ["Kofi Mensah (encadrant)"],
    daysAgo: 21,
  },
  {
    publisher: "kipronoLangat",
    slug: "idempotence-paiements-mobile-money",
    discussion: [
      {
        author: "coumbaThiam",
        body: "On a eu exactement le cas du chapitre 3 la semaine dernière : un callback rejoué six heures après. Votre clé d'idempotence, vous la gardez combien de temps ?",
        hoursAgo: 52,
      },
      {
        author: "kipronoLangat",
        body: "Trente jours. En dessous, on a vu des rejeux légitimes arriver après expiration, surtout après une panne côté opérateur.",
        hoursAgo: 50,
      },
      {
        author: "skanderJaziri",
        body: "Question bête de freelance : pour une PME qui reçoit 200 paiements par jour, une table Postgres avec un index unique suffit, ou il faut déjà Redis ?",
        hoursAgo: 20,
      },
      {
        author: "kipronoLangat",
        body: "Pas bête du tout. Postgres suffit largement à ce volume, et c'est plus facile à auditer. Un cache à part, c'est quand l'index unique devient ton goulot.",
        hoursAgo: 18,
      },
    ],
    title: "Idempotence des paiements mobile money : ce que M-Pesa et Wave nous ont appris",
    type: "article",
    summary: [
      "Article écrit à deux mains sur les paiements rejoués : un client qui renvoie sa requête après une coupure ne doit jamais être débité deux fois.",
      "",
      "On compare trois approches (clé d'idempotence fournie par le client, déduplication par contenu, journal d'événements Kafka) et leur coût en production.",
      "",
      "```sql",
      "create unique index payments_idempotency_key_idx on payments (merchant_id, idempotency_key);",
      "```",
    ].join("\n"),
    tags: ["paiements", "mobile-money", "idempotence", "architecture"],
    stack: ["Java", "Kafka", "PostgreSQL"],
    year: 2025,
    institution: null,
    links: [
      {
        type: "article",
        url: "https://blog.demo.kemetlabs.dev/idempotence-mobile-money",
        label: "Article en ligne",
      },
      { type: "site", url: "https://code.demo.kemetlabs.dev/kiprono-langat/idempotency-examples" },
    ],
    coauthors: [{ key: "coumbaThiam", status: "accepted" }],
    daysAgo: 18,
  },
  {
    publisher: "skanderJaziri",
    slug: "stock-boutique-hors-ligne",
    discussion: [
      {
        author: "eboQuansah",
        body: "Vous avez gardé SQLite côté téléphone ou IndexedDB dans une PWA ? Je me pose la question pour un client à Takoradi.",
        hoursAgo: 40,
      },
      {
        author: "skanderJaziri",
        body: "PWA avec IndexedDB, parce que les boutiquiers n'installent rien depuis un store. Par contre Safari peut vider le stockage d'un site pas visité depuis une semaine, il a fallu prévenir.",
        hoursAgo: 37,
      },
      {
        author: "ahouKouadio",
        body: "Le rapport parle de \"vente fantôme\" quand deux téléphones vendent le dernier article. Vous affichez quoi au boutiquier ?",
        hoursAgo: 9,
      },
    ],
    title: "Gestion de stock pour boutiques de quartier, utilisable hors ligne",
    type: "class_project",
    summary: [
      "Projet de fin de semestre en licence : une application web installable pour tenir le stock d'une épicerie sans connexion stable.",
      "",
      "Les ventes sont enregistrées dans le navigateur et envoyées au serveur à la reconnexion. Un écran signale les produits sous le seuil d'alerte.",
    ].join("\n"),
    tags: ["hors-ligne", "mobile", "stock", "commerce"],
    stack: ["Vue", "Node.js", "MySQL"],
    year: 2022,
    institution: "Université de Tunis El Manar",
    links: [{ type: "site", url: "https://code.demo.kemetlabs.dev/skander-jaziri/stock-boutique" }],
    externalAuthors: ["Sarra Ben Youssef", "Mehdi Jlassi"],
    daysAgo: 15,
  },
  {
    publisher: "ghizlaneAmrani",
    slug: "maladies-manioc-vision-mobile",
    discussion: [
      {
        author: "dapoOyelaran",
        body: "Le modèle tourne entièrement sur le téléphone ? Quelle taille une fois quantifié ?",
        hoursAgo: 26,
      },
      {
        author: "ghizlaneAmrani",
        body: "Entièrement, 4,2 Mo en int8. On a perdu deux points de précision par rapport au modèle complet, mais les agents n'ont pas de réseau dans les champs.",
        hoursAgo: 24,
      },
    ],
    title: "Détecter les maladies du manioc sur un téléphone d'entrée de gamme",
    type: "thesis_research",
    summary: [
      "Mémoire de recherche : un modèle de vision compressé à 4 Mo qui reconnaît la mosaïque et la striure brune du manioc, sans réseau.",
      "",
      "Le modèle tourne hors ligne sur des téléphones à 1 Go de RAM. Les diagnostics sont stockés localement et remontés quand l'agent agricole retrouve du réseau.",
      "",
      "Précision de 91 % sur un jeu de 6 000 photos prises au champ, contre 94 % pour le modèle complet.",
    ].join("\n"),
    tags: ["vision", "agriculture", "mobile", "hors-ligne", "ia"],
    stack: ["Python", "PyTorch", "TensorFlow Lite"],
    year: 2023,
    institution: "Université Mohammed V de Rabat",
    links: [
      { type: "site", url: "https://code.demo.kemetlabs.dev/ghizlane-amrani/cassava-mobile" },
      {
        type: "drive",
        url: "https://docs.demo.kemetlabs.dev/demo-cassava-thesis",
        label: "Mémoire (PDF)",
      },
      {
        type: "video",
        url: "https://video.demo.kemetlabs.dev/demo-cassava",
        label: "Démonstration au champ",
      },
    ],
    coauthors: [{ key: "heritierKabeya", status: "accepted" }],
    daysAgo: 12,
  },
  {
    publisher: "heritierKabeya",
    slug: "capteurs-sol-lora-une-pile",
    discussion: [
      {
        author: "kgomotsoMahlangu",
        body: "Une mesure toutes les 4 heures, c'est assez pour l'irrigation ? Côté coopératives, on nous demande souvent de l'horaire.",
        hoursAgo: 33,
      },
      {
        author: "heritierKabeya",
        body: "Pour le sol, oui : l'humidité bouge lentement. L'horaire divise l'autonomie par trois. On remonte plus souvent seulement quand il pleut, repéré par un saut de la mesure.",
        hoursAgo: 31,
      },
      {
        author: "lynaBouzid",
        body: "Vous mettez à jour le firmware comment, sur le terrain ? En LoRa ça doit être long.",
        hoursAgo: 6,
      },
      {
        author: "heritierKabeya",
        body: "Très long, donc presque jamais à distance. Un technicien passe avec un câble deux fois par an. Pas élégant, mais ça marche.",
        hoursAgo: 4,
      },
    ],
    title: "Capteurs d'humidité du sol en LoRa, un an sur une seule pile",
    type: "application",
    summary: [
      "Firmware et passerelle pour des capteurs posés dans des champs sans électricité.",
      "",
      "Le capteur dort 99 % du temps, mesure toutes les 30 minutes et n'émet que si la valeur change de plus de 2 %. Résultat : 13 mois d'autonomie mesurés sur le terrain.",
    ].join("\n"),
    tags: ["iot", "agriculture", "lora", "basse-consommation"],
    stack: ["Rust", "C", "FreeRTOS"],
    year: 2024,
    institution: null,
    links: [
      { type: "site", url: "https://code.demo.kemetlabs.dev/heritier-kabeya/lora-soil" },
      {
        type: "video",
        url: "https://video.demo.kemetlabs.dev/demo-lora-soil",
        label: "Installation sur le terrain",
      },
    ],
    daysAgo: 10,
  },
  {
    publisher: "kgomotsoMahlangu",
    slug: "pipeline-meteo-cooperatives-agricoles",
    title: "Pipeline de données météo pour des coopératives agricoles",
    type: "internship",
    summary: [
      "Stage de fin d'études : collecter chaque nuit les relevés de 120 stations météo et prévenir les coopératives d'un risque de gel ou de sécheresse.",
      "",
      "Les DAG Airflow sont surveillés par des alertes sur la mémoire des workers, ajoutées après deux pannes silencieuses en production.",
    ].join("\n"),
    tags: ["data", "agriculture", "météo", "surveillance"],
    stack: ["Python", "Airflow", "Spark"],
    year: 2020,
    institution: "Université du Cap",
    links: [
      { type: "site", url: "https://code.demo.kemetlabs.dev/kgomotso-mahlangu/weather-pipeline" },
      {
        type: "drive",
        url: "https://docs.demo.kemetlabs.dev/demo-weather-report",
        label: "Rapport de stage",
      },
    ],
    daysAgo: 8,
  },
  {
    publisher: "dapoOyelaran",
    slug: "formulaires-paiement-accessibles-react",
    title: "Rendre accessibles les formulaires de paiement mobile en React",
    type: "article",
    summary: [
      "Retour d'expérience sur l'audit d'accessibilité d'un parcours de paiement mobile money : lecteurs d'écran, saisie du code secret, messages d'erreur.",
      "",
      "Trois corrections simples ont réduit de moitié les abandons chez les utilisateurs de lecteurs d'écran.",
    ].join("\n"),
    tags: ["accessibilité", "paiements", "mobile-money", "formulaires"],
    stack: ["React", "TypeScript"],
    year: 2025,
    institution: null,
    links: [
      {
        type: "article",
        url: "https://blog.demo.kemetlabs.dev/paiement-accessible",
        label: "Article",
      },
    ],
    daysAgo: 6,
  },
  {
    publisher: "lynaBouzid",
    slug: "ci-docker-runners-partages",
    status: "in_progress",
    title: "Des builds Docker fiables sur des runners de CI partagés",
    type: "article",
    summary: [
      "Pourquoi un build Docker passe en local et expire en CI, et comment le cache de couches et les limites de mémoire changent la donne.",
      "",
      "Mesures prises sur 300 builds d'une même pipeline avant et après correction.",
    ].join("\n"),
    tags: ["ci", "docker", "devops", "performance"],
    stack: ["Docker", "GitHub Actions"],
    year: 2025,
    institution: null,
    links: [
      { type: "article", url: "https://blog.demo.kemetlabs.dev/ci-docker", label: "Article" },
      {
        type: "site",
        url: "https://ci-docker-watchdog.demo.kemetlabs.dev",
        label: "Outil de diagnostic",
      },
    ],
    // Invitation laissée en attente : le profil de coumba-thiam montre une
    // demande de coauteur à accepter ou refuser.
    coauthors: [{ key: "coumbaThiam", status: "pending" }],
    daysAgo: 3,
  },
];

export async function createDemoWorks(db: DbOrTx, ids: DemoAccountIds): Promise<void> {
  const spaceId = WORK_DISCUSSIONS_SPACE_ID;
  for (const demo of DEMO_WORKS) {
    const createdAt = daysAgo(demo.daysAgo);
    const [work] = await db
      .insert(works)
      .values({
        publisherId: ids[demo.publisher],
        slug: demo.slug,
        title: demo.title,
        type: demo.type,
        status: demo.status ?? "completed",
        summary: demo.summary,
        tags: demo.tags,
        stack: demo.stack,
        year: demo.year,
        institution: demo.institution,
        publishRightConfirmed: true,
        isDemo: true,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: works.id });
    const workId = work!.id;
    const [channel] = await db
      .insert(channels)
      .values({ spaceId, name: demo.title, slug: demo.slug, createdAt })
      .returning({ id: channels.id });
    await db.update(works).set({ channelId: channel!.id }).where(eq(works.id, workId));
    if (demo.discussion?.length) {
      await db.insert(messages).values(
        demo.discussion.map((entry, index) => ({
          channelId: channel!.id,
          authorId: ids[entry.author],
          clientId: `demo-work-${demo.slug}-${index}`,
          body: entry.body,
          createdAt: new Date(Date.now() - entry.hoursAgo * 60 * 60 * 1000),
        })),
      );
    }

    await db.insert(workLinks).values(
      demo.links.map((link, position) => ({
        workId,
        type: link.type,
        url: link.url,
        label: link.label ?? null,
        position,
      })),
    );
    if (demo.externalAuthors?.length) {
      await db
        .insert(workExternalAuthors)
        .values(demo.externalAuthors.map((name, position) => ({ workId, name, position })));
    }
    if (demo.coauthors?.length) {
      await db.insert(workAuthors).values(
        demo.coauthors.map((coauthor) => ({
          workId,
          profileId: ids[coauthor.key],
          status: coauthor.status,
          invitedAt: createdAt,
          respondedAt: coauthor.status === "accepted" ? createdAt : null,
        })),
      );
    }
    await db.insert(posts).values({ authorId: ids[demo.publisher], body: "", workId, createdAt });
  }
}
