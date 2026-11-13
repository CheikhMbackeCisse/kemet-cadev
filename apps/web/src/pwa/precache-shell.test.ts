import { describe, expect, it } from "vitest";
import { keepShellEntries } from "./precache-shell.js";

const indexHtml = `<!doctype html><html><head>
<script src="/theme-init.js"></script>
<script type="module" crossorigin src="/assets/index-B90mRwA6.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-AbC123.js">
<link rel="stylesheet" crossorigin href="/assets/index-CMLToiVA.css">
<link rel="manifest" href="/manifest.webmanifest"></head></html>`;

describe("keepShellEntries", () => {
  it("garde la page, les fichiers de la racine et ce que la page charge", () => {
    const entries = [
      { url: "index.html", revision: "1" },
      { url: "registerSW.js", revision: "1" },
      { url: "theme-init.js", revision: "1" },
      { url: "brand/kemet-app-icon-192.png", revision: "1" },
      { url: "assets/index-B90mRwA6.js", revision: null },
      { url: "assets/vendor-AbC123.js", revision: null },
      { url: "assets/index-CMLToiVA.css", revision: null },
      { url: "assets/cpp-DddhVWhK.js", revision: null },
      { url: "assets/FeedPage-Xy12.js", revision: null },
    ];

    expect(keepShellEntries(entries, indexHtml).map((entry) => entry.url)).toEqual([
      "index.html",
      "registerSW.js",
      "theme-init.js",
      "brand/kemet-app-icon-192.png",
      "assets/index-B90mRwA6.js",
      "assets/vendor-AbC123.js",
      "assets/index-CMLToiVA.css",
    ]);
  });
});
