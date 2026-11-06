import type { DbOrTx } from "../client.js";
import { competitions, teamMembers, teams } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { daysAgo, daysFromNow } from "./time.js";

type AccountKey = keyof DemoAccountIds;

/** Placé en tête de chaque description : ces compétitions n'ont jamais eu lieu. */
export const EXAMPLE_COMPETITION_NOTE =
  "*Compétition d'exemple, créée pour la démonstration de Kemet. Ses dates sont calculées à partir du jour où les données de démonstration ont été chargées.*";

interface FunCompetition {
  slug: string;
  name: string;
  pitch: string;
  rules: string;
  createdBy: AccountKey;
  createdDaysAgo: number;
  registrationClosesInDays: number;
  teams: { name: string; captain: AccountKey; members: AccountKey[] }[];
}

// Toutes ouvertes aux inscriptions : aucune soumission ni aucun vote inventé.
const FUN_COMPETITIONS: FunCompetition[] = [
  {
    slug: "site-le-plus-moche-css",
    name: "Le site le plus moche du continent",
    pitch: "Une page HTML et CSS volontairement affreuse, mais qui reste accessible au clavier.",
    rules:
      "Le jury note la laideur assumée, le public vote pour le site qui lui fait le plus mal aux yeux. " +
      "Une seule règle sérieuse : la page doit rester utilisable au clavier et lisible par un lecteur d'écran. " +
      "Moche, oui. Inaccessible, non.",
    createdBy: "dapoOyelaran",
    createdDaysAgo: 4,
    registrationClosesInDays: 12,
    teams: [
      { name: "Comic Sans Forever", captain: "dapoOyelaran", members: ["ahouKouadio"] },
      { name: "Marquee Revival", captain: "skanderJaziri", members: [] },
    ],
  },
  {
    slug: "dessin-css-une-seule-div",
    name: "Un dessin en CSS, une seule div",
    pitch:
      "Un baobab, un taxi-brousse ou un plat de thieb, avec une seule balise div et autant de CSS que tu veux.",
    rules:
      "Une seule `<div>` dans le corps de la page, aucun SVG, aucune image. Les pseudo-éléments et les dégradés " +
      "sont permis.\n\n" +
      "```html\n" +
      "<body>\n" +
      '  <div class="baobab"></div>\n' +
      "</body>\n" +
      "```",
    createdBy: "ahouKouadio",
    createdDaysAgo: 6,
    registrationClosesInDays: 9,
    teams: [{ name: "Box-shadow Gang", captain: "ahouKouadio", members: [] }],
  },
  {
    slug: "readme-le-plus-drole",
    name: "Le README le plus drôle",
    pitch: "Un README qui fait rire et qui explique quand même comment lancer le projet.",
    rules:
      "Le README doit contenir une vraie section d'installation qui marche. Le jury l'essaie. " +
      "Un README drôle qui ne dit pas comment lancer le projet est éliminé, comme dans la vraie vie.",
    createdBy: "skanderJaziri",
    createdDaysAgo: 3,
    registrationClosesInDays: 14,
    teams: [
      { name: "Works On My Machine", captain: "lynaBouzid", members: ["kgomotsoMahlangu"] },
      { name: "TODO: nom d'équipe", captain: "heritierKabeya", members: [] },
    ],
  },
  {
    slug: "bug-de-l-annee",
    name: "Le bug de l'année",
    pitch:
      "Raconte le bug le plus absurde que tu aies corrigé, avec la ligne fautive et ce qu'elle t'a appris.",
    rules:
      "Une histoire vraie, en moins de 500 mots, avec la correction. Aucune donnée de client ni secret dans le récit. " +
      "Le public vote pour l'histoire qu'il aurait le moins voulu vivre.",
    createdBy: "kipronoLangat",
    createdDaysAgo: 2,
    registrationClosesInDays: 16,
    teams: [{ name: "Fuseau Horaire", captain: "kipronoLangat", members: [] }],
  },
  {
    slug: "code-golf-fizzbuzz",
    name: "Code golf : FizzBuzz",
    pitch: "Le FizzBuzz le plus court, dans le langage de ton choix, classé par langage.",
    rules:
      "Le programme affiche les nombres de 1 à 100, Fizz pour les multiples de 3, Buzz pour ceux de 5, FizzBuzz pour les deux. " +
      "Le nombre d'octets du fichier source fait foi.\n\n" +
      "```python\n" +
      'for i in range(1,101):print("Fizz"*(i%3<1)+"Buzz"*(i%5<1)or i)\n' +
      "```\n\n" +
      "Cet exemple fait 62 octets. À battre.",
    createdBy: "eboQuansah",
    createdDaysAgo: 5,
    registrationClosesInDays: 11,
    teams: [
      { name: "Un Octet De Moins", captain: "eboQuansah", members: [] },
      { name: "Regex Ninjas", captain: "ghizlaneAmrani", members: ["coumbaThiam"] },
    ],
  },
];

/** Cinq compétitions légères, en inscription, marquées comme exemples. */
export async function createFunCompetitions(db: DbOrTx, ids: DemoAccountIds): Promise<void> {
  for (const demo of FUN_COMPETITIONS) {
    const registrationClosesInDays = demo.registrationClosesInDays;
    const [competition] = await db
      .insert(competitions)
      .values({
        createdBy: ids[demo.createdBy],
        reviewedBy: ids.coumbaThiam,
        status: "published",
        slug: demo.slug,
        name: demo.name,
        pitch: demo.pitch,
        description: `${EXAMPLE_COMPETITION_NOTE}\n\n${demo.rules}`,
        registrationClosesAt: daysFromNow(registrationClosesInDays),
        submissionClosesAt: daysFromNow(registrationClosesInDays + 7),
        votingClosesAt: daysFromNow(registrationClosesInDays + 14),
        createdAt: daysAgo(demo.createdDaysAgo),
      })
      .returning({ id: competitions.id });
    const competitionId = competition!.id;
    for (const team of demo.teams) {
      const [row] = await db
        .insert(teams)
        .values({ competitionId, captainId: ids[team.captain], name: team.name })
        .returning({ id: teams.id });
      await db
        .insert(teamMembers)
        .values(
          [team.captain, ...team.members].map((key) => ({
            teamId: row!.id,
            competitionId,
            profileId: ids[key],
          })),
        );
    }
  }
}
