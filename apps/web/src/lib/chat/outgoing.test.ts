import { describe, expect, it } from "vitest";
import { ChatApiError } from "./api.js";
import {
  addOutgoing,
  describeSendFailure,
  removeOutgoing,
  setOutgoingStatus,
  type OutgoingMessage,
} from "./outgoing.js";

function outgoing(
  clientId: string,
  status: OutgoingMessage["status"] = "sending",
): OutgoingMessage {
  return {
    clientId,
    body: `message ${clientId}`,
    parentMessageId: null,
    attachmentIds: [],
    status,
  };
}

describe("outgoing messages", () => {
  it("keeps the order of sending", () => {
    const list = addOutgoing(addOutgoing([], outgoing("a")), outgoing("b"));
    expect(list.map((item) => item.clientId)).toEqual(["a", "b"]);
  });

  it("moves a retried message back to the end instead of duplicating it", () => {
    const list = addOutgoing([outgoing("a", "failed"), outgoing("b")], outgoing("a"));
    expect(list.map((item) => [item.clientId, item.status])).toEqual([
      ["b", "sending"],
      ["a", "sending"],
    ]);
  });

  it("marks only the targeted message as failed", () => {
    const list = setOutgoingStatus([outgoing("a"), outgoing("b")], "b", "failed");
    expect(list.map((item) => item.status)).toEqual(["sending", "failed"]);
  });

  it("drops a message once the server has it", () => {
    expect(
      removeOutgoing([outgoing("a"), outgoing("b")], "a").map((item) => item.clientId),
    ).toEqual(["b"]);
  });
});

describe("describeSendFailure", () => {
  it("treats a missing answer from the server as a lost connection", () => {
    expect(describeSendFailure(new TypeError("Failed to fetch"))).toBeUndefined();
  });

  it("keeps the server reason and allows a retry after a rate limit", () => {
    expect(describeSendFailure(new ChatApiError("rate_limited", "Trop de messages.", 429))).toEqual(
      {
        message: "Trop de messages.",
        retryable: true,
      },
    );
  });

  it("does not offer a retry for a refusal", () => {
    expect(describeSendFailure(new ChatApiError("forbidden", "Compte suspendu.", 403))).toEqual({
      message: "Compte suspendu.",
      retryable: false,
    });
  });
});
