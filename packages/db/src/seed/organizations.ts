import { and, eq, inArray, ne } from "drizzle-orm";
import { DEMO_ORGANIZATION_HANDLES } from "@kemet/shared";
import type { DbOrTx } from "../client.js";
import { organizationManagers, posts, profiles } from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import { daysAgo } from "./time.js";

type OrganizationType = "company" | "school" | "community" | "event_organizer";

interface DemoOrganization {
  handle: (typeof DEMO_ORGANIZATION_HANDLES)[number];
  name: string;
  monogram: string;
  /** Une des teintes d'espace (tokens.css), blanc lisible dessus à 4,5:1. */
  color: string;
  type: OrganizationType;
  country: string;
  website: string;
  description: string;
  /** Compte de démonstration qui gère la page et reçoit les candidatures. */
  managerHandle: string;
  posts: { key: string; body: string; format: "astuce" | "question" | null; daysAgo: number }[];
}

// Organisations inventées pour Kemet : aucun nom d'entreprise ou d'école
// réelle, aucun logo repris. Le logo est un monogramme sur une teinte.
export const DEMO_ORGANIZATIONS: DemoOrganization[] = [
  {
    handle: "lagune-logiciels",
    name: "Lagune Logiciels",
    monogram: "LL",
    color: "#00727d",
    type: "company",
    country: "CI",
    website: "https://lagune-logiciels.demo.kemetlabs.dev",
    description:
      "Logiciels de facturation et de gestion pour les PME ivoiriennes, hébergés à Abidjan.",
    managerHandle: "ahou-kouadio",
    posts: [
      {
        key: "lagune-equipe",
        body:
          "Notre équipe d'Abidjan passe à huit développeurs. Il nous manque une personne côté mobile : " +
          "l'offre est dans l'onglet Opportunités de notre page.",
        format: null,
        daysAgo: 3,
      },
      {
        key: "lagune-astuce",
        body:
          "Une habitude qui nous a fait gagner des heures de support : chaque réponse de l'API porte un " +
          "identifiant de requête. Le client nous le lit au téléphone, on retrouve la trace en une recherche.",
        format: "astuce",
        daysAgo: 9,
      },
    ],
  },
  {
    handle: "cayor-distribution",
    name: "Cayor Distribution",
    monogram: "CD",
    color: "#a14f00",
    type: "company",
    country: "SN",
    website: "https://cayor-distribution.demo.kemetlabs.dev",
    description:
      "Distribution de produits d'épicerie à soixante boutiques, depuis trois dépôts autour de Thiès.",
    managerHandle: "mariam-diakite",
    posts: [
      {
        key: "cayor-erp",
        body:
          "Trois dépôts, soixante boutiques, et encore des cahiers. Nous cherchons une équipe pour notre ERP : " +
          "la mission est publiée sur notre page, les réponses arrivent jusqu'à la date limite.",
        format: null,
        daysAgo: 2,
      },
    ],
  },
  {
    handle: "code-des-collines",
    name: "Code des Collines",
    monogram: "CC",
    color: "#3949ab",
    type: "school",
    country: "RW",
    website: "https://code-des-collines.demo.kemetlabs.dev",
    description:
      "École de code à Kigali : développement web en six mois, cours en français et en anglais.",
    managerHandle: "wanjiru-kamau",
    posts: [
      {
        key: "collines-promo",
        body:
          "Notre prochaine promotion de développement web commence en janvier à Kigali : 24 places, " +
          "six mois, un projet réel par apprenant pour une association du quartier.",
        format: null,
        daysAgo: 4,
      },
      {
        key: "collines-question",
        body:
          "Question aux formatrices et formateurs : quel premier projet donnez-vous à des débutants " +
          "qui n'ont jamais ouvert un terminal ?",
        format: "question",
        daysAgo: 6,
      },
    ],
  },
];

export function demoOrganizationId(handle: string): string {
  return demoUuid(`organization:${handle}`);
}

/** Logo : le monogramme blanc sur la teinte, en vectoriel pour rester net à toute taille. */
export function monogramLogoDataUri(monogram: string, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${color}"/>` +
    `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" fill="#FFFFFF" ` +
    `font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700">${monogram}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export type OrganizationsSeedResult = {
  organizations: number;
  posts: number;
  skipped: string[];
};

/**
 * Crée ou remet à jour les organisations de démonstration, leur gestionnaire
 * et leurs posts. Relançable. Un identifiant déjà porté par un autre profil
 * (un vrai compte) est laissé tel quel, l'organisation est sautée.
 */
export async function seedDemoOrganizations(db: DbOrTx): Promise<OrganizationsSeedResult> {
  const result: OrganizationsSeedResult = { organizations: 0, posts: 0, skipped: [] };
  const managers = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(
      and(
        inArray(
          profiles.handle,
          DEMO_ORGANIZATIONS.map((organization) => organization.managerHandle),
        ),
        eq(profiles.isDemo, true),
      ),
    );
  const managerIdByHandle = new Map(managers.map((manager) => [manager.handle, manager.id]));

  for (const organization of DEMO_ORGANIZATIONS) {
    const id = demoOrganizationId(organization.handle);
    const [holder] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.handle, organization.handle), ne(profiles.id, id)));
    const managerId = managerIdByHandle.get(organization.managerHandle);
    if (holder || !managerId) {
      result.skipped.push(organization.handle);
      continue;
    }

    const fields = {
      kind: "organization" as const,
      organizationType: organization.type,
      userId: null,
      displayName: organization.name,
      country: organization.country,
      bio: organization.description,
      websiteUrl: organization.website,
      avatarUrl: monogramLogoDataUri(organization.monogram, organization.color),
      bannerUrl: null,
      openToOpportunities: false,
      helpsBeginners: false,
      isDemo: true,
      isFiller: false,
      isPlatformAdmin: false,
    };
    await db
      .insert(profiles)
      .values({ id, handle: organization.handle, onboardingCompletedAt: new Date(), ...fields })
      .onConflictDoUpdate({ target: profiles.id, set: fields });
    await db
      .insert(organizationManagers)
      .values({ organizationId: id, managerId })
      .onConflictDoNothing();

    const created = await db
      .insert(posts)
      .values(
        organization.posts.map((post) => ({
          id: demoUuid(`post:organization:${post.key}`),
          authorId: id,
          body: post.body,
          format: post.format,
          createdAt: daysAgo(post.daysAgo),
        })),
      )
      .onConflictDoNothing()
      .returning({ id: posts.id });
    result.organizations += 1;
    result.posts += created.length;
  }
  return result;
}
