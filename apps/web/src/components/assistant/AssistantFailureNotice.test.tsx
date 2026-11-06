import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fr } from "../../i18n/fr.js";
import { AssistantFailureNotice } from "./AssistantFailureNotice.js";

describe("AssistantFailureNotice", () => {
  it.each([
    ["assistant_unavailable", fr.chat.assistantUnavailable],
    ["quota_exceeded", fr.chat.assistantQuotaReached],
    ["internal_error", fr.chat.assistantFailed],
    ["code_inconnu", fr.chat.assistantFailed],
  ])("annonce le texte propre au code %s", (errorCode, text) => {
    render(<AssistantFailureNotice errorCode={errorCode} onRetry={null} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(text);
  });

  it("propose de reposer la question quand c'est possible", () => {
    const onRetry = vi.fn();
    render(
      <AssistantFailureNotice
        errorCode="assistant_unavailable"
        onRetry={onRetry}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: fr.chat.retryAssistantQuestion }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("ne propose pas de reposer la question sans action possible", () => {
    render(
      <AssistantFailureNotice errorCode="quota_exceeded" onRetry={null} onDismiss={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: fr.chat.retryAssistantQuestion })).toBeNull();
  });

  it("se masque à la demande", () => {
    const onDismiss = vi.fn();
    render(
      <AssistantFailureNotice
        errorCode="assistant_unavailable"
        onRetry={null}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: fr.chat.dismissAssistantFailure }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
