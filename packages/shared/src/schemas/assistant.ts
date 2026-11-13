import { z } from "zod";

/** Identifiant interne du profil de l'assistant, gardé en base depuis la migration 0003. */
export const KEMET_HANDLE = "kemet";

/** Nom de l'assistant dans l'interface. */
export const ASSISTANT_NAME = "Kocc";

/** Mention affichée dans l'interface : "@kocc". */
export const ASSISTANT_MENTION_HANDLE = "kocc";

/** Mentions qui appellent l'assistant ; "@kemet" reste compris, jamais affiché. */
export const ASSISTANT_MENTION_HANDLES: readonly string[] = [ASSISTANT_MENTION_HANDLE, KEMET_HANDLE];

export function isAssistantHandle(handle: string): boolean {
  return ASSISTANT_MENTION_HANDLES.includes(handle.toLowerCase());
}

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
