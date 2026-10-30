import { createDb } from "./client.js";
import { promotePlatformAdmin } from "./admin.js";

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email || process.argv.length > 3) {
    throw new Error("Usage : pnpm db:promote-admin <email d'un compte existant>");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL non définie.");
  const result = await promotePlatformAdmin(createDb(databaseUrl), email);
  console.log(result === "promoted" ? `${email} est maintenant administrateur.` : `${email} était déjà administrateur.`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
