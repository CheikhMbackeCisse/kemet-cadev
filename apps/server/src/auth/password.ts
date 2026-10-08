import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id (paramètres par défaut du paquet : m=19456, t=2, p=1), demandé par
 * nos règles de sécurité plutôt que le hachage par défaut de Better Auth (Scrypt).
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(data: { hash: string; password: string }): Promise<boolean> {
  return verify(data.hash, data.password);
}
