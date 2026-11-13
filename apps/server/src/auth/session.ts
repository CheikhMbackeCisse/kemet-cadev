import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import { unauthorized } from "../errors.js";
import type { Auth } from "./auth.js";

// La limite de débit, sa clé et la route lisent chacune la session d'une
// même requête : une seule lecture suffit.
const sessionUserIds = new WeakMap<FastifyRequest, Promise<string | null>>();

export function getSessionUserId(auth: Auth, request: FastifyRequest): Promise<string | null> {
  let pending = sessionUserIds.get(request);
  if (!pending) {
    pending = auth.api
      .getSession({ headers: fromNodeHeaders(request.headers) })
      .then((session) => session?.user.id ?? null);
    sessionUserIds.set(request, pending);
  }
  return pending;
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
