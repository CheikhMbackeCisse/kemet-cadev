import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoreActionsMenu } from "./MoreActionsMenu.js";

describe("MoreActionsMenu", () => {
  it("range la suppression derrière le bouton ... en action de danger", async () => {
    const onSelect = vi.fn();
    render(
      <MoreActionsMenu
        label="Actions sur ce skill"
        items={[{ value: "delete", label: "Supprimer", danger: true }]}
        onSelect={onSelect}
      />,
    );

    expect(screen.queryByText("Supprimer")).toBeNull();
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions sur ce skill" }), {
      key: "Enter",
    });

    const item = await screen.findByRole("menuitem", { name: "Supprimer" });
    expect(item).toHaveClass("text-danger");
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith("delete");
  });
});
