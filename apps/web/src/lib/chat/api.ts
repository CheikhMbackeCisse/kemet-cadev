import type {
  Application,
  AssistantInvocationDetail,
  Attachment,
  Channel,
  CompetitionDetail,
  CompetitionSummary,
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
  ModerationActionEntry,
  Report,
  ResolveReportInput,
  PostFeedbackEntry,
  PostReactionResult,
  PostReply,
  PostSummary,
  ProjectDetail,
  ProjectSummary,
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

export function getMe() {
  return request<MeResponse>("/api/me");
}

export function updateMyProfile(input: UpdateProfileInput) {
  return request<{ profile: MeResponse["profile"] }>("/api/me/profile", { method: "PATCH", body: JSON.stringify(input) });
}

export function getAuthConfig() {
  return request<{ githubEnabled: boolean }>("/api/auth-config");
}

export function signUp(input: { email: string; password: string; name: string }) {
  return request<{ user: { id: string } }>("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify(input) });
}

export function signIn(input: { email: string; password: string }) {
  return request<{ user: { id: string } }>("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify(input) });
}

export function signOut() {
  return request<{ success: boolean }>("/api/auth/sign-out", { method: "POST" });
}

export async function signInWithGithub(callbackURL: string): Promise<void> {
  const result = await request<{ url: string }>("/api/auth/sign-in/social", {
    method: "POST",
    body: JSON.stringify({ provider: "github", callbackURL }),
  });
  window.location.href = result.url;
}

export function forgotPassword(email: string, redirectTo: string) {
  return request<{ status: boolean }>("/api/auth/forget-password", { method: "POST", body: JSON.stringify({ email, redirectTo }) });
}

export function resetPassword(newPassword: string, token: string) {
  return request<{ status: boolean }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ newPassword, token }) });
}

export function resendVerificationEmail(email: string) {
  return request<{ status: boolean }>("/api/auth/send-verification-email", { method: "POST", body: JSON.stringify({ email }) });
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
  return request<{ post: PostSummary }>("/api/posts", { method: "POST", body: JSON.stringify(input) });
}

export function editPost(postId: string, body: string) {
  return request<{ post: PostSummary }>(`/api/posts/${postId}`, { method: "PATCH", body: JSON.stringify({ body }) });
}

export function deletePost(postId: string) {
  return request<{ deleted: boolean }>(`/api/posts/${postId}`, { method: "DELETE" });
}

export function sharePost(postId: string, body = "") {
  return request<{ post: PostSummary }>(`/api/posts/${postId}/share`, { method: "POST", body: JSON.stringify({ body }) });
}

export function togglePostReaction(postId: string) {
  return request<PostReactionResult>(`/api/posts/${postId}/reactions`, { method: "PUT" });
}

export function listPostReplies(postId: string, cursor?: string): Promise<Page<PostReply>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/posts/${postId}/replies${query}`);
}

export function createPostReply(postId: string, input: CreatePostReplyInput) {
  return request<{ reply: PostReply }>(`/api/posts/${postId}/replies`, { method: "POST", body: JSON.stringify(input) });
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
  return request<{ project: ProjectDetail }>("/api/projects", { method: "POST", body: JSON.stringify(input) });
}

export function updateProject(slug: string, input: UpdateProjectInput) {
  return request<{ project: ProjectDetail }>(`/api/projects/${slug}`, { method: "PATCH", body: JSON.stringify(input) });
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
  return request<{ helpRequest: HelpRequest }>(`/api/help-requests/${helpRequestId}/close`, { method: "PUT" });
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
  return request<{ competition: CompetitionDetail }>("/api/competitions", { method: "POST", body: JSON.stringify(input) });
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
  return request<{ team: Team }>(`/api/competitions/${slug}/teams`, { method: "POST", body: JSON.stringify(input) });
}

export function joinTeam(teamId: string) {
  return request<{ team: Team }>(`/api/teams/${teamId}/join`, { method: "POST" });
}

export function listSubmissions(slug: string) {
  return request<{ items: Submission[] }>(`/api/competitions/${slug}/submissions`);
}

export function createSubmission(slug: string, input: CreateSubmissionInput) {
  return request<{ submission: Submission }>(`/api/competitions/${slug}/submissions`, { method: "POST", body: JSON.stringify(input) });
}

export function updateSubmission(submissionId: string, input: UpdateSubmissionInput) {
  return request<{ submission: Submission }>(`/api/submissions/${submissionId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function voteForSubmission(submissionId: string) {
  return request<{ submissionId: string }>(`/api/submissions/${submissionId}/vote`, { method: "POST" });
}

export function getMyVote(slug: string) {
  return request<{ submissionId: string | null }>(`/api/competitions/${slug}/my-vote`);
}

export function submitJuryScore(submissionId: string, input: JuryScoreInput) {
  return request<{ score: number }>(`/api/submissions/${submissionId}/jury-score`, { method: "PUT", body: JSON.stringify(input) });
}

export function getCompetitionResults(slug: string) {
  return request<{ items: SubmissionResult[] }>(`/api/competitions/${slug}/results`);
}

export function createReport(input: CreateReportInput) {
  return request<{ report: Report }>("/api/reports", { method: "POST", body: JSON.stringify(input) });
}

export function listPendingReports(cursor?: string): Promise<Page<Report>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/reports${query}`);
}

export function resolveReport(reportId: string, input: ResolveReportInput) {
  return request<{ report: Report }>(`/api/reports/${reportId}/resolve`, { method: "PUT", body: JSON.stringify(input) });
}

export function reinstateProfile(handle: string) {
  return request<{ reinstated: boolean }>(`/api/profiles/${handle}/reinstate`, { method: "POST" });
}

export function listModerationLog(cursor?: string): Promise<Page<ModerationActionEntry>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/api/moderation/log${query}`);
}

export { ChatApiError };
