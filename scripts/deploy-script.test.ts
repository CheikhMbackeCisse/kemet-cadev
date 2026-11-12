import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

// infra/deploy.sh joué de bout en bout sans serveur : ssh exécute le script
// distant en local, dans un dépôt git jetable, et docker se contente de noter
// ses appels. Les chemins restent ceux de bash, pour tourner aussi sous Git Bash.

const REPO_ROOT = new URL("..", import.meta.url);

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function bash(script: string): Run {
  const result = spawnSync("bash", ["-c", script], { cwd: REPO_ROOT, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const FAKE_SSH = `#!/usr/bin/env bash
echo "ssh $*" >> "$FAKE_LOG"
shift
exec bash -c "$1"
`;

// Échoue au démarrage des services quand .env.deployed vise FAIL_TAG.
const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
if [[ $1 == compose && " $* " == *" up "* && -n \${FAIL_TAG:-} ]] &&
  grep -qx "KEMET_IMAGE_TAG=$FAIL_TAG" .env.deployed 2>/dev/null; then
  exit 1
fi
exit 0
`;

interface Sandbox {
  root: string;
  commits: [string, string, string];
}

function createSandbox(): Sandbox {
  const run = bash(`set -euo pipefail
root=$(mktemp -d /tmp/kemet-deploy-XXXXXX)
mkdir -p "$root/bin" "$root/server/infra/server"
cat > "$root/bin/ssh" <<'EOF'
${FAKE_SSH}EOF
cat > "$root/bin/docker" <<'EOF'
${FAKE_DOCKER}EOF
chmod +x "$root/bin/ssh" "$root/bin/docker"
cp infra/server/compose.sh "$root/server/infra/server/compose.sh"
cd "$root/server"
git init --quiet
git remote add origin "$root/server"
for name in a b c; do
  echo "$name" > version
  git add --all
  git -c user.name=test -c user.email=test@example.com commit --quiet -m "$name"
done
echo "$root"
git log --format=%H --reverse`);
  assert.equal(run.status, 0, run.stderr);
  const [root, a, b, c] = run.stdout.trim().split("\n");
  return { root: root!, commits: [a!, b!, c!] };
}

function deploy(sandbox: Sandbox, args: string[], env: Record<string, string> = {}): Run {
  const assignments = Object.entries({
    PATH: `${sandbox.root}/bin:$PATH`,
    FAKE_LOG: `${sandbox.root}/log`,
    SKIP_SMOKE: "1",
    KEMET_REMOTE_PATH: `${sandbox.root}/server`,
    ...env,
  })
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return bash(`${assignments} bash infra/deploy.sh ${args.map((arg) => `'${arg}'`).join(" ")}`);
}

function serverFile(sandbox: Sandbox, name: string): string {
  return bash(`cat "${sandbox.root}/server/${name}" 2>/dev/null || true`).stdout;
}

function writeServerFile(sandbox: Sandbox, name: string, content: string): void {
  const run = bash(`printf '%s' '${content}' > "${sandbox.root}/server/${name}"`);
  assert.equal(run.status, 0, run.stderr);
}

function removeSandbox(sandbox: Sandbox): void {
  bash(`rm -rf "${sandbox.root}"`);
}

describe("infra/deploy.sh", () => {
  it("refuse une construction sur le serveur sans commit, sans appeler ssh", () => {
    const sandbox = createSandbox();
    try {
      const run = deploy(sandbox, ["kemet@test", "https://kemet.test"], {
        KEMET_BUILD_ON_SERVER: "1",
      });
      assert.notEqual(run.status, 0);
      assert.match(run.stderr, /commit à déployer en troisième argument/);
      assert.match(run.stderr, /Rien n'a été fait sur le serveur/);
      assert.equal(
        bash(`test -e "${sandbox.root}/log" && echo oui || echo non`).stdout.trim(),
        "non",
      );
    } finally {
      removeSandbox(sandbox);
    }
  });

  it("note une construction sur le serveur, et le déploiement qui tournait avant elle", () => {
    const sandbox = createSandbox();
    const [a, b] = sandbox.commits;
    try {
      writeServerFile(sandbox, ".env.deployed", `KEMET_IMAGE_TAG=${b}\n`);
      const run = deploy(sandbox, ["kemet@test", "https://kemet.test", a], {
        KEMET_BUILD_ON_SERVER: "1",
      });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(serverFile(sandbox, ".deploy-history"), `${b}\n${a} server\n`);
      assert.equal(
        serverFile(sandbox, ".env.deployed"),
        `KEMET_IMAGE_PREFIX=kemet-local\nKEMET_IMAGE_TAG=${a}\n`,
      );
    } finally {
      removeSandbox(sandbox);
    }
  });

  it("reconstruit sur le serveur au retour arrière vers une construction sur place", () => {
    const sandbox = createSandbox();
    const [a, b, c] = sandbox.commits;
    try {
      writeServerFile(sandbox, ".deploy-history", `${b}\n${a} server\n`);
      writeServerFile(
        sandbox,
        ".env.deployed",
        `KEMET_IMAGE_PREFIX=kemet-local\nKEMET_IMAGE_TAG=${a}\n`,
      );
      const run = deploy(sandbox, ["kemet@test", "https://kemet.test", c], {
        KEMET_BUILD_ON_SERVER: "1",
        FAIL_TAG: c,
      });
      assert.notEqual(run.status, 0);
      assert.match(run.stderr, new RegExp(`Retour arrière vers ${a}, images reconstruites`));
      assert.equal(
        serverFile(sandbox, ".env.deployed"),
        `KEMET_IMAGE_PREFIX=kemet-local\nKEMET_IMAGE_TAG=${a}\n`,
      );
      assert.equal(serverFile(sandbox, ".deploy-history"), `${b}\n${a} server\n`);
      assert.equal(bash(`git -C "${sandbox.root}/server" rev-parse HEAD`).stdout.trim(), a);
    } finally {
      removeSandbox(sandbox);
    }
  });

  it("télécharge depuis GHCR au retour arrière vers un déploiement GHCR", () => {
    const sandbox = createSandbox();
    const [, b, c] = sandbox.commits;
    try {
      writeServerFile(sandbox, ".deploy-history", `${b}\n`);
      writeServerFile(sandbox, ".env.deployed", `KEMET_IMAGE_TAG=${b}\n`);
      const run = deploy(sandbox, ["kemet@test", "https://kemet.test", c], { FAIL_TAG: c });
      assert.notEqual(run.status, 0);
      assert.equal(serverFile(sandbox, ".env.deployed"), `KEMET_IMAGE_TAG=${b}\n`);
      const log = bash(`cat "${sandbox.root}/log"`).stdout;
      assert.match(log, /compose .* pull /);
      assert.doesNotMatch(log, /compose .* build /);
    } finally {
      removeSandbox(sandbox);
    }
  });
});
