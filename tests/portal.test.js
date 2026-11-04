import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://127.0.0.1:8788";
let cookie = "",
  userEmail = `member-${Date.now()}@example.com`,
  report,
  secret = crypto.randomUUID();
async function call(
  path,
  data,
  method = data ? "POST" : "GET",
  session = cookie,
  extra = {},
) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: session, ...extra },
    body: data ? JSON.stringify(data) : undefined,
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get("set-cookie"),
  };
}
test("API access, durable member workflows and authorization", async (t) => {
  await t.test("unauthenticated private endpoints are denied", async () => {
    assert.equal((await call("/records")).status, 401);
    assert.equal((await call("/admin/records")).status, 401);
  });
  await t.test("cross-origin writes are denied", async () => {
    assert.equal(
      (
        await call(
          "/auth/register",
          { email: userEmail, password: "test-password-1234", name: "Member" },
          "POST",
          "",
          { Origin: "https://untrusted.example" },
        )
      ).status,
      403,
    );
  });
  await t.test(
    "register creates secure session and never accepts an admin role",
    async () => {
      const r = await call("/auth/register", {
        email: userEmail,
        password: "test-password-1234",
        name: "Member",
        role: "admin",
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.user.role, "member");
      assert.match(r.cookie, /HttpOnly/);
      assert.match(r.cookie, /SameSite=Lax/);
      cookie = r.cookie.split(";")[0];
    },
  );
  await t.test(
    "session restores identity and protects administration",
    async () => {
      assert.equal((await call("/auth/me")).body.user.email, userEmail);
      assert.equal((await call("/admin/records")).status, 403);
    },
  );
  await t.test("bookmarks persist and can be removed", async () => {
    await call("/bookmarks", { key: "q1:1" });
    assert.deepEqual((await call("/bookmarks")).body.items, ["q1:1"]);
    await call("/bookmarks", { key: "q1:1" }, "DELETE");
    assert.deepEqual((await call("/bookmarks")).body.items, []);
  });
  await t.test("courses enroll, track progress and cancel", async () => {
    assert.equal(
      (await call("/enrollments", { resourceId: "seerah" })).status,
      200,
    );
    await call("/enrollments", { resourceId: "seerah", progress: 1 }, "PATCH");
    assert.equal((await call("/enrollments")).body.items[0].progress, 1);
    assert.equal(
      (
        await call(
          "/enrollments",
          { resourceId: "seerah", progress: 500 },
          "PATCH",
        )
      ).status,
      400,
    );
    await call("/enrollments", { resourceId: "seerah" }, "DELETE");
    assert.equal((await call("/enrollments")).body.items.length, 0);
  });
  await t.test("volunteer application stores validated data", async () => {
    const r = await call("/records", {
      kind: "volunteer",
      name: "Member",
      phone: "03000000000",
      city: "Lahore",
      unit: "Teaching",
      hours: "2–4",
      pledge: true,
    });
    assert.equal(r.status, 201);
    assert.equal((await call("/records")).body.items[0].kind, "volunteer");
  });
  await t.test(
    "anonymous report is private and needs its tracking key",
    async () => {
      const r = await call("/records", {
        kind: "report",
        category: "Other",
        location: "Example location",
        when: "2026-11-03T12:00",
        description: "Test submission, not a real incident",
        anonymous: true,
        truthful: true,
        trackingSecret: secret,
      });
      assert.equal(r.status, 201);
      report = r.body.id;
      assert.equal(
        (await call("/records")).body.items.filter((r) => r.kind === "report")
          .length,
        0,
      );
      assert.equal(
        (await call("/track", { id: report, secret: "incorrect" })).status,
        404,
      );
      const tracked = await call("/track", { id: report, secret });
      assert.equal(tracked.body.status, "received");
      assert.equal(tracked.body.data, undefined);
    },
  );
  await t.test(
    "private attachments require ownership or tracking key",
    async () => {
      const r = await fetch(base + "/api/uploads?record=" + report, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: "test",
      });
      assert.equal(r.status, 403);
      const saved = await fetch(base + "/api/uploads?record=" + report, {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-Tracking-Key": secret,
        },
        body: "test PDF fixture",
      });
      assert.equal(saved.status, 201);
    },
  );
  await t.test("bank payments fail closed when not configured", async () => {
    assert.equal((await call("/donation-settings")).body.enabled, false);
    assert.equal(
      (
        await call("/records", {
          kind: "donation",
          amount: 1000,
          currency: "PKR",
          fund: "gen",
        })
      ).status,
      503,
    );
    assert.equal((await call("/receipt/fake")).status, 404);
  });
  await t.test("logout invalidates session", async () => {
    await call("/auth/logout", {});
    assert.equal((await call("/auth/me")).body.user, null);
  });
  await t.test("bad passwords are rejected and valid login works", async () => {
    assert.equal(
      (
        await call("/auth/login", {
          email: userEmail,
          password: "wrong-password-12",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await call("/auth/login", {
          email: userEmail,
          password: "test-password-1234",
        })
      ).status,
      200,
    );
  });
});

test("Donation checkout creates a protected account with a required first-login password change", async () => {
  const bank = process.env.TEST_BANK_URL || "http://127.0.0.1:8791";
  async function request(path, data, session = "") {
    const r = await fetch(bank + "/api" + path, {
      method: data ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Cookie: session },
      body: data ? JSON.stringify(data) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const email = `checkout-${crypto.randomUUID()}@example.com`;
  const donation = {
    kind: "donation",
    amount: 2500,
    currency: "PKR",
    fund: "water",
    donorName: "New donor",
    email,
    createAccount: true,
  };
  const invalid = await request("/records", { ...donation, amount: -1 });
  assert.equal(invalid.status, 400);
  const saved = await request("/records", donation);
  assert.equal(saved.status, 201);
  assert.equal(saved.data.status, "awaiting_transfer");
  const credentials = saved.data.credentials;
  assert.equal(credentials.email, email);
  assert.ok(credentials.temporaryPassword.length >= 24);
  assert.equal(
    (await request("/auth/me")).data.user,
    null,
    "Checkout must not sign in an email owner without verification of credentials",
  );
  assert.equal(
    (await request("/records", donation)).status,
    409,
    "An existing account must never be overwritten",
  );
  const login = await request("/auth/login", {
    email,
    password: credentials.temporaryPassword,
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.must_change_password, 1);
  const session = login.cookie;
  assert.equal((await request("/records", undefined, session)).status, 403);
  assert.equal(
    (await request("/v2/donation-tracking", undefined, session)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/auth/password",
        {
          currentPassword: credentials.temporaryPassword,
          password: credentials.temporaryPassword,
        },
        session,
      )
    ).status,
    400,
  );
  const newPassword = "my-new-donation-password-123";
  assert.equal(
    (
      await request(
        "/auth/password",
        {
          currentPassword: credentials.temporaryPassword,
          password: newPassword,
        },
        session,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/auth/me", undefined, session)).data.user,
    null,
    "Password changes revoke old sessions",
  );
  assert.equal(
    (
      await request("/auth/login", {
        email,
        password: credentials.temporaryPassword,
      })
    ).status,
    401,
  );
  const updated = await request("/auth/login", {
    email,
    password: newPassword,
  });
  assert.equal(updated.data.user.must_change_password, 0);
  const records = await request("/records", undefined, updated.cookie);
  assert.equal(records.status, 200);
  assert.equal(records.data.items.length, 1);
  assert.equal(records.data.items[0].id, saved.data.id);
  assert.equal(records.data.items[0].data.temporaryPassword, undefined);
  const next = await request(
    "/records",
    { ...donation, createAccount: false },
    updated.cookie,
  );
  assert.equal(next.status, 201);
  assert.equal(
    next.data.credentials,
    undefined,
    "Existing members must never get replacement credentials",
  );
});
