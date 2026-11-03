import {
  platform,
  rolesFor,
  permitted,
  assigned,
  audit,
} from "../../lib/platform.js";
const encoder = new TextEncoder();
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const id = () => crypto.randomUUID();
const hex = (bytes) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function digest(text) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}
async function password(
  text,
  salt = hex(crypto.getRandomValues(new Uint8Array(16))),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(text),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return (
    salt +
    ":" +
    hex(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: encoder.encode(salt),
          iterations: 100000,
          hash: "SHA-256",
        },
        key,
        256,
      ),
    )
  );
}
function same(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function text(value, max = 300) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail("Please complete the required fields.");
  return value.trim();
}
function email(value) {
  const e = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    fail("Enter a valid email address.");
  return e;
}
async function body(request) {
  if (Number(request.headers.get("content-length")) > 100000)
    fail("Request too large.", 413);
  try {
    const raw = await request.text();
    if (raw.length > 100000) fail("Request too large.", 413);
    return JSON.parse(raw);
  } catch (e) {
    if (e.status) throw e;
    fail("Invalid JSON.");
  }
}
function unpack(row) {
  return { ...row, data: JSON.parse(row.data) };
}
async function limit(db, key, max = 30) {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      "INSERT INTO rate_limits(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END, reset=CASE WHEN reset<? THEN excluded.reset ELSE reset END",
    )
    .bind(key, now + 900, now, now)
    .run();
  const row = await db
    .prepare("SELECT count FROM rate_limits WHERE key=?")
    .bind(key)
    .first();
  if (row.count > max)
    fail("Too many attempts. Please try again in 15 minutes.", 429);
}
export async function onRequest({ request, env, params }) {
  try {
    const url = new URL(request.url),
      path =
        "/" +
        (Array.isArray(params.path)
          ? params.path.join("/")
          : params.path || "");
    const db = env.DB;
    if (!db) fail("Database is not configured.", 503);
    const method = request.method,
      write = !["GET", "HEAD"].includes(method);
    if (write) {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        fail("Request origin is not allowed.", 403);
      if (request.headers.get("sec-fetch-site") === "cross-site")
        fail("Request origin is not allowed.", 403);
    }
    const rawToken = (request.headers.get("cookie") || "").match(
      /(?:^|;\s*)session=([^;]+)/,
    )?.[1];
    const user = rawToken
      ? await db
          .prepare(
            "SELECT users.id,email,name,role FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
          )
          .bind(await digest(rawToken), Date.now())
          .first()
      : null;
    const auth = () => {
      if (!user) fail("Please sign in.", 401);
      return user;
    };
    const admin = () => {
      auth();
      if (user.role !== "admin") fail("Administrator access required.", 403);
    };
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const cookie = (token, age) =>
      `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${url.protocol === "https:" ? "; Secure" : ""}`;
    const roles = await rolesFor(db, user);
    if (path.startsWith("/v2/")) {
      const handled = await platform({
        db,
        user,
        roles,
        request,
        env,
        path,
        method,
        url,
        json,
        fail,
        body,
        text,
        id,
        digest,
        limit,
      });
      if (handled) return handled;
    }
    if (path === "/health") return json({ ok: true });
    if (path === "/auth/me")
      return json({ user: user ? { ...user, roles } : null });
    if (["/auth/register", "/auth/login"].includes(path) && method === "POST") {
      await limit(db, "auth:" + ip, 25);
      const b = await body(request),
        e = email(b.email),
        pw = text(b.password, 128);
      let u;
      if (path.endsWith("register")) {
        if (pw.length < 12) fail("Use a password with at least 12 characters.");
        const name = text(b.name, 100);
        u = { id: id(), name, email: e, role: "member" };
        try {
          await db
            .prepare(
              "INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)",
            )
            .bind(u.id, e, name, await password(pw))
            .run();
        } catch {
          fail(
            "Unable to create this account. Try signing in or use another email.",
            409,
          );
        }
      } else {
        u = await db
          .prepare("SELECT * FROM users WHERE email=?")
          .bind(e)
          .first();
        const candidate = await password(
          pw,
          u?.password.split(":")[0] || "00000000000000000000000000000000",
        );
        if (!u || !same(candidate, u.password))
          fail("Email or password is incorrect.", 401);
      }
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .bind(await digest(token), u.id, Date.now() + 7 * 86400000)
        .run();
      return json(
        { user: { id: u.id, name: u.name, email: u.email, role: u.role } },
        200,
        { "Set-Cookie": cookie(token, 604800) },
      );
    }
    if (path === "/auth/logout" && method === "POST") {
      if (rawToken)
        await db
          .prepare("DELETE FROM sessions WHERE token=?")
          .bind(await digest(rawToken))
          .run();
      return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
    }
    if (path === "/auth/password" && method === "POST") {
      auth();
      const b = await body(request);
      const u = await db
        .prepare("SELECT password FROM users WHERE id=?")
        .bind(user.id)
        .first();
      if (
        !same(
          await password(
            text(b.currentPassword, 128),
            u.password.split(":")[0],
          ),
          u.password,
        )
      )
        fail("Current password is incorrect.", 401);
      const next = text(b.password, 128);
      if (next.length < 12) fail("Use at least 12 characters.");
      await db.batch([
        db
          .prepare("UPDATE users SET password=? WHERE id=?")
          .bind(await password(next), user.id),
        db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
      ]);
      return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
    }
    if (path === "/bookmarks") {
      auth();
      if (method === "GET")
        return json({
          items: (
            await db
              .prepare("SELECT key FROM bookmarks WHERE user_id=?")
              .bind(user.id)
              .all()
          ).results.map((x) => x.key),
        });
      const b = await body(request),
        key = text(b.key, 100);
      if (method === "POST")
        await db
          .prepare("INSERT OR IGNORE INTO bookmarks VALUES(?,?)")
          .bind(user.id, key)
          .run();
      else if (method === "DELETE")
        await db
          .prepare("DELETE FROM bookmarks WHERE user_id=? AND key=?")
          .bind(user.id, key)
          .run();
      else fail("Method not allowed.", 405);
      return json({ ok: true });
    }
    if (path === "/resources" && method === "GET")
      return json({
        items: (
          await db.prepare("SELECT * FROM resources WHERE active=1").all()
        ).results.map(unpack),
      });
    if (path === "/resources" && method === "POST") {
      auth();
      if (!permitted(roles, ["scholar", "city_coordinator"]))
        fail("Content publisher access required.", 403);
      const b = await body(request);
      if (!["event", "shift", "course"].includes(b.kind))
        fail("Invalid resource type.");
      const data = {
        title: text(b.title, 200),
        description: text(b.description, 3000),
      };
      if (b.kind !== "course") {
        if (b.requiredTraining)
          data.requiredTraining = text(b.requiredTraining, 100);
        data.date = text(b.date, 40);
        if (!Number.isFinite(Date.parse(data.date))) fail("Invalid date.");
        data.location = text(b.location, 300);
      } else {
        if (
          !Array.isArray(b.lessons) ||
          !b.lessons.length ||
          b.lessons.length > 100
        )
          fail("Add at least one lesson.");
        data.lessons = b.lessons.map((l) => ({
          title: text(l.title, 200),
          body: text(l.body, 20000),
        }));
      }
      const rid = id();
      await db
        .prepare("INSERT INTO resources VALUES(?,?,?,1)")
        .bind(rid, b.kind, JSON.stringify(data))
        .run();
      return json({ id: rid }, 201);
    }
    if (path.startsWith("/resources/") && method === "DELETE") {
      auth();
      if (!permitted(roles, ["scholar", "city_coordinator"]))
        fail("Content publisher access required.", 403);
      await db
        .prepare("UPDATE resources SET active=0 WHERE id=?")
        .bind(path.split("/")[2])
        .run();
      return json({ ok: true });
    }
    if (path === "/enrollments" && method === "GET") {
      auth();
      return json({
        items: (
          await db
            .prepare(
              "SELECT resources.*,enrollments.progress FROM enrollments JOIN resources ON resources.id=resource_id WHERE user_id=?",
            )
            .bind(user.id)
            .all()
        ).results.map(unpack),
      });
    }
    if (
      path === "/enrollments" &&
      ["POST", "PATCH", "DELETE"].includes(method)
    ) {
      auth();
      const b = await body(request),
        rid = text(b.resourceId, 100);
      const resource = await db
        .prepare("SELECT * FROM resources WHERE id=? AND active=1")
        .bind(rid)
        .first();
      if (!resource) fail("This activity is no longer available.", 404);
      if (method === "POST" && resource.kind === "shift") {
        const required = JSON.parse(resource.data).requiredTraining;
        if (
          required &&
          !(await db
            .prepare(
              "SELECT id FROM service_entries WHERE owner_id=? AND kind='training' AND status='passed' AND json_extract(data,'$.training')=? AND json_extract(data,'$.validUntil')>=?",
            )
            .bind(user.id, required, new Date().toISOString().slice(0, 10))
            .first())
        )
          fail("Current " + required + " training is required.", 403);
      }

      if (method === "POST")
        await db
          .prepare(
            "INSERT OR IGNORE INTO enrollments(user_id,resource_id) VALUES(?,?)",
          )
          .bind(user.id, rid)
          .run();
      if (method === "DELETE")
        await db
          .prepare("DELETE FROM enrollments WHERE user_id=? AND resource_id=?")
          .bind(user.id, rid)
          .run();
      if (method === "PATCH") {
        if (resource.kind !== "course") fail("Not a course.");
        const lessons = JSON.parse(resource.data).lessons;
        const progress = Number(b.progress);
        if (
          !Number.isInteger(progress) ||
          progress < 0 ||
          progress > lessons.length
        )
          fail("Invalid progress.");
        await db
          .prepare(
            "UPDATE enrollments SET progress=MAX(progress,?) WHERE user_id=? AND resource_id=?",
          )
          .bind(progress, user.id, rid)
          .run();
      }
      return json({ ok: true });
    }
    if (path === "/records" && method === "GET") {
      auth();
      const rows = await db
        .prepare(
          "SELECT * FROM records WHERE user_id=? ORDER BY created_at DESC",
        )
        .bind(user.id)
        .all();
      for (const row of rows.results)
        if (row.kind === "report")
          await audit(db, user.id, "case.view", row.id);
      return json({ items: rows.results.map(unpack) });
    }
    if (path === "/records" && method === "PATCH") {
      auth();
      const b = await body(request);
      const row = await db
        .prepare(
          "SELECT * FROM records WHERE id=? AND kind='donation' AND user_id=?",
        )
        .bind(text(b.id, 100), user.id)
        .first();
      if (!row) fail("Donation not found.", 404);
      const data = JSON.parse(row.data);
      if (data.frequency !== "month") fail("This is not a monthly pledge.");
      if (typeof b.paused !== "boolean")
        fail("Specify whether to pause the pledge.");
      data.pledgePaused = b.paused;
      if (b.amount !== undefined) {
        const amount = Number(b.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000)
          fail("Enter a valid pledge amount.");
        data.pledgeAmount = amount;
      }
      await db
        .prepare("UPDATE records SET data=? WHERE id=?")
        .bind(JSON.stringify(data), row.id)
        .run();
      return json({ ok: true });
    }
    if (path === "/records" && method === "POST") {
      await limit(db, "submit:" + ip, 40);
      const b = await body(request);
      let data = {},
        kind = b.kind,
        status = "received";
      if (kind === "volunteer") {
        auth();
        data = {
          name: text(b.name, 100),
          phone: text(b.phone, 40),
          city: text(b.city, 100),
          unit: text(b.unit, 300),
          skills: String(b.skills || "").slice(0, 500),
          hours: text(b.hours, 100),
          pledge: b.pledge === true,
        };
        if (!data.pledge) fail("Please accept the volunteer pledge.");
      } else if (kind === "report") {
        data = {
          category: text(b.category, 100),
          location: text(b.location, 300),
          when: text(b.when, 40),
          description: text(b.description, 10000),
          anonymous: b.anonymous === true,
          contact: b.anonymous ? "" : String(b.contact || "").slice(0, 300),
        };
        if (!b.truthful) fail("Please confirm the report is accurate.");
        data.trackingHash = await digest(
          (b.trackingSecret = text(b.trackingSecret, 100)),
        );
      } else if (kind === "newsletter") {
        data = { email: email(b.email) };
      } else if (kind === "donation") {
        auth();
        if (!env.BANK_DETAILS)
          fail(
            "Donations are not open yet. Bank details must be configured by the organization.",
            503,
          );
        const amount = Number(b.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000)
          fail("Enter a valid donation amount.");
        if (!["PKR", "USD"].includes(b.currency)) fail("Invalid currency.");
        data = {
          amount,
          currency: b.currency,
          fund: text(b.fund, 100),
          frequency: b.frequency === "month" ? "month" : "once",
          reference: String(b.reference || "").slice(0, 200),
          anonymous: b.anonymous === true,
        };
        status = "awaiting_transfer";
      } else fail("Unknown submission type.");
      const rid = id();
      await db
        .prepare(
          "INSERT INTO records(id,kind,user_id,data,status) VALUES(?,?,?,?,?)",
        )
        .bind(
          rid,
          kind,
          kind === "report" && data.anonymous ? null : user?.id || null,
          JSON.stringify(data),
          status,
        )
        .run();
      return json({ id: rid, status }, 201);
    }
    if (path === "/donation-settings")
      return json({
        enabled: !!env.BANK_DETAILS,
        bankDetails: env.BANK_DETAILS || "",
        methods: ["bank"],
        notice:
          "Transfers are confirmed manually. A pledge is a reminder, not an automatic debit.",
      });
    if (path === "/track" && method === "POST") {
      await limit(db, "track:" + ip, 30);
      const b = await body(request);
      const row = await db
        .prepare(
          "SELECT id,status,created_at,data FROM records WHERE id=? AND kind='report'",
        )
        .bind(text(b.id, 100))
        .first();
      if (
        !row ||
        !same(
          JSON.parse(row.data).trackingHash,
          await digest(text(b.secret, 100)),
        )
      )
        fail("Report or tracking key not found.", 404);
      return json({
        id: row.id,
        status: row.status,
        created_at: row.created_at,
      });
    }
    if (path === "/uploads" && method === "POST") {
      await limit(db, "upload:" + ip, 15);
      if (!env.UPLOADS)
        fail("Private attachment storage is not configured.", 503);
      const rid = url.searchParams.get("record"),
        secret = request.headers.get("X-Tracking-Key");
      const row = await db
        .prepare("SELECT * FROM records WHERE id=? AND kind='report'")
        .bind(rid)
        .first();
      if (
        !row ||
        !(
          user?.id === row.user_id ||
          (secret &&
            same(await digest(secret), JSON.parse(row.data).trackingHash))
        )
      )
        fail("Access denied.", 403);
      const type = request.headers.get("content-type");
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
          "video/mp4",
        ].includes(type)
      )
        fail("Use JPEG, PNG, WebP, PDF or MP4.");
      if (Number(request.headers.get("content-length")) > 10 * 1024 * 1024)
        fail("Attachments must be under 10 MB.", 413);
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > 10 * 1024 * 1024)
        fail("Attachments must be under 10 MB.", 413);
      const key = rid + "/" + id();
      await env.UPLOADS.put(key, bytes, {
        httpMetadata: { contentType: type },
      });
      const data = JSON.parse(row.data);
      data.attachments = [...(data.attachments || []), key];
      await db
        .prepare("UPDATE records SET data=? WHERE id=?")
        .bind(JSON.stringify(data), rid)
        .run();
      return json({ ok: true }, 201);
    }
    if (path.startsWith("/attachments/") && method === "GET") {
      auth();
      if (
        !permitted(roles, [
          "trustee",
          "field_officer",
          "city_coordinator",
          "unit_lead",
        ])
      )
        fail("Case handler access required.", 403);
      const attachmentKey = decodeURIComponent(
        path.slice("/attachments/".length),
      );
      const reportId = attachmentKey.split("/")[0];
      if (!(await assigned(db, reportId, user.id)))
        fail("Assigned report handler required.", 403);
      await audit(db, user.id, "file.view", reportId);
      const object = await env.UPLOADS?.get(attachmentKey);
      if (!object) fail("Attachment not found.", 404);
      return new Response(object.body, {
        headers: {
          "Content-Type":
            object.httpMetadata?.contentType || "application/octet-stream",
          "Content-Disposition": "attachment",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path === "/admin/records" && method === "GET") {
      admin();
      return json({
        items: await (async () => {
          const rows = (
            await db
              .prepare(
                "SELECT * FROM records WHERE kind!='report' OR EXISTS(SELECT 1 FROM case_assignments a WHERE a.case_id=records.id AND a.user_id=?) ORDER BY created_at DESC LIMIT 500",
              )
              .bind(user.id)
              .all()
          ).results;
          for (const row of rows)
            if (row.kind === "report")
              await audit(db, user.id, "case.view", row.id);
          return rows.map(unpack);
        })(),
      });
    }
    if (path === "/admin/records" && method === "PATCH") {
      admin();
      const b = await body(request);
      const row = await db
        .prepare("SELECT kind FROM records WHERE id=?")
        .bind(text(b.id, 100))
        .first();
      if (!row) fail("Not found.", 404);
      if (row.kind === "report") {
        if (!(await assigned(db, b.id, user.id)))
          fail("Assigned report handler required.", 403);
        if (b.status === "forwarded") {
          if (!b.authorityReference || !b.authority)
            fail(
              "Record the authority and official reference before forwarding.",
            );
          await db
            .prepare(
              "INSERT INTO legacy_report_meta VALUES(?,?,?,?) ON CONFLICT(record_id) DO UPDATE SET authority_reference=excluded.authority_reference,authority=excluded.authority,updated_by=excluded.updated_by",
            )
            .bind(b.id, text(b.authorityReference), text(b.authority), user.id)
            .run();
        }
        await audit(db, user.id, "report.status", b.id, { status: b.status });
      }
      const states = {
        report: ["received", "checked", "forwarded", "closed"],
        volunteer: ["received", "approved", "declined"],
        donation: ["awaiting_transfer", "confirmed", "cancelled"],
        newsletter: ["received", "unsubscribed"],
      };
      if (!states[row.kind]?.includes(b.status)) fail("Invalid status.");
      await db
        .prepare("UPDATE records SET status=? WHERE id=?")
        .bind(b.status, b.id)
        .run();
      return json({ ok: true });
    }
    if (path.startsWith("/receipt/") && method === "GET") {
      auth();
      const row = await db
        .prepare(
          "SELECT * FROM records WHERE id=? AND kind='donation' AND user_id=? AND status='confirmed'",
        )
        .bind(path.split("/")[2], user.id)
        .first();
      if (!row)
        fail("A receipt is available after a transfer is confirmed.", 404);
      const d = JSON.parse(row.data);
      return new Response(
        `Ihya-e-Islam\nDonation acknowledgment\nReceipt: ${row.id}\nDate: ${row.created_at}\nAmount: ${d.currency} ${d.amount}\nFund: ${d.fund}\nThank you for your support.\nThis acknowledgment does not assert tax-deductible status.`,
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="receipt-${row.id}.txt"`,
            "Cache-Control": "no-store",
          },
        },
      );
    }
    fail("Not found.", 404);
  } catch (error) {
    if (!error.status) console.error("API failure", error.message);
    return json(
      {
        error: error.status
          ? error.message
          : "The request could not be completed. Please try again.",
      },
      error.status || 500,
    );
  }
}
