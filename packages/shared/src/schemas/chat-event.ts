import { z } from "zod";
import { messageSchema } from "./message.js";
import { skillCitationSchema } from "./assistant.js";

export const chatEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message:new"), channelId: z.string().uuid(), message: messageSchema }),
  z.object({ type: z.literal("message:updated"), channelId: z.string().uuid(), message: messageSchema }),
  z.object({
    type: z.literal("message:deleted"),
    channelId: z.string().uuid(),
    messageId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("reaction:updated"),
    channelId: z.string().uuid(),
    messageId: z.string().uuid(),
    reactions: messageSchema.shape.reactions,
  }),
  z.object({
    type: z.literal("member:removed"),
    spaceId: z.string().uuid(),
    profileId: z.string().uuid(),
  }),
  // Envoyé à chaque membre d'une conversation privée, où qu'il soit dans
  // l'application : de quoi rafraîchir la liste et les pastilles de non-lus
  // sans ouvrir la conversation. Ne porte aucun contenu.
  z.object({
    type: z.literal("conversation:activity"),
    conversationId: z.string().uuid(),
    profileIds: z.array(z.string().uuid()),
  }),
  // Membre parti (demande refusée, conversation quittée) : ses connexions
  // ouvertes quittent la salle du salon, comme pour `member:removed`.
  z.object({
    type: z.literal("conversation:member-left"),
    channelId: z.string().uuid(),
    profileId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("assistant:chunk"),
    channelId: z.string().uuid(),
    invocationId: z.string().uuid(),
    delta: z.string(),
    recorded: z.boolean(),
  }),
  z.object({
    type: z.literal("assistant:done"),
    channelId: z.string().uuid(),
    invocationId: z.string().uuid(),
    message: messageSchema,
    skill: skillCitationSchema.nullable(),
    recorded: z.boolean(),
  }),
  z.object({
    type: z.literal("assistant:failed"),
    channelId: z.string().uuid(),
    invocationId: z.string().uuid(),
    errorCode: z.string(),
    // Le salon entier reçoit l'événement, mais seule la personne qui a posé
    // la question le voit et peut la reposer : le client filtre sur ce champ.
    requestedBy: z.string().uuid(),
    triggerMessageId: z.string().uuid(),
  }),
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;
