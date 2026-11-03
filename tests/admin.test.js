import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = (process.env.TEST_BANK_URL || "http://127.0.0.1:8789") + "/api";
let cookie = "";
async function call(
  path,
  data,
  method = data ? "POST" : "GET",
  session = cookie,
) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: session },
    body: data ? JSON.stringify(data) : undefined,
  });
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get("set-cookie"),
  };
}
test("local admin, bank-transfer review and resource management", async (t) => {
  const email = `admin-test-${Date.now()}@example.com`;
  let r = await call("/auth/register", {
    email,
    name: "Local test admin",
    password: "local-admin-fixture-1234",
  });
  assert.equal(r.status, 200);
  cookie = r.cookie.split(";")[0];
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
      `UPDATE users SET role='admin' WHERE email='${email}'`,
    ],
    { stdio: "pipe" },
  );
  await t.test("admin membership is revalidated from DB", async () => {
    assert.equal((await call("/auth/me")).body.user.role, "admin");
  });
  let donation;
  await t.test(
    "bank intent remains pending until admin confirmation",
    async () => {
      assert.equal((await call("/donation-settings")).body.enabled, true);
      const r = await call("/records", {
        kind: "donation",
        amount: 2500,
        currency: "PKR",
        fund: "gen",
        reference: "LOCAL TEST ONLY",
        frequency: "month",
      });
      assert.equal(r.status, 201);
      donation = r.body.id;
      assert.equal(r.body.status, "awaiting_transfer");
      assert.equal((await call("/receipt/" + donation)).status, 404);
    },
  );
  await t.test(
    "admin confirms transfer and member downloads real acknowledgment",
    async () => {
      assert.equal(
        (
          await call(
            "/admin/records",
            { id: donation, status: "confirmed" },
            "PATCH",
          )
        ).status,
        200,
      );
      const response = await fetch(base + "/receipt/" + donation, {
        headers: { Cookie: cookie },
      });
      assert.equal(response.status, 200);
      assert.match(await response.text(), /PKR 2500/);
    },
  );
  await t.test("another member cannot read the receipt", async () => {
    const r = await call(
      "/auth/register",
      {
        email: `other-${Date.now()}@example.com`,
        name: "Other",
        password: "other-fixture-password-1234",
      },
      "POST",
      "",
    );
    assert.equal(
      (
        await call(
          "/receipt/" + donation,
          undefined,
          "GET",
          r.cookie.split(";")[0],
        )
      ).status,
      404,
    );
  });
  await t.test("admin publishes and archives a live event", async () => {
    const r = await call("/resources", {
      kind: "event",
      title: "Test event",
      description: "Local test fixture",
      date: "2027-01-01T10:00",
      location: "Test location",
    });
    assert.equal(r.status, 201);
    assert.ok(
      (await call("/resources")).body.items.some((x) => x.id === r.body.id),
    );
    assert.equal(
      (await call("/resources/" + r.body.id, undefined, "DELETE")).status,
      200,
    );
    assert.ok(
      !(await call("/resources")).body.items.some((x) => x.id === r.body.id),
    );
  });
  await t.test(
    "monthly pledge can pause without altering payment status",
    async () => {
      const created = await call("/records", {
        kind: "donation",
        amount: 1000,
        currency: "PKR",
        fund: "gen",
        frequency: "month",
      });
      assert.equal(created.status, 201);
      const changed = await call(
        "/records",
        { id: created.body.id, paused: true, amount: 1500 },
        "PATCH",
      );
      assert.equal(changed.status, 200);
      const saved = (await call("/records")).body.items.find(
        (r) => r.id === created.body.id,
      );
      assert.equal(saved.data.pledgePaused, true);
      assert.equal(saved.data.pledgeAmount, 1500);
      assert.equal(saved.data.amount, 1000);
      assert.equal(saved.status, "awaiting_transfer");
    },
  );
  await t.test(
    "invalid report state cannot be applied to donation",
    async () => {
      assert.equal(
        (
          await call(
            "/admin/records",
            { id: donation, status: "forwarded" },
            "PATCH",
          )
        ).status,
        400,
      );
    },
  );
});
