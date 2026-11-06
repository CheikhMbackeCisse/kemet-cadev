import type { DbOrTx } from "../client.js";
import { applications, helpRequests, projects } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { daysAgo } from "./time.js";

export interface DemoProjectIds {
  waveLedger: string;
  offliBank: string;
  ciDockerWatchdog: string;
  kemetDesignKit: string;
  dataPulse: string;
  pesaRail: string;
  darijaNlpToolkit: string;
  saharaRun: string;
}

export async function createDemoProjects(db: DbOrTx, ids: DemoAccountIds): Promise<DemoProjectIds> {
  const [
    waveLedger,
    offliBank,
    ciDockerWatchdog,
    kemetDesignKit,
    dataPulse,
    pesaRail,
    darijaNlpToolkit,
    saharaRun,
  ] = await db
    .insert(projects)
    .values([
      {
        ownerId: ids.coumbaThiam,
        slug: "wave-ledger",
        name: "Wave Ledger",
        pitch: "Réconciliation automatique des paiements Wave pour les commerçants avec plusieurs points de vente.",
        description:
          "Rapproche les webhooks Wave et les ventes enregistrées en caisse, signale les écarts en moins d'une " +
          "minute au lieu d'un contrôle manuel en fin de journée.",
        repoUrl: "https://code.demo.kemetlabs.dev/coumba-thiam/wave-ledger",
        demoUrl: "https://wave-ledger.demo.kemetlabs.dev",
        stack: ["TypeScript", "Fastify", "PostgreSQL"],
        createdAt: daysAgo(40),
      },
      {
        ownerId: ids.eboQuansah,
        slug: "offlibank",
        name: "OffliBank",
        pitch: "Application bancaire Flutter qui reste pleinement utilisable sans connexion.",
        description:
          "Démonstrateur d'une architecture offline-first pour le secteur bancaire : file d'opérations locale, " +
          "résolution de conflits par horodatage serveur, resynchronisation progressive.",
        repoUrl: "https://code.demo.kemetlabs.dev/ebo-quansah/offlibank",
        demoUrl: null,
        stack: ["Flutter", "Dart", "Firebase"],
        createdAt: daysAgo(55),
      },
      {
        ownerId: ids.lynaBouzid,
        slug: "ci-docker-watchdog",
        name: "CI Docker Watchdog",
        pitch: "Détecte les builds Docker qui vont timeout sur un runner GitHub Actions avant qu'ils cassent la pipeline.",
        description:
          "Surveille la mémoire des conteneurs pendant le build et alerte avant le timeout plutôt qu'après, en " +
          "distinguant un vrai blocage d'une simple lenteur du runner.",
        repoUrl: "https://code.demo.kemetlabs.dev/lyna-bouzid/ci-docker-watchdog",
        demoUrl: null,
        stack: ["Docker", "GitHub Actions", "Go"],
        createdAt: daysAgo(70),
      },
      {
        ownerId: ids.dapoOyelaran,
        slug: "kemet-design-kit",
        name: "Kemet Design Kit",
        pitch: "Bibliothèque de composants React accessibles, thème clair/sombre inclus.",
        description:
          "Composants construits sur Radix UI avec variables CSS pour le thème, pensés pour des produits fintech " +
          "qui ont besoin d'un design system cohérent sans tout reconstruire à chaque projet.",
        repoUrl: "https://code.demo.kemetlabs.dev/dapo-oyelaran/kemet-design-kit",
        demoUrl: "https://kemet-design-kit.demo.kemetlabs.dev",
        stack: ["React", "TypeScript", "Radix UI"],
        createdAt: daysAgo(30),
      },
      {
        ownerId: ids.kgomotsoMahlangu,
        slug: "datapulse",
        name: "DataPulse",
        pitch: "Tableau de bord de supervision des pipelines Airflow, alertes avant la saturation mémoire.",
        description:
          "Suit la mémoire de chaque worker Airflow en direct et alerte avant qu'une tâche échoue sans message " +
          "clair, plutôt que de fouiller les journaux après coup.",
        repoUrl: "https://code.demo.kemetlabs.dev/kgomotso-mahlangu/datapulse",
        demoUrl: null,
        stack: ["Python", "Airflow", "Grafana"],
        createdAt: daysAgo(25),
      },
      {
        ownerId: ids.kipronoLangat,
        slug: "pesarail",
        name: "PesaRail",
        pitch: "Architecture de référence pour un système de paiement mobile résilient et idempotent.",
        description:
          "Implémentation de référence : clé d'idempotence obligatoire, vérification systématique du statut " +
          "avant tout crédit, journal complet des transitions d'état pour chaque transaction.",
        repoUrl: "https://code.demo.kemetlabs.dev/kiprono-langat/pesarail",
        demoUrl: "https://pesarail.demo.kemetlabs.dev",
        stack: ["Java", "Spring", "Kafka"],
        createdAt: daysAgo(90),
      },
      {
        ownerId: ids.ghizlaneAmrani,
        slug: "darija-nlp-toolkit",
        name: "Darija NLP Toolkit",
        pitch: "Outils d'entraînement et d'évaluation NLP pour l'arabe dialectal, par dialecte plutôt qu'en moyenne.",
        description:
          "Normalisation du mélange arabe/latin fréquent dans les messages réels, évaluation séparée par " +
          "dialecte pour ne pas masquer une couverture faible derrière un score moyen flatteur.",
        repoUrl: "https://code.demo.kemetlabs.dev/ghizlane-amrani/darija-nlp-toolkit",
        demoUrl: null,
        stack: ["Python", "PyTorch", "FastAPI"],
        createdAt: daysAgo(35),
      },
      {
        ownerId: ids.ahouKouadio,
        slug: "sahararoad",
        name: "SaharaRoad",
        pitch: "Jeu de course mobile pensé dès le départ pour tourner sur de l'Android bas de gamme.",
        description:
          "Budget de frame fixe, dégradation progressive des particules plutôt que de la résolution, assets " +
          "préchargés pendant les transitions pour éviter tout freeze visible.",
        repoUrl: "https://code.demo.kemetlabs.dev/ahou-kouadio/sahararoad",
        demoUrl: "https://sahararoad.demo.kemetlabs.dev",
        stack: ["Unity", "C#"],
        createdAt: daysAgo(20),
      },
    ])
    .returning({ id: projects.id });

  const [
    waveLedgerHr,
    offliBankHr,
    ciDockerWatchdogHr,
    kemetDesignKitHr,
    dataPulseHr,
    pesaRailHr,
    darijaNlpToolkitHr,
    saharaRunHr,
  ] = await db
    .insert(helpRequests)
    .values([
      {
        projectId: waveLedger!.id,
        authorId: ids.coumbaThiam,
        kind: "collaboration",
        title: "Cherche un développeur frontend pour le tableau de bord",
        description: "Le moteur de réconciliation tourne, mais le tableau de bord commerçant est encore un prototype statique.",
        stack: ["React", "TypeScript"],
        status: "open",
        createdAt: daysAgo(20),
      },
      {
        projectId: offliBank!.id,
        authorId: ids.eboQuansah,
        kind: "help",
        title: "Revoir la gestion des conflits de synchronisation",
        description: "Besoin d'un second regard sur la stratégie de fusion quand deux appareils modifient le même solde hors-ligne.",
        stack: ["Flutter"],
        status: "open",
        createdAt: daysAgo(10),
      },
      {
        projectId: ciDockerWatchdog!.id,
        authorId: ids.lynaBouzid,
        kind: "collaboration",
        title: "Ajouter un mode Kubernetes",
        description: "Le watchdog ne couvre que Docker Compose pour l'instant, un mode Kubernetes est demandé par plusieurs équipes.",
        stack: ["Kubernetes", "Go"],
        status: "closed",
        createdAt: daysAgo(60),
        closedAt: daysAgo(5),
      },
      {
        projectId: kemetDesignKit!.id,
        authorId: ids.dapoOyelaran,
        kind: "help",
        title: "Auditer l'accessibilité des composants",
        description: "Avant la première version publique, un audit des composants au clavier et au lecteur d'écran serait précieux.",
        stack: ["React", "Accessibilité"],
        status: "open",
        createdAt: daysAgo(12),
      },
      {
        projectId: dataPulse!.id,
        authorId: ids.kgomotsoMahlangu,
        kind: "collaboration",
        title: "Chercher un data scientist pour la détection d'anomalies",
        description: "Les alertes sont pour l'instant des seuils fixes, un vrai modèle de détection d'anomalies ferait moins de faux positifs.",
        stack: ["Python"],
        status: "open",
        createdAt: daysAgo(15),
      },
      {
        projectId: pesaRail!.id,
        authorId: ids.kipronoLangat,
        kind: "help",
        title: "Revue d'architecture avant publication",
        description: "Cherche un regard extérieur sur la gestion des transactions distribuées avant de documenter publiquement l'approche.",
        stack: ["Java", "Kafka"],
        status: "closed",
        createdAt: daysAgo(80),
        closedAt: daysAgo(70),
      },
      {
        projectId: darijaNlpToolkit!.id,
        authorId: ids.ghizlaneAmrani,
        kind: "collaboration",
        title: "Annoter des phrases en darija marocain",
        description: "Le corpus d'évaluation manque de phrases annotées pour le dialecte marocain spécifiquement.",
        stack: ["NLP"],
        status: "open",
        createdAt: daysAgo(18),
      },
      {
        projectId: saharaRun!.id,
        authorId: ids.ahouKouadio,
        kind: "help",
        title: "Optimiser le frame pacing sur Android bas de gamme",
        description: "Encore des baisses de frame perceptibles sur les appareils d'entrée de gamme testés en Côte d'Ivoire.",
        stack: ["Unity"],
        status: "open",
        createdAt: daysAgo(8),
      },
    ])
    .returning({ id: helpRequests.id });

  await db.insert(applications).values([
    {
      helpRequestId: waveLedgerHr!.id,
      applicantId: ids.dapoOyelaran,
      message: "Le design system que je maintiens pourrait accélérer le tableau de bord, je peux proposer une première maquette.",
      status: "pending",
      createdAt: daysAgo(15),
    },
    {
      helpRequestId: offliBankHr!.id,
      applicantId: ids.kipronoLangat,
      message: "J'ai géré exactement ce problème côté paiement mobile, je peux relire la stratégie de fusion.",
      status: "accepted",
      createdAt: daysAgo(9),
      decidedAt: daysAgo(8),
    },
    {
      helpRequestId: ciDockerWatchdogHr!.id,
      applicantId: ids.heritierKabeya,
      message: "Je n'ai pas d'expérience Kubernetes en production, ce ne serait pas le bon profil pour cette demande.",
      status: "declined",
      createdAt: daysAgo(50),
      decidedAt: daysAgo(45),
    },
    {
      helpRequestId: kemetDesignKitHr!.id,
      applicantId: ids.skanderJaziri,
      message: "J'ai fait un audit accessibilité complet sur mon dernier projet, je peux appliquer la même grille ici.",
      status: "accepted",
      createdAt: daysAgo(10),
      decidedAt: daysAgo(9),
    },
    {
      helpRequestId: dataPulseHr!.id,
      applicantId: ids.ghizlaneAmrani,
      message: "La détection d'anomalies est mon quotidien, je peux proposer un premier modèle simple à itérer.",
      status: "pending",
      createdAt: daysAgo(6),
    },
    {
      helpRequestId: pesaRailHr!.id,
      applicantId: ids.coumbaThiam,
      message: "Je suis passée par les mêmes arbitrages côté webhooks Wave, je peux relire la partie idempotence.",
      status: "accepted",
      createdAt: daysAgo(78),
      decidedAt: daysAgo(76),
    },
    {
      helpRequestId: darijaNlpToolkitHr!.id,
      applicantId: ids.eboQuansah,
      message: "Je parle le darija au quotidien, je peux annoter un lot de phrases ce week-end.",
      status: "pending",
      createdAt: daysAgo(4),
    },
    {
      helpRequestId: saharaRunHr!.id,
      applicantId: ids.heritierKabeya,
      message: "J'optimise déjà pour du matériel contraint côté firmware, le raisonnement sur le budget de frame devrait se transposer.",
      status: "pending",
      createdAt: daysAgo(3),
    },
  ]);

  return {
    waveLedger: waveLedger!.id,
    offliBank: offliBank!.id,
    ciDockerWatchdog: ciDockerWatchdog!.id,
    kemetDesignKit: kemetDesignKit!.id,
    dataPulse: dataPulse!.id,
    pesaRail: pesaRail!.id,
    darijaNlpToolkit: darijaNlpToolkit!.id,
    saharaRun: saharaRun!.id,
  };
}
