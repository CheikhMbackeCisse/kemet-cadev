import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { isIPv4, isIPv6 } from "node:net";

export type SessionUserIdResolver = (request: FastifyRequest) => Promise<string | null>;

type MaxOption = number | ((request: FastifyRequest, key: string) => number | Promise<number>);

const ANONYMOUS_KEY_PREFIX = "ip:";

function expandIPv6(ip: string): number[] {
  let address = ip.toLowerCase();
  const embedded = /(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (embedded) {
    const [a, b, c, d] = embedded[1]!.split(".").map(Number);
    address = `${address.slice(0, -embedded[1]!.length)}${((a! << 8) | b!).toString(16)}:${((c! << 8) | d!).toString(16)}`;
  }
  const [head = "", tail] = address.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const zeros = tail === undefined ? 0 : 8 - headGroups.length - tailGroups.length;
  return [...headGroups, ...Array<string>(zeros).fill("0"), ...tailGroups].map((group) => Number.parseInt(group, 16));
}

function embeddedIPv4(groups: number[]): string {
  return [groups[6]! >> 8, groups[6]! & 0xff, groups[7]! >> 8, groups[7]! & 0xff].join(".");
}

/**
 * Réduit une adresse IPv6 à son préfixe /64, attribué en entier à un seul
 * abonné. Une adresse IPv4 encapsulée (::ffff:0:0/96, NAT64 64:ff9b::/96)
 * redevient l'adresse IPv4 qu'elle porte.
 */
export function normalizeClientAddress(ip: string): string {
  if (isIPv4(ip) || !isIPv6(ip)) return ip.toLowerCase();
  const groups = expandIPv6(ip);
  const isMapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  const isNat64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0);
  if (isMapped || isNat64) return embeddedIPv4(groups);
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}

export function rateLimitKey(userId: string | null, ip: string): string {
  return userId ? `user:${userId}` : `${ANONYMOUS_KEY_PREFIX}${normalizeClientAddress(ip)}`;
}

function widenForAnonymous(max: MaxOption, anonymousFactor: number) {
  return async (request: FastifyRequest, key: string): Promise<number> => {
    const base = typeof max === "number" ? max : await max(request, key);
    return key.startsWith(ANONYMOUS_KEY_PREFIX) ? Math.max(base, Math.round(base * anonymousFactor)) : base;
  };
}

/**
 * Compte chaque limite de débit par compte connecté, et par adresse IP
 * seulement sans session. Une même adresse peut cacher tout un campus ou
 * tout un réseau mobile derrière un NAT : la limite d'une requête sans
 * session y est multipliée par `anonymousFactor`.
 */
export function registerRateLimit(
  app: FastifyInstance,
  options: { resolveUserId: SessionUserIdResolver; anonymousFactor: number },
): void {
  // Ce hook doit être posé avant celui du greffon, qui lit la configuration
  // de la route au moment où elle est déclarée. L'objet de configuration
  // n'est jamais modifié en place : il peut être partagé entre plusieurs
  // routes, et chaque GET est redéclaré en HEAD avec le même objet.
  app.addHook("onRoute", (route) => {
    const config = route.config as { rateLimit?: { max?: MaxOption } | false } | undefined;
    const limit = config?.rateLimit;
    if (!limit || limit.max === undefined) return;
    route.config = {
      ...config,
      rateLimit: { ...limit, max: widenForAnonymous(limit.max, options.anonymousFactor) },
    } as typeof route.config;
  });
  // Une erreur de lecture de la session fait échouer la requête : jamais de
  // repli sur la clé par adresse, qui laisserait un compte changer de compteur.
  void app.register(rateLimit, {
    global: false,
    keyGenerator: async (request) => rateLimitKey(await options.resolveUserId(request), request.ip),
  });
}
