import { MailWarning, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fr } from "../../i18n/fr.js";
import { resendVerificationEmail } from "../../lib/chat/api.js";
import {
  dismissVerifyEmailBanner,
  isVerifyEmailBannerDismissed,
  shouldShowVerifyEmailBanner,
} from "../../lib/auth/verifyEmailBanner.js";
import { useSession } from "../../session/SessionProvider.js";
import { IconButton } from "../ui/IconButton.js";
import { useToast } from "../ui/Toast.js";

function localStorageOrUndefined(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function VerifyEmailBanner() {
  const { user, refresh } = useSession();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(() =>
    user ? isVerifyEmailBannerDismissed(localStorageOrUndefined(), user.id) : false,
  );
  const [sending, setSending] = useState(false);
  const visible = shouldShowVerifyEmailBanner(user, dismissed);

  // Le lien du mail s'ouvre souvent dans un autre onglet : au retour sur
  // celui-ci, la session est relue pour faire disparaître le rappel.
  useEffect(() => {
    if (!visible) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [visible, refresh]);

  if (!visible || !user) return null;

  async function handleResend() {
    if (!user) return;
    setSending(true);
    try {
      await resendVerificationEmail(user.email);
      toast.show(fr.auth.verificationEmailResent, "success");
    } catch {
      toast.show(fr.auth.verificationEmailError, "danger");
    } finally {
      setSending(false);
    }
  }

  function handleDismiss() {
    if (!user) return;
    dismissVerifyEmailBanner(localStorageOrUndefined(), user.id);
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-2 border-b border-border text-sm" role="status">
      <MailWarning className="size-4 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{fr.auth.verifyEmailBanner}</span>
      <button
        type="button"
        onClick={() => void handleResend()}
        disabled={sending}
        className="inline-flex h-control shrink-0 items-center text-link hover:underline disabled:opacity-60 max-md:h-control-mobile"
      >
        {fr.auth.resendVerificationEmail}
      </button>
      <IconButton aria-label={fr.auth.dismissVerifyEmailBanner} onClick={handleDismiss}>
        <X className="size-4" aria-hidden="true" />
      </IconButton>
    </div>
  );
}
