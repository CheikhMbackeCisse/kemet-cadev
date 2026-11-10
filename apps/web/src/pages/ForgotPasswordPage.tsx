import { useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Input } from "../components/ui/Input.js";
import { forgotPassword } from "../lib/chat/api.js";
import { FormField } from "../components/ui/FormField.js";
import { useFieldErrors } from "../lib/useFieldErrors.js";
import { requiredFieldErrors } from "../lib/forms.js";
import { fr } from "../i18n/fr.js";
import { ArrivalAction } from "../components/arrival/ArrivalAction.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { formRef, errors: fieldErrors, report } = useFieldErrors<"email">();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!report(requiredFieldErrors({ email }))) return;
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
      <form
        ref={formRef}
        noValidate
        className="relative flex flex-col gap-3"
        onSubmit={handleSubmit}
      >
        <FormField tone="inverse" label={fr.auth.emailLabel} error={fieldErrors.email}>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />
        </FormField>
        <ArrivalAction>
          <SubmitButton
            variant="inverse"
            label={fr.auth.forgotPasswordSubmit}
            loading={submitting}
          />
        </ArrivalAction>
      </form>
    </AuthLayout>
  );
}
