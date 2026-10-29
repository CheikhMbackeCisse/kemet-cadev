import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesTarget, readPlatformPackages, splitKey } from "./lockfile-platforms.js";

const LINUX_X64 = { os: "linux", cpu: "x64" };

const LOCKFILE = `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      cpu-like-key:
        specifier: ^1.0.0

packages:

  '@esbuild/linux-x64@0.25.12':
    resolution: {integrity: sha512-abc}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [linux]

  '@esbuild/win32-x64@0.25.12':
    cpu: [x64]
    os: [win32]

  '@node-rs/argon2-linux-x64-musl@2.2.2':
    cpu: [x64]
    os: [linux]
    libc: [musl]

  not-windows@1.0.0:
    os: ['!win32']

  plain@1.0.0:
    resolution: {integrity: sha512-def}

snapshots:

  other@1.0.0:
    os: [darwin]
`;

describe("readPlatformPackages", () => {
  const packages = readPlatformPackages(LOCKFILE);

  it("ne garde que les paquets qui portent une contrainte de plateforme", () => {
    assert.deepEqual([...packages.keys()].sort(), [
      "@esbuild/linux-x64@0.25.12",
      "@esbuild/win32-x64@0.25.12",
      "@node-rs/argon2-linux-x64-musl@2.2.2",
      "not-windows@1.0.0",
    ]);
  });

  it("retire les guillemets des valeurs", () => {
    assert.deepEqual(packages.get("not-windows@1.0.0"), { os: ["!win32"] });
  });

  it("lit la libc sans la filtrer", () => {
    assert.deepEqual(packages.get("@node-rs/argon2-linux-x64-musl@2.2.2"), {
      cpu: ["x64"],
      os: ["linux"],
      libc: ["musl"],
    });
  });

  it("échoue sur une liste écrite en bloc plutôt que de l'ignorer", () => {
    const blockList = "packages:\n\n  odd@1.0.0:\n    os:\n      - linux\n";
    assert.throws(() => readPlatformPackages(blockList), /illisible/);
  });
});

describe("matchesTarget", () => {
  it("accepte Linux x64, glibc comme musl", () => {
    assert.equal(matchesTarget({ os: ["linux"], cpu: ["x64"] }, LINUX_X64), true);
    assert.equal(matchesTarget({ os: ["linux"], cpu: ["x64"], libc: ["musl"] }, LINUX_X64), true);
  });

  it("refuse une autre plateforme", () => {
    assert.equal(matchesTarget({ os: ["win32"], cpu: ["x64"] }, LINUX_X64), false);
    assert.equal(matchesTarget({ os: ["linux"], cpu: ["arm64"] }, LINUX_X64), false);
  });

  it("applique les exclusions comme npm", () => {
    assert.equal(matchesTarget({ os: ["!win32"] }, LINUX_X64), true);
    assert.equal(matchesTarget({ os: ["!linux"] }, LINUX_X64), false);
  });
});

describe("splitKey", () => {
  it("sépare un nom à portée et sa version", () => {
    assert.deepEqual(splitKey("@esbuild/linux-x64@0.25.12"), {
      name: "@esbuild/linux-x64",
      version: "0.25.12",
    });
  });

  it("refuse une version qui n'est pas semver", () => {
    assert.throws(() => splitKey("odd@file:../odd"), /inattendue/);
    assert.throws(() => splitKey("no-version"), /inattendue/);
  });
});
