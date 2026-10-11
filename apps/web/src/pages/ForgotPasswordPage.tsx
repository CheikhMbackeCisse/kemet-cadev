import { useState } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { forgotPassword } from "../lib/chat/api.js";
import { fr } from "../i18n/fr.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
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
        <p className="text-sm text-text-2">{fr.auth.forgotPasswordSent}</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={fr.auth.forgotPasswordTitle} subtitle={fr.auth.forgotPasswordSubtitle}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.emailLabel}
          <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus />
        </label>
        <Button onClick={handleSubmit} loading={submitting} disabled={!email.trim()}>
          {fr.auth.forgotPasswordSubmit}
        </Button>
      </div>
    </AuthLayout>
  );
}
