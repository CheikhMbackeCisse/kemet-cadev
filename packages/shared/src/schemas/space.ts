import { z } from "zod";

export const spaceVisibilitySchema = z.enum(["public", "private"]);
export const spaceMemberRoleSchema = z.enum(["owner", "admin", "member"]);

export const createSpaceSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Lettres minuscules, chiffres et tirets uniquement."),
  description: z.string().max(300).nullable().optional(),
  visibility: spaceVisibilitySchema.default("public"),
});

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;

export const addSpaceMemberSchema = z.object({
  handle: z.string().min(3).max(30),
});

export type AddSpaceMemberInput = z.infer<typeof addSpaceMemberSchema>;

export const spaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  visibility: spaceVisibilitySchema,
  role: spaceMemberRoleSchema.nullable(),
  memberCount: z.number().int().nonnegative(),
  /** Toujours faux pour un visiteur ou un non-membre. */
  hasUnread: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Space = z.infer<typeof spaceSchema>;

export const spaceMemberSchema = z.object({
  profileId: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  country: z.string(),
  role: spaceMemberRoleSchema,
  joinedAt: z.string().datetime(),
});

export type SpaceMember = z.infer<typeof spaceMemberSchema>;
