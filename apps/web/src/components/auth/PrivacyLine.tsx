import { fr } from "../../i18n/fr.js";

/** Une seule ligne sous les formulaires de compte, avec le lien vers la page de confidentialité. */
export function PrivacyLine() {
  return (
    <p className="text-center text-xs text-auth-text-muted">
      {fr.auth.privacyLineLead}{" "}
      <a href="/confidentialite" className="text-auth-text underline underline-offset-2">
        {fr.auth.privacyLineLink}
      </a>
    </p>
  );
}
