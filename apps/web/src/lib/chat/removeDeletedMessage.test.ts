import { describe, expect, it } from "vitest";
import type { Message } from "@kemet/shared";
import { removeDeletedMessage } from "./removeDeletedMessage.js";

function message(id: string, replyCount = 0): Message {
  return { id, replyCount } as Message;
}

describe("removeDeletedMessage", () => {
  it("retire le message supprimé de la liste", () => {
    const result = removeDeletedMessage([message("a"), message("b")], {
      messageId: "a",
      parentMessageId: null,
    });
    expect(result.map((item) => item.id)).toEqual(["b"]);
  });

  it("décompte une réponse supprimée de son message d'origine", () => {
    const result = removeDeletedMessage([message("parent", 2)], {
      messageId: "reponse",
      parentMessageId: "parent",
    });
    expect(result).toEqual([message("parent", 1)]);
  });
});
