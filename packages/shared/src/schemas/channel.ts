import { z } from "zod";

export const createChannelSchema = z.object({
  name: z.string().min(1).max(60),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Lettres minuscules, chiffres et tirets uniquement."),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const renameChannelSchema = z.object({
  name: z.string().min(1).max(60),
});

export type RenameChannelInput = z.infer<typeof renameChannelSchema>;

export const channelSchema = z.object({
  id: z.string().uuid(),
  /** Nul pour le salon d'une conversation privée. */
  spaceId: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  displayOrder: z.number().int(),
  unreadCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type Channel = z.infer<typeof channelSchema>;
