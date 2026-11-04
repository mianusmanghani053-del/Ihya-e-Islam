import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const root = process.env.TEST_BANK_URL || "http://127.0.0.1:8789";
const base = root + "/api";
async function call(path, data, method = data ? "POST" : "GET", cookie = "") {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: r.status, body: await r.json() };
}
async function voice(id, key, bytes, type = "audio/webm") {
  const r = await fetch(`${base}/suggestions/${id}/audio`, {
    method: "POST",
    headers: {
      "Content-Type": type,
      ...(key ? { "X-Tracking-Key": key } : {}),
    },
    body: bytes,
  });
  return r.status;
}
const valid = {
  kind: "suggestion",
  type: "idea",
  area: "Courses and classes",
  areaGroup: "Activities",
  summary: "Weekend Quran class for children in our area",
  details: "Saturday mornings at the local mosque.",
  urgency: "soon",
  wantsToHelp: true,
  contactPref: "whatsapp",
  phone: "0300 1234567",
  name: "Test Suggester",
  city: "Lahore",
};

test("suggestions: submit, voice note, decision bench and tracking", async (t) => {
  const secret = crypto.randomUUID();
  let id;
  await t.test("rejects incomplete or invalid suggestions", async () => {
    assert.equal(
      (
        await call("/records", {
          ...valid,
          type: "spam",
          trackingSecret: secret,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/records", {
          ...valid,
          summary: "",
          trackingSecret: secret,
        })
      ).status,
      400,
    );
    const bad = await call("/records", {
      ...valid,
      phone: "12ab",
      trackingSecret: secret,
    });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /valid mobile/);
  });
  await t.test("accepts an anonymous suggestion without contact", async () => {
    const r = await call("/records", {
      ...valid,
      contactPref: "none",
      phone: "",
      trackingSecret: crypto.randomUUID(),
    });
    assert.equal(r.status, 201);
  });
  await t.test("accepts a suggestion with WhatsApp contact", async () => {
    const r = await call("/records", { ...valid, trackingSecret: secret });
    assert.equal(r.status, 201);
    assert.equal(r.body.status, "received");
    id = r.body.id;
  });
  const audio = new Uint8Array([26, 69, 223, 163, 1, 2, 3, 4, 5, 6]);
  await t.test("voice note requires the private tracking key", async () => {
    assert.equal(await voice(id, "", audio), 403);
    assert.equal(await voice(id, crypto.randomUUID(), audio), 403);
    assert.equal(await voice(id, secret, audio, "text/html"), 400);
    assert.equal(await voice(id, secret, audio, "audio/webm;codecs=opus"), 201);
    assert.equal(await voice(id, secret, audio), 409);
  });
  await t.test("tracking shows the stage to the key holder only", async () => {
    assert.equal((await call("/track", { id, secret: "wrong" })).status, 404);
    const r = await call("/track", { id, secret });
    assert.equal(r.status, 200);
    assert.equal(r.body.kind, "suggestion");
    assert.equal(r.body.status, "received");
    assert.equal(r.body.decisionNote, "");
  });
  await t.test("voice note is not public", async () => {
    const r = await fetch(`${base}/suggestions/${id}/audio`);
    assert.equal(r.status, 401);
  });

  const email = `bench-${Date.now()}@example.com`;
  const reg = await fetch(base + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      name: "Bench admin",
      password: "local-bench-fixture-1234",
    }),
  });
  const cookie = reg.headers.get("set-cookie").split(";")[0];
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
  await t.test("ordinary members cannot open the Decision Bench", async () => {
    const other = await fetch(base + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `member-${Date.now()}@example.com`,
        name: "Member",
        password: "local-member-fixture-1234",
      }),
    });
    const memberCookie = other.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await call("/suggestions", undefined, "GET", memberCookie)).status,
      403,
    );
    const r = await fetch(`${base}/suggestions/${id}/audio`, {
      headers: { Cookie: memberCookie },
    });
    assert.equal(r.status, 403);
  });
  await t.test(
    "leadership sees the suggestion and plays the voice note",
    async () => {
      const list = await call("/suggestions", undefined, "GET", cookie);
      assert.equal(list.status, 200);
      const row = list.body.items.find((r) => r.id === id);
      assert.equal(row.data.voiceNote, true);
      assert.equal(row.data.phone, "03001234567");
      assert.equal(row.data.trackingHash, undefined);
      const r = await fetch(`${base}/suggestions/${id}/audio`, {
        headers: { Cookie: cookie },
      });
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("content-type"), "audio/webm");
      assert.deepEqual(new Uint8Array(await r.arrayBuffer()), audio);
    },
  );
  await t.test("decision bench records stage and note", async () => {
    assert.equal(
      (await call(`/suggestions/${id}`, { status: "maybe" }, "PATCH", cookie))
        .status,
      400,
    );
    const r = await call(
      `/suggestions/${id}`,
      {
        status: "decision_bench",
        decisionNote: "Discussed on Friday. Pilot at one mosque first.",
      },
      "PATCH",
      cookie,
    );
    assert.equal(r.status, 200);
    const tracked = await call("/track", { id, secret });
    assert.equal(tracked.body.status, "decision_bench");
    assert.equal(
      tracked.body.decisionNote,
      "Discussed on Friday. Pilot at one mosque first.",
    );
  });
});
