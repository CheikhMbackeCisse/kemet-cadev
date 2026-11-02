export interface PrivacyContact {
  name: string;
  email: string;
}

// docker-compose transmet une chaîne vide pour une variable non définie. Une
// ligne de contact sans nom ou sans adresse ne servirait à rien : les deux
// sont exigées, sinon la page la masque.
export function loadPrivacyContact(env: NodeJS.ProcessEnv = process.env): PrivacyContact | null {
  const name = env.PRIVACY_CONTACT_NAME?.trim();
  const email = env.PRIVACY_CONTACT_EMAIL?.trim();
  return name && email ? { name, email } : null;
}
