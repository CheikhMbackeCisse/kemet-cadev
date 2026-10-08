import { z } from "zod";

export const createInviteSchema = z.object({
  maxUses: z.number().int().positive().max(10_000).nullable().optional(),
  expiresInDays: z.number().int().positive().max(90).default(7),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const inviteSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  createdByHandle: z.string(),
  maxUses: z.number().int().positive().nullable(),
  useCount: z.number().int().nonnegative(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type Invite = z.infer<typeof inviteSchema>;

export const inviteStatusSchema = z.enum(["valid", "not_found", "expired", "revoked", "exhausted"]);

export const invitePreviewSchema = z.object({
  status: inviteStatusSchema,
  spaceName: z.string().nullable(),
});

export type InvitePreview = z.infer<typeof invitePreviewSchema>;
