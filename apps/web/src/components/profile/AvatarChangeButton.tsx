import { Camera, Plus } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@kemet/shared";
import { ChatApiError, uploadMyAvatar } from "../../lib/chat/api.js";
import { cn } from "../../lib/cn.js";
import { useSession } from "../../session/SessionProvider.js";
import { Button } from "../ui/Button.js";
import { useToast } from "../ui/Toast.js";
import { fr } from "../../i18n/fr.js";

export interface AvatarChangeButtonProps {
  hasPhoto: boolean;
  /** "badge" : petit "+" rond posé sur la photo ; "button" : bouton ordinaire. */
  variant: "badge" | "button";
  disabled?: boolean;
  onChanged?: (avatarUrl: string) => void;
}

/**
 * Ajouter ou changer sa photo, sur Moi, sur son profil et dans Paramètres :
 * mêmes vérifications partout (PNG, JPEG ou WebP de 2 Mo au plus), que le
 * serveur refait en lisant le contenu.
 */
export function AvatarChangeButton({
  hasPhoto,
  variant,
  disabled = false,
  onChanged,
}: AvatarChangeButtonProps) {
  const toast = useToast();
  const { refresh } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const label = hasPhoto ? fr.profile.changePhoto : fr.profile.addPhoto;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.show(fr.profile.photoNotImage, "danger");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.show(fr.profile.photoTooLarge, "danger");
      return;
    }
    setBusy(true);
    try {
      const avatarUrl = await uploadMyAvatar(file);
      await refresh();
      onChanged?.(avatarUrl);
      toast.show(hasPhoto ? fr.profile.photoChanged : fr.profile.photoAdded, "success");
    } catch (err) {
      toast.show(
        err instanceof ChatApiError && err.statusCode === 400
          ? err.message
          : fr.profile.photoUploadError,
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={AVATAR_MIME_TYPES.join(",")}
      className="hidden"
      onChange={(event) => void handleFile(event)}
      aria-hidden="true"
      tabIndex={-1}
    />
  );

  if (variant === "button") {
    return (
      <>
        {input}
        <Button
          variant="secondary"
          loading={busy}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" aria-hidden="true" />
          {label}
        </Button>
      </>
    );
  }

  return (
    <>
      {input}
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          // Zone de toucher de 44 px autour d'une pastille de 28.
          "relative inline-flex size-7 items-center justify-center rounded-full border-2 border-bg bg-primary text-white hover:bg-primary-hover disabled:opacity-60",
          "after:absolute after:-inset-2 after:content-['']",
          busy && "animate-pulse",
        )}
      >
        <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </>
  );
}
