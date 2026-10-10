import Fastify from "fastify";
import { Queue, Worker } from "bullmq";
import { createDb } from "@kemet/db";
import { runMigrations } from "@kemet/db/migrate";
import { healthcheckResponseSchema } from "@kemet/shared";
import { cleanupOrphanAttachments } from "../chat/attachments-cleanup.js";
import { LocalDiskStorage } from "../storage/file-storage.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://kemet:kemet@localhost:5432/kemet";
// Premier accès du worker à la base (le nettoyage des pièces jointes) :
// jusqu'ici seuls api et realtime appliquaient les migrations au démarrage
// le worker n'en avait pas besoin.
await runMigrations(databaseUrl);
const db = createDb(databaseUrl);
const storage = new LocalDiskStorage(process.env.UPLOADS_DIR ?? "/data/uploads");

const connection = { url: process.env.VALKEY_URL ?? "redis://localhost:6379" };
const MAINTENANCE_QUEUE = "maintenance";
const CLEANUP_JOB = "cleanup-orphan-attachments";

const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, { connection });
await maintenanceQueue.upsertJobScheduler(CLEANUP_JOB, { every: 60 * 60 * 1000 }, { name: CLEANUP_JOB });

new Worker(
  MAINTENANCE_QUEUE,
  async (job) => {
    if (job.name !== CLEANUP_JOB) return;
    const deleted = await cleanupOrphanAttachments(db, storage);
    if (deleted > 0) job.log(`${deleted} fichier(s) orphelin(s) supprimé(s).`);
  },
  { connection },
);

/**
 * Le worker expose aussi un /health HTTP minimal : BullMQ n'a pas de serveur
 * propre, mais l'orchestrateur (docker-compose, puis le serveur Datacloud)
 * a besoin d'un point à sonder comme pour api et realtime.
 */
const app = Fastify({ logger: true });

app.get("/health", async () =>
  healthcheckResponseSchema.parse({ status: "ok", service: "worker" }),
);

const port = Number(process.env.WORKER_PORT ?? 3003);
app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
