import {
  Blocks,
  BookOpen,
  BrainCircuit,
  Briefcase,
  Cloud,
  CodeXml,
  Cpu,
  Database,
  FlaskConical,
  FolderOpen,
  Gamepad2,
  Globe,
  GraduationCap,
  HandHelping,
  Handshake,
  Network,
  Palette,
  Plus,
  Rocket,
  Server,
  ShieldCheck,
  Smartphone,
  Terminal,
  UserSearch,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Intent, Interest } from "@kemet/shared";

export const INTEREST_ICONS: Record<Interest, LucideIcon> = {
  web: Globe,
  mobile: Smartphone,
  backend: Server,
  ai: BrainCircuit,
  data: Database,
  devops: Cloud,
  security: ShieldCheck,
  networks: Network,
  embedded: Cpu,
  payments: Wallet,
  blockchain: Blocks,
  games: Gamepad2,
  design: Palette,
  testing: FlaskConical,
  systems: Terminal,
  other: Plus,
};

export const INTENT_ICONS: Record<Intent, LucideIcon> = {
  learn: BookOpen,
  help_others: HandHelping,
  showcase_work: FolderOpen,
  recruit: Briefcase,
  find_partner: Handshake,
  follow_community: Users,
};

/** Icônes des cinq profils proposés par la question "Qui es-tu ?". */
export const WHO_ICONS = {
  developer: CodeXml,
  student: GraduationCap,
  hr: UserSearch,
  entrepreneur: Rocket,
  other: Plus,
} as const;
