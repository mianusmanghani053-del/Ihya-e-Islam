import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const state = mkdtempSync(join(tmpdir(), "ihya-tests-"));
const cli = "node_modules/wrangler/bin/wrangler.js";
const children = [];
const env = {
  ...process.env,
  TEST_URL: "http://127.0.0.1:8790",
  TEST_BANK_URL: "http://127.0.0.1:8791",
  TEST_STATE: join(state, "bank"),
  TEST_MEMBER_STATE: join(state, "member"),
};
function command(args) {
  const r = spawnSync(process.execPath, [cli, ...args], {
    env,
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error("Cloudflare setup failed.");
}
try {
  for (const name of ["member", "bank"])
    command([
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--persist-to",
      join(state, name),
    ]);
  for (const [port, bank] of [
    [8790, false],
    [8791, true],
  ]) {
    const args = [
      cli,
      "pages",
      "dev",
      "public",
      "--r2",
      "UPLOADS",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      String(port + 1000),
      "--persist-to",
      join(state, bank ? "bank" : "member"),
    ];
    if (bank)
      args.push(
        "--binding",
        "BANK_DETAILS=TEST ONLY — fictitious bank account",
      );
    const child = spawn(process.execPath, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    children.push(child);
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.stdout.on("data", () => {});
  }
  for (const port of [8790, 8791]) {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error("Test server did not become ready.");
  }
  const run = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-concurrency=1",
      "tests/portal.test.js",
      "tests/admin.test.js",
      "tests/platform.test.js",
    ],
    { env, stdio: "inherit" },
  );
  if (run.status !== 0) process.exitCode = run.status || 1;
  if (process.env.RUN_BROWSER === "1" && !process.exitCode) {
    const browser = spawnSync("python3", ["tests/browser.py"], {
      env,
      stdio: "inherit",
    });
    process.exitCode = browser.status || 0;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  rmSync(state, { recursive: true, force: true });
}
