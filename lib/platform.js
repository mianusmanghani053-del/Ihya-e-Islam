import { WORKFLOWS, STAFF_ROLES } from "../public/workflows.mjs";
export async function rolesFor(db, user) {
  if (!user) return [];
  const rows = await db
    .prepare("SELECT role FROM staff_roles WHERE user_id=?")
    .bind(user.id)
    .all();
  return [...new Set([user.role, ...rows.results.map((x) => x.role)])];
}
export const permitted = (roles, needed) =>
  roles.includes("admin") ||
  roles.includes("chairman") ||
  needed.some((x) => roles.includes(x));
export async function assigned(db, caseId, userId) {
  return !!(await db
    .prepare("SELECT 1 FROM case_assignments WHERE case_id=? AND user_id=?")
    .bind(caseId, userId)
    .first());
}
export async function audit(db, actor, action, entity, details = {}) {
  await db
    .prepare(
      "INSERT INTO audit_events(actor_id,action,entity_id,details) VALUES(?,?,?,?)",
    )
    .bind(actor, action, entity, JSON.stringify(details))
    .run();
}
const decoded = (row) => (row ? { ...row, data: JSON.parse(row.data) } : null);
export async function platform(ctx) {
  const {
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
  } = ctx;
  const auth = () => {
    if (!user) fail("Please sign in.", 401);
  };
  const requireRole = (needed) => {
    auth();
    if (!permitted(roles, needed))
      fail("This action requires an authorized staff role.", 403);
  };
  const leadership = () => requireRole(["trustee"]);
  const isStaff = roles.some((x) => ["admin", ...STAFF_ROLES].includes(x));
  async function entry(eid) {
    const row = decoded(
      await db
        .prepare("SELECT * FROM service_entries WHERE id=?")
        .bind(eid)
        .first(),
    );
    if (!row) fail("Record not found.", 404);
    return row;
  }
  async function access(row, write = false) {
    const w = WORKFLOWS[row.kind];
    if (!w) fail("Invalid workflow.");
    if (w.private) {
      if (row.owner_id !== user?.id)
        fail("This record is private to its owner.", 403);
      return;
    }
    if (row.owner_id === user?.id && !write) return;
    if (!user) fail("Please sign in.", 401);
    if (w.sensitive && !(await assigned(db, row.id, user.id)))
      fail("Only assigned case handlers can open this case.", 403);
    if (!write && isStaff) return;
    if (!permitted(roles, w.edit || w.staffCreate || ["trustee"]))
      fail("You do not have permission for this record.", 403);
  }
  async function logRead(row) {
    if (WORKFLOWS[row.kind].sensitive)
      await audit(db, user.id, "case.view", row.id);
  }
  function validate(w, input, fields = w.fields) {
    const output = {};
    for (const f of fields || []) {
      let value = input[f.name];
      if (f.type === "checkbox") {
        if (value === undefined) continue;
        output[f.name] = value === true;
        continue;
      }
      if (value === undefined || value === "") {
        if (f.required) fail("Complete " + f.label + ".");
        continue;
      }
      if (f.type === "number") {
        value = Number(value);
        if (
          !Number.isFinite(value) ||
          value < (["latitude", "longitude"].includes(f.name) ? -180 : 0) ||
          value > (["latitude", "longitude"].includes(f.name) ? 180 : 1e10)
        )
          fail("Invalid " + f.label + ".");
      } else {
        value = text(value, f.type === "textarea" ? 12000 : 500);
        if (f.options && !f.options.includes(value))
          fail("Invalid " + f.label + ".");
        if (
          ["date", "datetime-local"].includes(f.type) &&
          !Number.isFinite(Date.parse(value))
        )
          fail("Invalid date.");
      }
      output[f.name] = value;
    }
    return output;
  }
  async function notify(uid, title, link) {
    await db
      .prepare(
        "INSERT INTO notifications(id,user_id,title,link) VALUES(?,?,?,?)",
      )
      .bind(id(), uid, title, link)
      .run();
  }
  function publicEntry(row) {
    const d = row.data;
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      created_at: row.created_at,
      data: d,
    };
  }
  async function publicList() {
    const rows = (
      await db
        .prepare(
          "SELECT * FROM service_entries WHERE status='published' AND kind IN ('article','job','mosque','lost_found','blood','scholar_question') ORDER BY created_at DESC LIMIT 200",
        )
        .all()
    ).results.map(decoded);
    return rows.map((row) => {
      if (row.kind === "scholar_question")
        return {
          id: row.id,
          kind: row.kind,
          status: row.status,
          data: {
            question: row.data.question,
            answer: row.data.answer,
            evidence: row.data.evidence,
            scholar: row.data.scholarName,
          },
        };
      return publicEntry(row);
    });
  }
  if (path === "/v2/support" && method === "POST") {
    await limit(db, "support:" + request.headers.get("CF-Connecting-IP"), 10);
    const b = await body(request),
      sid = id(),
      secret = id();
    await db
      .prepare(
        "INSERT INTO confidential_support(id,token_hash,data) VALUES(?,?,?)",
      )
      .bind(
        sid,
        await digest(secret),
        JSON.stringify({
          message: text(b.message, 12000),
          safeContact: String(b.safeContact || "").slice(0, 500),
        }),
      )
      .run();
    return json({ id: sid, secret }, 201);
  }
  if (path === "/v2/support/track" && method === "POST") {
    await limit(
      db,
      "support-track:" + request.headers.get("CF-Connecting-IP"),
      30,
    );
    const b = await body(request);
    const row = await db
      .prepare(
        "SELECT status,reply,created_at FROM confidential_support WHERE id=? AND token_hash=?",
      )
      .bind(text(b.id), await digest(text(b.secret)))
      .first();
    if (!row) fail("Request or private key not found.", 404);
    return json(row);
  }
  if (
    path.startsWith("/v2/staff/support/") &&
    ["GET", "PATCH"].includes(method)
  ) {
    requireRole(["field_officer", "trustee"]);
    const sid = path.split("/").pop();
    if (!(await assigned(db, sid, user.id)))
      fail("Assigned case handler required.", 403);
    if (method === "GET") {
      const row = await db
        .prepare(
          "SELECT id,data,status,reply,created_at FROM confidential_support WHERE id=?",
        )
        .bind(sid)
        .first();
      if (!row) fail("Not found.", 404);
      await audit(db, user.id, "case.view", sid);
      return json({ item: decoded(row) });
    }
    const b = await body(request);
    if (!["received", "assigned", "supported", "closed"].includes(b.status))
      fail("Invalid status.");
    await db
      .prepare("UPDATE confidential_support SET status=?,reply=? WHERE id=?")
      .bind(b.status, text(b.reply, 12000), sid)
      .run();
    await audit(db, user.id, "support.reply", sid);
    return json({ ok: true });
  }
  if (path === "/v2/staff/donations" && method === "GET") {
    requireRole(["finance", "trustee"]);
    return json({
      items: (
        await db
          .prepare(
            "SELECT id,user_id,data,status,created_at FROM records WHERE kind='donation' ORDER BY created_at DESC LIMIT 300",
          )
          .all()
      ).results.map(decoded),
    });
  }
  if (path === "/v2/staff/donations" && method === "PATCH") {
    requireRole(["finance"]);
    const b = await body(request);
    const row = await db
      .prepare("SELECT * FROM records WHERE id=? AND kind='donation'")
      .bind(b.id)
      .first();
    if (!row) fail("Donation not found.", 404);
    if (!["confirmed", "cancelled", "awaiting_transfer"].includes(b.status))
      fail("Invalid status.");
    const data = JSON.parse(row.data);
    data.reconciliationReference = text(b.bankReference, 200);
    await db
      .prepare("UPDATE records SET status=?,data=? WHERE id=?")
      .bind(b.status, JSON.stringify(data), row.id)
      .run();
    await audit(db, user.id, "donation.reconcile", row.id);
    return json({ ok: true });
  }
  if (
    path.startsWith("/v2/staff/report/") &&
    ["GET", "PATCH"].includes(method)
  ) {
    auth();
    const rid = path.split("/").pop();
    if (!isStaff || !(await assigned(db, rid, user.id)))
      fail("Assigned report handler required.", 403);
    const row = await db
      .prepare("SELECT * FROM records WHERE id=? AND kind='report'")
      .bind(rid)
      .first();
    if (!row) fail("Report not found.", 404);
    if (method === "GET") {
      await audit(db, user.id, "case.view", rid);
      const item = decoded(row);
      delete item.data.trackingHash;
      return json({
        item,
        authority: await db
          .prepare(
            "SELECT authority,authority_reference FROM legacy_report_meta WHERE record_id=?",
          )
          .bind(rid)
          .first(),
      });
    }
    const b = await body(request);
    if (!["received", "checked", "forwarded", "closed"].includes(b.status))
      fail("Invalid status.");
    if (b.status === "forwarded") {
      await db
        .prepare(
          "INSERT INTO legacy_report_meta VALUES(?,?,?,?) ON CONFLICT(record_id) DO UPDATE SET authority_reference=excluded.authority_reference,authority=excluded.authority,updated_by=excluded.updated_by",
        )
        .bind(
          rid,
          text(b.authorityReference, 200),
          text(b.authority, 200),
          user.id,
        )
        .run();
    }
    await db
      .prepare("UPDATE records SET status=? WHERE id=?")
      .bind(b.status, rid)
      .run();
    await audit(db, user.id, "report.status", rid, { status: b.status });
    return json({ ok: true });
  }
  if (path === "/v2/public" && method === "GET")
    return json({ items: await publicList() });
  if (path === "/v2/transparency" && method === "GET")
    return json({
      items: (
        await db
          .prepare(
            "SELECT fund,currency,substr(created_at,1,7) AS month,SUM(amount_paisa)/100.0 AS amount,COUNT(*) AS payments FROM payment_requests WHERE state='paid' GROUP BY fund,currency,substr(created_at,1,7) ORDER BY month DESC",
          )
          .all()
      ).results,
    });
  if (path.startsWith("/v2/verify/") && method === "GET") {
    const c = await db
      .prepare("SELECT * FROM credentials WHERE id=?")
      .bind(path.split("/").pop())
      .first();
    if (!c) fail("Credential not found.", 404);
    let active =
      !c.revoked &&
      (!c.expires || c.expires >= new Date().toISOString().slice(0, 10));
    if (c.entry_id) {
      const e = await entry(c.entry_id);
      active = active && e.status === "verified";
    }
    return json({
      kind: c.kind,
      displayName: c.display_name,
      details: JSON.parse(c.details),
      expires: c.expires,
      valid: active,
    });
  }
  if (path === "/v2/context" && method === "GET") {
    auth();
    const settings = (await db.prepare("SELECT key,value FROM settings").all())
      .results;
    return json({
      roles,
      staff: isStaff,
      paymentThreshold: Number(
        settings.find((x) => x.key === "payment_threshold")?.value || 50000,
      ),
      taxExempt: settings.find((x) => x.key === "tax_exempt")?.value === "true",
      uploads: !!env.UPLOADS,
      profile: await db
        .prepare("SELECT * FROM subscriptions WHERE user_id=?")
        .bind(user.id)
        .first(),
    });
  }
  if (path === "/v2/settings" && method === "PATCH") {
    leadership();
    const b = await body(request);
    const commands = [];
    if (b.paymentThreshold !== undefined) {
      const n = Number(b.paymentThreshold);
      if (!Number.isFinite(n) || n <= 0 || n > 1e8)
        fail("Invalid payment threshold.");
      commands.push(
        db
          .prepare("UPDATE settings SET value=? WHERE key='payment_threshold'")
          .bind(String(n)),
      );
    }
    if (b.taxExempt !== undefined) {
      if (typeof b.taxExempt !== "boolean") fail("Invalid tax setting.");
      if (b.taxExempt && !b.taxRegistration?.trim())
        fail("Enter the trust tax exemption registration.");
      commands.push(
        db
          .prepare("UPDATE settings SET value=? WHERE key='tax_exempt'")
          .bind(String(b.taxExempt)),
        db
          .prepare("UPDATE settings SET value=? WHERE key='tax_registration'")
          .bind(String(b.taxRegistration || "").slice(0, 300)),
      );
    }
    if (commands.length) await db.batch(commands);
    await audit(db, user.id, "settings.update", "settings");
    return json({ ok: true });
  }
  if (path === "/v2/profile" && method === "POST") {
    auth();
    const b = await body(request);
    if (!["brothers", "sisters"].includes(b.wing)) fail("Choose your wing.");
    if (
      b.bloodGroup &&
      !["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(b.bloodGroup)
    )
      fail("Invalid blood group.");
    const existing = await db
      .prepare("SELECT * FROM subscriptions WHERE user_id=?")
      .bind(user.id)
      .first();
    if (
      existing?.verified &&
      (existing.unit_id !== b.unit ||
        existing.wing !== b.wing ||
        existing.city !== b.city)
    )
      fail("A coordinator must change verified unit membership.");
    await db
      .prepare(
        "INSERT INTO subscriptions(user_id,unit_id,wing,city,blood_group,verified) VALUES(?,?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET unit_id=excluded.unit_id,wing=excluded.wing,city=excluded.city,blood_group=excluded.blood_group",
      )
      .bind(
        user.id,
        text(b.unit, 100),
        b.wing,
        text(b.city, 100),
        b.bloodGroup || null,
      )
      .run();
    return json({ ok: true });
  }
  if (path === "/v2/notifications" && method === "GET") {
    auth();
    const items = (
      await db
        .prepare(
          "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        )
        .bind(user.id)
        .all()
    ).results;
    const today = new Date().toISOString().slice(0, 10);
    const reminders = (
      await db
        .prepare(
          "SELECT id,kind,data,status FROM service_entries WHERE owner_id=? AND kind IN ('zakat','loan','hifz','seasonal')",
        )
        .bind(user.id)
        .all()
    ).results
      .map(decoded)
      .filter((r) => {
        const due =
          r.data.dueDate ||
          r.data.nextDue ||
          r.data.revisionDate ||
          r.data.startDate;
        return (
          due &&
          (r.kind === "zakat"
            ? due.slice(5) <= today.slice(5)
            : due <= today) &&
          !["repaid", "completed"].includes(r.status)
        );
      })
      .map((r) => ({
        id: r.id,
        title: WORKFLOWS[r.kind].title + " reminder: review your due date",
        link: "#services/" + r.kind,
      }));
    return json({ items: [...reminders, ...items] });
  }
  if (path === "/v2/notifications" && method === "PATCH") {
    auth();
    const b = await body(request);
    await db
      .prepare(
        "UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
      )
      .bind(text(b.id), user.id)
      .run();
    return json({ ok: true });
  }
  if (path === "/v2/staff/users" && method === "GET") {
    requireRole(["trustee", "city_coordinator"]);
    return json({
      items: (
        await db
          .prepare(
            "SELECT id,name,email,role FROM users ORDER BY name LIMIT 300",
          )
          .all()
      ).results,
      roles: (await db.prepare("SELECT * FROM staff_roles").all()).results,
    });
  }
  if (path === "/v2/staff/roles" && method === "POST") {
    leadership();
    const b = await body(request);
    if (!STAFF_ROLES.includes(b.role)) fail("Invalid role.");
    if (
      !(await db
        .prepare("SELECT id FROM users WHERE id=?")
        .bind(b.userId)
        .first())
    )
      fail("Member not found.", 404);
    if (b.remove)
      await db
        .prepare("DELETE FROM staff_roles WHERE user_id=? AND role=?")
        .bind(b.userId, b.role)
        .run();
    else
      await db
        .prepare("INSERT OR IGNORE INTO staff_roles VALUES(?,?)")
        .bind(b.userId, b.role)
        .run();
    await audit(
      db,
      user.id,
      b.remove ? "role.remove" : "role.grant",
      b.userId,
      { role: b.role },
    );
    return json({ ok: true });
  }
  if (path === "/v2/staff/assign" && method === "POST") {
    requireRole(["trustee", "city_coordinator"]);
    const b = await body(request);
    const target = await db
      .prepare("SELECT id FROM users WHERE id=?")
      .bind(b.userId)
      .first();
    if (!target) fail("Staff user not found.", 404);
    const targetUser = await db
      .prepare("SELECT id,role FROM users WHERE id=?")
      .bind(b.userId)
      .first();
    const targetRoles = await rolesFor(db, targetUser);
    if (!targetRoles.some((x) => ["admin", ...STAFF_ROLES].includes(x)))
      fail("Assign a staff member.");
    const candidate =
      (await db
        .prepare("SELECT id,kind FROM service_entries WHERE id=?")
        .bind(b.caseId)
        .first()) ||
      (await db
        .prepare("SELECT id,kind FROM records WHERE id=? AND kind='report'")
        .bind(b.caseId)
        .first());
    const supportCandidate =
      candidate ||
      (await db
        .prepare("SELECT id FROM confidential_support WHERE id=?")
        .bind(b.caseId)
        .first());
    if (!supportCandidate) fail("Case not found.", 404);
    if (
      !permitted(roles, ["trustee"]) &&
      !(await assigned(db, b.caseId, user.id))
    )
      fail(
        "Only leadership or an existing assigned coordinator can assign this case.",
        403,
      );
    if (b.remove)
      await db
        .prepare("DELETE FROM case_assignments WHERE case_id=? AND user_id=?")
        .bind(b.caseId, b.userId)
        .run();
    else
      await db
        .prepare("INSERT OR IGNORE INTO case_assignments VALUES(?,?)")
        .bind(b.caseId, b.userId)
        .run();
    await audit(
      db,
      user.id,
      b.remove ? "case.unassign" : "case.assign",
      b.caseId,
      { handler: b.userId },
    );
    return json({ ok: true });
  }
  if (path === "/v2/staff/queue" && method === "GET") {
    requireRole(STAFF_ROLES);
    return json({
      items: (
        await db
          .prepare(
            "SELECT id,kind,status,created_at FROM service_entries WHERE kind NOT IN ('habits','zakat','household') ORDER BY created_at DESC LIMIT 300",
          )
          .all()
      ).results,
      reports: (
        await db
          .prepare(
            "SELECT id,kind,status,created_at FROM records WHERE kind='report' ORDER BY created_at DESC LIMIT 300",
          )
          .all()
      ).results,
      support: (
        await db
          .prepare(
            "SELECT id,status,created_at FROM confidential_support ORDER BY created_at DESC LIMIT 200",
          )
          .all()
      ).results,
      assignments: (
        await db.prepare("SELECT case_id,user_id FROM case_assignments").all()
      ).results.filter((x) => x.user_id === user.id),
    });
  }
  if (path === "/v2/staff/audit" && method === "GET") {
    leadership();
    return json({
      items: (
        await db
          .prepare("SELECT * FROM audit_events ORDER BY id DESC LIMIT 300")
          .all()
      ).results,
    });
  }
  if (path === "/v2/entries" && method === "GET") {
    auth();
    const kind = url.searchParams.get("kind");
    if (!WORKFLOWS[kind]) fail("Choose a service.");
    const w = WORKFLOWS[kind];
    let rows;
    if (w.unit) {
      const profile = await db
        .prepare("SELECT * FROM subscriptions WHERE user_id=? AND verified=1")
        .bind(user.id)
        .first();
      if (!profile)
        fail(
          "Your coordinator must verify your unit before using unit messages.",
          403,
        );
      rows = (
        await db
          .prepare(
            "SELECT * FROM service_entries WHERE kind=? AND json_extract(data,'$.unit')=? AND json_extract(data,'$.wing')=? AND json_extract(data,'$.city')=? ORDER BY created_at DESC LIMIT 200",
          )
          .bind(kind, profile.unit_id, profile.wing, profile.city)
          .all()
      ).results;
    } else if (kind === "callout") {
      const p = await db
        .prepare("SELECT * FROM subscriptions WHERE user_id=? AND verified=1")
        .bind(user.id)
        .first();
      rows = (
        await db
          .prepare(
            "SELECT * FROM service_entries WHERE kind=? AND (owner_id=? OR (? IS NOT NULL AND json_extract(data,'$.city')=? AND json_extract(data,'$.unit')=? AND json_extract(data,'$.wing')=?)) ORDER BY created_at DESC LIMIT 200",
          )
          .bind(
            kind,
            user.id,
            p?.city || null,
            p?.city || "",
            p?.unit_id || "",
            p?.wing || "",
          )
          .all()
      ).results;
    } else if (w.private)
      rows = (
        await db
          .prepare(
            "SELECT * FROM service_entries WHERE kind=? AND owner_id=? ORDER BY created_at DESC LIMIT 200",
          )
          .bind(kind, user.id)
          .all()
      ).results;
    else
      rows = (
        await db
          .prepare(
            "SELECT e.* FROM service_entries e WHERE kind=? AND (owner_id=? OR EXISTS(SELECT 1 FROM case_assignments a WHERE a.case_id=e.id AND a.user_id=?)) ORDER BY created_at DESC LIMIT 200",
          )
          .bind(kind, user.id, user.id)
          .all()
      ).results;
    const items = [];
    for (const raw of rows) {
      const row = decoded(raw);
      if (w.sensitive) await logRead(row);
      items.push(row);
    }
    return json({ items });
  }
  if (path === "/v2/entries" && method === "POST") {
    auth();
    const b = await body(request);
    const w = WORKFLOWS[b.kind];
    if (!w) fail("Choose a valid service.");
    if (w.staffCreate) requireRole(w.staffCreate);
    const owner = w.staffCreate && b.ownerId ? text(b.ownerId) : user.id;
    if (
      !(await db.prepare("SELECT id FROM users WHERE id=?").bind(owner).first())
    )
      fail("Member not found.", 404);
    if (["lost_found", "blood"].includes(b.kind) && b.publicConsent !== true)
      fail("Consent to publish contact instructions is required.");
    let data = validate(w, b.data || {});
    const eid = id();
    if (w.unit) {
      const p = await db
        .prepare("SELECT * FROM subscriptions WHERE user_id=? AND verified=1")
        .bind(user.id)
        .first();
      if (!p)
        fail("Coordinator verification is required for unit messages.", 403);
      Object.assign(data, {
        unit: p.unit_id,
        wing: p.wing,
        city: p.city,
        author: user.name,
      });
    }
    if (b.kind === "hifz") {
      if (b.data?.teacherNotes)
        fail("Only an assigned scholar may add teacher notes.");
      if (data.juz > 30) fail("Juz must be between 0 and 30.");
    }
    if (b.kind === "zakat") {
      data.net = Math.max(0, data.assets - data.liabilities);
      data.zakatDue =
        data.net >= data.nisab ? Math.round(data.net * 2.5) / 100 : 0;
    }
    if (b.kind === "seasonal" && data.plan === "Last 10 nights") {
      const total = Math.round(data.amount * 100),
        start = new Date(data.startDate + "T12:00:00Z");
      data.schedule = Array.from({ length: 10 }, (_, i) => ({
        date: new Date(start.getTime() + i * 86400000)
          .toISOString()
          .slice(0, 10),
        amount: (Math.floor(total / 10) + (i < total % 10 ? 1 : 0)) / 100,
      }));
    }
    if (b.kind === "dedication" || b.kind === "household") {
      const donation = await db
        .prepare(
          "SELECT id FROM records WHERE id=? AND user_id=? AND kind='donation' AND status='confirmed'",
        )
        .bind(data.donationId, user.id)
        .first();
      if (!donation) fail("Use your own confirmed donation reference.");
    }
    if (b.kind === "help") {
      const normalized = data.cnic.replace(/\D/g, "");
      if (normalized.length !== 13) fail("Enter a 13-digit CNIC.");
      const duplicate = await db
        .prepare(
          "SELECT id FROM service_entries WHERE kind='help' AND json_extract(data,'$.cnic')=? AND json_extract(data,'$.category')=? AND status NOT IN ('received','declined')",
        )
        .bind(normalized, data.category)
        .first();
      if (duplicate)
        fail(
          "A similar active application exists. Contact the case team.",
          409,
        );
      data.cnic = normalized;
    }
    if (b.kind === "loan") {
      const c = await entry(data.caseId);
      await access(c, true);
      if (c.kind !== "help" || c.status !== "approved" || c.owner_id !== owner)
        fail("An approved help case for this member is required.");
      if (
        data.amount <= 0 ||
        data.installment <= 0 ||
        data.installment > data.amount
      )
        fail("Choose a positive installment no greater than the principal.");
      const count = Math.ceil(data.amount / data.installment);
      if (count > 360)
        fail("A loan schedule may have at most 360 installments.");
      const start = new Date(data.nextDue + "T12:00:00Z");
      let remaining = Math.round(data.amount * 100);
      data.schedule = Array.from({ length: count }, (_, i) => {
        const year = start.getUTCFullYear(),
          month = start.getUTCMonth() + i,
          day = Math.min(
            start.getUTCDate(),
            new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
          );
        const due = new Date(Date.UTC(year, month, day, 12))
          .toISOString()
          .slice(0, 10);
        const amount = Math.min(remaining, Math.round(data.installment * 100));
        remaining -= amount;
        return { date: due, amount: amount / 100 };
      });
      data.interest = 0;
      data.balance = data.amount;
    }
    if (b.kind === "repayment") {
      const l = await entry(data.loanId);
      if (l.kind !== "loan" || l.owner_id !== user.id)
        fail("Use your own loan reference.", 403);
      if (data.amount <= 0 || data.amount > l.data.amount)
        fail("Invalid repayment amount.");
    }
    if (b.kind === "duty") {
      const shift = await db
        .prepare(
          "SELECT * FROM resources WHERE id=? AND kind='shift' AND active=1",
        )
        .bind(data.dutyId)
        .first();
      if (!shift) fail("Choose an active published shift.");
      const joined = await db
        .prepare("SELECT 1 FROM enrollments WHERE user_id=? AND resource_id=?")
        .bind(user.id, data.dutyId)
        .first();
      if (!joined) fail("Enroll in the shift before checking in.");
      const required = JSON.parse(shift.data).requiredTraining;
      if (required) {
        const badge = await db
          .prepare(
            "SELECT id FROM service_entries WHERE owner_id=? AND kind='training' AND status='passed' AND json_extract(data,'$.training')=? AND json_extract(data,'$.validUntil')>=?",
          )
          .bind(user.id, required, new Date().toISOString().slice(0, 10))
          .first();
        if (!badge)
          fail("This duty requires current " + required + " training.", 403);
      }
      if (data.hours > 24) fail("Hours must not exceed 24 per shift.");
    }
    let status = w.states[0];
    const commands = [
      db
        .prepare(
          "INSERT INTO service_entries(id,kind,owner_id,data,status) VALUES(?,?,?,?,?)",
        )
        .bind(eid, b.kind, owner, JSON.stringify(data), status),
    ];
    if (w.staffCreate)
      commands.push(
        db
          .prepare("INSERT INTO case_assignments VALUES(?,?)")
          .bind(eid, user.id),
      );
    commands.push(
      db
        .prepare(
          "INSERT INTO entry_events(entry_id,actor_id,action) VALUES(?,?,?)",
        )
        .bind(eid, user.id, "created"),
    );
    await db.batch(commands);
    await audit(db, user.id, "entry.create", eid, { kind: b.kind });
    if (b.kind === "callout") {
      const recipients = (
        await db
          .prepare(
            "SELECT user_id FROM subscriptions WHERE city=? AND unit_id=? AND wing=? AND verified=1",
          )
          .bind(data.city, data.unit, data.wing)
          .all()
      ).results;
      for (const target of recipients)
        await notify(
          target.user_id,
          "Emergency call-out: " + data.title,
          "#services/callout",
        );
    }
    return json({ id: eid, status }, 201);
  }
  if (path.startsWith("/v2/entry/") && method === "GET") {
    auth();
    const row = await entry(path.split("/").pop());
    await access(row);
    await logRead(row);
    const files = (
      await db
        .prepare("SELECT id,mime,size FROM private_files WHERE entry_id=?")
        .bind(row.id)
        .all()
    ).results;
    return json({
      item: row,
      files,
      events: (
        await db
          .prepare(
            "SELECT actor_id,action,details,created_at FROM entry_events WHERE entry_id=? ORDER BY id",
          )
          .bind(row.id)
          .all()
      ).results,
    });
  }
  if (path.startsWith("/v2/entry/") && method === "PATCH") {
    auth();
    const row = await entry(path.split("/").pop());
    const w = WORKFLOWS[row.kind];
    const b = await body(request);
    if (Number(b.version) !== row.version)
      fail("This record changed. Reload before saving.", 409);
    const ownerEdit =
      row.owner_id === user.id &&
      (w.private || ["hifz", "seasonal"].includes(row.kind));
    if (!ownerEdit) await access(row, true);
    let data = { ...row.data };
    const status = b.status || row.status;
    if (!w.states.includes(status)) fail("Invalid workflow status.");
    if (ownerEdit && status !== row.status)
      fail("Status changes require staff review.", 403);
    if (b.data) {
      if (ownerEdit) {
        const next = validate(w, b.data);
        if (row.kind === "hifz") next.teacherNotes = row.data.teacherNotes;
        data = { ...data, ...next };
      } else {
        const optional = (w.staffFields || []).map((f) => ({
          ...f,
          required: false,
        }));
        data = { ...data, ...validate(w, b.data, optional) };
        if (w.staffCreate)
          data = {
            ...data,
            ...validate(
              w,
              b.data,
              w.fields.map((f) => ({ ...f, required: false })),
            ),
          };
      }
    }
    if (row.kind === "zakat") {
      data.net = Math.max(0, data.assets - data.liabilities);
      data.zakatDue =
        data.net >= data.nisab ? Math.round(data.net * 0.025 * 100) / 100 : 0;
    }
    if (
      row.kind === "seasonal" &&
      status !== row.status &&
      ["confirmed", "completed"].includes(status)
    ) {
      const d = await db
        .prepare(
          "SELECT id FROM records WHERE id=? AND user_id=? AND kind='donation' AND status='confirmed'",
        )
        .bind(data.donationId || "", row.owner_id)
        .first();
      if (!d)
        fail(
          "Link the member’s confirmed donation before confirming fulfilment.",
        );
      if (status === "completed" && (!data.slaughterDate || !data.fulfilment))
        fail("Record the fulfilment date and confirmation.");
    }
    if (
      row.kind === "duty" &&
      status === "confirmed" &&
      (!Number.isFinite(data.confirmedHours) ||
        data.confirmedHours < 0 ||
        data.confirmedHours > 24)
    )
      fail("The unit lead must confirm hours between 0 and 24.");
    if (row.kind === "help") {
      if (status !== row.status) {
        const next = {
          applied: ["field_visit", "declined"],
          field_visit: ["verified", "declined"],
          verified: ["approved", "declined"],
          approved: ["received"],
          received: [],
          declined: [],
        };
        if (!next[row.status]?.includes(status))
          fail("Follow the field visit and approval sequence.");
      }
      if (
        status === "verified" &&
        row.status !== status &&
        row.status !== "field_visit"
      )
        fail("Record a field visit before verification.");
      if (status === "approved" && row.status !== status) {
        requireRole(["trustee"]);
        if (row.status !== "verified")
          fail("A verified field visit is required.");
        const verifier = await db
          .prepare(
            "SELECT actor_id FROM entry_events WHERE entry_id=? AND action='status.verified' ORDER BY id DESC LIMIT 1",
          )
          .bind(row.id)
          .first();
        if (!verifier || verifier.actor_id === user.id)
          fail("A second person must approve this application.");
      }
      if (
        (data.shareName ||
          data.shareLocation ||
          data.sharePhone ||
          data.publicConsent) &&
        !data.consentReference
      )
        fail("Record written consent before sharing identifying information.");
    }
    if (
      row.kind === "scholar_question" &&
      ["answered", "published"].includes(status)
    ) {
      requireRole(["scholar"]);
      if (!data.answer || !data.evidence)
        fail("Answer and evidence are required.");
      data.scholarName = user.name;
      if (status === "published" && !row.data.publishConsent)
        fail("The questioner has not consented to publication.");
    }
    if (row.kind === "article") {
      requireRole(["scholar"]);
      if (status === "reviewed") {
        data.reviewer = user.name;
        data.reviewerId = user.id;
      }
      if (
        status === "published" &&
        b.data &&
        ["title", "body", "evidence", "type"].some(
          (k) => b.data[k] !== undefined && b.data[k] !== row.data[k],
        )
      )
        fail("Content changed after review. Submit it for a new review.");
      if (status === "published" && row.status !== "reviewed")
        fail("Scholar review is required before publication.");
    }
    if (row.kind === "repayment" && status === "confirmed") {
      requireRole(["finance"]);
      if (row.status === "confirmed") fail("Already confirmed.", 409);
      const loan = await entry(row.data.loanId);
      const repaid = await db
        .prepare(
          "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) AS amount FROM service_entries WHERE kind='repayment' AND status='confirmed' AND json_extract(data,'$.loanId')=?",
        )
        .bind(loan.id)
        .first();
      if (repaid.amount + row.data.amount > loan.data.amount)
        fail("Repayment exceeds the outstanding principal.", 409);
      if (!(await assigned(db, loan.id, user.id)))
        fail("Assign the loan to this finance handler first.", 403);
    }
    if (
      row.kind === "blood" &&
      status === "published" &&
      row.status !== "published"
    ) {
      const matches = (
        await db
          .prepare(
            "SELECT user_id FROM subscriptions WHERE blood_group=? AND city=?",
          )
          .bind(data.bloodGroup, data.city)
          .all()
      ).results;
      for (const r of matches)
        await notify(
          r.user_id,
          "Blood request: " + data.bloodGroup + " in " + data.city,
          "#community",
        );
    }
    const result = await db
      .prepare(
        "UPDATE service_entries SET data=?,status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?",
      )
      .bind(JSON.stringify(data), status, row.id, row.version)
      .run();
    if (!result.meta.changes) fail("Record changed. Reload.", 409);
    await db
      .prepare(
        "INSERT INTO entry_events(entry_id,actor_id,action,details) VALUES(?,?,?,?)",
      )
      .bind(
        row.id,
        user.id,
        "status." + status,
        JSON.stringify({ previous: row.status }),
      )
      .run();
    await audit(db, user.id, "entry.update", row.id, {
      status,
      fields: Object.keys(b.data || {}),
      ...(row.kind === "help"
        ? {
            consentReference: data.consentReference || null,
            shareName: !!data.shareName,
            shareLocation: !!data.shareLocation,
            sharePhone: !!data.sharePhone,
          }
        : {}),
    });
    if (row.kind === "volunteer_review" && status === "removed") {
      await db.batch([
        db
          .prepare("UPDATE subscriptions SET verified=0 WHERE user_id=?")
          .bind(row.data.volunteerId),
        db
          .prepare(
            "UPDATE service_entries SET status='suspended',version=version+1 WHERE kind='volunteer_id' AND owner_id=?",
          )
          .bind(row.data.volunteerId),
        db
          .prepare(
            "UPDATE credentials SET revoked=1 WHERE user_id=? AND kind='volunteer'",
          )
          .bind(row.data.volunteerId),
      ]);
      await audit(db, user.id, "volunteer.revoke", row.data.volunteerId);
    }
    await notify(
      row.owner_id,
      WORKFLOWS[row.kind].title + ": " + status,
      "#services/" + row.kind,
    );
    return json({ ok: true });
  }
  if (path === "/v2/respond" && method === "POST") {
    auth();
    const b = await body(request);
    const row = await entry(b.entryId);
    if (!["callout", "blood", "job"].includes(row.kind))
      fail("This service does not accept replies.");
    if (!["available", "not_available", "interested"].includes(b.response))
      fail("Invalid reply.");
    if (row.kind === "callout") {
      const p = await db
        .prepare("SELECT * FROM subscriptions WHERE user_id=? AND verified=1")
        .bind(user.id)
        .first();
      if (
        !p ||
        p.city !== row.data.city ||
        p.unit_id !== row.data.unit ||
        p.wing !== row.data.wing
      )
        fail("This call-out is for another unit.", 403);
      if (row.data.requiredTraining) {
        const badge = await db
          .prepare(
            "SELECT id FROM service_entries WHERE kind='training' AND owner_id=? AND status='passed' AND json_extract(data,'$.training')=? AND json_extract(data,'$.validUntil')>=?",
          )
          .bind(
            user.id,
            row.data.requiredTraining,
            new Date().toISOString().slice(0, 10),
          )
          .first();
        if (!badge) fail("Required training is not current.", 403);
      }
    } else if (row.status !== "published") fail("This listing is not active.");
    await db
      .prepare(
        "INSERT INTO participation VALUES(?,?,?) ON CONFLICT(entry_id,user_id) DO UPDATE SET response=excluded.response",
      )
      .bind(row.id, user.id, b.response)
      .run();
    return json({ ok: true });
  }
  if (path === "/v2/staff/responses" && method === "GET") {
    requireRole(["city_coordinator", "unit_lead"]);
    const row = await entry(url.searchParams.get("entry"));
    await access(row, true);
    return json({
      items: (
        await db
          .prepare(
            "SELECT p.user_id,u.name,p.response FROM participation p JOIN users u ON u.id=p.user_id WHERE entry_id=?",
          )
          .bind(row.id)
          .all()
      ).results,
    });
  }
  if (path === "/v2/staff/verify-unit" && method === "POST") {
    requireRole(["city_coordinator"]);
    const b = await body(request);
    if (
      !(await db
        .prepare("SELECT user_id FROM subscriptions WHERE user_id=?")
        .bind(b.userId)
        .first())
    )
      fail("Member must set a unit profile first.");
    await db
      .prepare("UPDATE subscriptions SET verified=? WHERE user_id=?")
      .bind(b.verified ? 1 : 0, b.userId)
      .run();
    await audit(db, user.id, "unit.verify", b.userId);
    return json({ ok: true });
  }
  if (path === "/v2/credentials" && method === "GET") {
    auth();
    return json({
      items: (
        await db
          .prepare("SELECT * FROM credentials WHERE user_id=?")
          .bind(user.id)
          .all()
      ).results.map((c) => ({ ...c, details: JSON.parse(c.details) })),
    });
  }
  if (path === "/v2/credentials" && method === "POST") {
    auth();
    const b = await body(request);
    if (b.consent !== true) fail("Consent to public verification is required.");
    let details,
      kind,
      expires = null,
      entryId = null,
      courseId = null;
    if (b.entryId) {
      const row = await entry(b.entryId);
      if (
        row.owner_id !== user.id ||
        row.kind !== "volunteer_id" ||
        row.status !== "verified"
      )
        fail("A verified volunteer ID belonging to you is required.", 403);
      entryId = row.id;
      expires = row.data.expiry;
      kind = "volunteer";
      details = {
        unit: row.data.unit,
        city: row.data.city,
        wing: row.data.wing,
      };
      if (expires < new Date().toISOString().slice(0, 10))
        fail("Volunteer ID expired.");
    } else {
      courseId = text(b.courseId);
      const enrollment = await db
        .prepare(
          "SELECT r.data,e.progress FROM enrollments e JOIN resources r ON r.id=e.resource_id WHERE e.user_id=? AND r.id=? AND r.kind='course'",
        )
        .bind(user.id, courseId)
        .first();
      if (!enrollment) fail("Course enrollment not found.");
      const course = JSON.parse(enrollment.data);
      if (enrollment.progress < course.lessons.length)
        fail("Complete every lesson first.");
      kind = "course";
      details = {
        course: course.title,
        completionType: "Self-paced course completion",
      };
    }
    const cid = id();
    await db
      .prepare(
        "INSERT INTO credentials(id,user_id,entry_id,course_id,kind,display_name,details,expires) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        cid,
        user.id,
        entryId,
        courseId,
        kind,
        user.name,
        JSON.stringify(details),
        expires,
      )
      .run();
    return json({ id: cid }, 201);
  }
  if (path.startsWith("/v2/files/") && ["GET", "POST"].includes(method)) {
    auth();
    const token = path.split("/").pop();
    if (method === "POST") {
      const row = await entry(token);
      await access(row);
      if (!env.UPLOADS)
        fail(
          "Private document storage is not enabled. Your form can be saved without documents.",
          503,
        );
      const mime = request.headers.get("content-type");
      if (
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          mime,
        )
      )
        fail("Use JPEG, PNG, WebP or PDF.");
      if (Number(request.headers.get("content-length")) > 5 * 1024 * 1024)
        fail("Maximum file size is 5 MB.", 413);
      const data = await request.arrayBuffer();
      if (data.byteLength > 5 * 1024 * 1024)
        fail("Maximum file size is 5 MB.", 413);
      const fid = id(),
        key = "cases/" + row.id + "/" + fid;
      await env.UPLOADS.put(key, data, { httpMetadata: { contentType: mime } });
      await db
        .prepare(
          "INSERT INTO private_files VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)",
        )
        .bind(fid, row.id, key, mime, data.byteLength, user.id)
        .run();
      await audit(db, user.id, "file.upload", row.id);
      return json({ id: fid }, 201);
    }
    const file = await db
      .prepare("SELECT * FROM private_files WHERE id=?")
      .bind(token)
      .first();
    if (!file) fail("File not found.", 404);
    const row = await entry(file.entry_id);
    await access(row);
    await logRead(row);
    await audit(db, user.id, "file.view", row.id);
    const obj = await env.UPLOADS?.get(file.storage_key);
    if (!obj) fail("File unavailable.", 404);
    return new Response(obj.body, {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": "attachment",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path === "/v2/payments" && method === "GET") {
    requireRole(["finance", "trustee"]);
    return json({
      items: (
        await db
          .prepare(
            "SELECT p.*,(SELECT COUNT(*) FROM payment_approvals a WHERE a.payment_id=p.id) AS approvals FROM payment_requests p ORDER BY created_at DESC LIMIT 200",
          )
          .all()
      ).results,
    });
  }
  if (path === "/v2/payments" && method === "POST") {
    requireRole(["finance"]);
    const b = await body(request);
    const amount = Math.round(Number(b.amount) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1e12)
      fail("Invalid amount.");
    if (!["zakat", "general"].includes(b.fund)) fail("Choose a separate fund.");
    if (b.caseId) {
      const c = await entry(b.caseId);
      await access(c);
      if (c.kind !== "help" || c.status !== "approved")
        fail("Use an approved help case.");
    }
    const threshold =
      Number(
        (
          await db
            .prepare("SELECT value FROM settings WHERE key='payment_threshold'")
            .first()
        ).value,
      ) * 100;
    const pid = id();
    await db
      .prepare(
        "INSERT INTO payment_requests(id,entry_id,amount_paisa,fund,purpose,creator_id,threshold_paisa) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(
        pid,
        b.caseId || null,
        amount,
        b.fund,
        text(b.purpose, 500),
        user.id,
        threshold,
      )
      .run();
    await audit(db, user.id, "payment.create", pid);
    return json({ id: pid }, 201);
  }
  if (path.startsWith("/v2/payment/") && method === "POST") {
    requireRole(["finance", "trustee"]);
    const pid = path.split("/").pop(),
      b = await body(request);
    const p = await db
      .prepare("SELECT * FROM payment_requests WHERE id=?")
      .bind(pid)
      .first();
    if (!p) fail("Payment not found.", 404);
    if (p.state === "paid" || p.state === "cancelled")
      fail("Payment is final.", 409);
    if (b.action === "approve") {
      if (p.creator_id === user.id)
        fail("You cannot approve your own payment.", 403);
      try {
        await db
          .prepare(
            "INSERT INTO payment_approvals VALUES(?,?,CURRENT_TIMESTAMP)",
          )
          .bind(pid, user.id)
          .run();
      } catch {
        fail("You have already approved this payment.", 409);
      }
      const count = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM payment_approvals WHERE payment_id=?",
        )
        .bind(pid)
        .first();
      if (count.n >= (p.amount_paisa > p.threshold_paisa ? 2 : 1))
        await db
          .prepare("UPDATE payment_requests SET state='approved' WHERE id=?")
          .bind(pid)
          .run();
    } else if (b.action === "paid") {
      requireRole(["finance"]);
      if (p.state !== "approved")
        fail(
          "Independent approvals are required before marking payment paid.",
          409,
        );
      try {
        await db
          .prepare(
            "UPDATE payment_requests SET state='paid',bank_reference=? WHERE id=? AND state='approved'",
          )
          .bind(text(b.bankReference, 200), pid)
          .run();
      } catch {
        fail("Required independent approvals are missing.", 409);
      }
    } else fail("Invalid payment action.");
    await audit(db, user.id, "payment." + b.action, pid);
    return json({ ok: true });
  }
  if (path === "/v2/allocations" && method === "POST") {
    requireRole(["finance"]);
    const b = await body(request);
    const c = await entry(b.caseId);
    await access(c);
    if (c.kind !== "help" || !["approved", "received"].includes(c.status))
      fail("Allocate only to an approved case.");
    const donation = await db
      .prepare(
        "SELECT * FROM records WHERE id=? AND kind='donation' AND status='confirmed'",
      )
      .bind(b.donationId)
      .first();
    if (!donation) fail("Confirmed donation not found.");
    const amount = Math.round(Number(b.amount) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0)
      fail("Invalid allocation amount.");
    if (b.paymentId) {
      const p = await db
        .prepare("SELECT * FROM payment_requests WHERE id=?")
        .bind(b.paymentId)
        .first();
      if (!p || p.entry_id !== c.id || p.amount_paisa < amount)
        fail("Payment must belong to the same case and cover this allocation.");
      if (JSON.parse(donation.data).fund === "zakat" && p.fund !== "zakat")
        fail("Zakat allocations require the zakat fund.");
    }
    try {
      await db
        .prepare(
          "INSERT INTO donation_allocations(id,donation_id,case_id,payment_id,amount_paisa,currency,label) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(
          id(),
          b.donationId,
          c.id,
          b.paymentId || null,
          amount,
          JSON.parse(donation.data).currency,
          c.data.category,
        )
        .run();
    } catch {
      fail(
        "Allocation exceeds the confirmed donation or conflicts with the fund.",
        409,
      );
    }
    await audit(db, user.id, "donation.allocate", b.donationId, {
      caseId: c.id,
    });
    return json({ ok: true });
  }
  if (path === "/v2/donation-tracking" && method === "GET") {
    auth();
    const rows = (
      await db
        .prepare(
          "SELECT a.*,e.data AS case_data,e.status AS case_status,p.state AS payment_status FROM donation_allocations a JOIN records r ON r.id=a.donation_id JOIN service_entries e ON e.id=a.case_id LEFT JOIN payment_requests p ON p.id=a.payment_id WHERE r.user_id=? ORDER BY a.created_at DESC",
        )
        .bind(user.id)
        .all()
    ).results;
    const items = [];
    for (const r of rows) {
      const d = JSON.parse(r.case_data);
      const recipient = { reference: r.case_id };
      if (d.consentReference) {
        if (d.shareName) recipient.name = d.name;
        if (d.shareLocation) recipient.location = d.generalLocation;
        if (d.sharePhone) recipient.phone = d.phone;
      }
      items.push({
        id: r.id,
        donationId: r.donation_id,
        amount: r.amount_paisa / 100,
        currency: r.currency,
        purpose: r.label,
        status: r.case_status,
        paymentStatus: r.payment_status || "not_linked",
        recipient,
        created_at: r.created_at,
      });
      await audit(db, user.id, "donor.allocation.view", r.case_id);
    }
    return json({ items });
  }
  if (path === "/v2/loan-summary" && method === "GET") {
    auth();
    const loan = await entry(url.searchParams.get("id"));
    await access(loan);
    if (loan.kind !== "loan") fail("Not a loan.");
    const repayments = (
      await db
        .prepare(
          "SELECT id,status,data FROM service_entries WHERE kind='repayment' AND json_extract(data,'$.loanId')=?",
        )
        .bind(loan.id)
        .all()
    ).results.map(decoded);
    const paid = repayments
      .filter((r) => r.status === "confirmed")
      .reduce((sum, r) => sum + r.data.amount, 0);
    return json({
      principal: loan.data.amount,
      repaid: paid,
      balance: Math.max(0, loan.data.amount - paid),
      nextDue: loan.data.nextDue,
      installment: loan.data.installment,
      schedule: loan.data.schedule || [],
      repayments: repayments.map((r) => ({
        id: r.id,
        status: r.status,
        amount: r.data.amount,
      })),
    });
  }
  if (path === "/v2/tax" && method === "GET") {
    auth();
    const exemption = await db
      .prepare("SELECT value FROM settings WHERE key='tax_exempt'")
      .first();
    if (exemption.value !== "true")
      fail(
        "Tax certificates will be available after the trust has verified tax-exempt status.",
        409,
      );
    const year = Number(url.searchParams.get("year"));
    if (!Number.isInteger(year) || year < 2020 || year > 2100)
      fail("Choose a valid year.");
    const rows = (
      await db
        .prepare(
          "SELECT id,data,created_at FROM records WHERE user_id=? AND kind='donation' AND status='confirmed' AND substr(created_at,1,4)=?",
        )
        .bind(user.id, String(year))
        .all()
    ).results.map(decoded);
    const totals = {};
    for (const r of rows)
      totals[r.data.currency] = (totals[r.data.currency] || 0) + r.data.amount;
    await audit(db, user.id, "tax.download", String(year));
    return json({
      year,
      name: user.name,
      registration: (
        await db
          .prepare("SELECT value FROM settings WHERE key='tax_registration'")
          .first()
      ).value,
      totals,
      receipts: rows.map((r) => ({
        id: r.id,
        date: r.created_at,
        amount: r.data.amount,
        currency: r.data.currency,
      })),
    });
  }
  return null;
}
