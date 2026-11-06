import { Paperclip, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import type { Attachment } from "@kemet/shared";
import { ChatApiError, uploadAttachment } from "../../lib/chat/api.js";
import { takeDraftFocusRequest, useChannelDraft } from "../../lib/chat/useChannelDraft.js";
import { fr } from "../../i18n/fr.js";
import { SuggestionChips } from "../chat/SuggestionChips.js";
import { CodeButton } from "../content/CodeButton.js";
import { usePasteAsCode } from "../content/usePasteAsCode.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { Textarea } from "../ui/Textarea.js";
import { useToast } from "../ui/Toast.js";

export interface MessageComposerProps {
  channelId: string;
  placeholder: string;
  onSend: (body: string, attachmentIds: string[]) => void;
  /** Texte d'aide sous le champ, lu avec lui par les lecteurs d'écran. */
  notice?: string;
  /** Pour que la conversation rende le focus au champ après une action. */
  textareaRef: RefObject<HTMLTextAreaElement>;
  /** Débuts de message proposés tant que le champ est vide et qu'aucun n'a été choisi. */
  suggestions?: string[];
}

/**
 * Composeur d'une conversation privée : même comportement que celui d'un
 * salon (brouillon par salon, bouton Code, collage en bloc de code, fichiers,
 * Entrée qui envoie sauf sur écran tactile), sans mentions ni @kemet.
 */
export function MessageComposer({
  channelId,
  placeholder,
  onSend,
  notice,
  textareaRef,
  suggestions,
}: MessageComposerProps) {
  const toast = useToast();
  const [draft, setDraft] = useChannelDraft(channelId);
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const composerRef = textareaRef;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paste = usePasteAsCode(composerRef, setDraft, "-mb-2");
  const enterSends = useMemo(() => !window.matchMedia("(pointer: coarse)").matches, []);
  const noticeId = `composer-notice-${channelId}`;

  // Une pièce jointe appartient à son salon : le serveur la refuserait ailleurs.
  useEffect(() => setPendingAttachments([]), [channelId]);

  // Sur mobile, le clavier ouvert cacherait la conversation : le focus attend un appui.
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer || !takeDraftFocusRequest(channelId)) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    composer.focus();
    composer.setSelectionRange(composer.value.length, composer.value.length);
  }, [channelId]);

  function send() {
    const body = draft.trim();
    if (!body && pendingAttachments.length === 0) return;
    onSend(
      body,
      pendingAttachments.map((attachment) => attachment.id),
    );
    setDraft("");
    setPendingAttachments([]);
    composerRef.current?.focus();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const attachment = await uploadAttachment(channelId, file);
      setPendingAttachments((current) => [...current, attachment]);
    } catch (error) {
      toast.show(error instanceof ChatApiError ? error.message : fr.chat.attachmentUploadError, "danger");
    } finally {
      setUploading(false);
    }
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

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
      {suggestions && !suggestionUsed && draft.trim() === "" && (
        <SuggestionChips suggestions={suggestions} onPick={applySuggestion} />
      )}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingAttachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1 rounded-full bg-surface-2 pl-2 text-xs text-text"
            >
              {attachment.originalName}
              <IconButton
                aria-label={fr.chat.removeAttachment(attachment.originalName)}
                onClick={() =>
                  setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))
                }
                className="size-control-compact max-md:size-control-mobile"
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </span>
          ))}
        </div>
      )}
      {paste.notice}
      <div className="flex gap-2">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
        <IconButton aria-label={fr.chat.attachFile} onClick={() => fileInputRef.current?.click()} loading={uploading}>
          <Paperclip className="size-4" aria-hidden="true" />
        </IconButton>
        <CodeButton textareaRef={composerRef} onChange={setDraft} />
        <Textarea
          ref={composerRef}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={notice ? noticeId : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onPaste={paste.handlePaste}
          enterKeyHint={enterSends ? "send" : "enter"}
          onKeyDown={(event) => {
            if (enterSends && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          variant="composer"
          className="max-md:min-h-11 flex-1 rounded-card"
        />
        <Button
          onClick={send}
          // Garde le focus (et le clavier mobile ouvert) dans le composeur.
          onPointerDown={(event) => event.preventDefault()}
          aria-label={fr.chat.send}
          disabled={uploading}
          className="max-md:size-control-mobile max-md:px-0"
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {notice && (
        <p id={noticeId} className="text-xs text-subtle">
          {notice}
        </p>
      )}
    </div>
  );
}
