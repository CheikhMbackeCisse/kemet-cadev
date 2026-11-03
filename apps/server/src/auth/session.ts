import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import { unauthorized } from "../errors.js";
import type { Auth } from "./auth.js";

export async function getSessionUserId(auth: Auth, request: FastifyRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  return session?.user.id ?? null;
}

export async function requireSessionUserId(auth: Auth, request: FastifyRequest): Promise<string> {
  const userId = await getSessionUserId(auth, request);
  if (!userId) throw unauthorized();
  return userId;
}

/** La session elle-même, pour une action qui exige une connexion récente. */
export async function requireSession(
  auth: Auth,
  request: FastifyRequest,
): Promise<{ userId: string; signedInAt: Date }> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) throw unauthorized();
  return { userId: session.user.id, signedInAt: new Date(session.session.createdAt) };
}
