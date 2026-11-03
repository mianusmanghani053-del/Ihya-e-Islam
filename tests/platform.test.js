import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = process.env.TEST_BANK_URL || "http://127.0.0.1:8791";
const people = {};
async function call(who, path, data, method = data ? "POST" : "GET") {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: people[who]?.cookie || "",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const b = await r.json();
  return { status: r.status, body: b, cookie: r.headers.get("set-cookie") };
}
async function newPerson(name, role) {
  const email = `platform-${name}-${Date.now()}@example.com`;
  const r = await call("", "/auth/register", {
    email,
    name,
    password: "platform-fixture-password-1234",
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  people[name] = { ...r.body.user, cookie: r.cookie.split(";")[0] };
  if (role)
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
        role === "admin"
          ? `UPDATE users SET role='admin' WHERE id='${r.body.user.id}'`
          : `INSERT INTO staff_roles VALUES('${r.body.user.id}','${role}')`,
      ],
      { stdio: "pipe" },
    );
}
async function getEntry(who, id) {
  return call(who, "/v2/entry/" + id);
}
async function update(who, id, status, data) {
  const r = await getEntry(who, id);
  if (r.status !== 200) return r;
  return call(
    who,
    "/v2/entry/" + id,
    { version: r.body.item.version, status, data },
    "PATCH",
  );
}
async function assign(caseId, name) {
  const r = await call("root", "/v2/staff/assign", {
    caseId,
    userId: people[name].id,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}
test("Community platform: privacy, consent, dual control and persistence", async (t) => {
  for (const [name, role] of [
    ["root", "admin"],
    ["donor", null],
    ["other", null],
    ["field", "field_officer"],
    ["trustee", "trustee"],
    ["finance", "finance"],
  ])
    await newPerson(name, role);
  let help, donation, payment, article;
  await t.test(
    "personal habits are inaccessible even to administrators",
    async () => {
      let r = await call("donor", "/v2/entries", {
        kind: "habits",
        data: { date: "2026-11-04", habit0: true },
      });
      assert.equal(r.status, 201);
      assert.equal((await getEntry("root", r.body.id)).status, 403);
      assert.equal((await getEntry("other", r.body.id)).status, 403);
      assert.equal(
        (await getEntry("donor", r.body.id)).body.item.data.habit0,
        true,
      );
    },
  );
  await t.test(
    "zakat calculation is saved, and a seasonal schedule conserves the amount",
    async () => {
      let r = await call("donor", "/v2/entries", {
        kind: "zakat",
        data: {
          year: 2026,
          assets: 200000,
          liabilities: 10000,
          nisab: 100000,
          dueDate: "2026-11-04",
        },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(
        (await getEntry("donor", r.body.id)).body.item.data.zakatDue,
        4750,
      );
      r = await call("donor", "/v2/entries", {
        kind: "seasonal",
        data: {
          plan: "Last 10 nights",
          amount: 1001.01,
          startDate: "2027-03-01",
        },
      });
      assert.equal(r.status, 201);
      const schedule = (await getEntry("donor", r.body.id)).body.item.data
        .schedule;
      assert.equal(schedule.length, 10);
      assert.equal(
        Math.round(schedule.reduce((s, x) => s + x.amount, 0) * 100),
        100101,
      );
    },
  );
  await t.test(
    "case creation detects duplicates and hides data from unassigned staff",
    async () => {
      const data = {
        category: "Ration",
        name: "Private applicant",
        phone: "03000000000",
        location: "Exact private address",
        cnic: "1234512345671",
        income: 5000,
        description: "Local test case",
      };
      let r = await call("donor", "/v2/entries", { kind: "help", data });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      help = r.body.id;
      assert.equal((await getEntry("root", help)).status, 403);
      assert.equal(
        (await call("other", "/v2/entries", { kind: "help", data })).status,
        409,
      );
      await assign(help, "field");
      await assign(help, "trustee");
      await assign(help, "finance");
      assert.equal((await getEntry("field", help)).status, 200);
    },
  );
  await t.test(
    "field verification and separate trustee approval are required",
    async () => {
      assert.equal((await update("trustee", help, "approved")).status, 400);
      assert.equal((await update("field", help, "received")).status, 400);
      assert.equal(
        (
          await update("field", help, "field_visit", {
            visitDate: "2026-11-04T12:00",
            verification: "Field visit completed",
          })
        ).status,
        200,
      );
      assert.equal((await update("field", help, "verified")).status, 200);
      assert.equal((await update("trustee", help, "approved")).status, 200);
    },
  );
  await t.test(
    "two distinct people must approve a large payment; creator cannot approve",
    async () => {
      let r = await call("finance", "/v2/payments", {
        caseId: help,
        amount: 60000,
        fund: "zakat",
        purpose: "Ration support",
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      payment = r.body.id;
      assert.equal(
        (await call("finance", "/v2/payment/" + payment, { action: "approve" }))
          .status,
        403,
      );
      assert.equal(
        (await call("root", "/v2/payment/" + payment, { action: "approve" }))
          .status,
        200,
      );
      assert.equal(
        (await call("root", "/v2/payment/" + payment, { action: "approve" }))
          .status,
        409,
      );
      assert.equal(
        (
          await call("finance", "/v2/payment/" + payment, {
            action: "paid",
            bankReference: "TEST-BANK",
          })
        ).status,
        409,
      );
      assert.equal(
        (await call("trustee", "/v2/payment/" + payment, { action: "approve" }))
          .status,
        200,
      );
      assert.equal(
        (
          await call("finance", "/v2/payment/" + payment, {
            action: "paid",
            bankReference: "TEST-BANK",
          })
        ).status,
        200,
      );
    },
  );
  await t.test(
    "confirmed donor allocation enforces budget and consent",
    async () => {
      let r = await call("donor", "/records", {
        kind: "donation",
        amount: 100000,
        currency: "PKR",
        fund: "zakat",
      });
      assert.equal(r.status, 201);
      donation = r.body.id;
      assert.equal(
        (
          await call(
            "finance",
            "/v2/staff/donations",
            {
              id: donation,
              status: "confirmed",
              bankReference: "TEST-INCOMING",
            },
            "PATCH",
          )
        ).status,
        200,
      );
      r = await call("finance", "/v2/allocations", {
        donationId: donation,
        caseId: help,
        paymentId: payment,
        amount: 60000,
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(
        (
          await call("finance", "/v2/allocations", {
            donationId: donation,
            caseId: help,
            amount: 50000,
          })
        ).status,
        409,
      );
      let tracking = (await call("donor", "/v2/donation-tracking")).body.items;
      assert.equal(tracking[0].recipient.phone, undefined);
      assert.equal(tracking[0].recipient.name, undefined);
      assert.equal(
        (await call("other", "/v2/donation-tracking")).body.items.length,
        0,
      );
      assert.equal(
        (await update("trustee", help, "approved", { sharePhone: true }))
          .status,
        400,
      );
      assert.equal(
        (
          await update("trustee", help, "approved", {
            shareName: true,
            sharePhone: true,
            shareLocation: true,
            consentReference: "SIGNED-TEST-CONSENT",
            generalLocation: "Lahore district",
          })
        ).status,
        200,
      );
      tracking = (await call("donor", "/v2/donation-tracking")).body.items;
      assert.equal(tracking[0].recipient.name, "Private applicant");
      assert.equal(tracking[0].recipient.location, "Lahore district");
      assert.equal(tracking[0].recipient.phone, "03000000000");
      assert.ok(
        !JSON.stringify((await call("", "/v2/transparency")).body).includes(
          "Private applicant",
        ),
      );
    },
  );
  await t.test(
    "case views and consent changes have audit records",
    async () => {
      const r = await call("root", "/v2/staff/audit");
      assert.equal(r.status, 200);
      assert.ok(
        r.body.items.some(
          (e) => e.entity_id === help && e.action === "case.view",
        ),
      );
      assert.ok(
        r.body.items.some(
          (e) => e.entity_id === help && e.action === "donor.allocation.view",
        ),
      );
    },
  );
  await t.test(
    "unit messages require verification and remain separated by wing",
    async () => {
      for (const [name, wing] of [
        ["donor", "brothers"],
        ["other", "sisters"],
      ]) {
        assert.equal(
          (
            await call(name, "/v2/profile", {
              unit: "Relief",
              city: "Lahore",
              wing,
              bloodGroup: "O+",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await call("root", "/v2/staff/verify-unit", {
              userId: people[name].id,
              verified: true,
            })
          ).status,
          200,
        );
      }
      let r = await call("donor", "/v2/entries", {
        kind: "announcement",
        data: { message: "Brothers unit message" },
      });
      assert.equal(r.status, 201);
      assert.equal(
        (await call("other", "/v2/entries?kind=announcement")).body.items
          .length,
        0,
      );
      assert.equal(
        (await call("donor", "/v2/entries?kind=announcement")).body.items
          .length,
        1,
      );
    },
  );
  await t.test("content cannot publish without scholar review", async () => {
    let r = await call("root", "/v2/entries", {
      kind: "article",
      data: {
        type: "Article",
        title: "Test reviewed article",
        body: "Source-checked teaching",
        evidence: "Test reference",
      },
    });
    assert.equal(r.status, 201);
    article = r.body.id;
    assert.equal((await update("root", article, "published")).status, 400);
    assert.equal((await update("root", article, "reviewed")).status, 200);
    assert.equal(
      (
        await update("root", article, "published", {
          body: "Unreviewed replacement",
        })
      ).status,
      400,
    );
    assert.equal((await update("root", article, "published")).status, 200);
    assert.ok(
      (await call("", "/v2/public")).body.items.some((x) => x.id === article),
    );
  });
  await t.test(
    "anonymous support ignores login identity and needs a private key",
    async () => {
      const r = await call("donor", "/v2/support", {
        message: "Confidential test support request",
      });
      assert.equal(r.status, 201);
      assert.equal(
        (
          await call("other", "/v2/support/track", {
            id: r.body.id,
            secret: "wrong",
          })
        ).status,
        404,
      );
      const tracked = await call("", "/v2/support/track", r.body);
      assert.equal(tracked.status, 200);
      assert.equal(tracked.body.status, "received");
      assert.equal(tracked.body.user_id, undefined);
      assert.equal(
        (await call("root", "/v2/staff/support/" + r.body.id)).status,
        403,
      );
      await assign(r.body.id, "field");
      assert.equal(
        (await call("field", "/v2/staff/support/" + r.body.id)).status,
        200,
      );
    },
  );
  await t.test(
    "tax certificate is gated by real trust configuration",
    async () => {
      assert.equal((await call("donor", "/v2/tax?year=2026")).status, 409);
    },
  );
  await t.test("training prerequisites and revocable QR cards", async () => {
    const shift = await call("root", "/resources", {
      kind: "shift",
      title: "Training-gated shift",
      description: "Local fixture",
      date: "2027-01-01T10:00",
      location: "Test centre",
      requiredTraining: "First aid",
    });
    assert.equal(shift.status, 201);
    assert.equal(
      (await call("donor", "/enrollments", { resourceId: shift.body.id }))
        .status,
      403,
    );
    const badge = await call("root", "/v2/entries", {
      kind: "training",
      ownerId: people.donor.id,
      data: {
        training: "First aid",
        date: "2026-11-04",
        validUntil: "2030-01-01",
      },
    });
    assert.equal(badge.status, 201);
    assert.equal((await update("root", badge.body.id, "passed")).status, 200);
    assert.equal(
      (await call("donor", "/enrollments", { resourceId: shift.body.id }))
        .status,
      200,
    );
    const card = await call("root", "/v2/entries", {
      kind: "volunteer_id",
      ownerId: people.donor.id,
      data: {
        unit: "Relief",
        city: "Lahore",
        expiry: "2030-01-01",
        wing: "brothers",
      },
    });
    assert.equal(card.status, 201);
    assert.equal((await update("root", card.body.id, "verified")).status, 200);
    const credential = await call("donor", "/v2/credentials", {
      entryId: card.body.id,
      consent: true,
    });
    assert.equal(credential.status, 201);
    const verified = await call("", "/v2/verify/" + credential.body.id);
    assert.equal(verified.body.valid, true);
    assert.equal(verified.body.details.phone, undefined);
    assert.equal((await update("root", card.body.id, "suspended")).status, 200);
    assert.equal(
      (await call("", "/v2/verify/" + credential.body.id)).body.valid,
      false,
    );
  });
  await t.test(
    "interest-free schedules and repayment principal limits",
    async () => {
      await assign(help, "root");
      const loan = await call("root", "/v2/entries", {
        kind: "loan",
        ownerId: people.donor.id,
        data: {
          caseId: help,
          amount: 5000,
          installment: 1000,
          nextDue: "2026-12-01",
        },
      });
      assert.equal(loan.status, 201, JSON.stringify(loan.body));
      await assign(loan.body.id, "finance");
      const repayment = await call("donor", "/v2/entries", {
        kind: "repayment",
        data: {
          loanId: loan.body.id,
          amount: 1000,
          date: "2026-11-04",
          bankReference: "TEST-REPAY",
        },
      });
      assert.equal(repayment.status, 201);
      await assign(repayment.body.id, "finance");
      assert.equal(
        (await update("finance", repayment.body.id, "confirmed")).status,
        200,
      );
      const summary = (
        await call("donor", "/v2/loan-summary?id=" + loan.body.id)
      ).body;
      assert.equal(summary.balance, 4000);
      assert.equal(summary.schedule.length, 5);
      assert.equal(summary.repaid, 1000);
      const extra = await call("donor", "/v2/entries", {
        kind: "repayment",
        data: {
          loanId: loan.body.id,
          amount: 4500,
          date: "2026-11-04",
          bankReference: "TEST-EXCESS",
        },
      });
      await assign(extra.body.id, "finance");
      assert.equal(
        (await update("finance", extra.body.id, "confirmed")).status,
        409,
      );
    },
  );
});
