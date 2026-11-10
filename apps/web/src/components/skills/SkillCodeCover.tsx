import type { SkillSummary } from "@kemet/shared";
import { highlightLine, type CodeTokenKind } from "../../lib/skills/highlightCode.js";
import { techLogoFor } from "../../lib/skills/techLogo.js";
import { cn } from "../../lib/cn.js";
import { TechLogo } from "../ui/TechLogo.js";

const TOKEN_CLASSES: Record<CodeTokenKind, string> = {
  keyword: "text-[var(--code-cover-keyword)]",
  string: "text-[var(--code-cover-string)]",
  comment: "text-[var(--code-cover-comment)]",
  text: "",
};

type CoverSkill = Pick<SkillSummary, "slug" | "name" | "tags" | "codeExcerpt">;

/**
 * Couverture 16:9 d'un skill : une petite fenêtre d'éditeur sombre avec le
 * début de son premier bloc de code, dessinée en HTML. Décorative : le nom du
 * skill est juste en dessous.
 */
export function SkillCodeCover({ skill, className }: { skill: CoverSkill; className?: string }) {
  const logo = techLogoFor([...skill.tags, skill.codeExcerpt.language, skill.name]);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex aspect-[16/9] w-full flex-col overflow-hidden bg-[var(--code-cover-bg)] font-mono text-[var(--code-cover-text)]",
        className,
      )}
    >
      <div className="flex h-7 shrink-0 items-center gap-2 bg-[var(--code-cover-bar)] px-3 text-xs text-[var(--code-cover-comment)]">
        <span className="truncate">{`${skill.slug}.md`}</span>
      </div>
      <pre className="min-h-0 flex-1 overflow-hidden px-3 py-2 text-xs leading-5">
        {skill.codeExcerpt.lines.map((line, index) => (
          <div key={index} className="truncate">
            {line === ""
              ? " "
              : highlightLine(line).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={TOKEN_CLASSES[token.kind]}>
                    {token.text}
                  </span>
                ))}
          </div>
        ))}
      </pre>
      {logo && <TechLogo name={logo} className="absolute bottom-3 right-3" />}
    </div>
  );
}
