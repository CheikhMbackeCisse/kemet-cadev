import { navigate } from "../lib/navigation/navigate.js";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  forgetPost,
  postFeedbackQueryKey,
  postFromFeedCache,
  postQueryKey,
  postRepliesQueryKey,
} from "../lib/feed/feedQuery.js";
import {
  isDeletedAccountHandle,
  KEMET_HANDLE,
  type PostFeedbackEntry,
  type PostReply,
  type PostSummary,
} from "@kemet/shared";
import {
  ChatApiError,
  createPostFeedback,
  createPostReply,
  deletePost,
  deletePostReply,
  getPost,
  listPostFeedback,
  listPostReplies,
  markPostReplySolution,
  retryPostAssistant,
  sendAssistantFeedback,
  setPostBookmark,
  togglePostReaction,
} from "../lib/chat/api.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Textarea } from "../components/ui/Textarea.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";
import { PostCard, PostCardSkeleton } from "../components/feed/PostCard.js";
import { RichText } from "../components/content/RichText.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";
import { SuspendedBanner } from "../components/shell/SuspendedBanner.js";
import { useSession } from "../session/SessionProvider.js";
import { WorkMatchPanel } from "../components/works/WorkMatchPanel.js";
import { fr } from "../i18n/fr.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";
import { CodeButton } from "../components/content/CodeButton.js";
import { usePasteAsCode } from "../components/content/usePasteAsCode.js";
import { authorLevel, ProfileLink } from "../components/ui/ProfileLink.js";
import { AssistantMessage, skillReferenceFrom } from "../components/assistant/AssistantMessage.js";
import { AssistantFailureNotice } from "../components/assistant/AssistantFailureNotice.js";
import { KemetSymbol } from "../components/ui/KemetSymbol.js";
import { usePostAssistant } from "../lib/feed/usePostAssistant.js";
import {
  ASK_KEMET_PARAM,
  EXPLAIN_POST_PROMPT,
  isTechnicalPost,
} from "../lib/feed/technicalPost.js";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readPostId(pathname: string): string {
  return pathname.replace(/^\/fil\//, "");
}

export function PostPage() {
  const toast = useToast();
  // Lu une seule fois : pendant le retour vers une autre page, celle-ci reste
  // affichée alors que l'adresse a déjà changé.
  const [postId] = useState(() => readPostId(window.location.pathname));
  const { status, profile, isSuspended } = useSession();
  const canInteract = status === "ready" && !isSuspended;
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const queryClient = useQueryClient();

  // Ouvert depuis le fil, le post s'affiche tout de suite avec ce que le fil
  // en sait, puis se met à jour.
  const postQuery = useQuery({
    queryKey: postQueryKey(postId),
    queryFn: () => getPost(postId).then((result) => result.post),
    initialData: () => postFromFeedCache(queryClient, postId),
    initialDataUpdatedAt: 0,
  });
  // Un 404 l'emporte sur ce que le fil savait : le post a été supprimé ou
  // masqué depuis.
  const notFound = postQuery.error instanceof ChatApiError && postQuery.error.statusCode === 404;
  const post = notFound ? null : (postQuery.data ?? null);
  const loading = postQuery.isPending;
  const error = !post && postQuery.isError && !notFound;
  useEffect(() => {
    if (notFound) forgetPost(queryClient, postId);
  }, [notFound, queryClient, postId]);
  const setPost = useCallback(
    (update: SetStateAction<PostSummary | null>) =>
      queryClient.setQueryData<PostSummary | null>(postQueryKey(postId), (current) =>
        typeof update === "function" ? update(current ?? null) : update,
      ),
    [queryClient, postId],
  );

  const repliesQuery = useQuery({
    queryKey: postRepliesQueryKey(postId),
    queryFn: () => listPostReplies(postId).then((page) => page.items),
  });
  const replies = repliesQuery.data ?? [];
  const setReplies = useCallback(
    (update: (current: PostReply[]) => PostReply[]) =>
      queryClient.setQueryData<PostReply[]>(postRepliesQueryKey(postId), (current) =>
        update(current ?? []),
      ),
    [queryClient, postId],
  );

  const [replyDraft, setReplyDraft] = useState("");
  const replyPaste = usePasteAsCode(replyTextareaRef, setReplyDraft, "-mb-2");
  const [replyToDelete, setReplyToDelete] = useState<string | null>(null);

  const feedbackQuery = useQuery({
    queryKey: postFeedbackQueryKey(postId),
    queryFn: () => listPostFeedback(postId).then((result) => result.items),
    enabled: post?.format === "a_tester",
  });
  const feedback = feedbackQuery.data ?? [];
  function setFeedback(update: (current: PostFeedbackEntry[]) => PostFeedbackEntry[]) {
    queryClient.setQueryData<PostFeedbackEntry[]>(postFeedbackQueryKey(postId), (current) =>
      update(current ?? []),
    );
  }
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const appendReply = useCallback(
    (reply: PostReply) => {
      setReplies((current) =>
        current.some((item) => item.id === reply.id) ? current : [...current, reply],
      );
      setPost((current) =>
        current ? { ...current, replyCount: current.replyCount + 1 } : current,
      );
    },
    [setReplies, setPost],
  );
  const assistant = usePostAssistant(appendReply);

  function prepareKemetQuestion() {
    // Ce qui était déjà écrit reste, sous la question.
    setReplyDraft((draft) =>
      draft.trim() && !draft.includes(EXPLAIN_POST_PROMPT)
        ? `${EXPLAIN_POST_PROMPT}\n\n${draft}`
        : draft.trim()
          ? draft
          : EXPLAIN_POST_PROMPT,
    );
    // Après le rendu : le champ reçoit la question avant le focus.
    requestAnimationFrame(() => {
      const textarea = replyTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }

  // Pastille du fil : la question est préparée ici, jamais envoyée seule.
  const askedFromFeed = useRef(false);
  useEffect(() => {
    if (askedFromFeed.current || !canInteract || !post) return;
    if (new URLSearchParams(window.location.search).get(ASK_KEMET_PARAM) !== "kemet") return;
    askedFromFeed.current = true;
    prepareKemetQuestion();
  }, [canInteract, post]);

  function loadPost() {
    void postQuery.refetch();
  }

  async function handleReact() {
    if (!post) return;
    try {
      const result = await togglePostReaction(post.id);
      setPost({ ...post, utileCount: result.utileCount, reactedByMe: result.reactedByMe });
    } catch {
      toast.show(fr.feed.reactError, "danger");
    }
  }

  async function handleSave() {
    if (!post) return;
    try {
      const result = await setPostBookmark(post.id, !post.savedByMe);
      setPost({ ...post, savedByMe: result.savedByMe });
      toast.show(result.savedByMe ? fr.feed.savedToast : fr.feed.unsavedToast, "success");
    } catch {
      toast.show(fr.feed.saveError, "danger");
    }
  }

  async function handleDeletePost() {
    if (!post) return;
    setDeleteOpen(false);
    try {
      await deletePost(post.id);
      forgetPost(queryClient, post.id);
      navigate("/fil");
    } catch {
      toast.show(fr.feed.postDeleteError, "danger");
    }
  }

  async function sendReply(body: string) {
    try {
      const result = await createPostReply(postId, { body });
      appendReply(result.reply);
      setReplyDraft("");
      assistant.track(result.assistant);
    } catch {
      toast.show(fr.feed.replySendError, "danger");
    }
  }

  async function handleReply() {
    const body = replyDraft.trim();
    if (!body) return;
    await sendReply(body);
  }

  async function retryAssistant(invocationId: string) {
    try {
      const result = await retryPostAssistant(invocationId);
      assistant.track(result.assistant);
    } catch {
      toast.show(fr.chat.assistantFailed, "danger");
    }
  }

  async function handleAssistantFeedback(invocationId: string, helpful: boolean) {
    try {
      await sendAssistantFeedback(invocationId, helpful);
    } catch {
      toast.show(fr.feed.reactError, "danger");
    }
  }

  async function handleDeleteReply(replyId: string) {
    setReplyToDelete(null);
    try {
      await deletePostReply(replyId);
      setReplies((current) => current.filter((reply) => reply.id !== replyId));
      setPost((current) =>
        current ? { ...current, replyCount: Math.max(0, current.replyCount - 1) } : current,
      );
    } catch {
      toast.show(fr.feed.replyDeleteError, "danger");
    }
  }

  async function handleToggleSolution(reply: PostReply) {
    try {
      const { reply: updated } = await markPostReplySolution(reply.id, !reply.isSolution);
      setReplies((current) =>
        current.map((item) => (item.id === updated.id ? updated : { ...item, isSolution: false })),
      );
    } catch {
      toast.show(fr.feed.solutionError, "danger");
    }
  }

  async function handleSubmitFeedback() {
    setFeedbackError(null);
    try {
      const { feedback: created } = await createPostFeedback(postId, feedbackBody.trim());
      setFeedback((current) => [created, ...current]);
      setFeedbackOpen(false);
      setFeedbackBody("");
      toast.show(fr.feed.feedbackSent, "success");
    } catch (err) {
      setFeedbackError(
        err instanceof ChatApiError && err.statusCode === 409
          ? fr.feed.feedbackAlready
          : fr.feed.feedbackError,
      );
    }
  }

  const header = (
    <div className="flex items-center justify-between">
      <a href="/fil" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {fr.feed.back}
      </a>
    </div>
  );

  if (loading || notFound || error || !post) {
    return (
      <ReadingPage
        activeSection="fil"
        width="feed"
        header={header}
        state={
          loading
            ? { kind: "loading" }
            : notFound
              ? {
                  kind: "notFound",
                  message: fr.feed.postNotFound,
                  retry: { label: fr.feed.back, onClick: () => navigate("/fil") },
                }
              : {
                  kind: "error",
                  message: fr.feed.loadingError,
                  retry: { label: fr.chat.retry, onClick: loadPost },
                }
        }
        loadingSkeleton={<PostCardSkeleton />}
      />
    );
  }

  const isOwnPost = profile !== null && profile.id === post.authorId && !post.deletedAt;
  // Une réponse de @kemet se retire par qui l'a demandée ou par l'auteur du post.
  const canRemoveAssistantReply = (reply: PostReply) =>
    canInteract &&
    !reply.deletedAt &&
    (isOwnPost || (profile !== null && reply.assistant?.requestedBy === profile.id));
  const hasGivenFeedback =
    profile !== null && feedback.some((entry) => entry.authorId === profile.id);

  return (
    <>
      <ReadingPage
        activeSection="fil"
        width="feed"
        header={header}
        className="pb-[calc(76px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-8"
      >
        {status === "visitor" && <VisitorBanner />}
        {isSuspended && <SuspendedBanner />}

        <PostCard
          post={post}
          canInteract={canInteract}
          isOwnPost={isOwnPost}
          canFeedback={canInteract && post.format === "a_tester" && !hasGivenFeedback}
          canReport={canInteract && !post.deletedAt}
          onReact={handleReact}
          onSave={handleSave}
          onFeedback={() => setFeedbackOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onReply={() => replyTextareaRef.current?.focus()}
          askKemet={
            canInteract && isTechnicalPost(post.body)
              ? { onClick: prepareKemetQuestion }
              : undefined
          }
        />

        {post.format === "question" && !post.deletedAt && (
          <WorkMatchPanel subject={{ type: "post", id: post.id }} />
        )}

        {post.format === "a_tester" && feedback.length > 0 && (
          <Card variant="plain" padding="compact" className="flex flex-col gap-2">
            <p className="text-md font-semibold text-text">{fr.feed.feedbackTitle}</p>
            {feedback.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-0.5">
                <ProfileLink handle={entry.authorHandle} className="flex w-fit items-center gap-2">
                  <Avatar
                    deleted={isDeletedAccountHandle(entry.authorHandle)}
                    name={entry.authorDisplayName}
                    src={entry.authorAvatarUrl ?? undefined}
                    size={32}
                    countryCode={entry.authorCountry}
                  />
                  <UserName
                    name={entry.authorDisplayName}
                    level={authorLevel(entry.authorHandle, entry.authorLevel)}
                  />
                </ProfileLink>
                <RichText source={entry.body} className="text-sm text-text-2" />
              </div>
            ))}
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {post.replyCount > 0 && (
            <p className="text-md font-semibold text-text">{fr.feed.replyCount(post.replyCount)}</p>
          )}
          {replies.length === 0 ? (
            <EmptyState message={fr.feed.noReplies} />
          ) : (
            replies.map((reply) =>
              reply.authorHandle === KEMET_HANDLE && reply.assistant ? (
                <div key={reply.id} className="flex flex-col gap-1">
                  <AssistantMessage
                    content={
                      reply.deletedAt ? fr.chat.messageDeleted : <RichText source={reply.body} />
                    }
                    skill={
                      reply.assistant.skill ? skillReferenceFrom(reply.assistant.skill) : undefined
                    }
                    recorded={reply.assistant.recorded}
                    initialFeedback={
                      reply.assistant.helpful === true
                        ? "helpful"
                        : reply.assistant.helpful === false
                          ? "not-helpful"
                          : null
                    }
                    // L'avis rapporte des points : réservé à qui a posé la
                    // question et à l'auteur du post (règle côté serveur).
                    hideFeedback={
                      !canInteract || (profile?.id !== reply.assistant.requestedBy && !isOwnPost)
                    }
                    onFeedback={(helpful) =>
                      void handleAssistantFeedback(reply.assistant!.invocationId, helpful)
                    }
                  />
                  {(reply.isSolution ||
                    (isOwnPost && post.format === "question") ||
                    canRemoveAssistantReply(reply)) && (
                    <div className="flex items-center gap-2">
                      {reply.isSolution && <Badge tone="success">{fr.feed.solutionBadge}</Badge>}
                      {isOwnPost && post.format === "question" && !reply.deletedAt && (
                        <button
                          type="button"
                          onClick={() => handleToggleSolution(reply)}
                          className="text-xs text-link hover:underline"
                        >
                          {reply.isSolution ? fr.feed.unmarkSolution : fr.feed.markSolution}
                        </button>
                      )}
                      {canRemoveAssistantReply(reply) && (
                        <IconButton
                          aria-label={fr.feed.delete}
                          onClick={() => setReplyToDelete(reply.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div key={reply.id} className="flex gap-3">
                  <ProfileLink
                    handle={reply.authorHandle}
                    aria-label={fr.profile.viewProfile(reply.authorDisplayName)}
                  >
                    <Avatar
                      deleted={isDeletedAccountHandle(reply.authorHandle)}
                      name={reply.authorDisplayName}
                      src={reply.authorAvatarUrl ?? undefined}
                      countryCode={reply.authorCountry}
                    />
                  </ProfileLink>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <UserName
                        name={reply.authorDisplayName}
                        handle={reply.authorHandle}
                        level={authorLevel(reply.authorHandle, reply.authorLevel)}
                      />
                      <span className="text-xs text-subtle">{formatTime(reply.createdAt)}</span>
                      {reply.isSolution && <Badge tone="success">{fr.feed.solutionBadge}</Badge>}
                    </div>
                    {reply.deletedAt ? (
                      <p className="mt-0.5 text-sm text-text">{fr.chat.messageDeleted}</p>
                    ) : (
                      <RichText source={reply.body} className="mt-0.5 text-sm text-text" />
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      {isOwnPost && post.format === "question" && !reply.deletedAt && (
                        <button
                          type="button"
                          onClick={() => handleToggleSolution(reply)}
                          className="text-xs text-link hover:underline"
                        >
                          {reply.isSolution ? fr.feed.unmarkSolution : fr.feed.markSolution}
                        </button>
                      )}
                      {profile?.id === reply.authorId && !reply.deletedAt && (
                        <IconButton
                          aria-label={fr.feed.delete}
                          onClick={() => setReplyToDelete(reply.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      )}
                    </div>
                  </div>
                </div>
              ),
            )
          )}
          {assistant.isPending && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-card border border-assistant-border bg-assistant-bg px-4 py-3 text-sm text-text-2"
            >
              <KemetSymbol className="size-5 motion-safe:animate-pulse" />
              {fr.feed.assistantPending}
            </div>
          )}
          {canInteract && assistant.failure && (
            <AssistantFailureNotice
              errorCode={assistant.failure.errorCode}
              onRetry={
                assistant.failure.invocationId === null
                  ? null
                  : () => {
                      const invocationId = assistant.failure!.invocationId!;
                      assistant.dismissFailure();
                      void retryAssistant(invocationId);
                      replyTextareaRef.current?.focus();
                    }
              }
              onDismiss={() => {
                assistant.dismissFailure();
                replyTextareaRef.current?.focus();
              }}
            />
          )}
          {canInteract && (
            <div className="flex flex-col gap-2">
              {replyPaste.notice}
              <div className="flex gap-2">
                <CodeButton textareaRef={replyTextareaRef} onChange={setReplyDraft} />
                <Textarea
                  ref={replyTextareaRef}
                  placeholder={fr.feed.replyPlaceholder}
                  aria-label={fr.feed.replyPlaceholder}
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  onPaste={replyPaste.handlePaste}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleReply();
                    }
                  }}
                  variant="composer"
                  className="max-md:min-h-11 flex-1"
                />
                <Button onClick={handleReply} disabled={!replyDraft.trim()}>
                  {fr.feed.reply}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen} title={fr.feed.feedbackTitle}>
          <div className="flex flex-col gap-3">
            <CodeTextarea
              placeholder={fr.feed.feedbackPlaceholder}
              aria-label={fr.feed.feedbackPlaceholder}
              value={feedbackBody}
              onValueChange={setFeedbackBody}
              autoFocus
            />
            {feedbackError && (
              <p className="text-sm text-danger" role="alert">
                {feedbackError}
              </p>
            )}
            <Button onClick={handleSubmitFeedback} disabled={!feedbackBody.trim()}>
              {fr.feed.feedbackSubmit}
            </Button>
          </div>
        </Dialog>

        <Dialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={fr.feed.delete}
          description={fr.feed.deleteConfirm}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {fr.feed.cancel}
            </Button>
            <Button variant="danger" onClick={handleDeletePost}>
              {fr.feed.delete}
            </Button>
          </div>
        </Dialog>

        <Dialog
          open={replyToDelete !== null}
          onOpenChange={(open) => !open && setReplyToDelete(null)}
          title={fr.feed.delete}
          description={fr.feed.replyDeleteConfirm}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReplyToDelete(null)}>
              {fr.feed.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => replyToDelete && handleDeleteReply(replyToDelete)}
            >
              {fr.feed.delete}
            </Button>
          </div>
        </Dialog>
      </ReadingPage>
    </>
  );
}
