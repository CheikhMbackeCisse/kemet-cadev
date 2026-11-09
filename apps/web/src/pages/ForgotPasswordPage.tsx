import { useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Input } from "../components/ui/Input.js";
import { forgotPassword } from "../lib/chat/api.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await forgotPassword(email, "/reinitialiser-mot-de-passe");
    } finally {
      // Toujours le même message, qu'un compte existe ou non pour cette
      // adresse : ne jamais révéler si un email est enregistré.
      setSent(true);
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title={fr.auth.forgotPasswordTitle}>
        <p className="text-sm text-auth-text">{fr.auth.forgotPasswordSent}</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={fr.auth.forgotPasswordTitle}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-auth-text">
          {fr.auth.emailLabel}
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />
        </label>
        <SubmitButton
          variant="inverse"
          label={fr.auth.forgotPasswordSubmit}
          loading={submitting}
          disabledReason={missingFieldsReason([[email, fr.auth.emailLabel]])}
        />
      </form>
    </AuthLayout>
  );
}
