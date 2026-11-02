import type { applications, helpRequests, profiles, projects } from "@kemet/db";
import type { Application, HelpRequest, Level, ProjectDetail, ProjectSummary } from "@kemet/shared";

type ProjectRow = typeof projects.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
type HelpRequestRow = typeof helpRequests.$inferSelect;
type ApplicationRow = typeof applications.$inferSelect;

export function serializeProjectSummary(row: ProjectRow, owner: ProfileRow, openHelpRequestCount: number): ProjectSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    pitch: row.pitch,
    stack: row.stack,
    ownerId: row.ownerId,
    ownerHandle: owner.handle,
    ownerDisplayName: owner.displayName,
    ownerAvatarUrl: owner.avatarUrl,
    ownerCountry: owner.country,
    openHelpRequestCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeProjectDetail(
  row: ProjectRow,
  owner: ProfileRow,
  openHelpRequestCount: number,
  datacloudDeployUrl: string | null,
): ProjectDetail {
  return {
    ...serializeProjectSummary(row, owner, openHelpRequestCount),
    description: row.description,
    repoUrl: row.repoUrl,
    demoUrl: row.demoUrl,
    datacloudDeployUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeHelpRequest(row: HelpRequestRow, applicationCount: number): HelpRequest {
  return {
    id: row.id,
    projectId: row.projectId,
    authorId: row.authorId,
    kind: row.kind,
    title: row.title,
    description: row.description,
    stack: row.stack,
    status: row.status,
    applicationCount,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

export function serializeApplication(row: ApplicationRow, applicant: ProfileRow, applicantLevel: Level): Application {
  return {
    id: row.id,
    helpRequestId: row.helpRequestId,
    applicantId: row.applicantId,
    applicantHandle: applicant.handle,
    applicantDisplayName: applicant.displayName,
    applicantLevel,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}
