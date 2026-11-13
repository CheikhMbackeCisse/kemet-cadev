import { ASSISTANT_MENTION_HANDLE, isAssistantHandle } from "@kemet/shared";
import type { Link, Nodes, PhrasingContent, Root, Strong } from "mdast";
import { findAndReplace } from "mdast-util-find-and-replace";

// Même forme que handleSchema (@kemet/shared) : 3 à 30 caractères, lettres
// minuscules, chiffres et tirets, ni en tête ni en fin.
const MENTION_PATTERN = /@([a-z0-9][a-z0-9-]{1,28}[a-z0-9])(?![a-z0-9-])/g;
const MENTION_PRECEDING_CHAR = /[a-zA-Z0-9._%+-]/;

export const USER_MENTION_CLASS = "user-mention";

/**
 * Transforme `@handle` en lien vers le profil, et `@kocc` en mention de
 * l'assistant, sans lien. L'ancien `@kemet` des messages déjà écrits
 * s'affiche aussi `@kocc`. Une adresse email comme
 * awa@example.com n'est pas une mention.
 */
export function remarkMentions() {
  return (tree: Root) => {
    findAndReplace(
      tree,
      [
        MENTION_PATTERN,
        (value: string, handle: string, match: { index: number; input: string }) => {
          const previous = match.input.charAt(match.index - 1);
          if (previous && MENTION_PRECEDING_CHAR.test(previous)) return false;
          if (isAssistantHandle(handle)) {
            const assistant: Strong = {
              type: "strong",
              data: { hName: "span", hProperties: { className: ["assistant-mention"] } },
              children: [{ type: "text", value: `@${ASSISTANT_MENTION_HANDLE}` }],
            };
            return assistant;
          }
          const user: Link = {
            type: "link",
            url: `/u/${handle}`,
            data: { hProperties: { className: [USER_MENTION_CLASS] } },
            children: [{ type: "text", value }],
          };
          return user;
        },
      ],
      { ignore: ["link", "linkReference"] },
    );
  };
}

const FLOW_CONTAINERS = new Set(["root", "blockquote", "listItem", "footnoteDefinition"]);

function htmlToText(node: Nodes): void {
  if (!("children" in node)) return;
  const isFlow = FLOW_CONTAINERS.has(node.type);
  node.children = node.children.map((child) => {
    if (child.type === "html") {
      const text: PhrasingContent = { type: "text", value: child.value };
      return isFlow ? { type: "paragraph", children: [text] } : text;
    }
    htmlToText(child);
    return child;
  }) as typeof node.children;
}

/**
 * Affiche le HTML écrit dans un message comme du texte, au lieu de
 * l'interpréter ou de le faire disparaître : un développeur qui écrit
 * "<Button>" doit le voir tel quel, et rien ne doit jamais être injecté.
 */
export function remarkHtmlAsText() {
  return (tree: Root) => htmlToText(tree);
}
