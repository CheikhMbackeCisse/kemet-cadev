/**
 * Posts du fil lisibles par un lycéen ou un étudiant de première année, et le
 * skill qui permet à Kocc de répondre sous le post sur les boucles. Les cœurs
 * (`hearts`) placent chaque post entre les posts plus pointus de "Pour toi",
 * classé par cœurs et republications.
 */

export interface BeginnerReply {
  key: string;
  authorHandle: string;
  body: string;
  minutesAfter: number;
}

export interface BeginnerPost {
  key: string;
  authorHandle: string;
  body: string;
  hoursAgo: number;
  hearts: number;
  format?: "astuce";
  replies: BeginnerReply[];
}

export const LOOPS_POST: BeginnerPost = {
  key: "for-ou-while",
  authorHandle: "dapo-oyelaran",
  hoursAgo: 0.4,
  hearts: 0,
  body:
    "**for ou while : laquelle choisir ?**\n\n" +
    "`for` quand tu sais d'avance ce que tu parcours : une liste, dix tours, chaque ligne d'un fichier.\n" +
    "`while` quand tu ne sais pas combien de tours il faudra : tu répètes tant qu'une condition reste vraie.\n" +
    "Exemple typique du `while` : redemander un mot de passe jusqu'à ce qu'il soit bon.\n" +
    "Le piège : si la condition ne devient jamais fausse, la boucle ne s'arrête pas.\n\n" +
    "```python\n" +
    "for note in [12, 15, 9]:\n" +
    "    print(note)\n" +
    'while input("Mot de passe : ") != "kemet":\n' +
    '    print("Encore une fois")\n' +
    "```\n\n" +
    "Dans le doute, commence par `for`.",
  replies: [
    {
      key: "yannick-js",
      authorHandle: "yannick-mbarga",
      body: "Et en JavaScript, c'est pareil ?",
      minutesAfter: 6,
    },
    {
      key: "dapo-js",
      authorHandle: "dapo-oyelaran",
      body: "Oui, même idée. En JS, `for (const note of notes)` fait exactement le `for` de Python.",
      minutesAfter: 9,
    },
    {
      key: "moussa-exo",
      authorHandle: "moussa-sow",
      body: "Je mettais des while partout. Je refais mon exercice de cette semaine avec un for.",
      minutesAfter: 14,
    },
  ],
};

