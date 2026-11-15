import { MessagesSquare } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { WorkDetail } from "@kemet/shared";
import { CodeButton } from "../content/CodeButton.js";
import { ComposerBar, ComposerSendButton } from "../composer/ComposerBar.js";
import { RichText } from "../content/RichText.js";
import { usePasteAsCode } from "../content/usePasteAsCode.js";
import { OutgoingMessages } from "../chat/OutgoingMessages.js";
import { ReportMenu } from "../moderation/ReportMenu.js";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { Textarea } from "../ui/Textarea.js";
import { UserName } from "../ui/UserName.js";
import { buildTimeline } from "../../lib/chat/timeline.js";
import { useChannelMessages } from "../../lib/chat/useChannelMessages.js";
import { useChannelDraft } from "../../lib/chat/useChannelDraft.js";
import { fr } from "../../i18n/fr.js";
import { SuggestionChips } from "../chat/SuggestionChips.js";
import { LOCALE } from "../../i18n/language.js";

export interface WorkDiscussionProps {
  work: WorkDetail;
  /** Profil connecté et complet ; `null` pour un visiteur. */
  viewer: { id: string; displayName: string } | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

/** Débuts de message proposés à qui ouvre la discussion pour la première fois. */
export function suggestedMessages(work: { title: string; tags: string[] }): string[] {
  const firstTag = work.tags[0];
  return [
    fr.works.suggestionHello(work.title),
    ...(firstTag ? [fr.works.suggestionTag(firstTag)] : []),
    fr.works.suggestionClose,
  ];
}

/**
 * Discussion publique d'un travail : un salon ordinaire (mêmes routes, même
 * temps réel, mêmes règles de lecture) rendu dans la page du travail. Les
 * auteurs y portent l'étiquette "Auteur".
 */
export function WorkDiscussion({ work, viewer }: WorkDiscussionProps) {
  const channelId = work.discussionChannelId;
  const {
    messages,
    loading,
    error,
    reload,
    outgoing,
    send,
    retry,
    discard,
    hasOlder,
    loadingOlder,
    loadOlder,
  } = useChannelMessages(channelId, viewer !== null);
  const [draft, setDraft] = useChannelDraft(channelId);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const paste = usePasteAsCode(composerRef, setDraft, "-mb-2");
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  // Sur écran tactile, Entrée passe à la ligne : on envoie avec le bouton.
  const enterSends = useMemo(() => !window.matchMedia("(pointer: coarse)").matches, []);

  const authorIds = useMemo(
    () => new Set([work.publisher.id, ...work.coauthors.map((person) => person.id)]),
    [work.publisher.id, work.coauthors],
  );
  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const viewerIsAuthor = viewer !== null && authorIds.has(viewer.id);
  const viewerHasWritten =
    viewer !== null &&
    (outgoing.length > 0 || messages.some((message) => message.authorId === viewer.id));
  const showSuggestions =
    viewer !== null &&
    !viewerIsAuthor &&
    !viewerHasWritten &&
    !suggestionUsed &&
    !loading &&
    draft.trim() === "";

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    composerRef.current?.focus();
    send(body);
  }

  function applySuggestion(text: string) {
    setDraft(text);
    setSuggestionUsed(true);
    requestAnimationFrame(() => {
      const textarea = composerRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(text.length, text.length);
    });
  }

  if (!channelId) {
    return <EmptyState icon={MessagesSquare} message={fr.works.discussionUnavailable} />;
  }

  return (
    <section className="flex flex-col gap-4" aria-label={fr.works.tabDiscussion}>
      {loading ? (
        <div className="flex flex-col gap-3" role="status" aria-label={fr.works.tabDiscussion}>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <ErrorState
          message={fr.works.discussionLoadError}
          retry={{ label: fr.chat.retry, onClick: reload }}
        />
      ) : messages.length === 0 && outgoing.length === 0 ? (
        <p className="text-sm text-text-2">{fr.works.discussionEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {hasOlder && (
            <li className="self-center">
              <Button variant="ghost" onClick={() => void loadOlder()} disabled={loadingOlder}>
                {loadingOlder ? fr.chat.loadingOlder : fr.chat.loadOlder}
              </Button>
            </li>
          )}
          {timeline.map((item) =>
            item.type === "day" ? (
              <li key={item.key} className="flex items-center gap-3 text-xs text-subtle">
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                {item.label}
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </li>
            ) : item.type === "group" ? (
              <li key={item.key} className="flex gap-3">
                <a
                  href={`/u/${item.group.authorHandle}`}
                  aria-label={fr.profile.viewProfile(item.group.authorDisplayName)}
                  className="shrink-0"
                >
                  <Avatar
                    name={item.group.authorDisplayName}
                    src={item.group.authorAvatarUrl ?? undefined}
                    countryCode={item.group.authorCountry ?? undefined}
                  />
                </a>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <UserName
                      name={item.group.authorDisplayName}
                      handle={item.group.authorHandle}
                      level={item.group.authorLevel}
                    />
                    {authorIds.has(item.group.authorId) && <Badge>{fr.works.authorTag}</Badge>}
                    <time
                      dateTime={item.group.messages[0]!.createdAt}
                      className="text-xs text-subtle"
                    >
                      {formatTime(item.group.messages[0]!.createdAt)}
                    </time>
                  </div>
                  {item.group.messages.map((message) => (
                    <div key={message.id} className="group/message relative flex items-start gap-2">
                      <RichText
                        source={message.body}
                        className="min-w-0 flex-1 text-base text-text"
                      />
                      {viewer && viewer.id !== message.authorId && (
                        // Visible au survol et au focus sur bureau, toujours sur écran tactile.
                        <div className="shrink-0 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/message:opacity-100 max-md:opacity-100">
                          <ReportMenu
                            contentType="message"
                            contentId={message.id}
                            authorId={message.authorId}
                            authorHandle={message.authorHandle}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            ) : null,
          )}
        </ol>
      )}

      {viewer && outgoing.length > 0 && (
        <OutgoingMessages
          messages={outgoing}
          authorDisplayName={viewer.displayName}
          onRetry={retry}
          onDiscard={discard}
        />
      )}

      {viewer ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {showSuggestions && (
            <SuggestionChips suggestions={suggestedMessages(work)} onPick={applySuggestion} />
          )}
          {paste.notice}
          <ComposerBar
            field={
              <Textarea
                ref={composerRef}
                placeholder={fr.works.discussionPlaceholder}
                aria-label={fr.works.discussionPlaceholder}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onPaste={paste.handlePaste}
                onKeyDown={(event) => {
                  if (
                    enterSends &&
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                enterKeyHint={enterSends ? "send" : "enter"}
                variant="composer"
              />
            }
            tools={<CodeButton appearance="icon" textareaRef={composerRef} onChange={setDraft} />}
            action={<ComposerSendButton ready={Boolean(draft.trim())} onClick={handleSend} />}
          />
        </div>
      ) : (
        <a
          href="/connexion"
          className="inline-flex items-center text-sm text-link hover:underline max-md:min-h-control-mobile"
        >
          {fr.works.discussionSignIn}
        </a>
      )}
    </section>
  );
}
