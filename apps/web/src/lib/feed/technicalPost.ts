// Mots qui signalent un sujet technique. Les mots courts ne comptent
// qu'entiers : "api" ne doit pas sortir de "rapide".
const TECHNICAL_WORDS = [
  "api",
  "sql",
  "css",
  "html",
  "git",
  "bug",
  "docker",
  "react",
  "python",
  "javascript",
  "typescript",
  "node",
  "flutter",
  "kotlin",
  "java",
  "php",
  "laravel",
  "django",
  "postgres",
  "postgresql",
  "mysql",
  "mongodb",
  "kubernetes",
  "linux",
  "backend",
  "frontend",
  "webhook",
  "serveur",
  "base de données",
  "algorithme",
  "framework",
  "déploiement",
  "requête",
  "index",
  "cache",
  "compilateur",
];

const CODE_PATTERN = /```|`[^`\n]+`/;
const WORDS_PATTERN = new RegExp(
  `(^|[^\\p{L}])(${TECHNICAL_WORDS.map((word) => word.replace(/ /g, "\\s+")).join("|")})($|[^\\p{L}])`,
  "iu",
);

/** Un post qui contient du code ou parle d'un sujet technique : @kemet peut proposer de l'expliquer. */
export function isTechnicalPost(body: string): boolean {
  return CODE_PATTERN.test(body) || WORDS_PATTERN.test(body);
}

/** Question préremplie par la pastille "Demander à @kemet d'expliquer". */
export const EXPLAIN_POST_PROMPT = "@kemet explique-moi ce post simplement";

/** Paramètre d'adresse posé par la pastille du fil, lu par la page du post. */
export const ASK_KEMET_PARAM = "demander";
