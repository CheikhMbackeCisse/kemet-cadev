import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { CodeTextarea } from "./CodeTextarea.js";

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <CodeTextarea label="Contenu" value={value} onValueChange={setValue} />;
}

function paste(field: HTMLElement, text: string, editorData = "") {
  const data: Record<string, string> = { "text/plain": text, "vscode-editor-data": editorData };
  fireEvent.paste(field, { clipboardData: { getData: (type: string) => data[type] ?? "" } });
}

const SNIPPET = ["def add(a, b):", "    total = a + b", "    return total"].join("\n");
const FENCE = "```";

async function chooseLanguage(name: string) {
  // Radix ouvre son menu au clavier dans jsdom, qui ne simule pas les pointeurs.
  fireEvent.keyDown(screen.getByRole("button", { name: "Code" }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name }));
  await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
}

describe("CodeTextarea", () => {
  it("relie le libellé au champ et non au bouton Code", () => {
    render(<Harness initial="" />);
    expect(screen.getByLabelText("Contenu").tagName).toBe("TEXTAREA");
  });

  it("entoure la sélection d'un bloc du langage choisi et rend le focus au champ", async () => {
    render(<Harness initial="print(1)" />);
    const field = screen.getByLabelText<HTMLTextAreaElement>("Contenu");
    field.setSelectionRange(0, 8);

    await chooseLanguage("Python");

    expect(field.value).toBe(`${FENCE}python\nprint(1)\n${FENCE}`);
    expect(field).toHaveFocus();
    expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe("print(1)");
  });

  it("insère du code en ligne", async () => {
    render(<Harness initial="lancer npm test" />);
    const field = screen.getByLabelText<HTMLTextAreaElement>("Contenu");
    field.setSelectionRange(7, 15);

    await chooseLanguage("Code en ligne");

    expect(field.value).toBe("lancer `npm test`");
  });

  it("place un collage de code dans un bloc, et Annuler le remet en texte", async () => {
    render(<Harness initial={"Mon code :\n"} />);
    const field = screen.getByLabelText<HTMLTextAreaElement>("Contenu");
    field.setSelectionRange(field.value.length, field.value.length);

    paste(field, SNIPPET);

    expect(field.value).toBe(`Mon code :\n${FENCE}python\n${SNIPPET}\n${FENCE}`);
    expect(screen.getByRole("status")).toHaveTextContent("Collé comme code");
    fireEvent.click(screen.getByRole("button", { name: "Remettre en texte" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(field.value).toBe(`Mon code :\n${SNIPPET}`);
  });

  it("préfère le langage annoncé par l'éditeur", () => {
    render(<Harness initial="" />);
    const field = screen.getByLabelText<HTMLTextAreaElement>("Contenu");

    paste(field, SNIPPET, JSON.stringify({ mode: "typescript" }));

    expect(field.value.startsWith(`${FENCE}typescript\n`)).toBe(true);
  });

  it("laisse passer un texte ordinaire, et tout collage dans un bloc ouvert", () => {
    render(<Harness initial={`${FENCE}js\n`} />);
    const field = screen.getByLabelText<HTMLTextAreaElement>("Contenu");
    field.setSelectionRange(field.value.length, field.value.length);

    paste(field, SNIPPET);
    paste(field, "Bonjour,\nmerci pour la relecture.\nÀ bientôt.");

    expect(field.value).toBe(`${FENCE}js\n`);
    expect(screen.queryByText("Collé comme code")).not.toBeInTheDocument();
  });

  it("retire la ligne d'état dès qu'on tape après le collage", () => {
    render(<Harness initial="" />);
    const field = screen.getByLabelText<HTMLTextAreaElement>("Contenu");

    paste(field, SNIPPET);
    expect(screen.getByRole("status")).toHaveTextContent("Collé comme code");
    fireEvent.input(field, { target: { value: `${field.value}x` } });

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("rend le focus au champ quand on ferme la ligne d'état", () => {
    render(<Harness initial="" />);
    const field = screen.getByLabelText<HTMLTextAreaElement>("Contenu");

    paste(field, SNIPPET);
    fireEvent.click(screen.getByRole("button", { name: "Masquer l'indication de collage" }));

    expect(field).toHaveFocus();
  });
});
