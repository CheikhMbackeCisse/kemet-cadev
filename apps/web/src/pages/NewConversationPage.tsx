import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
import { FormPage } from "../components/layout/FormPage.js";
import { Textarea } from "../components/ui/Textarea.js";
import { ChatApiError, openConversation } from "../lib/chat/api.js";
import { parseHandles } from "../lib/messaging/conversationLabels.js";
import { FormField } from "../components/ui/FormField.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

/** Préremplie par `?a=identifiant` : "Écrire" sur un profil peut passer par ici. */
function readInitialHandles(): string {
  return new URLSearchParams(window.location.search).getAll("a").join(", ");
}

export function NewConversationPage() {
  const { status, isSuspended } = useSession();
  const [handles, setHandles] = useState(readInitialHandles);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handlesError, setHandlesError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  const parsed = parseHandles(handles);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const fieldError = !parsed.ok
      ? parsed.error
      : parsed.handles.length === 0
        ? fr.common.requiredField
        : null;
    setHandlesError(fieldError);
    if (!parsed.ok || fieldError) return;
    setSubmitting(true);
    try {
      const { conversation } = await openConversation(parsed.handles);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      // Le serveur nomme l'identifiant introuvable ou bloqué : son message est le plus utile.
      setError(
        err instanceof ChatApiError && err.statusCode < 500 ? err.message : fr.messages.writeError,
      );
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.messages.newTitle}
      activeSection="messages"
      backHref="/messages"
      submitLabel={fr.messages.open}
      submitting={submitting}
      submitDisabled={isSuspended}
      error={error}
      onSubmit={handleSubmit}
    >
      <FormField label={fr.messages.handlesLabel} error={handlesError}>
        <Textarea
          variant="form"
          placeholder={fr.messages.handlesPlaceholder}
          value={handles}
          onChange={(event) => setHandles(event.target.value)}
        />
      </FormField>
      <p className="text-xs text-subtle">{fr.messages.privacyNote}</p>
    </FormPage>
  );
}
