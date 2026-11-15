const DISMISSED_KEY_PREFIX = "kemet.verifyEmailBannerDismissed:";

/** Le rappel est fermé pour ce compte sur ce navigateur. Stockage absent : jamais fermé. */
export function isVerifyEmailBannerDismissed(storage: Storage | undefined, userId: string): boolean {
  try {
    return storage?.getItem(DISMISSED_KEY_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

export function dismissVerifyEmailBanner(storage: Storage | undefined, userId: string): void {
  try {
    storage?.setItem(DISMISSED_KEY_PREFIX + userId, "1");
  } catch {
    // Navigation privée ou stockage bloqué : le rappel reste fermé jusqu'au rechargement.
  }
}

export function shouldShowVerifyEmailBanner(
  user: { id: string; emailVerified: boolean } | null,
  dismissed: boolean,
): boolean {
  return user !== null && !user.emailVerified && !dismissed;
}
