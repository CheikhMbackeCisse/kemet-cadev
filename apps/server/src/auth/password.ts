import { hash, verify } from "@node-rs/argon2";

/** Argon2id (m=19456, t=2, p=1, défauts du paquet) plutôt que le Scrypt de Better Auth. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(data: { hash: string; password: string }): Promise<boolean> {
  return verify(data.hash, data.password);
}
