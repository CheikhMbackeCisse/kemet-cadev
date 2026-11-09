import type { DbOrTx } from "@kemet/db";
import { sumUserStorageBytes } from "./attachments.js";
import { sumUserCvBytes } from "./library.js";
import { sumUserPostAttachmentBytes } from "./post-attachments.js";
import { sumUserWorkMediaBytes } from "./work-media.js";
import { sumUserWorkAttachmentBytes } from "./works.js";

/**
 * Un seul quota par personne : fichiers de salon, images de post, PDF,
 * images et vidéos de travaux et CV confondus. À lire sous `lockUserStorageQuota`.
 */
export async function sumTotalUserStorageBytes(db: DbOrTx, profileId: string): Promise<number> {
  const [messages, posts, works, media, cv] = await Promise.all([
    sumUserStorageBytes(db, profileId),
    sumUserPostAttachmentBytes(db, profileId),
    sumUserWorkAttachmentBytes(db, profileId),
    sumUserWorkMediaBytes(db, profileId),
    sumUserCvBytes(db, profileId),
  ]);
  return messages + posts + works + media + cv;
}
