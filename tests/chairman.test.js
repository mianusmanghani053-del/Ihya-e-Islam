import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = (process.env.TEST_BANK_URL || "http://127.0.0.1:8789") + "/api";
async function call(path, data, method = data ? "POST" : "GET", cookie = "") {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: r.status, body: await r.json(), headers: r.headers };
}
async function register(label) {
  const email = `${label}-${Date.now()}@example.com`;
  const r = await call("/auth/register", {
    email,
    name: label,
    password: `local-${label}-fixture-1234`,
  });
  assert.equal(r.status, 200);
  return { email, cookie: r.headers.get("set-cookie").split(";")[0] };
}
function sql(command) {
  execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      ...(process.env.TEST_STATE
        ? ["--persist-to", process.env.TEST_STATE]
        : []),
      "--command",
      command,
    ],
    { stdio: "pipe" },
  );
}

test("chairman is super admin: manages events and submissions", async (t) => {
  const chair = await register("chairman");
  const member = await register("member");
  sql(
    `INSERT INTO staff_roles(user_id,role) SELECT id,'chairman' FROM users WHERE email='${chair.email}'`,
  );
  const event = {
    kind: "event",
    title: "Seerah evening",
    description: "Talk and Q&A",
    date: "2026-12-05T18:30",
    location: "Central mosque",
  };
  let id;
  await t.test(
    "chairman account stays a member account with a role",
    async () => {
      const me = await call("/auth/me", undefined, "GET", chair.cookie);
      assert.equal(me.body.user.role, "member");
      assert.ok(me.body.user.roles.includes("chairman"));
    },
  );
  await t.test("ordinary members cannot manage events", async () => {
    assert.equal(
      (await call("/resources", event, "POST", member.cookie)).status,
      403,
    );
    assert.equal(
      (await call("/resources?manage=1", undefined, "GET", member.cookie))
        .status,
      403,
    );
    assert.equal(
      (await call("/admin/records", undefined, "GET", member.cookie)).status,
      403,
    );
  });
  await t.test("chairman creates an event", async () => {
    const r = await call("/resources", event, "POST", chair.cookie);
    assert.equal(r.status, 201);
    id = r.body.id;
  });
  await t.test("chairman edits the event", async () => {
    assert.equal(
      (
        await call(
          `/resources/${id}`,
          {
            ...event,
            title: "Seerah evening (moved)",
            location: "Model Town mosque",
          },
          "PATCH",
          member.cookie,
        )
      ).status,
      403,
    );
    const r = await call(
      `/resources/${id}`,
      {
        ...event,
        title: "Seerah evening (moved)",
        location: "Model Town mosque",
      },
      "PATCH",
      chair.cookie,
    );
    assert.equal(r.status, 200);
    const live = (await call("/resources")).body.items.find((x) => x.id === id);
    assert.equal(live.data.title, "Seerah evening (moved)");
    assert.equal(live.data.location, "Model Town mosque");
  });
  await t.test("chairman removes and restores the event", async () => {
    assert.equal(
      (await call(`/resources/${id}`, undefined, "DELETE", chair.cookie))
        .status,
      200,
    );
    assert.equal(
      (await call("/resources")).body.items.some((x) => x.id === id),
      false,
    );
    const managed = await call(
      "/resources?manage=1",
      undefined,
      "GET",
      chair.cookie,
    );
    assert.equal(managed.body.items.find((x) => x.id === id).active, false);
    assert.equal(
      (await call(`/resources/${id}`, { restore: true }, "PATCH", chair.cookie))
        .status,
      200,
    );
    assert.equal(
      (await call("/resources")).body.items.some((x) => x.id === id),
      true,
    );
  });
  await t.test("chairman sees website submissions", async () => {
    const r = await call("/admin/records", undefined, "GET", chair.cookie);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.items));
  });
});
