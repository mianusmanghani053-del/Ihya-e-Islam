export async function loadOverview(db, user, audit) {
  const now = new Date();
  let year, yearOf, calendar;
  try {
    const format = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      year: "numeric",
      timeZone: "Asia/Karachi",
    });
    yearOf = (date) =>
      format.formatToParts(date).find((p) => p.type === "year").value;
    year = yearOf(now);
    calendar = "Hijri";
  } catch {
    yearOf = (date) => String(date.getUTCFullYear());
    year = yearOf(now);
    calendar = "Gregorian";
  }
  const currentYear = (value) => {
    const date = new Date(
      /^\d{4}-\d\d-\d\d \d/.test(value) ? value.replace(" ", "T") + "Z" : value,
    );
    return !Number.isNaN(+date) && yearOf(date) === year;
  };
  const rows = (
    await db
      .prepare(
        "SELECT id,kind,data,status,created_at FROM records WHERE user_id=? AND kind IN ('donation','volunteer') ORDER BY created_at DESC,id DESC",
      )
      .bind(user.id)
      .all()
  ).results.map((r) => ({ ...r, data: JSON.parse(r.data) }));
  const totals = {};
  let receipts = 0;
  for (const r of rows) {
    if (
      r.kind === "donation" &&
      r.status === "confirmed" &&
      currentYear(r.created_at)
    ) {
      totals[r.data.currency] =
        (totals[r.data.currency] || 0) + Number(r.data.amount);
      receipts++;
    }
  }
  const monthly = rows.filter(
    (r) =>
      r.kind === "donation" &&
      r.data.frequency === "month" &&
      r.status !== "cancelled",
  );
  const pledgeTotals = {};
  for (const r of monthly)
    if (!r.data.pledgePaused)
      pledgeTotals[r.data.currency] =
        (pledgeTotals[r.data.currency] || 0) +
        Number(r.data.pledgeAmount || r.data.giftAmount || r.data.amount);
  const duties = (
    await db
      .prepare(
        "SELECT data,created_at FROM service_entries WHERE owner_id=? AND kind='duty' AND status='confirmed'",
      )
      .bind(user.id)
      .all()
  ).results;
  const hours = duties.reduce((sum, r) => {
    const d = JSON.parse(r.data);
    return (
      sum +
      (currentYear(d.date || r.created_at) ? Number(d.confirmedHours || 0) : 0)
    );
  }, 0);
  const enrolled = (
    await db
      .prepare(
        "SELECT r.id,r.kind,r.data,r.active,e.progress FROM enrollments e JOIN resources r ON r.id=e.resource_id WHERE e.user_id=?",
      )
      .bind(user.id)
      .all()
  ).results.map((r) => ({ ...r, data: JSON.parse(r.data) }));
  const courses = enrolled.filter((r) => r.kind === "course");
  const course =
    courses.find((r) => r.data.title.toLowerCase().includes("seerah")) ||
    courses[0];
  let learning = {
    enrolled: false,
    courseId: null,
    title: "Seerah School",
    percentage: 0,
    completed: 0,
    total: 0,
  };
  if (course) {
    const total = course.data.lessons?.length || 0,
      completed = Math.min(total, Math.max(0, Number(course.progress || 0)));
    learning = {
      enrolled: true,
      courseId: course.id,
      title: course.data.title,
      percentage: total ? Math.round((completed / total) * 100) : 0,
      completed,
      total,
    };
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const shifts = enrolled
    .filter(
      (r) =>
        r.kind === "shift" &&
        r.active &&
        String(r.data.date || "").slice(0, 10) >= today,
    )
    .sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)));
  const next = shifts[0];
  const r = await db
    .prepare(
      "SELECT r.id,r.data,r.status,r.created_at,m.authority,m.authority_reference FROM records r LEFT JOIN legacy_report_meta m ON m.record_id=r.id WHERE r.user_id=? AND r.kind='report' ORDER BY r.created_at DESC,r.id DESC LIMIT 1",
    )
    .bind(user.id)
    .first();
  let report = null;
  if (r) {
    await audit(db, user.id, "case.view", r.id);
    const history = (
      await db
        .prepare(
          "SELECT details FROM audit_events WHERE entity_id=? AND action='report.status' ORDER BY id",
        )
        .bind(r.id)
        .all()
    ).results;
    const observed = new Set([
      "received",
      r.status,
      ...history.map((e) => JSON.parse(e.details).status),
    ]);
    report = {
      id: r.id,
      category: JSON.parse(r.data).category,
      status: r.status,
      createdAt: r.created_at,
      authority: r.authority || "",
      authorityReference: r.authority_reference || "",
      stages: ["received", "checked", "forwarded", "closed"].map((key) => ({
        key,
        done: observed.has(key),
      })),
    };
  }
  return {
    period: {
      year,
      calendar,
      label: year + (calendar === "Hijri" ? " AH" : ""),
    },
    donations: {
      totals,
      receipts,
      pending: rows.filter(
        (r) => r.kind === "donation" && r.status === "awaiting_transfer",
      ).length,
    },
    pledges: {
      totals: pledgeTotals,
      active: monthly.filter((r) => !r.data.pledgePaused).length,
      paused: monthly.filter((r) => r.data.pledgePaused).length,
    },
    volunteering: {
      hours,
      applications: rows.filter((r) => r.kind === "volunteer").length,
    },
    learning,
    nextShift: next
      ? {
          id: next.id,
          title: next.data.title,
          date: next.data.date,
          location: next.data.location,
          hours: next.data.hours || null,
        }
      : null,
    report,
  };
}
