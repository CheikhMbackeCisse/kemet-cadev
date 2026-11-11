import { assistantRecordingTrigger, WAVE_WEBHOOK_RECORDING } from "../assistant-recordings.js";

/**
 * Question Wave en tête du fil "Pour toi" d'un visiteur, avec la réponse
 * enregistrée de @kemet dépliée dessous. Comme dans l'application, @kemet est
 * appelé par une réponse au post, jamais par le post seul (ADR 0033).
 */
export const WAVE_SHOWCASE = {
  key: "wave-webhook-question",
  recording: WAVE_WEBHOOK_RECORDING,
  authorHandle: "heritier-kabeya",
  hoursAgo: 5,
  body:
    "Je branche les paiements Wave sur une API Node.js. Les notifications arrivent bien sur mon " +
    "endpoint, mais comment vérifier qu'elles viennent vraiment de Wave ?",
  trigger: assistantRecordingTrigger(WAVE_WEBHOOK_RECORDING),
  hearts: 34,
  replies: [
    {
      key: "coumba-raw-body",
      authorHandle: "coumba-thiam",
      minutesAfter: 18,
      body:
        "Avec Fastify, ajoute un parser de contenu qui garde le Buffer pour cette route : sinon le " +
        "corps est déjà reformaté et la signature ne correspond jamais.",
    },
    {
      key: "kiprono-idempotence",
      authorHandle: "kiprono-langat",
      minutesAfter: 41,
      body:
        "Garde aussi l'identifiant de chaque notification reçue : Wave peut renvoyer la même " +
        "plusieurs fois, ton traitement doit pouvoir la recevoir deux fois sans rien doubler.",
    },
    {
      key: "heritier-thanks",
      authorHandle: "heritier-kabeya",
      minutesAfter: 75,
      body: "C'était bien le corps reformaté par le parser JSON. Ça passe maintenant, merci.",
    },
  ],
} as const;

export interface ShowcaseReply {
  key: string;
  authorHandle: string;
  /** Minutes après le post. */
  minutesAfter: number;
  body: string;
}

/**
 * Les quatre posts qui suivent la question Wave dans le fil "Pour toi" d'un
 * visiteur : retrouvés par leur auteur et le début de leur texte, ils
 * reçoivent quelques réponses et des cœurs pour ne pas paraître vides.
 */
export const FEED_TOP_POSTS: {
  key: string;
  authorHandle: string;
  bodyStart: string;
  hearts: number;
  replies: ShowcaseReply[];
}[] = [
  {
    key: "darija-prototype",
    authorHandle: "ghizlane-amrani",
    bodyStart: "Premier prototype d'un modèle de recommandation en arabe dialectal",
    hearts: 22,
    replies: [
      {
        key: "skander-tunisian",
        authorHandle: "skander-jaziri",
        minutesAfter: 35,
        body:
          "Testé avec des phrases en darija tunisienne : les mots empruntés au français passent bien, " +
          "mais « barcha » est pris pour un nom propre.",
      },
      {
        key: "kgomotso-per-dialect",
        authorHandle: "kgomotso-mahlangu",
        minutesAfter: 80,
        body: "Tu as un jeu de test par dialecte ? Une moyenne globale cacherait vite qu'un des dialectes décroche.",
      },
      {
        key: "ghizlane-next",
        authorHandle: "ghizlane-amrani",
        minutesAfter: 140,
        body: "Pas encore, c'est la prochaine étape. Merci pour « barcha », je l'ajoute aux exemples.",
      },
    ],
  },
  {
    key: "docker-watchdog",
    authorHandle: "lyna-bouzid",
    bodyStart: "J'ai écrit un petit outil qui détecte les builds Docker",
    hearts: 18,
    replies: [
      {
        key: "kgomotso-caught",
        authorHandle: "kgomotso-mahlangu",
        minutesAfter: 50,
        body:
          "Branché sur notre CI ce matin : il a repéré un build qui montait à 6,8 Go au lieu des 3 Go " +
          "habituels. Aucun faux positif sur nos jobs de tests.",
      },
      {
        key: "ebo-self-hosted",
        authorHandle: "ebo-quansah",
        minutesAfter: 95,
        body: "Il marche aussi sur un runner auto-hébergé, ou seulement sur ceux de GitHub ?",
      },
      {
        key: "lyna-both",
        authorHandle: "lyna-bouzid",
        minutesAfter: 120,
        body: "Sur les deux : il lit la mémoire avec docker stats, pas par l'API de GitHub.",
      },
    ],
  },
  {
    key: "fastify-pool",
    authorHandle: "coumba-thiam",
    bodyStart: "Astuce Fastify + PostgreSQL",
    hearts: 15,
    replies: [
      {
        key: "heritier-tests",
        authorHandle: "heritier-kabeya",
        minutesAfter: 60,
        body:
          "Ça explique les connexions qui s'accumulaient pendant nos tests d'intégration. Je passe tout " +
          "sur une instance partagée.",
      },
      {
        key: "dapo-max",
        authorHandle: "dapo-oyelaran",
        minutesAfter: 150,
        body:
          "Et garde `max` sous la limite de Postgres divisée par le nombre d'instances de l'API, sinon " +
          "le problème revient au premier passage à deux instances.",
      },
    ],
  },
  {
    key: "server-timestamps",
    authorHandle: "kiprono-langat",
    bodyStart: "Sur un système de paiement mobile, résoudre",
    hearts: 11,
    replies: [
      {
        key: "coumba-wave",
        authorHandle: "coumba-thiam",
        minutesAfter: 45,
        body:
          "Même constat avec Wave. On ajoute une clé d'idempotence générée par le téléphone : l'heure " +
          "vient du serveur, l'unicité vient du client.",
      },
      {
        key: "ahou-retention",
        authorHandle: "ahou-kouadio",
        minutesAfter: 110,
        body: "Vous gardez les clés d'idempotence combien de temps ? Chez nous, 24 heures ont suffi.",
      },
    ],
  },
];

