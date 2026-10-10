import { z } from "zod";
import { attachmentSchema, MAX_ATTACHMENTS_PER_MESSAGE } from "./attachment.js";

export const createMessageSchema = z
  .object({
    clientId: z.string().uuid(),
    body: z.string().max(4000),
    parentMessageId: z.string().uuid().nullable().optional(),
    attachmentIds: z.array(z.string().uuid()).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
  })
  // Un message peut être une image ou un fichier sans légende, mais pas vide des deux.
  .refine((input) => input.body.length > 0 || (input.attachmentIds?.length ?? 0) > 0, {
    message: "Un message doit contenir du texte ou au moins un fichier.",
    path: ["body"],
  });

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const editMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;

export const toggleReactionSchema = z.object({
  emoji: z.string().min(1).max(8),
});

export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;

export const reactionSchema = z.object({
  emoji: z.string(),
  profileIds: z.array(z.string().uuid()),
});

export type Reaction = z.infer<typeof reactionSchema>;

export const messageSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  parentMessageId: z.string().uuid().nullable(),
  clientId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorHandle: z.string(),
  authorDisplayName: z.string(),
  body: z.string(),
  mentionedHandles: z.array(z.string()),
  reactions: z.array(reactionSchema),
  replyCount: z.number().int().nonnegative(),
  attachments: z.array(attachmentSchema),
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
});

export type Message = z.infer<typeof messageSchema>;

export const markReadSchema = z.object({
  messageId: z.string().uuid(),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;
