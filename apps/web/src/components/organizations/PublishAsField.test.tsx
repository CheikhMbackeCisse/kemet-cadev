import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedOrganization } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { PublishAsField, PUBLISH_AS_ME } from "./PublishAsField.js";

const listMyOrganizations = vi.fn<() => Promise<{ items: ManagedOrganization[] }>>();

vi.mock("../../session/SessionProvider.js", () => ({
  useSession: () => ({ status: "ready", isSuspended: false }),
}));

vi.mock("../../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/chat/api.js")>()),
  listMyOrganizations: () => listMyOrganizations(),
}));

const LAGUNE: ManagedOrganization = {
  id: "00000000-0000-4000-8000-000000000031",
  handle: "lagune-logiciels",
  displayName: "Lagune Logiciels",
  avatarUrl: null,
  organizationType: "company",
};

function renderField() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <form>
        <PublishAsField value={PUBLISH_AS_ME} onChange={() => undefined} />
        <span>fin</span>
      </form>
    </QueryClientProvider>,
  );
}

describe("PublishAsField", () => {
  beforeEach(() => listMyOrganizations.mockReset());

  it("ne montre rien à qui ne gère aucune organisation", async () => {
    listMyOrganizations.mockResolvedValue({ items: [] });
    renderField();
    await screen.findByText("fin");
    await vi.waitFor(() => expect(listMyOrganizations).toHaveBeenCalled());
    expect(screen.queryByText(fr.organizations.publishAs)).toBeNull();
  });

  it("propose Moi par défaut à un gestionnaire", async () => {
    listMyOrganizations.mockResolvedValue({ items: [LAGUNE] });
    renderField();
    const select = await screen.findByRole("combobox", { name: fr.organizations.publishAs });
    expect(select.textContent).toContain(fr.organizations.publishAsMe);
  });
});
