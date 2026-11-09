import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Textarea, type TextareaVariant } from "./Textarea.js";

const LINE_HEIGHT = 20;
const PADDING = 16;
const BORDERS = 2;

// jsdom ne calcule aucune mise en page : la hauteur du contenu est simulée à
// partir du nombre de lignes du texte, et le style est donné en ligne pour que
// getComputedStyle le relise.
const style = {
  lineHeight: `${LINE_HEIGHT}px`,
  paddingTop: `${PADDING / 2}px`,
  paddingBottom: `${PADDING / 2}px`,
  borderTopWidth: `${BORDERS / 2}px`,
  borderBottomWidth: `${BORDERS / 2}px`,
};

const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");

beforeAll(() => {
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      const lines = this.value === "" ? 1 : this.value.split("\n").length;
      return lines * LINE_HEIGHT + PADDING;
    },
  });
});

afterAll(() => {
  delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
  if (original) Object.defineProperty(HTMLElement.prototype, "scrollHeight", original);
});

function heightFor(lines: number): string {
  return `${lines * LINE_HEIGHT + PADDING + BORDERS}px`;
}

function text(lines: number): string {
  return Array.from({ length: lines }, (_, index) => `ligne ${index + 1}`).join("\n");
}

function renderField(variant: TextareaVariant, value: string) {
  const view = render(
    <Textarea
      aria-label="Champ"
      variant={variant}
      value={value}
      onChange={() => {}}
      style={style}
    />,
  );
  return {
    field: screen.getByRole("textbox", { name: "Champ" }),
    setValue: (next: string) =>
      view.rerender(
        <Textarea
          aria-label="Champ"
          variant={variant}
          value={next}
          onChange={() => {}}
          style={style}
        />,
      ),
  };
}

describe("Textarea", () => {
  it("part d'une ligne dans un composeur, grandit jusqu'à six, puis défile", () => {
    const { field, setValue } = renderField("composer", "");
    expect(field.style.height).toBe(heightFor(1));
    expect(field.style.overflowY).toBe("hidden");

    setValue(text(4));
    expect(field.style.height).toBe(heightFor(4));
    expect(field.style.overflowY).toBe("hidden");

    setValue(text(9));
    expect(field.style.height).toBe(heightFor(6));
    expect(field.style.overflowY).toBe("auto");
  });

  it("part de trois lignes dans un formulaire et s'arrête à dix", () => {
    const { field, setValue } = renderField("form", "");
    expect(field.style.height).toBe(heightFor(3));

    setValue(text(8));
    expect(field.style.height).toBe(heightFor(8));
    expect(field.style.overflowY).toBe("hidden");

    setValue(text(14));
    expect(field.style.height).toBe(heightFor(10));
    expect(field.style.overflowY).toBe("auto");
  });

  it("redescend quand on efface le texte", () => {
    const { field, setValue } = renderField("composer", text(5));
    expect(field.style.height).toBe(heightFor(5));

    setValue("");
    expect(field.style.height).toBe(heightFor(1));
  });

  it("n'offre jamais de poignée de redimensionnement", () => {
    const { field } = renderField("form", "");
    expect(field).toHaveClass("resize-none");
  });
});
