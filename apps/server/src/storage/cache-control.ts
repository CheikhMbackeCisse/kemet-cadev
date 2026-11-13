// Un fichier envoyé n'est jamais réécrit : un nouvel envoi reçoit un nouvel
// identifiant, donc une nouvelle adresse. Le navigateur peut le garder sans
// jamais redemander.

/** Fichier lisible sans compte (image de post, média ou PDF d'un travail). */
export const PUBLIC_FILE_CACHE = "public, max-age=31536000, immutable";

/**
 * Fichier d'un salon ou d'une conversation : gardé par le seul navigateur de
 * la personne qui y avait accès, jamais par un cache partagé, et redemandé
 * au bout d'une semaine pour qu'un accès retiré finisse par compter.
 */
export const PRIVATE_FILE_CACHE = "private, max-age=604800";
