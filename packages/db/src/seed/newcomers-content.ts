// Contenu de démonstration moins technique : recruteurs, entrepreneure,
// étudiants de première année et lycéens, questions de débutants, conseils de
// carrière, offres de stage. Toutes les personnes et entreprises sont fictives.

export interface NewcomerAccount {
  handle: string;
  name: string;
  country: string;
  role: "hr" | "entrepreneur" | "student";
  title: string;
  bio: string;
  stack: string[];
  interests: string[];
  intents: string[];
}

export const NEWCOMER_ACCOUNTS: NewcomerAccount[] = [
  {
    handle: "mariam-diakite",
    name: "Mariam Diakité",
    country: "ML",
    role: "hr",
    title: "Responsable recrutement, Sahel Talents",
    bio: "Je recrute des profils tech pour des PME de Bamako et de Dakar. Je lis tous les CV, même ceux en Comic Sans.",
    stack: [],
    interests: ["web", "data"],
    intents: ["recruit"],
  },
  {
    handle: "tunde-bakare",
    name: "Tunde Bakare",
    country: "NG",
    role: "hr",
    title: "Recruteur tech, Lagos Hire Lab",
    bio: "Huit ans à faire passer des entretiens techniques. Je préfère un projet fini à un diplôme de plus.",
    stack: [],
    interests: ["backend", "mobile"],
    intents: ["recruit"],
  },
  {
    handle: "wanjiru-kamau",
    name: "Wanjiru Kamau",
    country: "KE",
    role: "hr",
    title: "Chargée de recrutement, Savanna Works",
    bio: "Je cherche des développeurs, mais aussi des chefs de produit, du support et des rédacteurs qui comprennent la tech.",
    stack: [],
    interests: ["data", "design"],
    intents: ["recruit", "follow_community"],
  },
  {
    handle: "aissatou-barry",
    name: "Aïssatou Barry",
    country: "GN",
    role: "entrepreneur",
    title: "Fondatrice de Kobo Market",
    bio: "Je construis une place de marché pour les vendeuses de Madina. Je ne code pas, mais je sais lire un ticket Jira.",
    stack: [],
    interests: ["payments", "mobile"],
    intents: ["find_partner", "recruit"],
  },
  {
    handle: "yannick-mbarga",
    name: "Yannick Mbarga",
    country: "CM",
    role: "student",
    title: "Licence 1 informatique, Université de Yaoundé I",
    bio: "Première ligne de Python il y a huit mois. Je cherche un stage d'été pour voir une vraie équipe.",
    stack: ["Python", "HTML", "CSS"],
    interests: ["web"],
    intents: ["learn"],
  },
  {
    handle: "salma-haddad",
    name: "Salma Haddad",
    country: "TN",
    role: "student",
    title: "Première année de prépa intégrée, Sousse",
    bio: "J'apprends le C en cours et le Python le week-end. Je comprends tout avec des recettes de cuisine.",
    stack: ["C", "Python"],
    interests: ["ai"],
    intents: ["learn"],
  },
  {
    handle: "moussa-sow",
    name: "Moussa Sow",
    country: "SN",
    role: "student",
    title: "Lycéen, terminale scientifique",
    bio: "Je veux faire de l'informatique après le bac, mais je ne sais pas encore quoi exactement.",
    stack: [],
    interests: [],
    intents: ["learn"],
  },
  {
    handle: "nala-uwase",
    name: "Nala Uwase",
    country: "RW",
    role: "student",
    title: "Lycéenne, club de robotique",
    bio: "Mon robot suit une ligne noire. Parfois. Je prépare le concours de robotique du lycée.",
    stack: ["Arduino"],
    interests: ["embedded"],
    intents: ["learn", "follow_community"],
  },
];

