import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

// drizzle-kit lance ce fichier lui-meme, sans passer par un script qui aurait
// pu charger le .env : sans ca, DATABASE_URL reste absente et les migrations
// partent sur la valeur de repli, donc potentiellement sur la mauvaise base.
const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://kemet:kemet@localhost:5432/kemet",
  },
});
