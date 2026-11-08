import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";

/** Octets de `start` à `end` inclus, comme dans un en-tête Range. */
export interface ByteRange {
  start: number;
  end: number;
}

export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string, range?: ByteRange): NodeJS.ReadableStream;
  delete(key: string): Promise<void>;
}

/**
 * Stocke les fichiers envoyés sur le volume disque monté par
 * docker-compose (`UPLOADS_DIR`, voir .env.example). `key` est toujours un
 * UUID généré côté serveur, jamais un nom fourni par le client : aucune
 * entrée utilisateur n'atteint le système de fichiers.
 */
export class LocalDiskStorage implements FileStorage {
  constructor(private readonly rootDir: string) {}

  private pathFor(key: string): string {
    return join(this.rootDir, key);
  }

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  read(key: string, range?: ByteRange): NodeJS.ReadableStream {
    return createReadStream(this.pathFor(key), range);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}

/** Utilisée par les tests et par défaut hors production : rien n'est écrit sur disque. */
export class InMemoryStorage implements FileStorage {
  private readonly files = new Map<string, Buffer>();

  async save(key: string, data: Buffer): Promise<void> {
    this.files.set(key, data);
  }

  read(key: string, range?: ByteRange): NodeJS.ReadableStream {
    const data = this.files.get(key);
    if (!data) throw new Error(`Fichier introuvable en mémoire : ${key}`);
    return Readable.from(range ? data.subarray(range.start, range.end + 1) : data);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}
