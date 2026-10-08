import Fastify, { type FastifyInstance } from "fastify";
import { toNodeHandler } from "better-auth/node";
import { healthcheckResponseSchema } from "@kemet/shared";
import type { Db } from "@kemet/db";
import type { Auth } from "../auth/auth.js";
import { AppError } from "../errors.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerUserRoutes } from "./routes/users.js";

export interface AppDeps {
  db: Db;
  auth: Auth;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
      return;
    }
    app.log.error(error);
    reply.status(500).send({ error: { code: "internal_error", message: "Erreur interne." } });
  });

  app.get("/health", async () => healthcheckResponseSchema.parse({ status: "ok", service: "api" }));

  const authHandler = toNodeHandler(deps.auth);
  app.register(async (scope) => {
    // Le handler Better Auth lit lui-même le flux brut de la requête : le
    // parseur JSON de Fastify ne doit pas consommer le corps avant lui. La
    // portée du plugin limite ce changement à ces seules routes.
    scope.addContentTypeParser("application/json", (_request, _payload, done) => done(null));
    scope.all("/api/auth/*", async (request, reply) => {
      reply.hijack();
      await authHandler(request.raw, reply.raw);
    });
  });

  registerMeRoutes(app, deps);
  registerUserRoutes(app, deps);

  return app;
}
