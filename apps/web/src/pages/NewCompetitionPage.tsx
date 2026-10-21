import { useEffect, useState, type FormEvent } from "react";
import { Input } from "../components/ui/Input.js";
import { Textarea } from "../components/ui/Textarea.js";
import { useToast } from "../components/ui/Toast.js";
import { FormPage } from "../components/layout/FormPage.js";
import { ChatApiError, requestCompetition } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { slugify } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";

export function NewCompetitionPage() {
  const toast = useToast();
  const { status } = useSession();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");
  const [submissionClosesAt, setSubmissionClosesAt] = useState("");
  const [votingClosesAt, setVotingClosesAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
  }, [status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestCompetition({
        slug,
        name,
        pitch,
        description,
        registrationClosesAt: new Date(registrationClosesAt).toISOString(),
        submissionClosesAt: new Date(submissionClosesAt).toISOString(),
        votingClosesAt: new Date(votingClosesAt).toISOString(),
      });
      toast.show(fr.competitions.requestSent, "success");
      window.location.href = "/competitions";
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : fr.competitions.requestError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.competitions.requestTitle}
      subtitle={fr.competitions.requestSubtitle}
      activeSection="competitions"
      backHref="/competitions"
      submitLabel={fr.competitions.requestSubmit}
      submitting={submitting}
      submitDisabled={
        !name.trim() ||
        !slug.trim() ||
        !pitch.trim() ||
        !registrationClosesAt ||
        !submissionClosesAt ||
        !votingClosesAt
      }
      error={error}
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.competitions.nameLabel}
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSlug(slugify(event.target.value));
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.competitions.slugLabel}
        <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
        <span className="text-xs text-subtle">{fr.competitions.slugHint}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.competitions.pitchLabel}
        <Input value={pitch} onChange={(event) => setPitch(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.competitions.descriptionLabel}
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxHeight={400}
          className="min-h-32"
        />
      </label>
      <label className="flex max-w-sm flex-col gap-1 text-sm text-text-2">
        {fr.competitions.registrationClosesAtLabel}
        <Input
          type="datetime-local"
          value={registrationClosesAt}
          onChange={(event) => setRegistrationClosesAt(event.target.value)}
        />
      </label>
      <label className="flex max-w-sm flex-col gap-1 text-sm text-text-2">
        {fr.competitions.submissionClosesAtLabel}
        <Input
          type="datetime-local"
          value={submissionClosesAt}
          onChange={(event) => setSubmissionClosesAt(event.target.value)}
        />
      </label>
      <label className="flex max-w-sm flex-col gap-1 text-sm text-text-2">
        {fr.competitions.votingClosesAtLabel}
        <Input
          type="datetime-local"
          value={votingClosesAt}
          onChange={(event) => setVotingClosesAt(event.target.value)}
        />
      </label>
    </FormPage>
  );
}
