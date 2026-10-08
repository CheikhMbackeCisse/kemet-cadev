import { z } from "zod";
import { messageSchema } from "./message.js";

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
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;
