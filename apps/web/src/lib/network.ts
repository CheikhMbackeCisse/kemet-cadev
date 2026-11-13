// API Network Information : Chrome et Android seulement, absente des types DOM.
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);

/**
 * Vrai quand la personne a demandé d'économiser les données ou que le
 * navigateur estime la connexion à la 3G ou moins. Sans l'information
 * (Safari, Firefox), la connexion compte comme normale.
 */
export function isSlowConnection(connection = readConnection()): boolean {
  if (!connection) return false;
  return connection.saveData === true || SLOW_EFFECTIVE_TYPES.has(connection.effectiveType ?? "");
}

function readConnection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}
