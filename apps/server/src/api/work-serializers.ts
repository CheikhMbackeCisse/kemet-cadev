import type {
  Level,
  PostWorkPreview,
  ProfileWork,
  WorkAttachment,
  WorkDetail,
  WorkInvitationEntry,
  WorkLink,
  WorkPerson,
  WorkSummary,
  WorkViewerRole,
} from "@kemet/shared";
import type {
  ProfileRow,
  WorkAttachmentRow,
  WorkLinkRow,
  WorkPeople,
  WorkRow,
} from "./repositories/works.js";

const EXCERPT_LENGTH = 220;

/** Début du résumé en texte brut, sans la syntaxe Markdown ni les blocs de code. */
export function toExcerpt(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > EXCERPT_LENGTH ? `${plain.slice(0, EXCERPT_LENGTH).trimEnd()}…` : plain;
}

export function serializeWorkPerson(profile: ProfileRow, level: Level): WorkPerson {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    country: profile.country,
    level,
  };
}

function levelOf(people: WorkPeople, profileId: string): Level {
  return people.levels.get(profileId) ?? "apprenti";
}

export function serializeWorkSummary(row: WorkRow, people: WorkPeople): WorkSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    status: row.status,
    excerpt: toExcerpt(row.summary),
    tags: row.tags,
    stack: row.stack,
    year: row.year,
    institution: row.institution,
    publisher: serializeWorkPerson(people.publisher, levelOf(people, people.publisher.id)),
    coauthors: people.coauthors.map((person) => serializeWorkPerson(person, levelOf(people, person.id))),
    externalAuthors: people.externalAuthors,
    hasPdf: people.hasPdf,
    messageCount: people.messageCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeProfileWork(
  row: WorkRow,
  people: WorkPeople,
  profileId: string,
): ProfileWork {
  return {
    ...serializeWorkSummary(row, people),
    relation: row.publisherId === profileId ? "published" : "coauthored",
  };
}

function serializeWorkLink(row: WorkLinkRow): WorkLink {
  return { id: row.id, type: row.type, url: row.url, label: row.label };
}

function serializeWorkAttachment(row: WorkAttachmentRow): WorkAttachment {
  return { id: row.id, originalName: row.originalName, byteSize: row.byteSize };
}

export function serializeWorkDetail(
  row: WorkRow,
  people: WorkPeople,
  extra: {
    publisherLevel: Level;
    links: WorkLinkRow[];
    attachment: WorkAttachmentRow | null;
    invitations: { status: WorkInvitationEntry["status"]; profile: ProfileRow }[] | null;
    viewerRole: WorkViewerRole | null;
    participantCount: number;
  },
): WorkDetail {
  return {
    ...serializeWorkSummary(row, people),
    summary: row.summary,
    publisherLevel: extra.publisherLevel,
    links: extra.links.map(serializeWorkLink),
    attachment: extra.attachment ? serializeWorkAttachment(extra.attachment) : null,
    invitations: extra.invitations
      ? extra.invitations.map((entry) => ({
          person: serializeWorkPerson(entry.profile, levelOf(people, entry.profile.id)),
          status: entry.status,
        }))
      : null,
    viewerRole: extra.viewerRole,
    discussionChannelId: row.channelId,
    participantCount: extra.participantCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializePostWorkPreview(row: WorkRow): PostWorkPreview {
  return { slug: row.slug, title: row.title, type: row.type, excerpt: toExcerpt(row.summary) };
}
