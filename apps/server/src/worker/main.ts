import Fastify from "fastify";
import { Queue, Worker } from "bullmq";
import { createDb } from "@kemet/db";
import { runMigrations } from "@kemet/db/migrate";
import { healthcheckResponseSchema } from "@kemet/shared";
import { cleanupOrphanAttachments } from "../chat/attachments-cleanup.js";
import { cleanupOrphanPostAttachments } from "../feed/post-attachments-cleanup.js";
import { cleanupOrphanWorkAttachments, cleanupOrphanWorkMedia } from "../works/work-attachments-cleanup.js";
import { LocalDiskStorage } from "../storage/file-storage.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://kemet:kemet@localhost:5432/kemet";
// Le worker peut démarrer avant api : il applique lui-même les migrations
// avant de lire la base.
await runMigrations(databaseUrl);
const db = createDb(databaseUrl);
const storage = new LocalDiskStorage(process.env.UPLOADS_DIR ?? "/data/uploads");

const connection = { url: process.env.VALKEY_URL ?? "redis://localhost:6379" };
const MAINTENANCE_QUEUE = "maintenance";
const CLEANUP_JOB = "cleanup-orphan-attachments";
const CLEANUP_POST_ATTACHMENTS_JOB = "cleanup-orphan-post-attachments";
const CLEANUP_WORK_ATTACHMENTS_JOB = "cleanup-orphan-work-attachments";

const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, { connection });
await maintenanceQueue.upsertJobScheduler(CLEANUP_JOB, { every: 60 * 60 * 1000 }, { name: CLEANUP_JOB });
await maintenanceQueue.upsertJobScheduler(
  CLEANUP_POST_ATTACHMENTS_JOB,
  { every: 60 * 60 * 1000 },
  { name: CLEANUP_POST_ATTACHMENTS_JOB },
);
await maintenanceQueue.upsertJobScheduler(
  CLEANUP_WORK_ATTACHMENTS_JOB,
  { every: 60 * 60 * 1000 },
  { name: CLEANUP_WORK_ATTACHMENTS_JOB },
);

new Worker(
  MAINTENANCE_QUEUE,
  async (job) => {
    if (job.name === CLEANUP_JOB) {
      const deleted = await cleanupOrphanAttachments(db, storage);
      if (deleted > 0) job.log(`${deleted} fichier(s) orphelin(s) supprimé(s).`);
      return;
    }
    if (job.name === CLEANUP_POST_ATTACHMENTS_JOB) {
      const deleted = await cleanupOrphanPostAttachments(db, storage);
      if (deleted > 0) job.log(`${deleted} image(s) orpheline(s) de post supprimée(s).`);
      return;
    }
    if (job.name === CLEANUP_WORK_ATTACHMENTS_JOB) {
      const deleted = await cleanupOrphanWorkAttachments(db, storage);
      if (deleted > 0) job.log(`${deleted} PDF orphelin(s) de travail supprimé(s).`);
      const deletedMedia = await cleanupOrphanWorkMedia(db, storage);
      if (deletedMedia > 0) job.log(`${deletedMedia} média(s) orphelin(s) de travail supprimé(s).`);
    }
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
