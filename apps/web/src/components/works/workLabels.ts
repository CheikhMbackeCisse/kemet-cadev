import {
  GitBranch,
  GitMerge,
  Globe,
  HardDrive,
  Link,
  Newspaper,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { WorkLinkType, WorkStatus, WorkType } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  class_project: fr.works.typeClassProject,
  internship: fr.works.typeInternship,
  thesis_research: fr.works.typeThesisResearch,
  application: fr.works.typeApplication,
  article: fr.works.typeArticle,
  other: fr.works.typeOther,
};

export const WORK_TYPES = Object.keys(WORK_TYPE_LABELS) as WorkType[];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  completed: fr.works.statusCompleted,
  in_progress: fr.works.statusInProgress,
};

export const WORK_STATUSES = Object.keys(WORK_STATUS_LABELS) as WorkStatus[];

export const WORK_LINK_TYPE_LABELS: Record<WorkLinkType, string> = {
  github: fr.works.linkTypeGithub,
  gitlab: fr.works.linkTypeGitlab,
  drive: fr.works.linkTypeDrive,
  site: fr.works.linkTypeSite,
  video: fr.works.linkTypeVideo,
  article: fr.works.linkTypeArticle,
  other: fr.works.linkTypeOther,
};

export const WORK_LINK_TYPES = Object.keys(WORK_LINK_TYPE_LABELS) as WorkLinkType[];

// Lucide n'a plus d'icônes de marque : une icône générique distincte par
// type, le libellé dit le reste.
export const WORK_LINK_ICONS: Record<WorkLinkType, LucideIcon> = {
  github: GitBranch,
  gitlab: GitMerge,
  drive: HardDrive,
  site: Globe,
  video: Video,
  article: Newspaper,
  other: Link,
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