export const BEGINNER_FEED_POSTS: BeginnerPost[] = [
  {
    key: "api-restaurant",
    authorHandle: "coumba-thiam",
    hoursAgo: 5,
    hearts: 36,
    body:
      "**C'est quoi une API ?**\n\n" +
      "Au restaurant, tu ne vas pas en cuisine : tu passes ta commande au serveur, il revient avec ton plat.\n" +
      "Une API, c'est ce serveur. Ton application demande quelque chose (la météo de Dakar, le solde d'un compte), l'API va le chercher et rapporte la réponse.\n" +
      "Tu n'as pas besoin de savoir comment la cuisine fonctionne, seulement comment commander.\n" +
      "Et le menu, c'est la documentation de l'API.",
    replies: [],
  },
  {
    key: "tris-cartes",
    authorHandle: "kiprono-langat",
    hoursAgo: 9,
    hearts: 23,
    body:
      "**Les algorithmes de tri, simplement**\n\n" +
      "Tri à bulles : tu ranges des cartes en comparant deux voisines, et tu les échanges si elles sont dans le mauvais ordre. " +
      "Tu recommences jusqu'à ce que plus rien ne bouge. Facile à écrire, lent sur une grande pile.\n\n" +
      "Tri rapide : tu choisis une carte, le pivot. Les plus petites à gauche, les plus grandes à droite, " +
      "puis tu recommences sur chaque tas. Beaucoup plus rapide en pratique.\n\n" +
      "```python\n" +
      "def tri_rapide(cartes):\n" +
      "    if len(cartes) <= 1:\n" +
      "        return cartes\n" +
      "    pivot = cartes[0]\n" +
      "    petites = [c for c in cartes[1:] if c < pivot]\n" +
      "    grandes = [c for c in cartes[1:] if c >= pivot]\n" +
      "    return tri_rapide(petites) + [pivot] + tri_rapide(grandes)\n" +
      "```\n\n" +
      "Dans un vrai projet, `sorted()` le fait déjà très bien. L'écrire une fois aide à comprendre ce qu'il fait.",
    replies: [
      {
        key: "salma-pivot",
        authorHandle: "salma-haddad",
        body: "On l'a vu en cours cette semaine, l'image des cartes m'aide beaucoup plus que le schéma du prof.",
        minutesAfter: 40,
      },
    ],
  },
  {
    key: "erreur-python",
    authorHandle: "lyna-bouzid",
    hoursAgo: 14,
    hearts: 17,
    format: "astuce",
    body:
      "**Lire un message d'erreur Python sans paniquer**\n\n" +
      "Lis-le de bas en haut.\n" +
      "1. La dernière ligne donne le type d'erreur : `NameError`, `TypeError`, `ZeroDivisionError`...\n" +
      '2. Juste au-dessus, `File "...", line 7` te dit où regarder.\n' +
      "3. Va à cette ligne et à celle d'avant : faute de frappe, variable pas encore créée, parenthèse oubliée.\n\n" +
      "```text\n" +
      '  File "notes.py", line 7, in <module>\n' +
      "    print(moyene)\n" +
      "NameError: name 'moyene' is not defined\n" +
      "```\n\n" +
      "Ici, une lettre manque : `moyenne` est devenu `moyene`.",
    replies: [
      {
        key: "nala-merci",
        authorHandle: "nala-uwase",
        body: "Je lisais toujours la première ligne et je ne comprenais rien. Merci.",
        minutesAfter: 55,
      },
    ],
  },
];

/** Post déjà publié par le seed des débutants, remonté parmi les premiers du fil. */
export const GIT_MEMO_POST = {
  authorHandle: "ghizlane-amrani",
  bodyStart: "Mémo Git en trois cartes",
  hearts: 12,
};

export const LOOPS_SKILL = {
  slug: "choisir-la-bonne-boucle",
  name: "Choisir la bonne boucle",
  description:
    "Expliquer à un débutant quand utiliser for ou while, ce qu'est une boucle infinie et comment en sortir.",
  tags: ["débutant", "boucles", "boucle infinie", "python", "javascript"],
  content:
    "Utiliser ce skill quand un débutant demande la différence entre for et while, ou ce qu'est une boucle infinie.\n\n" +
    "Principes :\n" +
    "- `for` : on sait d'avance ce qu'on parcourt (une liste, un intervalle, les lignes d'un fichier).\n" +
    "- `while` : on répète tant qu'une condition reste vraie, sans savoir combien de tours il faudra.\n" +
    "- Une boucle infinie est une boucle dont la condition ne devient jamais fausse : le programme tourne sans fin " +
    "et semble bloqué. Cause la plus fréquente : oublier de changer, dans la boucle, la variable que teste la condition.\n" +
    "- Pour arrêter un programme bloqué dans le terminal : Ctrl+C.\n" +
    "- Une boucle infinie voulue existe (un serveur qui attend des requêtes, un jeu qui attend les touches) : " +
    "elle a toujours une sortie prévue, avec `break`.\n\n" +
    "Exemple en Python :\n" +
    "```python\n" +
    "compteur = 0\n" +
    "while compteur < 3:\n" +
    "    print(compteur)\n" +
    "    compteur += 1\n" +
    "```\n" +
    "Sans la dernière ligne, `compteur` reste à 0 et la boucle ne s'arrête jamais.\n\n" +
    "En JavaScript, même logique : `for (const x of liste)` pour parcourir, `while (condition)` pour répéter.\n\n" +
    "Répondre en phrases courtes, avec un exemple de quatre lignes au plus, sans jargon.",
};
