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
  coumbaThiam: string;
  eboQuansah: string;
  lynaBouzid: string;
  dapoOyelaran: string;
  kgomotsoMahlangu: string;
  skanderJaziri: string;
  ahouKouadio: string;
  kipronoLangat: string;
  ghizlaneAmrani: string;
  heritierKabeya: string;
}

export const DEMO_ACCOUNTS: DemoAccountSeed[] = [
  {
    key: "coumbaThiam",
    email: "coumba.thiam@demo.kemetlabs.dev",
    name: "Coumba Thiam",
    handle: "coumba-thiam",
    country: "SN",
    title: "Lead backend, paiements",
    bio: "Dix ans de PostgreSQL. Je relis les migrations des autres avant qu'elles partent en prod, c'est plus fort que moi.",
    stack: ["TypeScript", "Fastify", "PostgreSQL"],
    openToOpportunities: true,
    credentials: [
      {
        type: "job",
        organization: "Jàmm Pay",
        title: "Lead backend",
        startDate: "2022-03-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
      {
        type: "job",
        organization: "Teranga Systèmes",
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
        organization: "Teranga Systèmes",
        title: "Stage développeuse backend",
        startDate: "2015-02-01",
        endDate: "2015-07-31",
        status: "verified",
        verificationMethod: "Convention de stage",
      },
    ],
  },
  {
    key: "eboQuansah",
    email: "ebo.quansah@demo.kemetlabs.dev",
    name: "Ebo Quansah",
    handle: "ebo-quansah",
    country: "GH",
    title: "Développeur mobile",
    bio: "Flutter pour une banque à Kumasi. Je teste tout sur un téléphone à 60 dollars avant de dire que ça marche.",
    stack: ["Flutter", "Dart", "Firebase"],
    openToOpportunities: false,
    credentials: [
      {
        type: "job",
        organization: "Sika Mobile Banking",
        title: "Développeur mobile",
        startDate: "2021-06-01",
        status: "declared",
      },
    ],
  },
  {
    key: "lynaBouzid",
    email: "lyna.bouzid@demo.kemetlabs.dev",
    name: "Lyna Bouzid",
    handle: "lyna-bouzid",
    country: "DZ",
    title: "DevOps en freelance",
    bio: "J'aide les petites équipes à arrêter de déployer le vendredi soir. Docker, Terraform, et beaucoup de patience.",
    stack: ["Docker", "Kubernetes", "Terraform"],
    openToOpportunities: true,
    credentials: [
      {
        type: "job",
        organization: "Indépendante",
        title: "Consultante DevOps",
        startDate: "2020-09-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
    ],
  },
  {
    key: "dapoOyelaran",
    email: "dapo.oyelaran@demo.kemetlabs.dev",
    name: "Dapo Oyelaran",
    handle: "dapo-oyelaran",
    country: "NG",
    title: "Lead frontend",
    bio: "Design systems en React. Si ton bouton n'a pas d'état de focus, je vais le voir.",
    stack: ["React", "TypeScript", "Tailwind"],
    openToOpportunities: false,
    credentials: [
      {
        type: "education",
        organization: "Université d'Ibadan",
        title: "Licence en informatique",
        startDate: "2017-09-01",
        endDate: "2020-07-01",
        status: "declared",
      },
    ],
  },
  {
    key: "kgomotsoMahlangu",
    email: "kgomotso.mahlangu@demo.kemetlabs.dev",
    name: "Kgomotso Mahlangu",
    handle: "kgomotso-mahlangu",
    country: "ZA",
    title: "Data engineer",
    bio: "Airflow et Spark pour un site de e-commerce à Johannesburg. J'ai appris à surveiller la mémoire avant les logs.",
    stack: ["Python", "Airflow", "Spark"],
    openToOpportunities: true,
    credentials: [
      {
        type: "job",
        organization: "Kasi Market",
        title: "Data engineer",
        startDate: "2021-02-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
    ],
  },
  {
    key: "skanderJaziri",
    email: "skander.jaziri@demo.kemetlabs.dev",
    name: "Skander Jaziri",
    handle: "skander-jaziri",
    country: "TN",
    title: "Full-stack en freelance",
    bio: "Sites et back-offices pour des PME de Sfax. Node, Vue, MySQL, et des devis qui tiennent sur une page.",
    stack: ["Node.js", "Vue", "MySQL"],
    openToOpportunities: false,
    credentials: [
      {
        type: "internship",
        organization: "Medina Soft",
        title: "Stage développeur full-stack",
        startDate: "2019-02-01",
        endDate: "2019-08-01",
        status: "declared",
      },
    ],
  },
  {
    key: "ahouKouadio",
    email: "ahou.kouadio@demo.kemetlabs.dev",
    name: "Ahou Kouadio",
    handle: "ahou-kouadio",
    country: "CI",
    title: "Étudiante en génie logiciel, jeux vidéo",
    bio: "En dernière année à Yamoussoukro. Je fais des jeux mobiles en Unity le soir et j'en publie un par semestre.",
    stack: ["C++", "Unity", "C#"],
    openToOpportunities: true,
    credentials: [
      {
        type: "job",
        organization: "Studio Akwaba",
        title: "Développeuse gameplay, en alternance",
        startDate: "2022-11-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
    ],
  },
  {
    key: "kipronoLangat",
    email: "kiprono.langat@demo.kemetlabs.dev",
    name: "Kiprono Langat",
    handle: "kiprono-langat",
    country: "KE",
    title: "Architecte logiciel",
    bio: "Quinze ans de paiement mobile à Nairobi. Mon sujet préféré : ce qui se passe quand le même paiement arrive deux fois.",
    stack: ["Java", "Spring", "Kafka"],
    openToOpportunities: false,
    credentials: [
      {
        type: "job",
        organization: "PesaRails",
        title: "Architecte logiciel, plateforme de paiement",
        startDate: "2012-04-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
    ],
  },
  {
    key: "ghizlaneAmrani",
    email: "ghizlane.amrani@demo.kemetlabs.dev",
    name: "Ghizlane Amrani",
    handle: "ghizlane-amrani",
    country: "MA",
    title: "Doctorante en traitement du langage",
    bio: "Thèse sur la darija écrite en lettres latines. Je collectionne les corpus que personne n'a encore nettoyés.",
    stack: ["Python", "PyTorch", "FastAPI"],
    openToOpportunities: true,
    credentials: [
      {
        type: "job",
        organization: "Laboratoire LIMS, Rabat",
        title: "Doctorante en NLP",
        startDate: "2021-07-01",
        status: "verified",
        verificationMethod: "Attestation employeur",
      },
      {
        type: "education",
        organization: "Université Mohammed V de Rabat",
        title: "Master en intelligence artificielle",
        startDate: "2019-09-01",
        endDate: "2021-06-01",
        status: "verified",
        verificationMethod: "Diplôme transmis",
      },
    ],
  },
  {
    key: "heritierKabeya",
    email: "heritier.kabeya@demo.kemetlabs.dev",
    name: "Héritier Kabeya",
    handle: "heritier-kabeya",
    country: "CD",
    title: "Développeur embarqué junior",
    bio: "Premier poste, à Lubumbashi. Firmware pour des capteurs agricoles qui doivent tenir une saison sur une batterie.",
    stack: ["C", "Rust", "FreeRTOS"],
    openToOpportunities: false,
    credentials: [
      {
        type: "job",
        organization: "Shamba Sense",
        title: "Développeur firmware junior",
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
