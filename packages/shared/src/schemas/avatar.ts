/** Photo de profil envoyée par la personne : 2 Mo au plus, PNG, JPEG ou WebP. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/** Plus grand côté accepté, en pixels. */
export const AVATAR_MAX_SIDE_PX = 4096;
