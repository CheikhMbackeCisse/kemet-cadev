import Fastify from "fastify";
import { Server, type Socket } from "socket.io";
import { fromNodeHeaders } from "better-auth/node";
import { healthcheckResponseSchema } from "@kemet/shared";
import { eq } from "drizzle-orm";
import { createDb, channels } from "@kemet/db";
import { runMigrations } from "@kemet/db/migrate";
import { createAuth } from "../auth/auth.js";
import { SmtpEmailSender } from "../email/smtp-email-sender.js";
import { subscribeChatEvents } from "../chat/pubsub.js";
import { canAccessChannel, findProfileId } from "./access.js";
import { acknowledge, readChannelId } from "./channel-event.js";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET n'est pas définie : elle signe les sessions, aucune valeur par défaut n'est acceptable.",
  );
}

const databaseUrl = process.env.DATABASE_URL ?? "postgres://kemet:kemet@localhost:5432/kemet";
await runMigrations(databaseUrl);
const db = createDb(databaseUrl);

const emailSender = new SmtpEmailSender({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.EMAIL_FROM ?? "kemet@example.com",
});

const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:5173";
const additionalTrustedOrigins = (process.env.EXTRA_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const auth = createAuth({
  db,
  emailSender,
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  webAppUrl,
  additionalTrustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
});

const valkeyUrl = process.env.VALKEY_URL ?? "redis://localhost:6379";

function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

// Salle personnelle, rejointe à la connexion : les pastilles de la
// messagerie y arrivent même quand aucune conversation n'est ouverte.
function profileRoom(profileId: string): string {
  return `profile:${profileId}`;
}

async function listChannelIdsInSpace(spaceId: string): Promise<string[]> {
  const rows = await db.select({ id: channels.id }).from(channels).where(eq(channels.spaceId, spaceId));
  return rows.map((row) => row.id);
}

const app = Fastify({ logger: true });

app.get("/health", async () => healthcheckResponseSchema.parse({ status: "ok", service: "realtime" }));

const port = Number(process.env.REALTIME_PORT ?? 3002);

app
  .listen({ port, host: "0.0.0.0" })
  .then((address) => {
    const httpServer = app.server;
    const io = new Server(httpServer, {
      cors: { origin: [webAppUrl, ...additionalTrustedOrigins], credentials: true },
    });

    const socketsByProfile = new Map<string, Set<Socket>>();

    // Sans session, connexion acceptée en visiteur (`profileId = null`). Une
    // session sans profil reste refusée.
    io.use(async (socket, next) => {
      try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(socket.handshake.headers) });
        if (!session) {
          socket.data.profileId = null;
          next();
          return;
        }
        const profileId = await findProfileId(db, session.user.id);
        if (!profileId) {
          next(new Error("profile_required"));
          return;
        }
        socket.data.profileId = profileId;
        next();
      } catch (error) {
        app.log.error({ err: error }, "poignée de main refusée");
        next(new Error("handshake_failed"));
      }
    });

    io.on("connection", (socket) => {
      const profileId: string | null = socket.data.profileId;
      if (profileId) {
        const existing = socketsByProfile.get(profileId) ?? new Set<Socket>();
        existing.add(socket);
        socketsByProfile.set(profileId, existing);
        void socket.join(profileRoom(profileId));
      }
      app.log.info({ socketId: socket.id, profileId }, "client connecté");

      socket.on("channel:join", async (payload: unknown, ack?: unknown) => {
        const channelId = readChannelId(payload);
        if (!channelId) {
          acknowledge(ack, false);
          return;
        }
        // Un gestionnaire asynchrone qui rejette arrêterait le processus :
        // une panne de la base ne doit couper le temps réel de personne.
        try {
          if (!(await canAccessChannel(db, profileId, channelId))) {
            acknowledge(ack, false);
            return;
          }
          await socket.join(channelRoom(channelId));
          acknowledge(ack, true);
        } catch (error) {
          app.log.error({ err: error, channelId }, "channel:join a échoué");
          acknowledge(ack, false);
        }
      });

      socket.on("channel:leave", (payload: unknown) => {
        const channelId = readChannelId(payload);
        if (channelId) void socket.leave(channelRoom(channelId));
      });

      // Un visiteur n'a pas de composeur côté interface ; le serveur ne lui
      // fait pas confiance pour autant et ignore ces événements sans profil.
      for (const state of ["start", "stop"] as const) {
        socket.on(`typing:${state}`, (payload: unknown) => {
          const channelId = readChannelId(payload);
          if (!profileId || !channelId || !socket.rooms.has(channelRoom(channelId))) return;
          socket.to(channelRoom(channelId)).emit(`typing:${state}`, { channelId, profileId });
        });
      }

      socket.on("disconnect", () => {
        if (!profileId) return;
        const sockets = socketsByProfile.get(profileId);
        sockets?.delete(socket);
        if (sockets && sockets.size === 0) socketsByProfile.delete(profileId);
      });
    });

    subscribeChatEvents(valkeyUrl, (event) => {
      if (event.type === "member:removed") {
        const sockets = socketsByProfile.get(event.profileId);
        if (!sockets || sockets.size === 0) return;
        listChannelIdsInSpace(event.spaceId).then((channelIds) => {
          for (const socket of sockets) {
            for (const channelId of channelIds) void socket.leave(channelRoom(channelId));
          }
        });
        return;
      }
      if (event.type === "conversation:member-left") {
        for (const socket of socketsByProfile.get(event.profileId) ?? []) void socket.leave(channelRoom(event.channelId));
        return;
      }
      if (event.type === "conversation:activity") {
        for (const profileId of event.profileIds) {
          io.to(profileRoom(profileId)).emit(event.type, { type: event.type, conversationId: event.conversationId });
        }
        return;
      }
      io.to(channelRoom(event.channelId)).emit(event.type, event);
    });

    app.log.info(`realtime à l'écoute sur ${address}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
