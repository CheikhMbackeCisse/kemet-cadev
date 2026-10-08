import Fastify from "fastify";
import { Server, type Socket } from "socket.io";
import { fromNodeHeaders } from "better-auth/node";
import { healthcheckResponseSchema } from "@kemet/shared";
import { and, eq } from "drizzle-orm";
import { createDb, channels, profiles, spaceMembers, spaces } from "@kemet/db";
import { runMigrations } from "@kemet/db/migrate";
import { createAuth } from "../auth/auth.js";
import { SmtpEmailSender } from "../email/smtp-email-sender.js";
import { subscribeChatEvents } from "../chat/pubsub.js";

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

const auth = createAuth({
  db,
  emailSender,
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:5173",
  secret: process.env.BETTER_AUTH_SECRET,
});

const valkeyUrl = process.env.VALKEY_URL ?? "redis://localhost:6379";

function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

async function findProfileId(userId: string): Promise<string | null> {
  const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId));
  return profile?.id ?? null;
}

async function canAccessChannel(profileId: string, channelId: string): Promise<boolean> {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel) return false;
  const [space] = await db.select().from(spaces).where(eq(spaces.id, channel.spaceId));
  if (!space) return false;
  if (space.visibility === "public") return true;
  const [membership] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, space.id), eq(spaceMembers.profileId, profileId)));
  return membership != null;
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
      cors: { origin: process.env.WEB_APP_URL ?? "http://localhost:5173", credentials: true },
    });

    const socketsByProfile = new Map<string, Set<Socket>>();

    io.use(async (socket, next) => {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(socket.handshake.headers) });
      if (!session) {
        next(new Error("unauthorized"));
        return;
      }
      const profileId = await findProfileId(session.user.id);
      if (!profileId) {
        next(new Error("profile_required"));
        return;
      }
      socket.data.profileId = profileId;
      next();
    });

    io.on("connection", (socket) => {
      const profileId: string = socket.data.profileId;
      const existing = socketsByProfile.get(profileId) ?? new Set<Socket>();
      existing.add(socket);
      socketsByProfile.set(profileId, existing);
      app.log.info({ socketId: socket.id, profileId }, "client connecté");

      socket.on("channel:join", async ({ channelId }: { channelId: string }, ack?: (ok: boolean) => void) => {
        const allowed = await canAccessChannel(profileId, channelId);
        if (!allowed) {
          ack?.(false);
          return;
        }
        await socket.join(channelRoom(channelId));
        ack?.(true);
      });

      socket.on("channel:leave", ({ channelId }: { channelId: string }) => {
        void socket.leave(channelRoom(channelId));
      });

      socket.on("typing:start", ({ channelId }: { channelId: string }) => {
        socket.to(channelRoom(channelId)).emit("typing:start", { channelId, profileId });
      });

      socket.on("typing:stop", ({ channelId }: { channelId: string }) => {
        socket.to(channelRoom(channelId)).emit("typing:stop", { channelId, profileId });
      });

      socket.on("disconnect", () => {
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
      io.to(channelRoom(event.channelId)).emit(event.type, event);
    });

    app.log.info(`realtime à l'écoute sur ${address}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
