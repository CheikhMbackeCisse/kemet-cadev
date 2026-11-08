import { DEFAULT_MAX_WORK_VIDEO_BYTES } from "@kemet/shared";

export interface AttachmentLimits {
  maxAttachmentBytes: number;
  maxUserStorageBytes: number;
  /** Vidéo d'un travail. Absente des réglages de test : valeur de `@kemet/shared`. */
  maxWorkVideoBytes?: number;
}

const DEFAULT_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_USER_STORAGE_BYTES = 500 * 1024 * 1024;

// docker-compose transmet une chaîne vide pour une variable non définie :
// `??` ne suffit pas, et Number("") vaut 0.
function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadAttachmentLimits(env: NodeJS.ProcessEnv = process.env): AttachmentLimits {
  return {
    maxAttachmentBytes: readPositiveInt(env.MAX_ATTACHMENT_BYTES, DEFAULT_MAX_ATTACHMENT_BYTES),
    maxUserStorageBytes: readPositiveInt(env.MAX_USER_STORAGE_BYTES, DEFAULT_MAX_USER_STORAGE_BYTES),
    maxWorkVideoBytes: readPositiveInt(env.WORK_VIDEO_MAX_BYTES, DEFAULT_MAX_WORK_VIDEO_BYTES),
  };
}