/** Sujets des comptes de démonstration d'origine, qui n'en avaient aucun. */
export const DEMO_ACCOUNT_INTERESTS: Record<string, string[]> = {
  "coumba-thiam": ["backend", "payments"],
  "ebo-quansah": ["mobile"],
  "lyna-bouzid": ["devops", "security"],
  "dapo-oyelaran": ["web", "design"],
  "kgomotso-mahlangu": ["data"],
  "skander-jaziri": ["web", "backend"],
  "ahou-kouadio": ["games", "mobile"],
  "kiprono-langat": ["backend", "payments", "systems"],
  "ghizlane-amrani": ["ai", "data"],
  "heritier-kabeya": ["embedded", "networks"],
};

/** Comptes qui ont activé "Aide les débutants". */
export const DEMO_BEGINNER_HELPERS = ["coumba-thiam", "kiprono-langat", "lyna-bouzid", "dapo-oyelaran"];

/**
 * Liens des bibliothèques : uniquement des sites sur le domaine de
 * démonstration. Jamais de lien GitHub, GitLab ou LinkedIn, qui mènerait chez
 * une vraie personne portant peut-être ce nom.
 */
export const DEMO_PROFILE_LINKS: Record<string, { portfolioUrl?: string; websiteUrl?: string }> = {
  "coumba-thiam": { websiteUrl: "https://coumba-thiam.demo.kemetlabs.dev" },
  "ahou-kouadio": { portfolioUrl: "https://ahou-kouadio.demo.kemetlabs.dev/jeux" },
  "dapo-oyelaran": {
    portfolioUrl: "https://dapo-oyelaran.demo.kemetlabs.dev",
    websiteUrl: "https://dapo-oyelaran.demo.kemetlabs.dev/blog",
  },
  "ghizlane-amrani": { websiteUrl: "https://ghizlane-amrani.demo.kemetlabs.dev/corpus" },
  "kiprono-langat": { websiteUrl: "https://kiprono-langat.demo.kemetlabs.dev" },
  "yannick-mbarga": { portfolioUrl: "https://yannick-mbarga.demo.kemetlabs.dev" },
  "aissatou-barry": { websiteUrl: "https://kobo-market.demo.kemetlabs.dev" },
  "mariam-diakite": { websiteUrl: "https://sahel-talents.demo.kemetlabs.dev" },
};

/** CV de démonstration, fichiers seed-assets/out/cv-<identifiant>.pdf. */
export const DEMO_CVS: { handle: string; visibility: "public" | "members" }[] = [
  { handle: "coumba-thiam", visibility: "public" },
  { handle: "ahou-kouadio", visibility: "public" },
  { handle: "ghizlane-amrani", visibility: "members" },
  { handle: "yannick-mbarga", visibility: "public" },
];

export interface NewcomerSkill {
  key: string;
  authorHandle: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  content: string;
}

export const NEWCOMER_SKILLS: NewcomerSkill[] = [
  {
    key: "premier-langage",
    authorHandle: "kiprono-langat",
    slug: "choisir-son-premier-langage",
    name: "choisir-son-premier-langage",
    description: "Aider un débutant à choisir un premier langage selon ce qu'il veut construire, sans guerre de clochers.",
    tags: ["débutant", "orientation", "python", "javascript"],
    content:
      "Utiliser ce skill quand quelqu'un débute et demande par quel langage commencer.\n\n" +
      "Principes :\n" +
      "- Partir de ce que la personne veut construire, pas du langage à la mode.\n" +
      "- Site ou application web : HTML, CSS puis JavaScript.\n" +
      "- Automatiser, analyser des données, découvrir la programmation : Python.\n" +
      "- Application mobile : d'abord les bases d'un langage, puis Flutter (Dart) ou Kotlin.\n" +
      "- Robotique et objets : C avec une carte Arduino.\n" +
      "- Le premier langage compte moins que le premier projet terminé. Conseiller un petit projet utile " +
      "à son entourage, fini en deux à quatre semaines.\n" +
      "- Toujours rassurer : changer de langage plus tard est normal et rapide une fois les bases acquises.",
  },
  {
    key: "message-erreur",
    authorHandle: "lyna-bouzid",
    slug: "lire-un-message-d-erreur",
    name: "lire-un-message-d-erreur",
    description: "Apprendre à lire un message d'erreur pas à pas avant de chercher sur internet.",
    tags: ["débutant", "erreurs", "méthode"],
    content:
      "Utiliser ce skill quand un débutant colle un message d'erreur.\n\n" +
      "Méthode à expliquer :\n" +
      "1. Lire la dernière ligne d'abord : c'est souvent le type d'erreur et la cause.\n" +
      "2. Trouver dans la pile la première ligne qui vient de son propre fichier, avec son numéro de ligne.\n" +
      "3. Relire cette ligne et celle d'avant : faute de frappe, parenthèse, variable vide.\n" +
      "4. Chercher le type d'erreur avec le nom du langage, jamais le message entier avec ses chemins.\n" +
      "5. Expliquer ce que l'on a déjà essayé quand on demande de l'aide.\n\n" +
      "Exemple en Python :\n" +
      "```text\n" +
      "Traceback (most recent call last):\n" +
      '  File "moyenne.py", line 4, in <module>\n' +
      "    print(total / nombre)\n" +
      "ZeroDivisionError: division by zero\n" +
      "```\n" +
      "Ici, la ligne 4 divise par `nombre`, qui vaut zéro : la liste de notes est vide.",
  },
];

