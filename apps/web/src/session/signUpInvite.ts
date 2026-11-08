/** Une action réservée aux comptes, déclenchée par un visiteur, mène à l'inscription plutôt qu'à une erreur. */
export const SIGN_UP_PATH = "/inscription";

export function goToSignUp(): void {
  window.location.href = SIGN_UP_PATH;
}
