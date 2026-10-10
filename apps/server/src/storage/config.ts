export interface AttachmentLimits {
  maxAttachmentBytes: number;
  maxUserStorageBytes: number;
}

const DEFAULT_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_USER_STORAGE_BYTES = 500 * 1024 * 1024;

/**
 * docker-compose substitue une chaîne vide, pas une variable absente, pour
 * tout `${VAR}` non défini dans `.env` (voir infra/docker-compose.yml) :
 * `??` ne suffit pas, une chaîne vide n'est pas nullish mais donnerait
 * `Number("") === 0` si on la convertissait quand même.
 */
function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadAttachmentLimits(env: NodeJS.ProcessEnv = process.env): AttachmentLimits {
  return {
    maxAttachmentBytes: readPositiveInt(env.MAX_ATTACHMENT_BYTES, DEFAULT_MAX_ATTACHMENT_BYTES),
    maxUserStorageBytes: readPositiveInt(env.MAX_USER_STORAGE_BYTES, DEFAULT_MAX_USER_STORAGE_BYTES),
  };
}
