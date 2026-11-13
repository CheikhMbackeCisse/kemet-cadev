export type SkillDomain = "payments" | "ai" | "data" | "infra" | "front" | "back" | "other";

// Premier domaine dont un mot apparaît dans les tags, le nom ou la
// description. Les mots courts ("ia", "ci", "ui") ne comptent qu'entiers.
const DOMAIN_KEYWORDS: [SkillDomain, string[]][] = [
  [
    "payments",
    [
      "wave",
      "paiement",
      "payment",
      "mobile money",
      "orange money",
      "momo",
      "stripe",
      "facturation",
    ],
  ],
  ["ai", ["llm", "ia", "ai", "prompt", "gemini", "rag", "embedding", "modèle"]],
  [
    "data",
    ["postgres", "sql", "base de données", "database", "migration", "drizzle", "mongo", "index"],
  ],
  [
    "infra",
    [
      "docker",
      "devops",
      "déploiement",
      "deploy",
      "ci",
      "kubernetes",
      "caddy",
      "linux",
      "nginx",
      "serveur vps",
    ],
  ],
  [
    "front",
    ["react", "css", "tailwind", "front", "ui", "vue", "svelte", "accessibilité", "mobile"],
  ],
  [
    "back",
    ["api", "node", "fastify", "express", "backend", "auth", "webhook", "serveur", "sécurité"],
  ],
];

function mentions(text: string, keyword: string): boolean {
  if (keyword.length > 3) return text.includes(keyword);
  return new RegExp(`(^|[^\\p{L}])${keyword}($|[^\\p{L}])`, "u").test(text);
}

/** Domaine d'un skill, pour la couleur et l'icône de sa bannière ; rien n'est stocké. */
export function skillDomain(skill: {
  tags: string[];
  name: string;
  description: string;
}): SkillDomain {
  const text = [...skill.tags, skill.name, skill.description].join(" ").toLowerCase();
  for (const [domain, keywords] of DOMAIN_KEYWORDS) {
    if (keywords.some((keyword) => mentions(text, keyword))) return domain;
  }
  return "other";
}
