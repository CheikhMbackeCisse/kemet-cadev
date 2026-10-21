import { z } from "zod";

export const credentialTypeSchema = z.enum(["job", "education", "internship"]);
export const credentialStatusSchema = z.enum(["declared", "verified"]);

export type CredentialType = z.infer<typeof credentialTypeSchema>;

export const credentialSchema = z.object({
  id: z.string().uuid(),
  type: credentialTypeSchema,
  organization: z.string(),
  title: z.string(),
  startDate: z.string().date(),
  endDate: z.string().date().nullable(),
  status: credentialStatusSchema,
  verificationMethod: z.string().nullable(),
});

export type Credential = z.infer<typeof credentialSchema>;
