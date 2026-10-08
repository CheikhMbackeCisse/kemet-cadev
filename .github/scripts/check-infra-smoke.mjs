import { execFileSync } from "node:child_process";

const MEMORY_LIMIT_GIB = 3.2;
const COMPOSE_ARGS = ["compose", "-f", "infra/docker-compose.yml", "--env-file", ".env"];
const UNIT_MULTIPLIERS = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 };

function run(args) {
  return execFileSync("docker", args, { encoding: "utf-8" });
}

function parseNdjson(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function parseMemUsage(usage) {
  // Format docker stats, ex: "45.21MiB / 64MiB"
  const used = usage.split("/")[0].trim();
  const match = used.match(/^([\d.]+)\s*([A-Za-z]+)$/);
  if (!match) throw new Error(`Format de mémoire inattendu : "${usage}"`);
  const [, value, unit] = match;
  const multiplier = UNIT_MULTIPLIERS[unit];
  if (!multiplier) throw new Error(`Unité de mémoire inconnue : "${unit}"`);
  return Number(value) * multiplier;
}

const services = parseNdjson(run([...COMPOSE_ARGS, "ps", "--format", "json"]));

// Les sept services définissent tous un HEALTHCHECK : un Health absent ou
// vide signalerait un service mal configuré, pas seulement un service lent.
const unhealthy = services.filter((service) => service.Health !== "healthy");
if (unhealthy.length > 0) {
  for (const service of unhealthy) {
    console.error(`Service non sain : ${service.Service} (${service.Health || "pas de healthcheck"})`);
  }
  process.exit(1);
}

const stats = parseNdjson(run(["stats", "--no-stream", "--format", "{{json .}}"]));
const totalBytes = stats.reduce((sum, stat) => sum + parseMemUsage(stat.MemUsage), 0);
const totalGiB = totalBytes / 1024 ** 3;

console.log(`Mémoire totale utilisée par la pile : ${totalGiB.toFixed(3)} Go (plafond ${MEMORY_LIMIT_GIB} Go)`);

if (totalGiB > MEMORY_LIMIT_GIB) {
  console.error(`Dépassement du plafond mémoire : ${totalGiB.toFixed(3)} Go > ${MEMORY_LIMIT_GIB} Go`);
  process.exit(1);
}
