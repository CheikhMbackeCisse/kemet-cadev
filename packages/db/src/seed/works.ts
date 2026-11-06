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

interface DemoWork {
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
const DEMO_WORKS: DemoWork[] = [
  {
    publisher: "kwameAsante",
    slug: "synchronisation-hors-ligne-banque-mobile",
    discussion: [
      {
        author: "fatimaBenali",
        body: "Bonjour, j'ai lu votre mémoire. Comment avez-vous testé la reprise sur un vrai réseau 2G ? Nous avons le même problème sur une application de microcrédit.",
        hoursAgo: 30,
      },
      {
        author: "kwameAsante",
        body: "Avec un téléphone d'entrée de gamme et un forfait 2G réel, pas un simulateur : le simulateur ne reproduit pas les coupures de plusieurs minutes. Le chapitre 4 décrit le protocole.",
        hoursAgo: 28,
      },
      {
        author: "samuelMwangi",
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
      { type: "github", url: "https://github.com/kwame-asante/offline-sync-thesis" },
      {
        type: "drive",
        url: "https://drive.google.com/file/d/demo-offline-sync-thesis/view",
        label: "Mémoire complet",
      },
    ],
    externalAuthors: ["Kofi Mensah (encadrant)"],
    daysAgo: 21,
  },
  {
    publisher: "samuelMwangi",
    slug: "idempotence-paiements-mobile-money",
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
        url: "https://blog.demo.kemet.africa/idempotence-mobile-money",
        label: "Article en ligne",
      },
      { type: "github", url: "https://github.com/samuel-mwangi/idempotency-examples" },
    ],
    coauthors: [{ key: "aminaDiallo", status: "accepted" }],
    daysAgo: 18,
  },
  {
    publisher: "yassineTrabelsi",
    slug: "stock-boutique-hors-ligne",
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
    links: [{ type: "github", url: "https://github.com/yassine-trabelsi/stock-boutique" }],
    externalAuthors: ["Sarra Ben Youssef", "Mehdi Jlassi"],
    daysAgo: 15,
  },
  {
    publisher: "nadiaHassan",
    slug: "maladies-manioc-vision-mobile",
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
    institution: "Université américaine du Caire",
    links: [
      { type: "github", url: "https://github.com/nadia-hassan/cassava-mobile" },
      {
        type: "drive",
        url: "https://drive.google.com/file/d/demo-cassava-thesis/view",
        label: "Mémoire (PDF)",
      },
      {
        type: "video",
        url: "https://www.youtube.com/watch?v=demo-cassava",
        label: "Démonstration au champ",
      },
    ],
    coauthors: [{ key: "jeanMarcMukendi", status: "accepted" }],
    daysAgo: 12,
  },
  {
    publisher: "jeanMarcMukendi",
    slug: "capteurs-sol-lora-une-pile",
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
      { type: "github", url: "https://github.com/jean-marc-mukendi/lora-soil" },
      {
        type: "video",
        url: "https://www.youtube.com/watch?v=demo-lora-soil",
        label: "Installation sur le terrain",
      },
    ],
    daysAgo: 10,
  },
  {
    publisher: "zaneleMokoena",
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
      { type: "gitlab", url: "https://gitlab.com/zanele-mokoena/weather-pipeline" },
      {
        type: "drive",
        url: "https://drive.google.com/file/d/demo-weather-report/view",
        label: "Rapport de stage",
      },
    ],
    daysAgo: 8,
  },
  {
    publisher: "chidiOkafor",
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
        url: "https://blog.demo.kemet.africa/paiement-accessible",
        label: "Article",
      },
    ],
    daysAgo: 6,
  },
  {
    publisher: "fatimaBenali",
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
      { type: "article", url: "https://blog.demo.kemet.africa/ci-docker", label: "Article" },
      {
        type: "site",
        url: "https://ci-docker-watchdog.demo.kemet.africa",
        label: "Outil de diagnostic",
      },
    ],
    // Invitation laissée en attente : le profil de amina-diallo montre une
    // demande de coauteur à accepter ou refuser.
    coauthors: [{ key: "aminaDiallo", status: "pending" }],
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
