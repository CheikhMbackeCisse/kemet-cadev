import { cn } from "../../lib/cn.js";
import { Input } from "../ui/Input.js";
import type { ChoiceTone } from "./choiceTone.js";

export interface OtherAnswerFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  tone?: ChoiceTone;
}

/** Champ qui apparaît sous un choix "Autre". Soixante caractères, comme côté serveur. */
export function OtherAnswerField({
  label,
  placeholder,
  value,
  onChange,
  tone = "page",
}: OtherAnswerFieldProps) {
  return (
    <label
      className={cn(
        "flex flex-col gap-1 text-sm",
        tone === "glass" ? "text-auth-text" : "text-text-2",
      )}
    >
      {label}
      <Input
        value={value}
        maxLength={60}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
