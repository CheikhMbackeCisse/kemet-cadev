import { randomUUID } from "node:crypto";
import type { DbOrTx } from "../client.js";
import { credentialPoints } from "../points-rules.js";
import { account, credentials, pointsLedger, profiles, user } from "../schema/index.js";
import { avatarDataUri } from "./avatar.js";
import { daysAgo } from "./time.js";

const CREDENTIALS_VERIFIED_AT = daysAgo(100);

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
  credentials: CredentialSeed[];
}

interface CredentialSeed {
  type: "job" | "education" | "internship";
  organization: string;
  title: string;
  startDate: string;
  endDate?: string;
  status: "declared" | "verified";
  verificationMethod?: string;
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
    title: "Lead développeuse backend",
    bio: "Fastify et PostgreSQL au quotidien, passionnée de systèmes distribués.",
    stack: ["TypeScript", "Fastify", "PostgreSQL"],
    githubUrl: "https://github.com/amina-diallo",
    openToOpportunities: true,
    credentials: [
      {
        type: "job",
        organization: "Orange Digital Center",
        title: "Lead développeuse backend",
        startDate: "2022-03-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
      {
        type: "job",
        organization: "Sonatel",
        title: "Développeuse backend",
        startDate: "2015-09-01",
        endDate: "2022-02-28",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
      {
        type: "education",
        organization: "École supérieure polytechnique de Dakar",
        title: "Master en génie logiciel",
        startDate: "2013-09-01",
        endDate: "2015-07-15",
        status: "verified",
        verificationMethod: "Diplôme transmis",
      },
      {
        type: "internship",
        organization: "Sonatel",
        title: "Stage développeuse backend",
        startDate: "2015-02-01",
        endDate: "2015-07-31",
        status: "verified",
        verificationMethod: "Convention de stage",
      },
    ],
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
    credentials: [
      {
        type: "job",
        organization: "Zenith Bank Ghana",
        title: "Développeur mobile senior",
        startDate: "2021-06-01",
        status: "declared",
      },
    ],
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
    credentials: [
      {
        type: "job",
        organization: "OCP Group",
        title: "Ingénieure DevOps",
        startDate: "2020-09-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
    ],
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
    credentials: [
      {
        type: "education",
        organization: "Université de Lagos",
        title: "Licence en informatique",
        startDate: "2017-09-01",
        endDate: "2020-07-01",
        status: "declared",
      },
    ],
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
    credentials: [
      {
        type: "job",
        organization: "Takealot",
        title: "Data engineer",
        startDate: "2021-02-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
    ],
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
    credentials: [
      {
        type: "internship",
        organization: "InstaDeep",
        title: "Stage développeur full-stack",
        startDate: "2019-02-01",
        endDate: "2019-08-01",
        status: "declared",
      },
    ],
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
    credentials: [
      {
        type: "job",
        organization: "Kiro'o Games",
        title: "Développeuse gameplay",
        startDate: "2022-11-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
    ],
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
    credentials: [
      {
        type: "job",
        organization: "Safaricom",
        title: "Architecte logiciel, plateforme M-Pesa",
        startDate: "2012-04-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
    ],
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
    credentials: [
      {
        type: "job",
        organization: "InstaDeep",
        title: "Développeuse IA",
        startDate: "2021-07-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
      {
        type: "education",
        organization: "Université américaine du Caire",
        title: "Master en intelligence artificielle",
        startDate: "2019-09-01",
        endDate: "2021-06-01",
        status: "verified",
        verificationMethod: "Diplôme transmis",
      },
    ],
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
    credentials: [
      {
        type: "job",
        organization: "Gorilla Technology",
        title: "Développeur firmware",
        startDate: "2023-01-01",
        status: "declared",
      },
    ],
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

    for (const credential of demoAccount.credentials) {
      const [row] = await db
        .insert(credentials)
        .values({
          profileId: profile!.id,
          type: credential.type,
          organization: credential.organization,
          title: credential.title,
          startDate: credential.startDate,
          endDate: credential.endDate ?? null,
          status: credential.status,
          verificationMethod: credential.verificationMethod ?? null,
          // Aucun compte de démonstration n'est administrateur : pas d'auteur.
          verifiedAt: credential.status === "verified" ? CREDENTIALS_VERIFIED_AT : null,
        })
        .returning();
      // Comme la route de vérification : seul un élément vérifié rapporte des points.
      if (row!.status === "verified") {
        await db.insert(pointsLedger).values({
          profileId: profile!.id,
          source: "credential_verified",
          sourceId: row!.id,
          amount: credentialPoints(row!, CREDENTIALS_VERIFIED_AT),
          createdAt: CREDENTIALS_VERIFIED_AT,
        });
      }
    }
  }

  return ids;
}
