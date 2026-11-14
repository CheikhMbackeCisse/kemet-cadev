import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { helpRequests, profiles, projects } from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import { daysAgo, hoursAgo } from "./time.js";

interface InProgressRequest {
  key: string;
  kind: "help" | "collaboration";
  title: string;
  description: string;
  stack: string[];
  hoursAgo: number;
}

interface InProgressProject {
  slug: string;
  ownerHandle: string;
  name: string;
  pitch: string;
  description: string;
  stack: string[];
  daysAgo: number;
  request: InProgressRequest | null;
}

/**
 * Projets en cours qui cherchent de l'aide, sur des sujets du quotidien
 * (santé, transport, agriculture, éducation, paiement, langues locales).
 * Aucune vraie marque, aucun partenariat inventé.
 */
export const IN_PROGRESS_PROJECTS: InProgressProject[] = [
  {
    slug: "carnet-vaccins",
    ownerHandle: "kgomotso-mahlangu",
    name: "Carnet Vaccins",
    pitch: "Le carnet de vaccination des enfants sur le téléphone des parents, avec un rappel avant chaque dose.",
    description:
      "Les agents des centres de santé saisissent la dose une fois ; les parents reçoivent un rappel par SMS " +
      "ou dans l'application quelques jours avant la suivante. Le carnet papier reste la référence.",
    stack: ["React Native", "TypeScript", "Node.js"],
    daysAgo: 21,
    request: {
      key: "rn-tests",
      kind: "collaboration",
      title: "Cherche 1 dev React Native et 1 personne pour les tests sur Android",
      description:
        "L'écran du carnet et les rappels marchent sur un émulateur. Il faut maintenant tester sur de vrais " +
        "téléphones Android d'entrée de gamme, et finir l'écran de saisie des agents.",
      stack: ["React Native", "Android"],
      hoursAgo: 30,
    },
  },
  {
    slug: "arret-malin",
    ownerHandle: "ebo-quansah",
    name: "Arrêt Malin",
    pitch: "Les arrêts et les horaires réels des minibus, ajoutés par les passagers eux-mêmes.",
    description:
      "Un passager signale un arrêt ou le passage d'une ligne, les autres confirment. Les données restent " +
      "ouvertes pour que n'importe quelle application de la ville puisse s'en servir.",
    stack: ["Flutter", "Dart", "PostgreSQL"],
    daysAgo: 34,
    request: {
      key: "flutter-carte",
      kind: "collaboration",
      title: "Cherche 1 dev Flutter pour la carte des arrêts",
      description:
        "La carte doit rester fluide avec quelques milliers d'arrêts et fonctionner avec une connexion faible.",
      stack: ["Flutter", "Dart"],
      hoursAgo: 52,
    },
  },
  {
    slug: "sol-sur",
    ownerHandle: "heritier-kabeya",
    name: "Sol Sûr",
    pitch: "Des conseils d'arrosage envoyés par SMS aux maraîchers, à partir de capteurs d'humidité du sol.",
    description:
      "Des capteurs à bas prix relèvent l'humidité toutes les heures. Le serveur calcule s'il faut arroser " +
      "et envoie un SMS court, lisible sur n'importe quel téléphone.",
    stack: ["Python", "PostgreSQL", "Docker"],
    daysAgo: 18,
    request: {
      key: "python-api",
      kind: "help",
      title: "Cherche 1 dev Python pour l'API des relevés de capteurs",
      description:
        "Les capteurs envoient déjà leurs mesures. Il manque une API qui les range, repère les valeurs " +
        "aberrantes et prépare le message du jour.",
      stack: ["Python", "PostgreSQL"],
      hoursAgo: 20,
    },
  },
  {
    slug: "revise-bac",
    ownerHandle: "dapo-oyelaran",
    name: "Révise ton bac",
    pitch: "Des exercices de maths corrigés pas à pas pour le bac, consultables sans connexion.",
    description:
      "Chaque exercice a sa correction détaillée et un indice avant la solution. L'application se télécharge " +
      "une fois et fonctionne ensuite hors ligne.",
    stack: ["React", "TypeScript"],
    daysAgo: 12,
    request: {
      key: "saisie-exercices",
      kind: "help",
      title: "Bon premier projet : cherche 2 personnes pour écrire et vérifier des exercices en Markdown",
      description:
        "Aucune expérience demandée : il suffit d'avoir eu le bac ou de le préparer. On apprend Git ensemble " +
        "en chemin.",
      stack: ["Markdown", "Git"],
      hoursAgo: 8,
    },
  },
  {
    slug: "tontine-claire",
    ownerHandle: "skander-jaziri",
    name: "Tontine Claire",
    pitch: "Une tontine suivie par tous les membres : qui a cotisé, qui reçoit ce mois-ci, sans cahier perdu.",
    description:
      "Chaque membre voit l'historique des cotisations et l'ordre des bénéficiaires. Un rappel part avant " +
      "la date de cotisation. Le paiement lui-même reste fait par mobile money, hors de l'application.",
    stack: ["Node.js", "PostgreSQL", "React"],
    daysAgo: 27,
    request: {
      key: "rappels-sms",
      kind: "collaboration",
      title: "Cherche 1 dev Node.js pour les rappels par SMS",
      description: "La liste des membres et l'historique sont prêts. Il faut planifier les rappels et gérer les échecs d'envoi.",
      stack: ["Node.js"],
      hoursAgo: 44,
    },
  },
  {
    slug: "clavier-wolof",
    ownerHandle: "ghizlane-amrani",
    name: "Clavier Wolof",
    pitch: "Un clavier Android qui propose les mots en wolof pendant qu'on écrit.",
    description:
      "Un petit modèle de langue tourne sur le téléphone, sans connexion. Les suggestions viennent de textes " +
      "publics relus par des locuteurs.",
    stack: ["Python", "Java"],
    daysAgo: 25,
    request: {
      key: "relecture-wolof",
      kind: "help",
      title: "Bon premier projet : cherche des personnes qui parlent wolof pour relire les suggestions",
      description:
        "Pas besoin de savoir coder : on relit des listes de mots dans un tableur partagé. Les développeurs " +
        "débutants peuvent ensuite aider à écrire les tests.",
      stack: ["Python"],
      hoursAgo: 14,
    },
  },
  {
    slug: "pharmacie-de-garde",
    ownerHandle: "yannick-mbarga",
    name: "Pharmacie de garde",
    pitch: "La liste des pharmacies de garde de la ville, à jour chaque semaine, sur une page légère.",
    description:
      "Une page web qui se charge vite, même en 3G, avec la pharmacie de garde la plus proche et son numéro.",
    stack: ["HTML", "CSS", "JavaScript"],
    daysAgo: 9,
    request: {
      key: "page-publique",
      kind: "help",
      title: "Bon premier projet : cherche 1 personne pour la page publique en HTML et CSS",
      description: "La liste existe déjà dans un fichier. Il faut une page claire, lisible sur un petit écran.",
      stack: ["HTML", "CSS"],
      hoursAgo: 26,
    },
  },
  {
    slug: "prix-du-marche",
    ownerHandle: "kiprono-langat",
    name: "Prix du marché",
    pitch: "Les prix des denrées relevés chaque matin sur les marchés, pour comparer avant d'acheter.",
    description:
      "Des relevés faits par des commerçants volontaires, publiés le matin même. L'équipe est au complet " +
      "pour la première version.",
    stack: ["Flutter", "Go"],
    daysAgo: 40,
    request: null,
  },
];

