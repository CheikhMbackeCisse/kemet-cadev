import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  it("affiche le message d'accueil", () => {
    render(<App />);
    expect(screen.getByText("Kemet arrive.")).toBeInTheDocument();
  });
});