export interface NewcomerReply {
  key: string;
  authorHandle: string;
  body: string;
  hoursAgo: number;
}

export interface NewcomerAssistantReply {
  /** Réponse qui appelle @kemet. */
  trigger: NewcomerReply;
  /** Réponse enregistrée de @kemet, publiée sous le post. */
  answer: string;
  skillKey: string;
  helpful: boolean;
}

export interface NewcomerPost {
  key: string;
  authorHandle: string;
  body: string;
  hoursAgo: number;
  format?: "astuce" | "question";
  isBeginner?: boolean;
  replies?: NewcomerReply[];
  assistant?: NewcomerAssistantReply;
}

export const NEWCOMER_POSTS: NewcomerPost[] = [
  {
    key: "premier-langage",
    authorHandle: "yannick-mbarga",
    format: "question",
    isBeginner: true,
    hoursAgo: 30,
    body:
      "Question sûrement bête : par quel langage commencer ? Mon grand frère dit Java, mon prof dit C, " +
      "TikTok dit Python, et mon cousin dit que tout ça va être remplacé par l'IA de toute façon.",
    replies: [
      {
        key: "premier-langage-coumba",
        authorHandle: "coumba-thiam",
        hoursAgo: 28,
        body:
          "Pas bête du tout. Dis-nous ce que tu veux construire en premier : un site, une appli, un jeu ? " +
          "Le bon langage dépend de ça, pas de qui crie le plus fort.",
      },
      {
        key: "premier-langage-yannick",
        authorHandle: "yannick-mbarga",
        hoursAgo: 27,
        body: "Un site pour la cotisation de mon quartier, où chacun voit qui a payé.",
      },
      {
        key: "premier-langage-dapo",
        authorHandle: "dapo-oyelaran",
        hoursAgo: 26,
        body: "Alors HTML et CSS cette semaine, JavaScript la suivante. Ton cousin peut attendre.",
      },
    ],
    assistant: {
      skillKey: "premier-langage",
      helpful: true,
      trigger: {
        key: "premier-langage-salma",
        authorHandle: "salma-haddad",
        hoursAgo: 25,
        body: "@kemet tu peux résumer ce fil simplement pour quelqu'un qui débute ?",
      },
      answer:
        "Voici l'essentiel du fil :\n\n" +
        "- **Partir du projet** : Yannick veut un site pour la cotisation de son quartier.\n" +
        "- **Pour un site** : HTML et CSS d'abord (la structure et l'apparence), puis JavaScript pour " +
        "qu'il réagisse (afficher qui a payé, filtrer).\n" +
        "- **Le reste attend** : Java, C ou Python sont de bons langages, mais pour un autre projet.\n" +
        "- **Le plus important** : finir ce premier site, même petit. Le deuxième langage s'apprend ensuite " +
        "beaucoup plus vite.",
    },
  },
  {
    key: "maths-informatique",
    authorHandle: "moussa-sow",
    format: "question",
    isBeginner: true,
    hoursAgo: 50,
    body:
      "Je suis en terminale. Est-ce qu'il faut être très fort en maths pour faire de l'informatique ? " +
      "J'ai 11 en maths et je ne veux pas m'engager dans une filière où je vais souffrir pendant cinq ans.",
    replies: [
      {
        key: "maths-kiprono",
        authorHandle: "kiprono-langat",
        hoursAgo: 47,
        body:
          "J'avais 12. Ce qui compte surtout : la logique, la patience devant un problème, et l'envie de " +
          "comprendre pourquoi ça ne marche pas. Les maths lourdes servent dans certains domaines (IA, " +
          "graphisme 3D, cryptographie), pas dans tous.",
      },
      {
        key: "maths-ghizlane",
        authorHandle: "ghizlane-amrani",
        hoursAgo: 44,
        body: "Je fais de l'IA et j'ai réappris les probabilités à 24 ans. On rattrape, promis.",
      },
    ],
    assistant: {
      skillKey: "premier-langage",
      helpful: true,
      trigger: {
        key: "maths-moussa-kemet",
        authorHandle: "moussa-sow",
        hoursAgo: 42,
        body: "@kemet explique-moi simplement quels métiers de l'informatique demandent peu de maths",
      },
      answer:
        "Bonne question. Beaucoup de métiers demandent surtout de la logique et de la rigueur, pas des maths " +
        "avancées :\n\n" +
        "- **Développement web** (sites, applications) : surtout de la logique et de l'organisation.\n" +
        "- **Développement mobile** : pareil, avec du soin sur l'interface.\n" +
        "- **Administration système et réseaux** : de la méthode et beaucoup de curiosité.\n" +
        "- **Test et qualité logicielle** : de l'attention au détail.\n" +
        "- **Design d'interface** : du sens visuel et de l'écoute des utilisateurs.\n\n" +
        "Les maths comptent davantage en intelligence artificielle, en 3D ou en cryptographie, et elles " +
        "s'apprennent aussi en chemin, comme le disent Kiprono et Ghizlane dans ce fil.",
    },
  },
  {
    key: "api-petite-soeur",
    authorHandle: "coumba-thiam",
    format: "astuce",
    isBeginner: true,
    hoursAgo: 20,
    body:
      "Une API expliquée à ma petite sœur : au restaurant, tu ne vas pas en cuisine. Tu donnes ta commande " +
      "au serveur, il revient avec le plat. L'API, c'est le serveur. Le menu, c'est la documentation. " +
      "Et l'erreur 404, c'est quand tu commandes un plat qui n'existe pas.",
    replies: [
      {
        key: "api-salma",
        authorHandle: "salma-haddad",
        hoursAgo: 18,
        body: "Et l'erreur 500, c'est quand la cuisine prend feu ?",
      },
      {
        key: "api-coumba",
        authorHandle: "coumba-thiam",
        hoursAgo: 17,
        body: "Exactement. Et le 429, c'est le serveur qui te dit d'arrêter de commander toutes les deux secondes.",
      },
    ],
  },
  {
    key: "premier-cv",
    authorHandle: "kiprono-langat",
    format: "astuce",
    isBeginner: true,
    hoursAgo: 70,
    body:
      "Trois choses que je regarde dans un premier CV de développeur :\n\n" +
      "1. Un projet terminé, avec un lien qui marche. Même petit.\n" +
      "2. Ce que **toi** tu as fait dans un projet de groupe, en une phrase.\n" +
      "3. Une page, pas trois. Je lis vite, comme tout le monde.\n\n" +
      "Ce que je ne regarde pas : la barre de progression \"JavaScript 80 %\".",
    replies: [
      {
        key: "premier-cv-mariam",
        authorHandle: "mariam-diakite",
        hoursAgo: 66,
        body: "Côté RH, je confirme pour les barres de progression. 80 % de quoi, exactement ?",
      },
      {
        key: "premier-cv-yannick",
        authorHandle: "yannick-mbarga",
        hoursAgo: 60,
        body: "J'ai retiré les miennes et mis mon CV dans ma bibliothèque. Merci !",
      },
    ],
  },
  {
    key: "stage-bamako",
    authorHandle: "mariam-diakite",
    hoursAgo: 26,
    body:
      "Offre de stage : développeur ou développeuse web, six mois, à Bamako, pour une PME de distribution " +
      "que j'accompagne. Débutants bienvenus si vous avez un projet à montrer. Stage rémunéré, encadré par " +
      "une développeuse senior. Écrivez-moi en privé avec le lien de votre bibliothèque Kemet.",
    replies: [
      {
        key: "stage-bamako-nala",
        authorHandle: "nala-uwase",
        hoursAgo: 24,
        body: "Est-ce qu'il y a aussi des stages pour les lycéens, même juste une semaine d'observation ?",
      },
      {
        key: "stage-bamako-mariam",
        authorHandle: "mariam-diakite",
        hoursAgo: 23,
        body: "Pas pour celui-ci, mais je garde l'idée : plusieurs entreprises acceptent des stages d'observation.",
      },
    ],
  },
  {
    key: "entretien-recruteur",
    authorHandle: "tunde-bakare",
    hoursAgo: 40,
    body:
      "Ce qui fait la différence en entretien technique, vu de mon côté de la table :\n\n" +
      "- Penser à voix haute. Un silence de trois minutes, je ne peux rien en tirer.\n" +
      "- Dire \"je ne sais pas, mais je chercherais comme ça\". C'est une très bonne réponse.\n" +
      "- Poser une question sur l'équipe à la fin. Ceux qui n'en posent aucune m'inquiètent un peu.",
  },
  {
    key: "entretien-rate",
    authorHandle: "ahou-kouadio",
    isBeginner: true,
    hoursAgo: 90,
    body:
      "Mon premier entretien technique : on me demande d'inverser une chaîne de caractères. Je panique, " +
      "j'écris une boucle de 25 lignes, elle ne marche pas. Le recruteur me dit gentiment qu'en C# il y a " +
      "`Reverse()`. J'ai eu le poste trois entretiens plus tard. Ce que j'en retiens : on a le droit de rater " +
      "le premier.",
    replies: [
      {
        key: "entretien-rate-tunde",
        authorHandle: "tunde-bakare",
        hoursAgo: 85,
        body: "Et la prochaine fois, dis que tu connais `Reverse()` mais que tu montres la boucle pour le plaisir.",
      },
    ],
  },
  {
    key: "kobo-recrute",
    authorHandle: "aissatou-barry",
    hoursAgo: 15,
    body:
      "Kobo Market cherche deux personnes pour rejoindre l'aventure : un développeur ou une développeuse " +
      "mobile Flutter, et une personne data à temps partiel pour comprendre ce que vendent nos 300 " +
      "vendeuses de Madina. Je ne suis pas technique, alors je promets des specs claires et des réunions " +
      "courtes. Le projet et les rôles sont sur ma bibliothèque.",
    replies: [
      {
        key: "kobo-ebo",
        authorHandle: "ebo-quansah",
        hoursAgo: 12,
        body: "Les vendeuses ont surtout des Android d'entrée de gamme ? Ça change beaucoup de choses pour l'appli.",
      },
      {
        key: "kobo-aissatou",
        authorHandle: "aissatou-barry",
        hoursAgo: 11,
        body: "Oui, et des forfaits de 1 Go par semaine. C'est exactement le genre de question que je cherche.",
      },
    ],
  },
  {
    key: "boucles-couscous",
    authorHandle: "salma-haddad",
    isBeginner: true,
    hoursAgo: 60,
    body:
      "J'ai enfin compris les boucles grâce au couscous de ma grand-mère :\n\n" +
      "```python\n" +
      "for invite in invites:\n" +
      "    servir(invite)\n" +
      "while marmite_pas_vide():\n" +
      "    resservir_tout_le_monde()\n" +
      "```\n\n" +
      "Le `while` ne s'arrête jamais chez elle. Boucle infinie confirmée.",
    replies: [
      {
        key: "boucles-lyna",
        authorHandle: "lyna-bouzid",
        hoursAgo: 58,
        body: "Ajoute un `break` quand tu dis \"je n'ai plus faim\". Il sera ignoré, mais c'est une bonne pratique.",
      },
    ],
  },
  {
    key: "robot-ligne",
    authorHandle: "nala-uwase",
    isBeginner: true,
    hoursAgo: 35,
    body:
      "Mon robot suiveur de ligne marche ! Enfin, il suit la ligne noire… et aussi l'ombre de la table, " +
      "et mes chaussures. Quelqu'un sait comment régler la sensibilité des capteurs infrarouges sur Arduino ?",
    replies: [
      {
        key: "robot-heritier",
        authorHandle: "heritier-kabeya",
        hoursAgo: 33,
        body:
          "Lis la valeur brute des capteurs sur la ligne et à côté, puis prends le milieu comme seuil. Et " +
          "éloigne tes chaussures pendant le concours.",
      },
    ],
  },
  {
    key: "metiers-non-tech",
    authorHandle: "wanjiru-kamau",
    hoursAgo: 55,
    body:
      "Rappel pour celles et ceux qui pensent que la tech, c'est seulement coder : on recrute aussi des " +
      "chefs de produit, du support client, des rédacteurs techniques et des designers. Comprendre comment " +
      "un logiciel est fabriqué est déjà un vrai atout. Je partage nos postes ouverts cette semaine.",
  },
  {
    key: "ca-marche-pas",
    authorHandle: "dapo-oyelaran",
    hoursAgo: 45,
    body:
      "Le débutant : \"ça marche pas\".\n" +
      "Le senior : \"ça marche pas, mais différemment depuis ce matin\".\n" +
      "Le lead : \"ça marchait chez moi\".",
    replies: [
      {
        key: "ca-marche-pas-moussa",
        authorHandle: "moussa-sow",
        hoursAgo: 40,
        body: "Je suis encore au niveau 1, mais je sens que j'ai de l'avenir.",
      },
    ],
  },
  {
    key: "git-cahier",
    authorHandle: "lyna-bouzid",
    format: "astuce",
    isBeginner: true,
    hoursAgo: 80,
    body:
      "Git expliqué avec un cahier de brouillon :\n\n" +
      "- `git add`, c'est choisir les pages à garder.\n" +
      "- `git commit`, c'est photocopier ces pages et noter la date.\n" +
      "- `git push`, c'est déposer la photocopie chez un ami, au cas où ton cahier tombe dans la flaque.\n\n" +
      "Et `git push --force`, c'est remplacer les photocopies de ton ami sans lui demander. Évite.",
  },
  {
    key: "alternance-data",
    authorHandle: "tunde-bakare",
    hoursAgo: 100,
    body:
      "Alternance data d'un an pour une fintech de Lagos, sur place ou à distance depuis l'Afrique de l'Ouest. " +
      "SQL de base demandé, Python apprécié. Je regarde les bibliothèques Kemet avant les CV : montrez un " +
      "tableau de bord, même sur les dépenses de votre colocation.",
  },
];

