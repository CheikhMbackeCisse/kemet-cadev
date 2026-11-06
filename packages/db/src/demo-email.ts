/** Domaine des adresses des comptes de démonstration. Aucune boîte n'existe derrière : le serveur n'y envoie jamais d'email. */
export const DEMO_EMAIL_DOMAIN = "demo.kemetlabs.dev";

/** Vrai pour une adresse du domaine de démonstration ou de l'un de ses sous-domaines, quelle que soit la casse. */
export function isDemoEmailAddress(address: string): boolean {
  const domain = address
    .slice(address.lastIndexOf("@") + 1)
    .trim()
    .toLowerCase()
    .replace(/[>.\s]+$/, "");
  return domain === DEMO_EMAIL_DOMAIN || domain.endsWith(`.${DEMO_EMAIL_DOMAIN}`);
}
