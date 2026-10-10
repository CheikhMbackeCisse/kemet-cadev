import type {
  AssistantInvocationDetail,
  Attachment,
  Channel,
  CreateSkillInput,
  Invite,
  InvitePreview,
  Message,
  Space,
  SpaceMember,
  SkillDetail,
  SkillSummary,
  UpdateSkillInput,
} from "@kemet/shared";

class ChatApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ChatApiError(
      body?.error?.code ?? "unknown_error",
      body?.error?.message ?? "Une erreur est survenue.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function listSpaces(cursor?: string): Promise<Page<Space>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/spaces${query}`);
}

export function createSpace(input: { name: string; slug: string; description?: string | null; visibility: "public" | "private" }) {
  return request<{ space: Space }>("/api/spaces", { method: "POST", body: JSON.stringify(input) });
}

export function getSpace(spaceId: string) {
  return request<{ space: Space }>(`/api/spaces/${spaceId}`);
}

export function listSpaceMembers(spaceId: string) {
  return request<{ items: SpaceMember[] }>(`/api/spaces/${spaceId}/members`);
}

export function addSpaceMember(spaceId: string, handle: string) {
  return request<{ added: boolean }>(`/api/spaces/${spaceId}/members`, {
    method: "POST",
    body: JSON.stringify({ handle }),
  });
}

export function removeSpaceMember(spaceId: string, profileId: string) {
  return request<{ removed: boolean }>(`/api/spaces/${spaceId}/members/${profileId}`, { method: "DELETE" });
}

export function listChannels(spaceId: string) {
  return request<{ items: Channel[] }>(`/api/spaces/${spaceId}/channels`);
}

export function createChannel(spaceId: string, name: string, slug: string) {
  return request<{ channel: Channel }>(`/api/spaces/${spaceId}/channels`, {
    method: "POST",
    body: JSON.stringify({ name, slug }),
  });
}

export function listMessages(channelId: string, cursor?: string): Promise<Page<Message>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/channels/${channelId}/messages${query}`);
}

export function listReplies(messageId: string, cursor?: string): Promise<Page<Message>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/messages/${messageId}/replies${query}`);
}

export function sendMessage(
  channelId: string,
  input: { clientId: string; body: string; parentMessageId?: string | null; attachmentIds?: string[] },
) {
  return request<{ message: Message }>(`/api/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadAttachment(channelId: string, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/channels/${channelId}/messages/attachments`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ChatApiError(
      body?.error?.code ?? "unknown_error",
      body?.error?.message ?? "Une erreur est survenue.",
      response.status,
    );
  }
  const { attachment } = (await response.json()) as { attachment: Attachment };
  return attachment;
}

export function attachmentUrl(attachmentId: string): string {
  return `/api/attachments/${attachmentId}/content`;
}

export function editMessage(messageId: string, body: string) {
  return request<{ message: Message }>(`/api/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ body }) });
}

export function deleteMessage(messageId: string) {
  return request<{ deleted: boolean }>(`/api/messages/${messageId}`, { method: "DELETE" });
}

export function toggleReaction(messageId: string, emoji: string) {
  return request<{ reactions: Message["reactions"] }>(`/api/messages/${messageId}/reactions`, {
    method: "PUT",
    body: JSON.stringify({ emoji }),
  });
}

export function markChannelRead(channelId: string, messageId: string) {
  return request<{ read: boolean }>(`/api/channels/${channelId}/read`, {
    method: "POST",
    body: JSON.stringify({ messageId }),
  });
}

export function createInvite(spaceId: string, input: { maxUses?: number | null; expiresInDays?: number }) {
  return request<{ invite: Invite }>(`/api/spaces/${spaceId}/invites`, { method: "POST", body: JSON.stringify(input) });
}

export function listInvites(spaceId: string) {
  return request<{ items: Invite[] }>(`/api/spaces/${spaceId}/invites`);
}

export function revokeInvite(inviteId: string) {
  return request<{ revoked: boolean }>(`/api/invites/${inviteId}`, { method: "DELETE" });
}

export function listSkills() {
  return request<{ items: SkillSummary[] }>("/api/skills");
}

export function getSkill(slug: string) {
  return request<{ skill: SkillDetail }>(`/api/skills/${slug}`);
}

export function createSkill(input: CreateSkillInput) {
  return request<{ skill: SkillDetail }>("/api/skills", { method: "POST", body: JSON.stringify(input) });
}

export function updateSkill(slug: string, input: UpdateSkillInput) {
  return request<{ skill: SkillDetail }>(`/api/skills/${slug}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteSkill(slug: string) {
  return request<{ deleted: boolean }>(`/api/skills/${slug}`, { method: "DELETE" });
}

export function rateSkill(slug: string, stars: number) {
  return request<{ ratings: { average: number | null; count: number } }>(`/api/skills/${slug}/rating`, {
    method: "PUT",
    body: JSON.stringify({ stars }),
  });
}

export function getAssistantInvocation(messageId: string) {
  return request<AssistantInvocationDetail>(`/api/messages/${messageId}/assistant-invocation`);
}

export function sendAssistantFeedback(invocationId: string, helpful: boolean) {
  return request<{ helpful: boolean }>(`/api/assistant-invocations/${invocationId}/feedback`, {
    method: "PUT",
    body: JSON.stringify({ helpful }),
  });
}

export function previewInvite(code: string) {
  return request<InvitePreview>(`/api/invites/${code}`);
}

export function acceptInvite(code: string) {
  return request<{ joined: boolean; status: string; spaceId?: string }>(`/api/invites/${code}/accept`, { method: "POST" });
}

export { ChatApiError };
