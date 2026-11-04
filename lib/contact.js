import { CONTACT_SERVICES } from "../public/contact-options.mjs";
import { permitted, audit } from "./platform.js";
export const CONTACT_TOPICS = [
  "Donation & receipt",
  "Member portal",
  "Volunteering",
  "Learning & courses",
  "Digital solutions",
  "General enquiry",
];
export async function contact(ctx) {
  const {
    path,
    method,
    db,
    user,
    roles,
    env,
    request,
    json,
    fail,
    body,
    text,
    id,
    limit,
  } = ctx;
  if (path === "/contact-settings" && method === "GET") {
    const number = String(env.WHATSAPP_NUMBER || "").replace(/[\s()+-]/g, "");
    return json({ whatsapp: /^[1-9]\d{9,14}$/.test(number) ? number : null });
  }
  if (path === "/contact" && method === "POST") {
    await limit(
      db,
      "contact:" + (request.headers.get("CF-Connecting-IP") || "local"),
      8,
    );
    const b = await body(request);
    if (b.website) fail("Unable to submit this message.");
    if (!CONTACT_TOPICS.includes(b.topic))
      fail("Choose a valid enquiry topic.");
    if (b.consent !== true)
      fail("Please consent to being contacted about this enquiry.");
    const email = text(b.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail("Enter a valid email address.");
    if (b.service && !CONTACT_SERVICES.some((s) => s.id === b.service))
      fail("Choose a valid related service.");
    const data = {
      name: text(b.name, 100),
      email,
      phone: String(b.phone || "")
        .trim()
        .slice(0, 40),
      topic: b.topic,
      service: b.service || "",
      subject: text(b.subject, 150),
      message: text(b.message, 5000),
      consent: true,
    };
    if (data.message.length < 10)
      fail("Please give a little more detail (at least 10 characters).");
    const rid = id();
    await db
      .prepare(
        "INSERT INTO records(id,kind,user_id,data,status) VALUES(?,'contact',?,?,'received')",
      )
      .bind(rid, user?.id || null, JSON.stringify(data))
      .run();
    return json({ id: rid, status: "received" }, 201);
  }
  if (path === "/contact/messages") {
    if (!user) fail("Please sign in.", 401);
    if (!permitted(roles, ["trustee", "city_coordinator"]))
      fail("Contact inbox access required.", 403);
    if (method === "GET") {
      const rows = await db
        .prepare(
          "SELECT id,status,created_at,data FROM records WHERE kind='contact' ORDER BY created_at DESC LIMIT 100",
        )
        .all();
      await audit(db, user.id, "contact.inbox.view", "contact", {
        ids: rows.results.map((r) => r.id),
      });
      return json({
        items: rows.results.map((r) => ({ ...r, data: JSON.parse(r.data) })),
      });
    }
    if (method === "PATCH") {
      const b = await body(request);
      if (!["received", "in_progress", "closed"].includes(b.status))
        fail("Invalid message status.");
      const row = await db
        .prepare("SELECT id FROM records WHERE id=? AND kind='contact'")
        .bind(text(b.id, 100))
        .first();
      if (!row) fail("Message not found.", 404);
      await db
        .prepare("UPDATE records SET status=? WHERE id=?")
        .bind(b.status, row.id)
        .run();
      await audit(db, user.id, "contact.status", row.id, { status: b.status });
      return json({ ok: true });
    }
  }
  return null;
}
