import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
import { Input } from "../components/ui/Input.js";
import { useToast } from "../components/ui/Toast.js";
import { FormPage } from "../components/layout/FormPage.js";
import { ChatApiError, requestCompetition } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { createWithSlugFromTitle } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";
import { hasFieldErrors, validateFields, type FieldErrors } from "../lib/forms.js";
import { FormField } from "../components/ui/FormField.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";

export function NewCompetitionPage() {
  const toast = useToast();
  const { status } = useSession();
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");
  const [submissionClosesAt, setSubmissionClosesAt] = useState("");
  const [votingClosesAt, setVotingClosesAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<"name" | "pitch" | "registration" | "submission" | "voting">
  >({});

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = validateFields({
      name: { value: name, min: 2 },
      pitch: { value: pitch, min: 10 },
      registration: { value: registrationClosesAt },
      submission: { value: submissionClosesAt },
      voting: { value: votingClosesAt },
    });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setSubmitting(true);
    try {
      await createWithSlugFromTitle(name, "competition", (slug) =>
        requestCompetition({
          slug,
          name,
          pitch,
          description,
          registrationClosesAt: new Date(registrationClosesAt).toISOString(),
          submissionClosesAt: new Date(submissionClosesAt).toISOString(),
          votingClosesAt: new Date(votingClosesAt).toISOString(),
        }),
      );
      toast.show(fr.competitions.requestSent, "success");
      navigate("/competitions");
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : fr.competitions.requestError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.competitions.requestTitle}
      activeSection="competitions"
      backHref="/competitions"
      submitLabel={fr.competitions.requestSubmit}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    >
      <FormField label={fr.competitions.nameLabel} error={fieldErrors.name}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <FormField label={fr.competitions.pitchLabel} error={fieldErrors.pitch}>
        <Input value={pitch} onChange={(event) => setPitch(event.target.value)} />
      </FormField>
      <CodeTextarea
        label={fr.competitions.descriptionLabel}
        value={description}
        onValueChange={setDescription}
      />
      <FormField label={fr.competitions.registrationClosesAtLabel} error={fieldErrors.registration}>
        <Input
          type="datetime-local"
          value={registrationClosesAt}
          onChange={(event) => setRegistrationClosesAt(event.target.value)}
        />
      </FormField>
      <FormField label={fr.competitions.submissionClosesAtLabel} error={fieldErrors.submission}>
        <Input
          type="datetime-local"
          value={submissionClosesAt}
          onChange={(event) => setSubmissionClosesAt(event.target.value)}
        />
      </FormField>
      <FormField label={fr.competitions.votingClosesAtLabel} error={fieldErrors.voting}>
        <Input
          type="datetime-local"
          value={votingClosesAt}
          onChange={(event) => setVotingClosesAt(event.target.value)}
        />
      </FormField>
    </FormPage>
  );
}
