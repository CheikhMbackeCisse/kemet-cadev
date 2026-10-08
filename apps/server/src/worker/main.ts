import Fastify from "fastify";
import { healthcheckResponseSchema } from "@kemet/shared";

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
