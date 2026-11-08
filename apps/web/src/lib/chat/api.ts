import type {
  Application,
  AssistantInvocationDetail,
  Attachment,
  Channel,
  CompetitionDetail,
  CompetitionSummary,
  Conversation,
  ConversationBox,
  ConversationDetail,
  ConversationUnreadSummary,
  CreateApplicationInput,
  CreateCompetitionRequestInput,
  CreateHelpRequestInput,
  CreatePostInput,
  CreatePostReplyInput,
  CreateProjectInput,
  CreateSkillInput,
  CreateSubmissionInput,
  CreateTeamInput,
  FeedTab,
  HelpRequest,
  Invite,
  InvitePreview,
  JuryScoreInput,
  CreateReportInput,
  MeResponse,
  Message,
  OnboardingState,
  PersonSuggestion,
  UpdateOnboardingInput,
  ModerationActionEntry,
  Report,
  ResolveReportInput,
  PostFeedbackEntry,
  PostBookmarkResult,
  PostReactionResult,
  PostReply,
  PostSummary,
  ProfileSummary,
  ProjectDetail,
  ProjectSummary,
  PublicProfileResponse,
  ReviewCompetitionInput,
  Space,
  SpaceMember,
  SkillDetail,
  SkillSummary,
  Submission,
  SubmissionResult,
  Team,
  UpdateProfileInput,
  UpdateProjectInput,
  UpdateSkillInput,
  UpdateSubmissionInput,
  CreateWorkInput,
  PendingWorkInvitation,
  ProfileWork,
  UpdateWorkInput,
  WorkAttachment,
  WorkDetail,
  WorkMatchResult,
  WorkMatchSubject,
  WorkSummary,
  WorkSort,
  WorkStatus,
  WorkType,
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
    // Fastify refuse en 400 un corps vide annoncé comme JSON : un POST sans corps
    // (suivre, rejoindre) ne doit pas porter cet en-tête.
    headers: { ...(init?.body !== undefined && { "Content-Type": "application/json" }), ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // Better Auth répond { code, message } à plat, les routes de Kemet { error: { code, message } }.
    throw new ChatApiError(
      body?.error?.code ?? body?.code ?? "unknown_error",
      body?.error?.message ?? "Une erreur est survenue.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

/** Fichier JSON de toutes les données du compte connecté, nommé par le serveur. */
export async function downloadAccountExport(): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch("/api/me/export", { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ChatApiError(
      body?.error?.code ?? "unknown_error",
      body?.error?.message ?? "Une erreur est survenue.",
      response.status,
    );
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "kemet-export.json";
  return { blob: await response.blob(), fileName };
}

/** Supprime le compte de la session (ADR 0023) : 204 sans corps. */
export async function deleteMyAccount(password?: string): Promise<void> {
  const response = await fetch("/api/me", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(password ? { password } : {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ChatApiError(
      body?.error?.code ?? "unknown_error",
      body?.error?.message ?? "Une erreur est survenue.",
      response.status,
    );
  }
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function listSpaces(cursor?: string): Promise<Page<Space>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/spaces${query}`);
}

export function createSpace(input: {
  name: string;
  slug: string;
  description?: string | null;
  visibility: "public" | "private";
}) {
  return request<{ space: Space }>("/api/spaces", { method: "POST", body: JSON.stringify(input) });
}

export function getSpace(spaceId: string) {
  return request<{ space: Space }>(`/api/spaces/${spaceId}`);
}

export function listSpaceMembers(spaceId: string, cursor?: string): Promise<Page<SpaceMember>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/spaces/${spaceId}/members${query}`);
}

export function addSpaceMember(spaceId: string, handle: string) {
  return request<{ added: boolean }>(`/api/spaces/${spaceId}/members`, {
    method: "POST",
    body: JSON.stringify({ handle }),
  });
}

export function joinSpace(spaceId: string) {
  return request<{ joined: boolean }>(`/api/spaces/${spaceId}/join`, { method: "POST" });
}

export function removeSpaceMember(spaceId: string, profileId: string) {
  return request<{ removed: boolean }>(`/api/spaces/${spaceId}/members/${profileId}`, {
    method: "DELETE",
  });
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

export interface MessagePage extends Page<Message> {
  /** Renseigné à l'ouverture seulement (sans curseur), pour un membre de l'espace. */
  firstUnreadMessageId: string | null;
}

export function listMessages(
  channelId: string,
  cursor?: string,
  limit?: number,
): Promise<MessagePage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/channels/${channelId}/messages${query}`);
}

export function listReplies(messageId: string, cursor?: string): Promise<Page<Message>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/messages/${messageId}/replies${query}`);
}

export function sendMessage(
  channelId: string,
  input: {
    clientId: string;
    body: string;
    parentMessageId?: string | null;
    attachmentIds?: string[];
  },
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

export async function uploadPostAttachment(file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/posts/attachments", {
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

export function postAttachmentUrl(attachmentId: string): string {
  return `/api/post-attachments/${attachmentId}/content`;
}

export function editMessage(messageId: string, body: string) {
  return request<{ message: Message }>(`/api/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
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

export function createInvite(
  spaceId: string,
  input: { maxUses?: number | null; expiresInDays?: number },
) {
  return request<{ invite: Invite }>(`/api/spaces/${spaceId}/invites`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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
  return request<{ skill: SkillDetail }>("/api/skills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSkill(slug: string, input: UpdateSkillInput) {
  return request<{ skill: SkillDetail }>(`/api/skills/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSkill(slug: string) {
  return request<{ deleted: boolean }>(`/api/skills/${slug}`, { method: "DELETE" });
}

export function rateSkill(slug: string, stars: number) {
  return request<{ ratings: { average: number | null; count: number } }>(
    `/api/skills/${slug}/rating`,
    {
      method: "PUT",
      body: JSON.stringify({ stars }),
    },
  );
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
  return request<{ joined: boolean; status: string; spaceId?: string }>(
    `/api/invites/${code}/accept`,
    { method: "POST" },
  );
}

export function getMe() {
  return request<MeResponse>("/api/me");
}

export function updateOnboarding(input: UpdateOnboardingInput) {
  return request<{ onboarding: OnboardingState }>("/api/me/onboarding", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getOnboardingSpaces() {
  return request<{ items: Space[] }>("/api/me/onboarding/spaces");
}

export function getOnboardingPeople() {
  return request<{ items: PersonSuggestion[] }>("/api/me/onboarding/people");
}

export function updateMyProfile(input: UpdateProfileInput) {
  return request<{ profile: MeResponse["profile"] }>("/api/me/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getUserProfile(handle: string) {
  return request<PublicProfileResponse>(`/api/users/${handle}`);
}

export function followUser(handle: string) {
  return request<{ following: boolean }>(`/api/users/${handle}/follow`, { method: "POST" });
}

export function unfollowUser(handle: string) {
  return request<{ following: boolean }>(`/api/users/${handle}/follow`, { method: "DELETE" });
}

export function listUserFollowers(handle: string, cursor?: string): Promise<Page<ProfileSummary>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/users/${handle}/followers${query}`);
}

export function listUserFollowing(handle: string, cursor?: string): Promise<Page<ProfileSummary>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/users/${handle}/following${query}`);
}

export function getAuthConfig() {
  return request<{ githubEnabled: boolean; googleEnabled: boolean; linkedinEnabled: boolean }>(
    "/api/auth-config",
  );
}

/** Responsable des données personnelles, null tant que le serveur ne le configure pas. */
export function getPrivacyContact() {
  return request<{ contact: { name: string; email: string } | null }>("/api/privacy-contact");
}

export function signUp(input: { email: string; password: string; name: string }) {
  return request<{ user: { id: string } }>("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signIn(input: { email: string; password: string }) {
  return request<{ user: { id: string } }>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signOut() {
  return request<{ success: boolean }>("/api/auth/sign-out", { method: "POST" });
}

export type SocialProvider = "github" | "google" | "linkedin";

export async function signInWithSocialProvider(
  provider: SocialProvider,
  callbackURL: string,
): Promise<void> {
  const result = await request<{ url: string }>("/api/auth/sign-in/social", {
    method: "POST",
    body: JSON.stringify({ provider, callbackURL, errorCallbackURL: callbackURL }),
  });
  window.location.href = result.url;
}

export function forgotPassword(email: string, redirectTo: string) {
  return request<{ status: boolean }>("/api/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ email, redirectTo }),
  });
}

export function resetPassword(newPassword: string, token: string) {
  return request<{ status: boolean }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ newPassword, token }),
  });
}

export function resendVerificationEmail(email: string) {
  return request<{ status: boolean }>("/api/auth/send-verification-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function listPosts(tab: FeedTab, cursor?: string): Promise<Page<PostSummary>> {
  const params = new URLSearchParams({ tab });
  if (cursor) params.set("cursor", cursor);
  return request(`/api/posts?${params.toString()}`);
}

export function getPost(postId: string) {
  return request<{ post: PostSummary }>(`/api/posts/${postId}`);
}

export function createPost(input: CreatePostInput) {
  return request<{ post: PostSummary }>("/api/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function editPost(postId: string, body: string) {
  return request<{ post: PostSummary }>(`/api/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export function deletePost(postId: string) {
  return request<{ deleted: boolean }>(`/api/posts/${postId}`, { method: "DELETE" });
}

export function setPostBookmark(postId: string, saved: boolean) {
  return request<PostBookmarkResult>(`/api/posts/${postId}/bookmark`, {
    method: "PUT",
    body: JSON.stringify({ saved }),
  });
}

export function listBookmarkedPosts(cursor?: string): Promise<Page<PostSummary>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/me/bookmarks${query}`);
}

export function togglePostReaction(postId: string) {
  return request<PostReactionResult>(`/api/posts/${postId}/reactions`, { method: "PUT" });
}

export function listPostReplies(postId: string, cursor?: string): Promise<Page<PostReply>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/posts/${postId}/replies${query}`);
}

export function createPostReply(postId: string, input: CreatePostReplyInput) {
  return request<{ reply: PostReply }>(`/api/posts/${postId}/replies`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deletePostReply(replyId: string) {
  return request<{ deleted: boolean }>(`/api/post-replies/${replyId}`, { method: "DELETE" });
}

export function markPostReplySolution(replyId: string, isSolution: boolean) {
  return request<{ reply: PostReply }>(`/api/post-replies/${replyId}/solution`, {
    method: "PUT",
    body: JSON.stringify({ isSolution }),
  });
}

export function createPostFeedback(postId: string, body: string) {
  return request<{ feedback: PostFeedbackEntry }>(`/api/posts/${postId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function listPostFeedback(postId: string) {
  return request<{ items: PostFeedbackEntry[] }>(`/api/posts/${postId}/feedback`);
}

export function listProjects(cursor?: string): Promise<Page<ProjectSummary>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/projects${query}`);
}

export function getProject(slug: string) {
  return request<{ project: ProjectDetail }>(`/api/projects/${slug}`);
}

export function createProject(input: CreateProjectInput) {
  return request<{ project: ProjectDetail }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProject(slug: string, input: UpdateProjectInput) {
  return request<{ project: ProjectDetail }>(`/api/projects/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProject(slug: string) {
  return request<{ deleted: boolean }>(`/api/projects/${slug}`, { method: "DELETE" });
}

export function listHelpRequests(slug: string) {
  return request<{ items: HelpRequest[] }>(`/api/projects/${slug}/help-requests`);
}

export function createHelpRequest(slug: string, input: CreateHelpRequestInput) {
  return request<{ helpRequest: HelpRequest }>(`/api/projects/${slug}/help-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function closeHelpRequest(helpRequestId: string) {
  return request<{ helpRequest: HelpRequest }>(`/api/help-requests/${helpRequestId}/close`, {
    method: "PUT",
  });
}

export function listApplications(helpRequestId: string) {
  return request<{ items: Application[] }>(`/api/help-requests/${helpRequestId}/applications`);
}

export function createApplication(helpRequestId: string, input: CreateApplicationInput) {
  return request<{ application: Application }>(`/api/help-requests/${helpRequestId}/applications`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function decideApplication(applicationId: string, accepted: boolean) {
  return request<{ application: Application }>(`/api/applications/${applicationId}/decision`, {
    method: "PUT",
    body: JSON.stringify({ accepted }),
  });
}

export function listCompetitions(cursor?: string): Promise<Page<CompetitionSummary>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/competitions${query}`);
}

export function listPendingCompetitions() {
  return request<{ items: CompetitionDetail[] }>("/api/competitions/pending");
}

export function getCompetition(slug: string) {
  return request<{ competition: CompetitionDetail }>(`/api/competitions/${slug}`);
}

export function requestCompetition(input: CreateCompetitionRequestInput) {
  return request<{ competition: CompetitionDetail }>("/api/competitions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function reviewCompetition(competitionId: string, input: ReviewCompetitionInput) {
  return request<{ competition: CompetitionDetail }>(`/api/competitions/${competitionId}/review`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function listTeams(slug: string) {
  return request<{ items: Team[] }>(`/api/competitions/${slug}/teams`);
}

export function createTeam(slug: string, input: CreateTeamInput) {
  return request<{ team: Team }>(`/api/competitions/${slug}/teams`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinTeam(teamId: string) {
  return request<{ team: Team }>(`/api/teams/${teamId}/join`, { method: "POST" });
}

export function listSubmissions(slug: string) {
  return request<{ items: Submission[] }>(`/api/competitions/${slug}/submissions`);
}

export function createSubmission(slug: string, input: CreateSubmissionInput) {
  return request<{ submission: Submission }>(`/api/competitions/${slug}/submissions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSubmission(submissionId: string, input: UpdateSubmissionInput) {
  return request<{ submission: Submission }>(`/api/submissions/${submissionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function voteForSubmission(submissionId: string) {
  return request<{ submissionId: string }>(`/api/submissions/${submissionId}/vote`, {
    method: "POST",
  });
}

export function getMyVote(slug: string) {
  return request<{ submissionId: string | null }>(`/api/competitions/${slug}/my-vote`);
}

export function submitJuryScore(submissionId: string, input: JuryScoreInput) {
  return request<{ score: number }>(`/api/submissions/${submissionId}/jury-score`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getCompetitionResults(slug: string) {
  return request<{ items: SubmissionResult[] }>(`/api/competitions/${slug}/results`);
}

export function createReport(input: CreateReportInput) {
  return request<{ report: Report }>("/api/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listPendingReports(cursor?: string): Promise<Page<Report>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/reports${query}`);
}

export function resolveReport(reportId: string, input: ResolveReportInput) {
  return request<{ report: Report }>(`/api/reports/${reportId}/resolve`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function reinstateProfile(handle: string) {
  return request<{ reinstated: boolean }>(`/api/profiles/${handle}/reinstate`, { method: "POST" });
}

export function listModerationLog(cursor?: string): Promise<Page<ModerationActionEntry>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/moderation/log${query}`);
}

export function listConversations(
  box: ConversationBox,
  cursor?: string,
): Promise<Page<Conversation>> {
  const params = new URLSearchParams({ box });
  if (cursor) params.set("cursor", cursor);
  return request(`/api/conversations?${params.toString()}`);
}

export function getConversationUnread() {
  return request<ConversationUnreadSummary>("/api/conversations/unread");
}

/** Ouvre la conversation avec ces personnes : celle qui existe déjà pour une conversation à deux. */
export function openConversation(handles: string[]) {
  return request<{ conversation: ConversationDetail }>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ handles }),
  });
}

/** "Écrire à l'équipe en privé" : celle qui existe déjà pour ce travail et cette personne. */
export function openTeamConversation(workSlug: string) {
  return request<{ conversation: ConversationDetail }>("/api/conversations/team", {
    method: "POST",
    body: JSON.stringify({ workSlug }),
  });
}

export function getConversation(conversationId: string) {
  return request<{ conversation: ConversationDetail }>(`/api/conversations/${conversationId}`);
}

export function acceptConversation(conversationId: string) {
  return request<{ conversation: ConversationDetail }>(
    `/api/conversations/${conversationId}/accept`,
    { method: "POST" },
  );
}

/** Refuser une demande ou quitter une conversation. */
export function leaveConversation(conversationId: string) {
  return request<{ left: true }>(`/api/conversations/${conversationId}/leave`, { method: "POST" });
}

export function getBlockStatus(handle: string) {
  return request<{ blocked: boolean }>(`/api/users/${handle}/block`);
}

export function blockUser(handle: string) {
  return request<{ blocked: boolean }>(`/api/users/${handle}/block`, { method: "PUT" });
}

export function unblockUser(handle: string) {
  return request<{ blocked: boolean }>(`/api/users/${handle}/block`, { method: "DELETE" });
}

export function listBlockedUsers() {
  return request<{ items: ProfileSummary[] }>("/api/me/blocks");
}

export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return request<{ status: boolean }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ ...input, revokeOtherSessions: true }),
  });
}

/** Rattache un compte GitHub, Google ou LinkedIn au compte connecté : renvoie vers le fournisseur. */
export async function linkSocialProvider(provider: SocialProvider, callbackURL: string) {
  const result = await request<{ url: string }>("/api/auth/link-social", {
    method: "POST",
    body: JSON.stringify({ provider, callbackURL, errorCallbackURL: callbackURL }),
  });
  window.location.href = result.url;
}

export function unlinkSocialProvider(provider: SocialProvider) {
  return request<{ status: boolean }>("/api/auth/unlink-account", {
    method: "POST",
    body: JSON.stringify({ providerId: provider }),
  });
}

export { ChatApiError };

export function listWorks(
  filters: {
    q?: string;
    type?: WorkType;
    status?: WorkStatus;
    sort?: WorkSort;
    tag?: string;
    cursor?: string;
  } = {},
): Promise<Page<WorkSummary>> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort && filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.cursor) params.set("cursor", filters.cursor);
  const query = params.toString();
  return request(`/api/works${query ? `?${query}` : ""}`);
}

export function getWork(slug: string) {
  return request<{ work: WorkDetail }>(`/api/works/${encodeURIComponent(slug)}`);
}

export function createWork(input: CreateWorkInput) {
  return request<{ work: WorkDetail }>("/api/works", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWork(slug: string, input: UpdateWorkInput) {
  return request<{ work: WorkDetail }>(`/api/works/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteWork(slug: string) {
  return request<{ deleted: boolean }>(`/api/works/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

export function inviteWorkCoauthor(slug: string, handle: string) {
  return request<{ work: WorkDetail }>(`/api/works/${encodeURIComponent(slug)}/authors`, {
    method: "POST",
    body: JSON.stringify({ handle }),
  });
}

export function removeWorkCoauthor(slug: string, handle: string) {
  return request<{ removed: boolean }>(
    `/api/works/${encodeURIComponent(slug)}/authors/${encodeURIComponent(handle)}`,
    { method: "DELETE" },
  );
}

export function decideWorkInvitation(slug: string, accepted: boolean) {
  return request<{ work: WorkDetail }>(`/api/works/${encodeURIComponent(slug)}/invitation`, {
    method: "PUT",
    body: JSON.stringify({ accepted }),
  });
}

export function listUserWorks(handle: string, cursor?: string): Promise<Page<ProfileWork>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/users/${encodeURIComponent(handle)}/works${query}`);
}

export function listMyWorkInvitations() {
  return request<{ items: PendingWorkInvitation[] }>("/api/me/work-invitations");
}

export async function uploadWorkAttachment(file: File): Promise<WorkAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/works/attachments", {
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
  const { attachment } = (await response.json()) as { attachment: WorkAttachment };
  return attachment;
}

export function workAttachmentUrl(attachmentId: string): string {
  return `/api/work-attachments/${attachmentId}/content`;
}

export function findWorkMatches(subject: WorkMatchSubject) {
  return request<{ result: WorkMatchResult }>("/api/work-matches", {
    method: "POST",
    body: JSON.stringify({ subject }),
  });
}
