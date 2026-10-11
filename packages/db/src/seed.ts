import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { createDb } from "./client.js";
import { account, credentials, follows, profiles, skills, user } from "./schema/index.js";

/**
 * Mot de passe commun des comptes de démonstration, pour que le jury puisse
 * se connecter sans fouiller la base. Ces comptes ont `is_demo = true` et ne
 * doivent jamais être utilisés en production.
 */
const DEMO_PASSWORD = "demonstration";

interface DemoAccount {
  email: string;
  name: string;
  handle: string;
  country: string;
  title: string;
  bio: string;
  stack: string[];
  githubUrl: string;
  openToOpportunities: boolean;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "amina.diallo@demo.kemet.africa",
    name: "Amina Diallo",
    handle: "amina-diallo",
    country: "SN",
    title: "Développeuse backend",
    bio: "Fastify et PostgreSQL au quotidien, passionnée de systèmes distribués.",
    stack: ["TypeScript", "Fastify", "PostgreSQL"],
    githubUrl: "https://github.com/amina-diallo",
    openToOpportunities: true,
  },
  {
    email: "kwame.asante@demo.kemet.africa",
    name: "Kwame Asante",
    handle: "kwame-asante",
    country: "GH",
    title: "Développeur mobile",
    bio: "Applications Flutter pour le secteur bancaire depuis cinq ans.",
    stack: ["Flutter", "Dart", "Firebase"],
    githubUrl: "https://github.com/kwame-asante",
    openToOpportunities: false,
  },
  {
    email: "fatima.benali@demo.kemet.africa",
    name: "Fatima Benali",
    handle: "fatima-benali",
    country: "MA",
    title: "Ingénieure DevOps",
    bio: "Docker, Kubernetes, et une obsession pour les pipelines CI fiables.",
    stack: ["Docker", "Kubernetes", "Terraform"],
    githubUrl: "https://github.com/fatima-benali",
    openToOpportunities: true,
  },
  {
    email: "chidi.okafor@demo.kemet.africa",
    name: "Chidi Okafor",
    handle: "chidi-okafor",
    country: "NG",
    title: "Lead frontend",
    bio: "React et design systems pour des produits fintech à grande échelle.",
    stack: ["React", "TypeScript", "Tailwind"],
    githubUrl: "https://github.com/chidi-okafor",
    openToOpportunities: false,
  },
  {
    email: "zanele.mokoena@demo.kemet.africa",
    name: "Zanele Mokoena",
    handle: "zanele-mokoena",
    country: "ZA",
    title: "Data engineer",
    bio: "Pipelines de données et entrepôts analytiques pour le e-commerce.",
    stack: ["Python", "Airflow", "Spark"],
    githubUrl: "https://github.com/zanele-mokoena",
    openToOpportunities: true,
  },
  {
    email: "yassine.trabelsi@demo.kemet.africa",
    name: "Yassine Trabelsi",
    handle: "yassine-trabelsi",
    country: "TN",
    title: "Développeur full-stack",
    bio: "Du schéma de base de données à l'interface, sans détour.",
    stack: ["Node.js", "Vue", "MySQL"],
    githubUrl: "https://github.com/yassine-trabelsi",
    openToOpportunities: false,
  },
  {
    email: "aissatou.toure@demo.kemet.africa",
    name: "Aïssatou Touré",
    handle: "aissatou-toure",
    country: "CI",
    title: "Développeuse jeux vidéo",
    bio: "Moteurs de jeu en C++ et expériences interactives pour mobile.",
    stack: ["C++", "Unity", "C#"],
    githubUrl: "https://github.com/aissatou-toure",
    openToOpportunities: true,
  },
  {
    email: "samuel.mwangi@demo.kemet.africa",
    name: "Samuel Mwangi",
    handle: "samuel-mwangi",
    country: "KE",
    title: "Architecte logiciel",
    bio: "Quinze ans à concevoir des systèmes de paiement mobile résilients.",
    stack: ["Java", "Spring", "Kafka"],
    githubUrl: "https://github.com/samuel-mwangi",
    openToOpportunities: false,
  },
  {
    email: "nadia.hassan@demo.kemet.africa",
    name: "Nadia Hassan",
    handle: "nadia-hassan",
    country: "EG",
    title: "Développeuse IA",
    bio: "Modèles de recommandation et traitement du langage naturel en arabe.",
    stack: ["Python", "PyTorch", "FastAPI"],
    githubUrl: "https://github.com/nadia-hassan",
    openToOpportunities: true,
  },
  {
    email: "jean-marc.mukendi@demo.kemet.africa",
    name: "Jean-Marc Mukendi",
    handle: "jean-marc-mukendi",
    country: "CD",
    title: "Développeur embarqué",
    bio: "Firmware pour capteurs agricoles connectés en zone rurale.",
    stack: ["C", "Rust", "FreeRTOS"],
    githubUrl: "https://github.com/jean-marc-mukendi",
    openToOpportunities: false,
  },
];

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Le seed crée des comptes avec un mot de passe public (demonstration) : refusé quand NODE_ENV=production.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? "postgres://kemet:kemet@localhost:5432/kemet";
  const db = createDb(databaseUrl);
  const passwordHash = await hash(DEMO_PASSWORD);

  const profileIds: string[] = [];

  for (const demoAccount of DEMO_ACCOUNTS) {
    const userId = randomUUID();
    await db.insert(user).values({
      id: userId,
      name: demoAccount.name,
      email: demoAccount.email,
      emailVerified: true,
    });
    await db.insert(account).values({
      id: randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    });
    const [profile] = await db
      .insert(profiles)
      .values({
        userId,
        handle: demoAccount.handle,
        displayName: demoAccount.name,
        country: demoAccount.country,
        title: demoAccount.title,
        bio: demoAccount.bio,
        stack: demoAccount.stack,
        githubUrl: demoAccount.githubUrl,
        openToOpportunities: demoAccount.openToOpportunities,
        isDemo: true,
        // Un seul compte de démonstration porte le rôle admin (validation
        // des compétitions, lot 10) : aucune interface ne permet encore de
        // l'attribuer, voir packages/db/src/schema/profiles.ts.
        isPlatformAdmin: demoAccount.handle === "amina-diallo",
      })
      .returning({ id: profiles.id });
    profileIds.push(profile!.id);
  }

  await db.insert(credentials).values({
    profileId: profileIds[0]!,
    type: "job",
    organization: "Orange Digital Center",
    title: "Développeuse backend",
    startDate: "2022-03-01",
    status: "verified",
    verificationMethod: "Attestation employeur",
  });
  await db.insert(credentials).values({
    profileId: profileIds[3]!,
    type: "education",
    organization: "Université de Lagos",
    title: "Licence en informatique",
    startDate: "2017-09-01",
    endDate: "2020-07-01",
    status: "declared",
  });

  for (let i = 1; i < profileIds.length; i += 1) {
    await db.insert(follows).values({ followerId: profileIds[i]!, followeeId: profileIds[0]! });
  }

  await db.insert(skills).values([
    {
      authorId: profileIds[0]!,
      slug: "wave-paiements",
      name: "wave-paiements",
      description: "Intégrer les paiements Wave dans une API Node.js : webhooks, statuts, remboursements.",
      content:
        "Utiliser ce skill pour toute question sur l'intégration de Wave (paiement mobile) côté serveur.\n\n" +
        "Points clés :\n" +
        "- Les webhooks Wave arrivent sans garantie d'ordre : toujours vérifier le statut actuel de la " +
        "transaction via l'API avant de considérer un paiement comme confirmé.\n" +
        "- Un remboursement partiel n'existe pas côté Wave : il faut rembourser en totalité puis relancer " +
        "un paiement pour la part restante.\n" +
        "- Toujours vérifier la signature du webhook avant de traiter son contenu.\n\n" +
        "Exemple de vérification de signature :\n" +
        "```ts\n" +
        "const expected = createHmac('sha256', secret).update(rawBody).digest('hex');\n" +
        "if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))) {\n" +
        "  throw new Error('signature invalide');\n" +
        "}\n" +
        "```",
      tags: ["wave", "paiement", "mobile money", "webhook"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: profileIds[2]!,
      slug: "ci-docker-fiable",
      name: "ci-docker-fiable",
      description: "Rendre une CI GitHub Actions stable quand elle construit et démarre des images Docker.",
      content:
        "Utiliser ce skill pour une CI qui construit des images Docker et les fait démarrer pour des tests " +
        "d'intégration ou end-to-end.\n\n" +
        "Points clés :\n" +
        "- Toujours attendre un healthcheck explicite avant de lancer les tests, jamais un délai fixe : " +
        "le temps de démarrage varie selon la charge du runner.\n" +
        "- Mettre en cache les couches Docker entre les exécutions (buildx avec un cache GitHub Actions) " +
        "réduit le temps de CI de plusieurs minutes.\n" +
        "- Un service qui dépasse la mémoire allouée au runner échoue silencieusement : surveiller la " +
        "mémoire de chaque conteneur, pas seulement les journaux applicatifs.",
      tags: ["ci", "docker", "github actions", "tests"],
      visibility: "public",
      isDemo: true,
    },
  ]);

  console.log(`${DEMO_ACCOUNTS.length} comptes de démonstration créés (mot de passe : ${DEMO_PASSWORD}).`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
