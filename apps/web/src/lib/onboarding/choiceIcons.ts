import {
  Blocks,
  BrainCircuit,
  Briefcase,
  Cloud,
  CodeXml,
  Cpu,
  Database,
  FlaskConical,
  Gamepad2,
  Globe,
  GraduationCap,
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

/** Ce qu'un compte RH ou entrepreneur cherche, demandé avant l'inscription. */
export const SEEKING_INTENTS = [
  "recruit",
  "find_partner",
  "follow_community",
] as const satisfies readonly Intent[];

export type SeekingIntent = (typeof SEEKING_INTENTS)[number];

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

export const SEEKING_ICONS: Record<SeekingIntent, LucideIcon> = {
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