export type ProjectsInProgressResult =
  | { status: "done"; projects: number; requests: number }
  | { status: "skipped"; reason: string };

/**
 * Relançable : un projet dont le slug est déjà pris (par un compte réel ou un
 * passage précédent) n'est jamais modifié, une demande déjà posée n'est pas
 * reposée.
 */
export async function seedProjectsInProgress(db: DbOrTx): Promise<ProjectsInProgressResult> {
  const handles = [...new Set(IN_PROGRESS_PROJECTS.map((project) => project.ownerHandle))];
  const rows = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(and(inArray(profiles.handle, handles), eq(profiles.isDemo, true)));
  const ids = new Map(rows.map((row) => [row.handle, row.id]));
  if (handles.some((handle) => !ids.has(handle)))
    return { status: "skipped", reason: "comptes de démonstration absents" };

  return db.transaction(async (tx) => {
    let createdProjects = 0;
    let createdRequests = 0;
    for (const entry of IN_PROGRESS_PROJECTS) {
      const ownerId = ids.get(entry.ownerHandle)!;
      const projectId = demoUuid(`in-progress-project:${entry.slug}`);
      const inserted = await tx
        .insert(projects)
        .values({
          id: projectId,
          ownerId,
          slug: entry.slug,
          name: entry.name,
          pitch: entry.pitch,
          description: entry.description,
          repoUrl: `https://code.demo.kemetlabs.dev/${entry.ownerHandle}/${entry.slug}`,
          demoUrl: null,
          stack: entry.stack,
          createdAt: daysAgo(entry.daysAgo),
        })
        .onConflictDoNothing()
        .returning({ id: projects.id });
      createdProjects += inserted.length;
      const [project] = await tx
        .select({ ownerId: projects.ownerId })
        .from(projects)
        .where(eq(projects.id, projectId));
      if (!project || project.ownerId !== ownerId || !entry.request) continue;
      const request = await tx
        .insert(helpRequests)
        .values({
          id: demoUuid(`in-progress-request:${entry.slug}:${entry.request.key}`),
          projectId,
          authorId: ownerId,
          kind: entry.request.kind,
          title: entry.request.title,
          description: entry.request.description,
          stack: entry.request.stack,
          status: "open",
          createdAt: hoursAgo(entry.request.hoursAgo),
        })
        .onConflictDoNothing()
        .returning({ id: helpRequests.id });
      createdRequests += request.length;
    }
    return { status: "done", projects: createdProjects, requests: createdRequests };
  });
}
