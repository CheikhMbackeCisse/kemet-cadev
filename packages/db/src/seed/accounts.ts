import { randomUUID } from "node:crypto";
import type { DbOrTx } from "../client.js";
import { account, credentials, profiles, user } from "../schema/index.js";
import { avatarDataUri } from "./avatar.js";

interface DemoAccountSeed {
  key: keyof DemoAccountIds;
  email: string;
  name: string;
  handle: string;
  country: string;
  title: string;
  bio: string;
  stack: string[];
  githubUrl: string;
  openToOpportunities: boolean;
  credential: {
    type: "job" | "education" | "internship";
    organization: string;
    title: string;
    startDate: string;
    endDate?: string;
    status: "declared" | "verified";
    verificationMethod?: string;
  };
}

export interface DemoAccountIds {
  aminaDiallo: string;
  kwameAsante: string;
  fatimaBenali: string;
  chidiOkafor: string;
  zaneleMokoena: string;
  yassineTrabelsi: string;
  aissatouToure: string;
  samuelMwangi: string;
  nadiaHassan: string;
  jeanMarcMukendi: string;
}

export const DEMO_ACCOUNTS: DemoAccountSeed[] = [
  {
    key: "aminaDiallo",
    email: "amina.diallo@demo.kemet.africa",
    name: "Amina Diallo",
    handle: "amina-diallo",
    country: "SN",
    title: "Développeuse backend",
    bio: "Fastify et PostgreSQL au quotidien, passionnée de systèmes distribués.",
    stack: ["TypeScript", "Fastify", "PostgreSQL"],
    githubUrl: "https://github.com/amina-diallo",
    openToOpportunities: true,
    credential: {
      type: "job",
      organization: "Orange Digital Center",
      title: "Développeuse backend",
      startDate: "2022-03-01",
      status: "verified",
      verificationMethod: "Attestation employeur",
    },
  },
  {
    key: "kwameAsante",
    email: "kwame.asante@demo.kemet.africa",
    name: "Kwame Asante",
    handle: "kwame-asante",
    country: "GH",
    title: "Développeur mobile",
    bio: "Applications Flutter pour le secteur bancaire depuis cinq ans.",
    stack: ["Flutter", "Dart", "Firebase"],
    githubUrl: "https://github.com/kwame-asante",
    openToOpportunities: false,
    credential: {
      type: "job",
      organization: "Zenith Bank Ghana",
      title: "Développeur mobile senior",
      startDate: "2021-06-01",
      status: "declared",
    },
  },
  {
    key: "fatimaBenali",
    email: "fatima.benali@demo.kemet.africa",
    name: "Fatima Benali",
    handle: "fatima-benali",
    country: "MA",
    title: "Ingénieure DevOps",
    bio: "Docker, Kubernetes, et une obsession pour les pipelines CI fiables.",
    stack: ["Docker", "Kubernetes", "Terraform"],
    githubUrl: "https://github.com/fatima-benali",
    openToOpportunities: true,
    credential: {
      type: "job",
      organization: "OCP Group",
      title: "Ingénieure DevOps",
      startDate: "2020-09-01",
      status: "verified",
      verificationMethod: "Attestation employeur",
    },
  },
  {
    key: "chidiOkafor",
    email: "chidi.okafor@demo.kemet.africa",
    name: "Chidi Okafor",
    handle: "chidi-okafor",
    country: "NG",
    title: "Lead frontend",
    bio: "React et design systems pour des produits fintech à grande échelle.",
    stack: ["React", "TypeScript", "Tailwind"],
    githubUrl: "https://github.com/chidi-okafor",
    openToOpportunities: false,
    credential: {
      type: "education",
      organization: "Université de Lagos",
      title: "Licence en informatique",
      startDate: "2017-09-01",
      endDate: "2020-07-01",
      status: "declared",
    },
  },
  {
    key: "zaneleMokoena",
    email: "zanele.mokoena@demo.kemet.africa",
    name: "Zanele Mokoena",
    handle: "zanele-mokoena",
    country: "ZA",
    title: "Data engineer",
    bio: "Pipelines de données et entrepôts analytiques pour le e-commerce.",
    stack: ["Python", "Airflow", "Spark"],
    githubUrl: "https://github.com/zanele-mokoena",
    openToOpportunities: true,
    credential: {
      type: "job",
      organization: "Takealot",
      title: "Data engineer",
      startDate: "2021-02-01",
      status: "declared",
    },
  },
  {
    key: "yassineTrabelsi",
    email: "yassine.trabelsi@demo.kemet.africa",
    name: "Yassine Trabelsi",
    handle: "yassine-trabelsi",
    country: "TN",
    title: "Développeur full-stack",
    bio: "Du schéma de base de données à l'interface, sans détour.",
    stack: ["Node.js", "Vue", "MySQL"],
    githubUrl: "https://github.com/yassine-trabelsi",
    openToOpportunities: false,
    credential: {
      type: "internship",
      organization: "InstaDeep",
      title: "Stage développeur full-stack",
      startDate: "2019-02-01",
      endDate: "2019-08-01",
      status: "declared",
    },
  },
  {
    key: "aissatouToure",
    email: "aissatou.toure@demo.kemet.africa",
    name: "Aïssatou Touré",
    handle: "aissatou-toure",
    country: "CI",
    title: "Développeuse jeux vidéo",
    bio: "Moteurs de jeu en C++ et expériences interactives pour mobile.",
    stack: ["C++", "Unity", "C#"],
    githubUrl: "https://github.com/aissatou-toure",
    openToOpportunities: true,
    credential: {
      type: "job",
      organization: "Kiro'o Games",
      title: "Développeuse gameplay",
      startDate: "2022-11-01",
      status: "declared",
    },
  },
  {
    key: "samuelMwangi",
    email: "samuel.mwangi@demo.kemet.africa",
    name: "Samuel Mwangi",
    handle: "samuel-mwangi",
    country: "KE",
    title: "Architecte logiciel",
    bio: "Quinze ans à concevoir des systèmes de paiement mobile résilients.",
    stack: ["Java", "Spring", "Kafka"],
    githubUrl: "https://github.com/samuel-mwangi",
    openToOpportunities: false,
    credential: {
      type: "job",
      organization: "Safaricom",
      title: "Architecte logiciel, plateforme M-Pesa",
      startDate: "2012-04-01",
      status: "verified",
      verificationMethod: "Attestation employeur",
    },
  },
  {
    key: "nadiaHassan",
    email: "nadia.hassan@demo.kemet.africa",
    name: "Nadia Hassan",
    handle: "nadia-hassan",
    country: "EG",
    title: "Développeuse IA",
    bio: "Modèles de recommandation et traitement du langage naturel en arabe.",
    stack: ["Python", "PyTorch", "FastAPI"],
    githubUrl: "https://github.com/nadia-hassan",
    openToOpportunities: true,
    credential: {
      type: "education",
      organization: "Université américaine du Caire",
      title: "Master en intelligence artificielle",
      startDate: "2019-09-01",
      endDate: "2021-06-01",
      status: "verified",
      verificationMethod: "Diplôme transmis",
    },
  },
  {
    key: "jeanMarcMukendi",
    email: "jean-marc.mukendi@demo.kemet.africa",
    name: "Jean-Marc Mukendi",
    handle: "jean-marc-mukendi",
    country: "CD",
    title: "Développeur embarqué",
    bio: "Firmware pour capteurs agricoles connectés en zone rurale.",
    stack: ["C", "Rust", "FreeRTOS"],
    githubUrl: "https://github.com/jean-marc-mukendi",
    openToOpportunities: false,
    credential: {
      type: "job",
      organization: "Gorilla Technology",
      title: "Développeur firmware",
      startDate: "2023-01-01",
      status: "declared",
    },
  },
];

export async function createDemoAccounts(db: DbOrTx, passwordHash: string): Promise<DemoAccountIds> {
  const ids = {} as DemoAccountIds;

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
        avatarUrl: avatarDataUri(demoAccount.handle),
        openToOpportunities: demoAccount.openToOpportunities,
        isDemo: true,
      })
      .returning({ id: profiles.id });
    ids[demoAccount.key] = profile!.id;

    await db.insert(credentials).values({
      profileId: profile!.id,
      type: demoAccount.credential.type,
      organization: demoAccount.credential.organization,
      title: demoAccount.credential.title,
      startDate: demoAccount.credential.startDate,
      endDate: demoAccount.credential.endDate ?? null,
      status: demoAccount.credential.status,
      verificationMethod: demoAccount.credential.verificationMethod ?? null,
    });
  }

  return ids;
}
