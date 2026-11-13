import { z } from "zod";
import { handleSchema } from "./profile.js";
import { levelSchema } from "./points.js";

/** Une conversation privée réunit de 2 à 8 personnes, soi compris. */
export const MAX_CONVERSATION_MEMBERS = 8;

export const createConversationSchema = z.object({
  handles: z
    .array(handleSchema)
    .min(1)
    .max(MAX_CONVERSATION_MEMBERS - 1)
    .refine((handles) => new Set(handles).size === handles.length, {
      message: "Chaque personne ne peut être ajoutée qu'une fois.",
    }),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

/** "Écrire à l'équipe en privé" depuis la page d'un travail. */
export const createTeamConversationSchema = z.object({
  workSlug: z.string().min(1).max(80),
});

export type CreateTeamConversationInput = z.infer<typeof createTeamConversationSchema>;

export const conversationMemberStatusSchema = z.enum(["accepted", "pending", "left"]);
export type ConversationMemberStatus = z.infer<typeof conversationMemberStatusSchema>;

export const conversationBoxSchema = z.enum(["inbox", "requests"]);
export type ConversationBox = z.infer<typeof conversationBoxSchema>;

export const conversationListQuerySchema = z.object({
  box: conversationBoxSchema.default("inbox"),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const conversationParticipantSchema = z.object({
  profileId: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  country: z.string(),
  level: levelSchema,
  status: conversationMemberStatusSchema,
});

export type ConversationParticipant = z.infer<typeof conversationParticipantSchema>;

export const conversationLastMessageSchema = z.object({
  authorId: z.string().uuid(),
  body: z.string(),
  hasAttachments: z.boolean(),
  hasVoice: z.boolean(),
  deleted: z.boolean(),
  createdAt: z.string().datetime(),
});

/**
 * Pourquoi la personne connectée ne peut pas écrire : demande pas encore
 * acceptée par elle (`pending`), premier message déjà envoyé à quelqu'un qui
 * n'a pas encore accepté (`awaiting_acceptance`), blocage dans une
 * conversation à deux (`blocked`), plus personne avec qui échanger (`alone`).
 */
export const conversationWriteBlockSchema = z.enum(["pending", "awaiting_acceptance", "blocked", "alone"]);
export type ConversationWriteBlock = z.infer<typeof conversationWriteBlockSchema>;

export const conversationSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  isGroup: z.boolean(),
  /** Travail dont l'équipe est réunie ici, s'il est encore publié. */
  work: z.object({ slug: z.string(), title: z.string() }).nullable(),
  /** Les autres membres, dont ceux qui n'ont pas encore accepté. */
  participants: z.array(conversationParticipantSchema),
  viewerStatus: conversationMemberStatusSchema,
  lastMessage: conversationLastMessageSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type Conversation = z.infer<typeof conversationSchema>;

export const conversationDetailSchema = conversationSchema.extend({
  /** `null` : la personne connectée peut écrire. */
  writeBlock: conversationWriteBlockSchema.nullable(),
  /** Conversation à deux seulement : la personne connectée a bloqué l'autre. */
  blockedByViewer: z.boolean(),
});

export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

export const conversationUnreadSummarySchema = z.object({
  /** Conversations acceptées qui ont au moins un message non lu. */
  unreadConversations: z.number().int().nonnegative(),
  /** Demandes de message en attente d'une réponse. */
  pendingRequests: z.number().int().nonnegative(),
});

export type ConversationUnreadSummary = z.infer<typeof conversationUnreadSummarySchema>;

export const blockStatusSchema = z.object({ blocked: z.boolean() });
export type BlockStatus = z.infer<typeof blockStatusSchema>;