export interface ShowcaseSubmission {
  /** Équipe existante du seed, ou créée ici si elle manque. */
  team: string;
  captainHandle: string;
  memberHandles: string[];
  projectSlug: string;
  title: string;
  pitch: string;
  description: string;
}

/**
 * Compétitions d'exemple passées en phase de soumission, avec des projets
 * soumis. Le Hackathon Paiements Résilients reste en inscription : une
 * compétition doit rester ouverte aux équipes pour qui veut essayer.
 */
export const SHOWCASE_SUBMISSIONS: {
  competitionSlug: string;
  submissionClosesInDays: number;
  submissions: ShowcaseSubmission[];
}[] = [
  {
    competitionSlug: "site-le-plus-moche-css",
    submissionClosesInDays: 6,
    submissions: [
      {
        team: "Comic Sans Forever",
        captainHandle: "dapo-oyelaran",
        memberHandles: ["ahou-kouadio"],
        projectSlug: "comic-sans-forever",
        title: "Comic Sans Forever",
        pitch:
          "Une page d'accueil en Comic Sans sur fond qui clignote, navigable entièrement au clavier.",
        description:
          "Fond animé en dégradé arc-en-ciel, texte en Comic Sans, curseur en forme de baguette. Le contraste " +
          "reste à 4,5:1 sur chaque couleur et l'animation s'arrête avec `prefers-reduced-motion`.",
      },
      {
        team: "Marquee Revival",
        captainHandle: "skander-jaziri",
        memberHandles: [],
        projectSlug: "marquee-revival",
        title: "Marquee Revival",
        pitch:
          "Le retour de la balise marquee, refaite en CSS avec un bouton pause pour les lecteurs d'écran.",
        description:
          "Chaque titre défile dans un sens différent. Un bouton « Arrêter le défilement » est le premier " +
          "élément atteint au clavier, et le texte reste lisible en entier par un lecteur d'écran.",
      },
    ],
  },
  {
    competitionSlug: "dessin-css-une-seule-div",
    submissionClosesInDays: 7,
    submissions: [
      {
        team: "Box-shadow Gang",
        captainHandle: "ahou-kouadio",
        memberHandles: [],
        projectSlug: "baobab-une-div",
        title: "Un baobab au coucher du soleil",
        pitch: "Un baobab dessiné avec 38 ombres portées sur une seule div.",
        description:
          "Le tronc est le `::before`, le feuillage une pile de `box-shadow` arrondies, le soleil le `::after`. " +
          "Aucune image, aucun SVG.",
      },
      {
        team: "Pixel Thieb",
        captainHandle: "dapo-oyelaran",
        memberHandles: [],
        projectSlug: "thieb-une-div",
        title: "Un plat de thieb",
        pitch: "Un plat de thieboudienne vu de dessus, en dégradés coniques sur une seule div.",
        description:
          "Le riz est un `conic-gradient`, le poisson et les légumes des `radial-gradient` superposés. " +
          "Environ 60 lignes de CSS.",
      },
    ],
  },
  {
    competitionSlug: "readme-le-plus-drole",
    submissionClosesInDays: 8,
    submissions: [
      {
        team: "Works On My Machine",
        captainHandle: "lyna-bouzid",
        memberHandles: ["kgomotso-mahlangu"],
        projectSlug: "works-on-my-machine",
        title: "Works On My Machine",
        pitch: "Un README qui livre la machine avec le projet : un conteneur prêt à lancer.",
        description:
          "La section « Installation » tient en une ligne, `docker compose up`, et elle marche vraiment. " +
          "La section « Dépannage » liste les excuses classiques, chacune avec sa vraie solution.",
      },
      {
        team: "TODO: nom d'équipe",
        captainHandle: "heritier-kabeya",
        memberHandles: [],
        projectSlug: "readme-todo",
        title: "TODO: écrire le README",
        pitch: "Un README fait uniquement de TODO, qui explique pourtant comment lancer le projet.",
        description:
          "Chaque titre est un TODO oublié depuis 2019. Sous chacun, l'instruction exacte : installer, " +
          "configurer, lancer les tests.",
      },
      {
        team: "Lisez-moi Vraiment",
        captainHandle: "coumba-thiam",
        memberHandles: [],
        projectSlug: "lisez-moi-vraiment",
        title: "Lisez-moi, vraiment",
        pitch: "Un README écrit comme une lettre de rupture avec la documentation.",
        description:
          "« Ce n'est pas toi, c'est moi : je n'ai jamais su lire un README. » L'installation est dans " +
          "le post-scriptum, en trois commandes.",
      },
    ],
  },
  {
    competitionSlug: "bug-de-l-annee",
    submissionClosesInDays: 9,
    submissions: [
      {
        team: "Fuseau Horaire",
        captainHandle: "kiprono-langat",
        memberHandles: [],
        projectSlug: "paiements-a-minuit",
        title: "Les paiements de minuit",
        pitch: "Des paiements comptés deux fois, une nuit par an, au changement d'heure.",
        description:
          "Le serveur stockait l'heure locale. La nuit du changement d'heure, l'heure de 2 h existait deux " +
          "fois et la déduplication laissait passer les doublons. Correction : tout en UTC, l'heure locale " +
          "seulement à l'affichage.",
      },
      {
        team: "Off By One",
        captainHandle: "skander-jaziri",
        memberHandles: [],
        projectSlug: "le-dernier-jour-du-mois",
        title: "Le dernier jour du mois",
        pitch: "Un rapport mensuel qui oubliait le 31, sept mois par an.",
        description:
          "Une boucle `for (let day = 1; day < daysInMonth; day++)`. Le bug a vécu deux ans parce que le " +
          "31 tombait souvent un week-end sans ventes.",
      },
      {
        team: "Null Pointer Club",
        captainHandle: "coumba-thiam",
        memberHandles: [],
        projectSlug: "client-null",
        title: "Le client nommé Null",
        pitch: "Une cliente dont le nom de famille, Null, cassait l'export comptable.",
        description:
          "L'export transformait la chaîne `\"Null\"` en valeur vide avant de l'écrire. Correction : ne " +
          "jamais deviner une valeur absente à partir de son texte.",
      },
    ],
  },
  {
    competitionSlug: "code-golf-fizzbuzz",
    submissionClosesInDays: 5,
    submissions: [
      {
        team: "Un Octet De Moins",
        captainHandle: "ebo-quansah",
        memberHandles: [],
        projectSlug: "fizzbuzz-python-59",
        title: "FizzBuzz en 59 octets (Python)",
        pitch: "Trois octets de moins que l'exemple de la compétition.",
        description:
          "```python\n" + 'for i in range(100):print(i%3//2*"Fizz"+i%5//4*"Buzz"or-~i)\n' + "```",
      },
      {
        team: "Regex Ninjas",
        captainHandle: "ghizlane-amrani",
        memberHandles: ["coumba-thiam"],
        projectSlug: "fizzbuzz-regex",
        title: "FizzBuzz par expressions régulières",
        pitch: "Plus long, mais sans aucun modulo : seulement des remplacements de texte.",
        description:
          "Les nombres sont écrits en unaire, puis trois remplacements successifs posent Fizz, Buzz et " +
          "FizzBuzz. 97 octets en Perl.",
      },
    ],
  },
];
