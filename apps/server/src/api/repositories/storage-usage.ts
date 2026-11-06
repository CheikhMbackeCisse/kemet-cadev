import type { DbOrTx } from "@kemet/db";
import { sumUserStorageBytes } from "./attachments.js";
import { sumUserPostAttachmentBytes } from "./post-attachments.js";
import { sumUserWorkAttachmentBytes } from "./works.js";

/**
 * Un seul quota par personne : fichiers de salon, images de post et PDF de
 * travaux confondus. À lire sous `lockUserStorageQuota`.
 */
export async function sumTotalUserStorageBytes(db: DbOrTx, profileId: string): Promise<number> {
  const [messages, posts, works] = await Promise.all([
    sumUserStorageBytes(db, profileId),
    sumUserPostAttachmentBytes(db, profileId),
    sumUserWorkAttachmentBytes(db, profileId),
  ]);
  return messages + posts + works;
}
