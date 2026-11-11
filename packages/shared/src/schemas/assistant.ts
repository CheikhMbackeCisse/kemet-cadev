import { z } from "zod";

export const KEMET_HANDLE = "kemet";

export const skillCitationSchema = z.object({
  slug: z.string(),
  name: z.string(),
  authorHandle: z.string(),
  authorDisplayName: z.string(),
  authorAvatarUrl: z.string().nullable(),
});

export type SkillCitation = z.infer<typeof skillCitationSchema>;

export const assistantInvocationDetailSchema = z.object({
  invocationId: z.string().uuid(),
  skill: skillCitationSchema.nullable(),
  helpful: z.boolean().nullable(),
  recorded: z.boolean(),
  /** Sous un post seulement : la personne qui a posé la question, qui peut retirer la réponse. */
  requestedBy: z.string().uuid().optional(),
});

export type AssistantInvocationDetail = z.infer<typeof assistantInvocationDetailSchema>;

export const invokeAssistantSchema = z.object({
  messageId: z.string().uuid(),
});

export type InvokeAssistantInput = z.infer<typeof invokeAssistantSchema>;

export const assistantFeedbackSchema = z.object({
  helpful: z.boolean(),
});

export type AssistantFeedbackInput = z.infer<typeof assistantFeedbackSchema>;

export const llmProviderNameSchema = z.enum(["gemini", "openrouter"]);

export const assistantInvocationStatusSchema = z.enum(["pending", "streaming", "done", "failed"]);

export const assistantInvocationSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid().nullable(),
  triggerMessageId: z.string().uuid().nullable(),
  postId: z.string().uuid().nullable(),
  requestedBy: z.string().uuid(),
  responseMessageId: z.string().uuid().nullable(),
  skillIds: z.array(z.string().uuid()),
  provider: llmProviderNameSchema.nullable(),
  status: assistantInvocationStatusSchema,
  errorCode: z.string().nullable(),
  helpful: z.boolean().nullable(),
  recorded: z.boolean(),
  createdAt: z.string().datetime(),
});

export type AssistantInvocation = z.infer<typeof assistantInvocationSchema>;
