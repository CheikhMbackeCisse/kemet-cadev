import type { ProfileRole } from "@kemet/shared";
import { fr } from "../i18n/fr.js";

export const PROFILE_ROLE_OPTIONS: { value: ProfileRole; label: string }[] = [
  { value: "developer", label: fr.auth.roleDeveloper },
  { value: "designer", label: fr.auth.roleDesigner },
  { value: "hr", label: fr.auth.roleHr },
  { value: "student", label: fr.auth.roleStudent },
  { value: "project_manager", label: fr.auth.roleProjectManager },
  { value: "entrepreneur", label: fr.auth.roleEntrepreneur },
  { value: "other", label: fr.auth.roleOther },
];
