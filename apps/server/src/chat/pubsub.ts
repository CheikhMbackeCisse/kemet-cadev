import Redis from "ioredis";
import { chatEventSchema, type ChatEvent } from "@kemet/shared";

const CHANNEL_NAME = "kemet:chat-events";

export interface ChatPublisher {
  publish(event: ChatEvent): Promise<void>;
  close(): Promise<void>;
}

export function createChatPublisher(valkeyUrl: string): ChatPublisher {
  const client = new Redis(valkeyUrl);
  return {
    async publish(event) {
      await client.publish(CHANNEL_NAME, JSON.stringify(chatEventSchema.parse(event)));
    },
    async close() {
      client.disconnect();
    },
  };
}

export function createNoopChatPublisher(): ChatPublisher {
  return {
    async publish() {},
    async close() {},
  };
}

export function subscribeChatEvents(valkeyUrl: string, onEvent: (event: ChatEvent) => void): Redis {
  const client = new Redis(valkeyUrl);
  client.subscribe(CHANNEL_NAME).catch((error) => {
    throw error;
  });
  client.on("message", (_channel, raw) => {
    const parsed = chatEventSchema.safeParse(JSON.parse(raw));
    if (parsed.success) onEvent(parsed.data);
  });
  return client;
}
