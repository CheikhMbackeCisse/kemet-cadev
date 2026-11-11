// Offres de démonstration. Organisations inventées pour Kemet : aucune
// entreprise réelle, aucun logo. Dates relatives au jour du seed, pour que
// les offres restent ouvertes à la démo.

export interface DemoOpportunity {
  key: string;
  slug: string;
  authorHandle: string;
  kind: "job" | "internship" | "mission";
  title: string;
  organization: string;
  remote: boolean;
  countryCode: string | null;
  city: string | null;
  domains: string[];
  description: string;
  contractType: "cdi" | "cdd" | "alternance" | "stage" | "freelance" | null;
  startInDays: number | null;
  compensationFcfa: number | null;
  budgetMinFcfa: number | null;
  budgetMaxFcfa: number | null;
  deadlineInDays: number | null;
  criteria: string[];
  postedDaysAgo: number;
}

const job = { budgetMinFcfa: null, budgetMaxFcfa: null, criteria: [] };
const mission = { contractType: null, startInDays: null, compensationFcfa: null };

export const DEMO_OPPORTUNITIES: DemoOpportunity[] = [
  {
    ...mission,
    key: "erp-thies",
    slug: "erp-distribution-thies",
    authorHandle: "mariam-diakite",
    kind: "mission",
    title: "ERP pour une PME de distribution",
    organization: "Distribution Ndiaye et Fils",
    remote: false,
    countryCode: "SN",
    city: "Thiès",
    domains: ["web", "data"],
    description:
      "Nous distribuons des produits d'épicerie à une soixantaine de boutiques depuis trois dépôts, à Thiès, Tivaouane et Mbour. " +
      "Tout se suit aujourd'hui dans des cahiers et un fichier Excel partagé.\n\n" +
      "**Ce que nous attendons**\n\n" +
      "- Stocks par dépôt, avec les transferts entre dépôts.\n" +
      "- Ventes et factures, paiement comptant, à crédit ou par Wave.\n" +
      "- Un écran simple sur téléphone pour les livreurs.\n" +
      "- Un tableau de bord du jour pour le gérant.\n\n" +
      "Livraison en deux étapes : stocks et ventes d'abord, tableau de bord ensuite. Formation de quatre personnes comprise.",
    budgetMinFcfa: 3_000_000,
    budgetMaxFcfa: 6_000_000,
    deadlineInDays: 18,
    criteria: [
      "Une référence d'ERP ou de gestion commerciale déjà livrée",
      "Disponible à Thiès une journée par semaine pendant le déploiement",
      "Maintenance proposée sur douze mois",
    ],
    postedDaysAgo: 2,
  },
  {
    ...job,
    key: "backend-dakar",
    slug: "developpeur-backend-nodejs-dakar",
    authorHandle: "mariam-diakite",
    kind: "job",
    title: "Développeuse ou développeur backend Node.js",
    organization: "Baobab Logistique",
    remote: false,
    countryCode: "SN",
    city: "Dakar",
    domains: ["backend"],
    description:
      "Baobab Logistique suit chaque jour 4 000 colis entre Dakar et les régions. Notre API de suivi tient, mais elle a grandi vite.\n\n" +
      "**Ton travail**\n\n" +
      "- Reprendre l'API Node.js (Fastify, PostgreSQL) et ses tests.\n" +
      "- Brancher les notifications SMS et WhatsApp des destinataires.\n" +
      "- Relire le code des deux juniors de l'équipe.\n\n" +
      "Trois ans d'expérience sur une API en production. Équipe de six, bureaux aux Almadies.",
    contractType: "cdi",
    startInDays: 30,
    compensationFcfa: 900_000,
    deadlineInDays: null,
    postedDaysAgo: 1,
  },
  {
    ...job,
    key: "stage-react-dakar",
    slug: "stage-developpement-web-react",
    authorHandle: "mariam-diakite",
    kind: "internship",
    title: "Stage développement web React",
    organization: "Studio Téranga Numérique",
    remote: false,
    countryCode: "SN",
    city: "Dakar",
    domains: ["web"],
    description:
      "Petit studio de six personnes qui fait des sites et des applications pour des associations et des PME.\n\n" +
      "Tu travailles sur un vrai projet client dès la deuxième semaine, avec une développeuse senior qui relit ton code. " +
      "Six mois, ouvert aux étudiantes et étudiants de licence 3 ou de master.",
    contractType: "stage",
    startInDays: 40,
    compensationFcfa: 150_000,
    deadlineInDays: 25,
    postedDaysAgo: 3,
  },
  {
    ...job,
    key: "alternance-data-bamako",
    slug: "alternance-data-analyst-bamako",
    authorHandle: "mariam-diakite",
    kind: "job",
    title: "Alternance data analyst",
    organization: "Mutuelle Kôrô Finance",
    remote: false,
    countryCode: "ML",
    city: "Bamako",
    domains: ["data"],
    description:
      "Une mutuelle de microcrédit qui suit 12 000 membres. Nous voulons enfin lire nos remboursements autrement que dans des tableaux croisés.\n\n" +
      "- SQL et un peu de Python.\n" +
      "- Tableaux de bord pour les agences.\n" +
      "- Rythme : trois semaines en entreprise, une semaine en formation.",
    contractType: "alternance",
    startInDays: 60,
    compensationFcfa: 200_000,
    deadlineInDays: 35,
    postedDaysAgo: 4,
  },
  {
    ...job,
    key: "flutter-lagos",
    slug: "developpeur-mobile-flutter-lagos",
    authorHandle: "tunde-bakare",
    kind: "job",
    title: "Développeuse ou développeur mobile Flutter",
    organization: "Lagoon Courses",
    remote: false,
    countryCode: "NG",
    city: "Lagos",
    domains: ["mobile"],
    description:
      "Application de livraison de courses pour Lagos Island et Lekki, 30 000 commandes par mois.\n\n" +
      "Tu prends en main l'application des livreurs : mode hors ligne, suivi GPS qui ménage la batterie, paiement à la livraison. " +
      "Deux ans de Flutter en production demandés, anglais courant.",
    contractType: "cdi",
    startInDays: 21,
    compensationFcfa: null,
    deadlineInDays: null,
    postedDaysAgo: 2,
  },
  {
    ...job,
    key: "qa-lagos",
    slug: "ingenieur-qa-lagos",
    authorHandle: "tunde-bakare",
    kind: "job",
    title: "Ingénieure ou ingénieur qualité logicielle",
    organization: "Ìrìn Freight",
    remote: true,
    countryCode: null,
    city: null,
    domains: ["testing"],
    description:
      "Nous cherchons la personne qui écrira les premiers tests de bout en bout de notre plateforme de fret.\n\n" +
      "- Playwright ou Cypress.\n" +
      "- Une campagne de tests avant chaque mise en production.\n" +
      "- Travail à distance, deux jours par trimestre à Lagos.",
    contractType: "cdd",
    startInDays: 14,
    compensationFcfa: null,
    deadlineInDays: 30,
    postedDaysAgo: 6,
  },
  {
    ...job,
    key: "sysadmin-nairobi",
    slug: "administrateur-systemes-reseaux-nairobi",
    authorHandle: "wanjiru-kamau",
    kind: "job",
    title: "Administratrice ou administrateur systèmes et réseaux",
    organization: "Afya Lab Diagnostics",
    remote: false,
    countryCode: "KE",
    city: "Nairobi",
    domains: ["devops", "networks"],
    description:
      "Réseau de quatre laboratoires d'analyses médicales. Serveurs sur place, sauvegardes, postes des techniciens et liaison entre les sites.\n\n" +
      "Astreinte une semaine sur trois. Expérience Linux et pare-feu demandée.",
    contractType: "cdi",
    startInDays: 30,
    compensationFcfa: null,
    deadlineInDays: null,
    postedDaysAgo: 5,
  },
  {
    ...job,
    key: "stage-data-remote",
    slug: "stage-data-tableaux-de-bord",
    authorHandle: "wanjiru-kamau",
    kind: "internship",
    title: "Stage data et tableaux de bord",
    organization: "Savanna Works",
    remote: true,
    countryCode: null,
    city: null,
    domains: ["data"],
    description:
      "Stage de quatre mois à distance dans notre équipe données. Tu construis les tableaux de bord de suivi des candidatures pour nos clients.\n\n" +
      "Python, SQL et l'envie d'expliquer un graphique à quelqu'un qui n'en lit jamais.",
    contractType: "stage",
    startInDays: 20,
    compensationFcfa: 100_000,
    deadlineInDays: 12,
    postedDaysAgo: 1,
  },
  {
    ...job,
    key: "designer-conakry",
    slug: "designer-produit-temps-partiel-conakry",
    authorHandle: "aissatou-barry",
    kind: "job",
    title: "Designer produit à temps partiel",
    organization: "Kobo Market",
    remote: false,
    countryCode: "GN",
    city: "Conakry",
    domains: ["design", "mobile"],
    description:
      "Kobo Market met en ligne les vendeuses du marché de Madina. Beaucoup lisent peu : chaque écran doit se comprendre avec des images.\n\n" +
      "Deux jours par semaine, dont une matinée au marché avec elles.",
    contractType: "freelance",
    startInDays: 10,
    compensationFcfa: 350_000,
    deadlineInDays: null,
    postedDaysAgo: 3,
  },
  {
    ...mission,
    key: "caisse-conakry",
    slug: "application-caisse-mobile-vendeuses",
    authorHandle: "aissatou-barry",
    kind: "mission",
    title: "Application de caisse sur téléphone pour les vendeuses",
    organization: "Kobo Market",
    remote: false,
    countryCode: "GN",
    city: "Conakry",
    domains: ["mobile", "payments"],
    description:
      "Une caisse sur un téléphone Android d'entrée de gamme : ventes du jour, crédit des clientes, paiement Orange Money.\n\n" +
      "Elle doit marcher sans réseau une journée entière et se synchroniser le soir.",
    budgetMinFcfa: 1_500_000,
    budgetMaxFcfa: 2_500_000,
    deadlineInDays: 15,
    criteria: ["Une application Android publiée", "Expérience du mode hors ligne", "Disponible pour deux visites au marché"],
    postedDaysAgo: 2,
  },
  {
    ...mission,
    key: "hotel-ziguinchor",
    slug: "site-reservation-hotel-ziguinchor",
    authorHandle: "mariam-diakite",
    kind: "mission",
    title: "Site et réservation en ligne pour un hôtel",
    organization: "Hôtel Les Palétuviers",
    remote: true,
    countryCode: null,
    city: null,
    domains: ["web"],
    description:
      "Hôtel de quatorze chambres en Casamance. Nous voulons un site en français et en anglais, avec les disponibilités et un acompte en ligne.",
    budgetMinFcfa: 800_000,
    budgetMaxFcfa: 1_200_000,
    deadlineInDays: 10,
    criteria: ["Trois sites livrés à montrer", "Formation de la réception à la mise à jour des chambres"],
    postedDaysAgo: 5,
  },
  {
    ...job,
    key: "stage-securite-abidjan",
    slug: "stage-cybersecurite-abidjan",
    authorHandle: "tunde-bakare",
    kind: "internship",
    title: "Stage cybersécurité",
    organization: "Lagune Cloud Services",
    remote: false,
    countryCode: "CI",
    city: "Abidjan",
    domains: ["security"],
    description:
      "Hébergeur local pour des PME ivoiriennes. Tu participes aux tests d'intrusion internes et à la rédaction des procédures de réponse aux incidents.",
    contractType: "stage",
    startInDays: 25,
    compensationFcfa: 120_000,
    deadlineInDays: -2,
    postedDaysAgo: 20,
  },
];