export interface BeginnerSpaceMessage {
  key: string;
  channelId: string;
  authorHandle: string;
  body: string;
  hoursAgo: number;
}

const QUESTIONS = "00000000-0000-0000-0000-000000000031";
const ORIENTATION = "00000000-0000-0000-0000-000000000032";
const FIRST_PROJECTS = "00000000-0000-0000-0000-000000000033";

export const BEGINNER_SPACE_MEMBERS = [
  ...NEWCOMER_ACCOUNTS.filter((account) => account.role === "student").map((account) => account.handle),
  ...DEMO_BEGINNER_HELPERS,
  "ahou-kouadio",
  "mariam-diakite",
];

export const BEGINNER_SPACE_MESSAGES: BeginnerSpaceMessage[] = [
  {
    key: "q1",
    channelId: QUESTIONS,
    authorHandle: "moussa-sow",
    hoursAgo: 52,
    body: "C'est quoi la différence entre un langage de programmation et un logiciel ?",
  },
  {
    key: "q2",
    channelId: QUESTIONS,
    authorHandle: "lyna-bouzid",
    hoursAgo: 51,
    body:
      "Le langage, c'est la langue dans laquelle on écrit les instructions. Le logiciel, c'est le livre " +
      "écrit dans cette langue. WhatsApp est un logiciel, écrit en plusieurs langages.",
  },
  {
    key: "q3",
    channelId: QUESTIONS,
    authorHandle: "salma-haddad",
    hoursAgo: 30,
    body: "Mon programme C affiche « Segmentation fault ». Je dois m'inquiéter pour mon ordinateur ?",
  },
  {
    key: "q4",
    channelId: QUESTIONS,
    authorHandle: "coumba-thiam",
    hoursAgo: 29,
    body:
      "Non, ton ordinateur va très bien. Ton programme a voulu lire une case de mémoire qui ne lui " +
      "appartient pas, souvent un tableau lu trop loin. Colle la ligne qui plante, on regarde ensemble.",
  },
  {
    key: "o1",
    channelId: ORIENTATION,
    authorHandle: "nala-uwase",
    hoursAgo: 70,
    body: "Après le bac, vaut-il mieux une licence à l'université ou une école d'ingénieurs pour faire de la robotique ?",
  },
  {
    key: "o2",
    channelId: ORIENTATION,
    authorHandle: "kiprono-langat",
    hoursAgo: 68,
    body:
      "Les deux mènent à la robotique. L'école est plus encadrée, l'université laisse plus de liberté et " +
      "coûte souvent moins cher. Regarde surtout s'il y a un club ou un labo de robotique : c'est là que " +
      "tu apprendras le plus.",
  },
  {
    key: "o3",
    channelId: ORIENTATION,
    authorHandle: "mariam-diakite",
    hoursAgo: 66,
    body: "Et côté recrutement, on regarde d'abord ce que tu as construit. Le nom de l'école vient après.",
  },
  {
    key: "p1",
    channelId: FIRST_PROJECTS,
    authorHandle: "yannick-mbarga",
    hoursAgo: 22,
    body: "Mon site de cotisation du quartier est en ligne ! Une seule page, mais mon oncle l'a déjà partagé.",
  },
  {
    key: "p2",
    channelId: FIRST_PROJECTS,
    authorHandle: "dapo-oyelaran",
    hoursAgo: 21,
    body: "Bravo. Prochaine étape : un formulaire pour que le trésorier coche qui a payé sans t'appeler.",
  },
  {
    key: "p3",
    channelId: FIRST_PROJECTS,
    authorHandle: "salma-haddad",
    hoursAgo: 10,
    body: "Idée de premier projet : une appli qui compte les tours de resservice chez ma grand-mère. Données réelles garanties.",
  },
];

export const KOBO_PROJECT = {
  ownerHandle: "aissatou-barry",
  slug: "kobo-market",
  name: "Kobo Market",
  pitch: "Une place de marché mobile pour les vendeuses de Madina, pensée pour les petits forfaits.",
  description:
    "Les vendeuses publient leurs produits en photo, les clientes commandent et paient par mobile money. " +
    "Version actuelle : un groupe WhatsApp et un tableur. Objectif : une appli Flutter légère, utilisable " +
    "avec 1 Go par semaine.",
  repoUrl: "https://code.demo.kemetlabs.dev/aissatou-barry/kobo-market",
  stack: ["Flutter", "Node.js", "PostgreSQL"],
  helpRequests: [
    {
      key: "kobo-mobile",
      kind: "collaboration" as const,
      title: "Développeur ou développeuse mobile Flutter",
      description: "Construire l'appli des vendeuses : catalogue en photo, commandes, mode hors ligne.",
      stack: ["Flutter", "Dart"],
    },
    {
      key: "kobo-data",
      kind: "collaboration" as const,
      title: "Personne data à temps partiel",
      description: "Comprendre ce qui se vend, quand et à qui, à partir de six mois de tableur.",
      stack: ["SQL", "Python"],
    },
  ],
};
