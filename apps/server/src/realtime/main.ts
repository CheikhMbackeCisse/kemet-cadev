import Fastify from "fastify";
import { Server } from "socket.io";
import { healthcheckResponseSchema } from "@kemet/shared";

const app = Fastify({ logger: true });

app.get("/health", async () =>
  healthcheckResponseSchema.parse({ status: "ok", service: "realtime" }),
);

const port = Number(process.env.REALTIME_PORT ?? 3002);

app
  .listen({ port, host: "0.0.0.0" })
  .then((address) => {
    const httpServer = app.server;
    const io = new Server(httpServer, { cors: { origin: true } });
    io.on("connection", (socket) => {
      app.log.info({ socketId: socket.id }, "client connecté");
    });
    app.log.info(`realtime à l'écoute sur ${address}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
