import { installAudioQuran } from "./audio-quran.mjs?v=audio-quran-1";
import { installBukhari } from "./bukhari.mjs";
import { installContact } from "./contact.mjs?v=contact-form-2";
import { installImpact } from "./impact.mjs";
import { installSeerah } from "./seerah.mjs";
import { WORKFLOWS, GROUPS, STAFF_ROLES } from "./workflows.mjs";
import { digitalSolutionsPage } from "./solutions.mjs?v=contact-form-2";
import { renderPortalOverview, clearOverview } from "./overview.mjs";
import { installNavigation } from "./navigation.mjs";
window.renderPortalOverview = renderPortalOverview;
window.invalidatePortalOverview = clearOverview;
V["digital-solutions"] = digitalSolutionsPage;
let context = null,
  contextUser = null,
  serviceRows = {},
  serviceErrors = {},
  communityRows = null,
  queue = null,
  staffError = "",
  staffUsers = [],
  payments = [],
  donationRows = [],
  credentials = [];
const safe = esc;
const button = (key, label, value = "") =>
  `<button type="button" class="btn sm" data-platform="${key}" data-value="${safe(value)}">${safe(label)}</button>`;
const staffRole = (needed) =>
  context?.roles?.some((r) => ["admin", "chairman", ...needed].includes(r));
const block = (title, body) =>
  `<section class="sec"><div class="wrap"><div class="sh"><div><span class="eyebrow">Ihya-e-Islam portal</span><h2>${safe(title)}</h2></div><a class="btn sm" href="#hub">All services</a></div>${body}</div></section>`;
function input(f, value = "") {
  const name = f.name,
    label = safe(f.label);
  value = value ?? "";
  if (f.type === "checkbox")
    return `<label class="service-check"><input type="checkbox" name="${name}" ${value === true ? "checked" : ""}> ${label}</label>`;
  const content =
    f.type === "textarea"
      ? `<textarea name="${name}" ${f.required ? "required" : ""}>${safe(value)}</textarea>`
      : f.options
        ? `<select name="${name}" ${f.required ? "required" : ""}>${f.options.map((o) => `<option ${String(value) === o ? "selected" : ""}>${safe(o)}</option>`).join("")}</select>`
        : `<input name="${name}" type="${f.type}" value="${safe(value)}" ${f.required ? "required" : ""} ${f.type === "number" ? 'min="0" step="any"' : ""}>`;
  return `<label class="service-field">${label}${content}</label>`;
}
function values(form, fields) {
  const data = {};
  for (const f of fields || []) {
    const control = form.elements.namedItem(f.name);
    if (!control) continue;
    data[f.name] =
      f.type === "checkbox"
        ? control.checked
        : f.type === "number" && control.value !== ""
          ? Number(control.value)
          : control.value;
  }
  return data;
}
async function ensureContext() {
  if (!member) {
    context = null;
    contextUser = null;
    return;
  }
  if (contextUser === member.id && context) return;
  context = await api("/v2/context");
  contextUser = member.id;
}
function requireMember() {
  return member
    ? null
    : block(
        "Sign in to continue",
        `<div class="card"><p>Your personal services are saved to your account.</p><a class="btn em" href="#portal">Sign in</a> <a class="btn" href="#register">Create account</a></div>`,
      );
}
async function loadService(kind) {
  try {
    await ensureContext();
    serviceRows[kind] = (await api("/v2/entries?kind=" + kind)).items;
    serviceErrors[kind] = "";
  } catch (e) {
    serviceErrors[kind] = e.message;
    serviceRows[kind] = [];
  }
  if (S.view === "services/" + kind) go();
}
function recordDetails(row) {
  return `<dl class="record-details">${Object.entries(row.data)
    .filter(([key]) => !["trackingHash", "attachments"].includes(key))
    .map(([key, value]) => {
      const f = [
        ...(WORKFLOWS[row.kind]?.fields || []),
        ...(WORKFLOWS[row.kind]?.staffFields || []),
      ].find((x) => x.name === key);
      return `<div><dt>${safe(f?.label || key.replace(/([A-Z])/g, " $1"))}</dt><dd>${safe(typeof value === "object" ? JSON.stringify(value) : typeof value === "boolean" ? (value ? "Yes" : "No") : value)}</dd></div>`;
    })
    .join("")}</dl>`;
}
function serviceView(kind) {
  const w = WORKFLOWS[kind];
  const signedOut = requireMember();
  if (signedOut) return signedOut;
  if (!context || contextUser !== member.id) {
    ensureContext()
      .then(() => {
        if (S.view === "services/" + kind) go();
      })
      .catch((e) => toast(e.message));
    return block(w.title, empty("Loading permissions…"));
  }
  if (!serviceRows[kind]) {
    loadService(kind);
    return block(w.title, empty("Loading saved records…"));
  }
  const canCreate = !w.staffCreate || staffRole(w.staffCreate);
  return block(
    w.title,
    `<p class="note">${w.private ? "Private to you. Staff cannot open these records." : w.sensitive ? "Personal details and documents are restricted to you and assigned case handlers. Case views are logged." : w.unit ? "Messages are visible only within your verified city, unit and wing." : w.public ? "Public listings appear only after staff approval." : "Your records and updates are saved to your member account."}</p>${serviceErrors[kind] ? empty(serviceErrors[kind]) : ""}${canCreate ? `<details class="card service-create"><summary>Add ${safe(w.title.toLowerCase())}</summary><form class="service-form" data-platform-form="create" data-kind="${kind}">${w.staffCreate ? `<label class="service-field">Member ID (leave blank for yourself)<input name="ownerId"></label>` : ""}${w.fields.map((f) => input(f)).join("")}${w.public ? '<label class="service-check"><input name="publicConsent" type="checkbox" required> I consent to publication of the contact instructions entered in this listing after review.</label>' : ""}<p class="err" role="alert"></p><button class="btn em">Save record</button></form></details>` : ""}<div class="service-list">${serviceRows[kind].map((r) => `<article class="card"><div class="service-heading"><h3>${safe(w.title)}</h3><span class="tag m">${safe(r.status.replaceAll("_", " "))}</span></div><p class="small">Reference: ${safe(r.id)}</p>${recordDetails(r)}<div class="service-actions">${button("open", "Open record", r.id)}${["dedication"].includes(kind) ? button("dedication", "Print dedication certificate", r.id) : ""}${kind === "loan" ? button("loan-summary", "Repayments & balance", r.id) : ""}${kind === "volunteer_id" && r.status === "verified" ? button("volunteer-card", "Issue / print QR ID", r.id) : ""}${kind === "callout" ? button("respond", "Available", r.id + "|available") + button("respond", "Not available", r.id + "|not_available") : ""}</div></article>`).join("") || empty("No records yet. Add a record above or wait for the team to share an update.")}</div>`,
  );
}
V.hub = () => {
  if (!member) return requireMember();
  ensureContext()
    .then(() => {
      if (
        S.view === "hub" &&
        document.querySelector("[data-context-ready]")?.dataset.contextReady !==
          "yes"
      )
        go();
    })
    .catch((e) => toast(e.message));
  return block(
    "Your services",
    `<div data-context-ready="${context ? "yes" : ""}"></div><div class="service-actions"><a class="btn em" href="#donation-tracking">Track & confirm donations</a><a class="btn" href="#notifications">Alerts & reminders</a><a class="btn" href="#credentials">My verified credentials</a><a class="btn" href="#unit-profile">Unit & blood profile</a><a class="btn" href="#community">Community</a><a class="btn" href="#tools">Islamic tools</a><a class="btn" href="#transparency">Transparency</a>${context?.staff ? '<a class="btn" href="#staff">Staff portal</a>' : ""}</div>${Object.entries(
      GROUPS,
    )
      .filter(([key]) => key !== "staff" || context?.staff)
      .map(
        ([key, title]) =>
          `<h3 class="service-group-title">${title}</h3><div class="grid g3">${Object.entries(
            WORKFLOWS,
          )
            .filter(([, w]) => w.group === key)
            .map(
              ([kind, w]) =>
                `<a class="card service-link" href="#services/${kind}"><h3>${safe(w.title)}</h3><p>${w.private ? "Private personal records" : w.sensitive ? "Confidential case workflow" : w.staffCreate ? "Updates from the trust" : "Manage your activity"} →</p></a>`,
            )
            .join("")}</div>`,
      )
      .join(
        "",
      )}<div class="card" style="margin-top:24px"><h3>Yearly tax certificate</h3><p>Available once the trust has verified tax exemption.</p><form data-platform-form="tax" class="service-form"><label>Year<input name="year" type="number" min="2020" max="2100" value="${new Date().getFullYear()}" required></label><p class="err"></p><button class="btn">Generate yearly certificate</button></form></div>`,
  );
};
for (const key of Object.keys(WORKFLOWS))
  V["services/" + key] = () => serviceView(key);
async function openRecord(eid) {
  const result = await api("/v2/entry/" + eid),
    r = result.item,
    w = WORKFLOWS[r.kind];
  await ensureContext();
  const own = r.owner_id === member.id;
  const editable =
    (own && (w.private || ["hifz", "seasonal"].includes(r.kind))) ||
    staffRole(w.edit || w.staffCreate || ["trustee"]);
  const fields =
    own && (w.private || ["hifz", "seasonal"].includes(r.kind))
      ? w.fields
      : [...(w.staffCreate ? w.fields : []), ...(w.staffFields || [])];
  const content = `${recordDetails(r)}${editable ? `<form class="service-form" data-platform-form="update" data-id="${r.id}" data-kind="${r.kind}" data-version="${r.version}">${fields.map((f) => input({ ...f, required: false }, r.data[f.name])).join("")}${own && (w.private || ["hifz", "seasonal"].includes(r.kind)) ? "" : `<label>Status<select name="status">${w.states.map((s) => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>`}<p class="err"></p><button class="btn em">Save update</button></form>` : ""}<h4>Private documents & reports</h4><div>${result.files.map((f) => `<a class="btn sm" href="/api/v2/files/${f.id}">Download ${safe(f.mime)}</a>`).join("") || "<p>No documents attached.</p>"}</div>${context.uploads ? `<form data-platform-form="upload" data-id="${r.id}" class="service-form"><label>Attach a private document or project photo (5 MB maximum)<input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><p class="err"></p><button class="btn">Upload privately</button></form>` : empty("Private file storage is awaiting Cloudflare R2 activation; records can be saved now.")}<details><summary>Record history</summary>${result.events.map((e) => `<p>${safe(e.created_at)} · ${safe(e.action)}</p>`).join("")}</details>`;
  openMd(safe(w.title), content);
}
let trackingRows = null;
V["donation-tracking"] = () => {
  if (!member) return requireMember();
  if (!trackingRows) {
    api("/v2/donation-tracking")
      .then((r) => {
        trackingRows = r.items;
        if (S.view === "donation-tracking") go();
      })
      .catch((e) => toast(e.message));
    return block("Track & confirm donations", empty("Loading allocations…"));
  }
  return block(
    "Track & confirm donations",
    `<p class="note">Each allocation is linked to your confirmed donation. Recipient names, general areas and phone numbers appear only when written consent has been recorded. Exact addresses and children’s locations are never public.</p><div class="service-list">${trackingRows.map((r) => `<article class="card"><span class="eyebrow">${safe(r.currency)} ${safe(r.amount)}</span><h3>${safe(r.purpose)}</h3><p>Donation ${safe(r.donationId)}</p><p>Case status: <b>${safe(r.status)}</b> · Payment: <b>${safe(r.paymentStatus)}</b></p><dl class="record-details"><div><dt>Recipient reference</dt><dd>${safe(r.recipient.reference)}</dd></div>${["name", "location", "phone"].map((k) => (r.recipient[k] ? `<div><dt>${k}</dt><dd>${safe(r.recipient[k])}</dd></div>` : "")).join("")}</dl>${!r.recipient.name ? "<p>Identifying details are withheld because consent has not been recorded.</p>" : ""}</article>`).join("") || empty("No allocations have been recorded against your donations yet. Your confirmed receipts remain in the Donations tab.")}</div>`,
  );
};
let alerts = null;
V.notifications = () => {
  if (!member) return requireMember();
  if (!alerts) {
    api("/v2/notifications")
      .then((r) => {
        alerts = r.items;
        if (S.view === "notifications") go();
      })
      .catch((e) => toast(e.message));
    return block("Alerts & reminders", empty("Loading…"));
  }
  return block(
    "Alerts & reminders",
    `<p>Reminders are shown here. External email/SMS delivery is not configured.</p><div class="service-list">${alerts.map((n) => `<div class="card"><h3>${safe(n.title)}</h3><a class="btn sm" href="${safe(n.link)}">Open</a>${n.read_at ? "" : button("read-alert", "Mark read", n.id)}</div>`).join("") || empty("You have no alerts.")}</div>`,
  );
};
V["unit-profile"] = () => {
  if (!member) return requireMember();
  if (!context) {
    ensureContext().then(() => go());
    return empty("Loading…");
  }
  const p = context.profile || {};
  return block(
    "Unit & blood profile",
    `<div class="card"><p>Unit chat and call-outs require coordinator verification. Your blood group is used to show matching local requests.</p><form class="service-form" data-platform-form="profile">${input({ name: "unit", label: "Unit", type: "text", required: true }, p.unit_id)}${input({ name: "city", label: "City", type: "text", required: true }, p.city)}${input({ name: "wing", label: "Wing", options: ["brothers", "sisters"] }, p.wing)}${input({ name: "bloodGroup", label: "Blood group (optional)", options: ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] }, p.blood_group)}<p>Status: ${p.verified ? "Verified" : "Awaiting coordinator verification"}</p><p class="err"></p><button class="btn em">Save profile</button></form></div>`,
  );
};
async function printDocument(title, lines, verifyId) {
  const content = `<div class="print-certificate"><h2>Ihya-e-Islam</h2><h3>${safe(title)}</h3>${lines.map((l) => `<p>${safe(l)}</p>`).join("")}${verifyId ? `<p>Verification: ${safe(location.origin + "/#verify/" + verifyId)}</p><canvas id="credential-qr"></canvas>` : ""}</div>${button("print", "Print / save as PDF")}`;
  openMd(safe(title), content);
  if (verifyId)
    await window.PortalQR.toCanvas(
      document.getElementById("credential-qr"),
      location.origin + "/#verify/" + verifyId,
      { width: 180, margin: 1 },
    );
}
V.credentials = () => {
  if (!member) return requireMember();
  api("/v2/credentials")
    .then((r) => {
      credentials = r.items;
      const host = document.getElementById("credential-list");
      if (host)
        host.innerHTML =
          credentials
            .map(
              (c) =>
                `<div class="card"><h3>${safe(c.kind === "course" ? c.details.course : "Volunteer ID")}</h3><p>${safe(c.id)}</p>${button("print-credential", "Print verified credential", c.id)}</div>`,
            )
            .join("") || empty("No credentials issued yet.");
    })
    .catch((e) => toast(e.message));
  return block(
    "Verified credentials",
    `<p>Issue a volunteer QR card from your verified ID record, or issue a course certificate after completion.</p><div class="service-list" id="credential-list"></div><div class="card"><form class="service-form" data-platform-form="course-credential"><label>Completed course<select name="courseId">${enrollments
      .filter((e) => e.kind === "course" && e.progress >= e.data.lessons.length)
      .map((e) => `<option value="${e.id}">${safe(e.data.title)}</option>`)
      .join(
        "",
      )}</select></label><label><input name="consent" type="checkbox" required> I agree that my name and course completion can be verified through the QR link.</label><p class="err"></p><button class="btn em">Issue verified certificate</button></form></div>`,
  );
};
async function verifyCredential(token) {
  try {
    const c = await api("/v2/verify/" + encodeURIComponent(token));
    return block(
      "Credential verification",
      `<div class="card"><span class="tag ${c.valid ? "z" : "r"}">${c.valid ? "Valid" : "Expired or revoked"}</span><h3>${safe(c.displayName)}</h3>${Object.entries(
        c.details,
      )
        .map(([k, v]) => `<p>${safe(k)}: ${safe(v)}</p>`)
        .join(
          "",
        )}${c.expires ? `<p>Expires: ${safe(c.expires)}</p>` : ""}</div>`,
    );
  } catch (e) {
    return block("Credential verification", empty(e.message));
  }
}
let verifyResult = "";
function verificationRoute() {
  const token = location.hash.slice("#verify/".length);
  if (!verifyResult) {
    verifyCredential(token).then((html) => {
      if (location.hash !== "#verify/" + token) return;
      verifyResult = html;
      go();
    });
    return empty("Checking credential…");
  }
  return verifyResult;
}
// Register token-bearing verification routes as hash changes arrive, before the original router renders.
window.addEventListener("hashchange", () => {
  if (location.hash.startsWith("#verify/")) {
    verifyResult = "";
    V[location.hash.slice(1)] = verificationRoute;
    route();
  }
});
if (location.hash.startsWith("#verify/"))
  V[location.hash.slice(1)] = verificationRoute;
V.community = () => {
  if (!communityRows) {
    api("/v2/public")
      .then((r) => {
        communityRows = r.items;
        if (S.view === "community") go();
      })
      .catch((e) => toast(e.message));
    return block("Community noticeboard", empty("Loading reviewed notices…"));
  }
  return block(
    "Community noticeboard",
    `<div class="service-actions"><a class="btn" href="#tools">Islamic tools</a><a class="btn" href="#support-line">Confidential support</a><a class="btn" href="#services/blood">Request blood</a><a class="btn" href="#services/lost_found">Lost & found</a><a class="btn" href="#services/nikah">Nikah registration</a><a class="btn" href="#services/mediation">Mediation booking</a></div><div class="grid g2">${communityRows.map((r) => `<article class="card"><span class="eyebrow">${safe(WORKFLOWS[r.kind]?.title || r.kind)}</span><h3>${safe(r.data.title || r.data.name || r.data.question || r.data.bloodGroup + " blood request")}</h3>${recordDetails(r)}${["blood", "job"].includes(r.kind) ? button("respond", "I can help / interested", r.id + "|interested") : ""}</article>`).join("") || empty("Reviewed listings will appear here when published.")}</div>`,
  );
};
let spending = null;
V.transparency = () => {
  if (!spending) {
    api("/v2/transparency")
      .then((r) => {
        spending = r.items;
        if (S.view === "transparency") go();
      })
      .catch((e) => toast(e.message));
    return block(
      "Monthly fund transparency",
      empty("Loading verified spending…"),
    );
  }
  return block(
    "Monthly fund transparency",
    `<p>Only bank-referenced payments with the required independent approvals are included. Zakat and general funds are reported separately. No beneficiary identities are published.</p><div class="card"><div class="tw"><table><thead><tr><th>Month</th><th>Fund</th><th>Currency</th><th>Spent</th><th>Payments</th></tr></thead><tbody>${spending.map((r) => `<tr><td>${safe(r.month)}</td><td>${safe(r.fund)}</td><td>${safe(r.currency)}</td><td>${safe(r.amount)}</td><td>${r.payments}</td></tr>`).join("")}</tbody></table></div>${!spending.length ? empty("No completed payments have been recorded yet.") : ""}</div>`,
  );
};
V["support-line"] = () =>
  block(
    "Confidential Karamat support",
    `<div class="grid g2"><div class="card"><h3>Ask for help privately</h3><p>This request is not linked to a portal account. A safe contact is optional. Keep the private key to check the team’s reply. In an emergency, contact local emergency services.</p><form class="service-form" data-platform-form="support"><label>How can we help?<textarea name="message" required maxlength="12000"></textarea></label><label>Safe contact method (optional)<input name="safeContact"></label><p class="err"></p><button class="btn em">Send confidential request</button></form></div><div class="card"><h3>Check a private reply</h3><form class="service-form" data-platform-form="support-track"><label>Request reference<input name="id" required></label><label>Private key<input name="secret" required></label><p class="err"></p><button class="btn">Check reply</button><div id="support-result"></div></form></div></div>`,
  );
const cities = {
  Karachi: [24.8607, 67.0011],
  Lahore: [31.5204, 74.3587],
  Islamabad: [33.6844, 73.0479],
  Peshawar: [34.0151, 71.5249],
  Quetta: [30.1798, 66.975],
  Multan: [30.1575, 71.5249],
};
V.tools = () =>
  block(
    "Islamic tools",
    `<div class="grid g2"><div class="card"><h3>Prayer times & qibla</h3><form class="service-form" data-platform-form="prayer"><label>City<select name="city">${Object.keys(
      cities,
    )
      .map((c) => `<option>${c}</option>`)
      .join(
        "",
      )}</select></label><label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label><label>Calculation method<select name="method"><option value="Karachi">University of Islamic Sciences, Karachi</option><option value="MuslimWorldLeague">Muslim World League</option></select></label><label>Asr method<select name="madhab"><option value="Hanafi">Hanafi</option><option value="Shafi">Standard</option></select></label><p class="err"></p><button class="btn em">Calculate</button><div id="prayer-result"></div></form><p class="note">Times are calculated locally for the city centre in Asia/Karachi. Follow your local mosque for congregation times and moon-sighting dates.</p></div><div class="card"><h3>Hijri calendar</h3><p class="ar">${safe(new Intl.DateTimeFormat("ur-PK-u-ca-islamic", { dateStyle: "full" }).format(new Date()))}</p><p>Hijri dates are calculated estimates and may differ from local moon sighting.</p><h3>Ramadan timetable</h3><p>Select a date in Ramadan and calculate the city timetable. The tool shows Fajr (fast begins) and Maghrib (iftar), plus a printable 30-day schedule from the selected date.</p><a class="btn" href="#community">Partner mosques & community listings</a></div></div>`,
  );
const legacyPortalView = portalView;
portalView = () =>
  legacyPortalView().replace(
    '<div class="pl">',
    '<nav class="portal-toolbar" aria-label="Portal shortcuts"><a class="btn" href="#donation-tracking">Track donations</a><a class="btn" href="#notifications">Alerts & reminders</a><a class="btn" href="#community">Community</a><a class="btn" href="#tools">Islamic tools</a><a class="btn" href="#transparency">Transparency</a><a class="btn" href="#route-map">Route map</a><a class="btn portal-all-services" href="#hub">All Services</a></nav><div class="pl">',
  );
const originalAdmin = V.admin;
let managed = null,
  managedError = "";
window.reloadManagedResources = async () => {
  try {
    managed = (await api("/resources?manage=1")).items;
    window.managedResources = managed;
    managedError = "";
  } catch (e) {
    managedError = e.message;
  }
  if (S.view === "content-tools") go();
};
const TRAININGS = [
  "First aid",
  "Fire safety",
  "Child safeguarding",
  "Reporting without confronting",
];
function resourceForm(r) {
  const d = r?.data || {};
  const kind = r?.kind || "event";
  const local = d.date
    ? new Date(
        new Date(d.date).getTime() -
          new Date(d.date).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
  const lessons = d.lessons?.length ? d.lessons : [{ title: "", body: "" }];
  return `<div class="card manage-form"><h3>${r ? "Edit: " + safe(d.title) : "Add a new event, shift or course"}</h3><form class="service-form" data-live-form="resource">${r ? `<input type="hidden" name="id" value="${safe(r.id)}"><input type="hidden" name="kind" value="${safe(kind)}"><p class="note">Type: ${safe(kind)}. To change the type, remove this and add a new one.</p>` : `<label>Type<select name="kind" id="kind"><option value="event">Event</option><option value="shift">Volunteer shift</option><option value="course">Course</option></select></label>`}<label>Title<input name="title" id="title" required maxlength="200" value="${safe(d.title || "")}"></label><label>Description<textarea name="description" id="description" required maxlength="3000" rows="3">${safe(d.description || "")}</textarea></label>${kind === "course" && r ? "" : `<label>Date and time<input name="date" type="datetime-local" value="${local}"></label><label>Location<input name="location" maxlength="300" value="${safe(d.location || "")}"></label><label>Required training (shifts)<select name="requiredTraining"><option></option>${TRAININGS.map((t) => `<option ${d.requiredTraining === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>`}${kind === "course" || !r ? `<div id="lesson-fields">${lessons.map((l) => `<label>Lesson title<input name="lessonTitle" value="${safe(l.title)}"></label><label>Lesson content<textarea name="lessonBody">${safe(l.body)}</textarea></label>`).join("")}</div><button type="button" class="btn" data-live="add-lesson">Add another lesson</button>` : ""}<p class="err"></p><div class="service-actions"><button class="btn em">${r ? "Save changes" : "Publish"}</button>${r ? '<button type="button" class="btn" data-live="cancel-edit">Cancel</button>' : ""}</div></form>${r ? "" : '<p class="note">Events and shifts need a date and location. Courses need at least one lesson.</p>'}</div>`;
}
function managedCard(r) {
  const d = r.data;
  return `<div class="card manage-item${r.active ? "" : " removed"}"><div class="service-actions" style="margin:0 0 6px"><span class="tag m">${safe(r.kind)}</span>${r.active ? '<span class="tag s">Live</span>' : '<span class="tag r">Removed</span>'}<span class="tag">${r.enrolled} registered</span></div><h3>${safe(d.title)}</h3>${d.date ? `<p>${safe(new Date(d.date).toLocaleString("en-PK"))}${d.location ? " · " + safe(d.location) : ""}</p>` : ""}${d.lessons ? `<p>${d.lessons.length} lesson${d.lessons.length === 1 ? "" : "s"}</p>` : ""}<div class="service-actions"><button type="button" class="btn sm" data-live="edit-resource" data-value="${safe(r.id)}">Edit</button>${r.active ? `<button type="button" class="btn sm" data-live="archive" data-value="${safe(r.id)}">Remove</button>` : `<button type="button" class="btn sm em" data-live="restore-resource" data-value="${safe(r.id)}">Restore</button>`}</div></div>`;
}
V["content-tools"] = () => {
  if (!member) return requireMember();
  if (!context) {
    ensureContext().then(() => go());
    return empty("Loading permissions…");
  }
  if (!staffRole(["scholar", "city_coordinator"]))
    return empty("Content publisher access required.");
  if (managedError)
    return block("Manage events & courses", empty(managedError));
  if (!managed) {
    window.reloadManagedResources();
    return block("Manage events & courses", empty("Loading activities…"));
  }
  const editing = managed.find((r) => r.id === window.editingResource);
  const live = managed.filter((r) => r.active),
    removed = managed.filter((r) => !r.active);
  return block(
    "Manage events & courses",
    `<p><a class="btn sm" href="#staff">← Staff portal</a></p>${resourceForm(editing)}<h3 style="margin:24px 0 10px">On the website (${live.length})</h3><div class="grid g2">${live.map(managedCard).join("") || empty("Nothing published yet. Add your first event above.")}</div>${removed.length ? `<h3 style="margin:24px 0 10px">Removed (${removed.length})</h3><div class="grid g2">${removed.map(managedCard).join("")}</div>` : ""}`,
  );
};
V.submissions = () =>
  originalAdmin().replace(
    "<h2>Administration</h2>",
    '<p><a class="btn sm" href="#staff">← Staff portal</a></p><h2>Website submissions</h2>',
  );
async function loadStaff() {
  await ensureContext();
  if (!context.staff) throw new Error("Staff access required.");
  queue = await api("/v2/staff/queue");
  if (staffRole(["trustee", "city_coordinator"]))
    staffUsers = (await api("/v2/staff/users")).items;
  if (staffRole(["finance", "trustee"])) {
    payments = (await api("/v2/payments")).items;
    donationRows = (await api("/v2/staff/donations")).items;
  }
  if (S.view === "staff" || S.view === "admin") go();
}
const userSelect = (name = "userId") =>
  `<label class="service-field">Member<select name="${name}">${staffUsers.map((u) => `<option value="${u.id}">${safe(u.name)} — ${u.email ? safe(u.email) : "Member " + safe(u.id.slice(0, 8))}</option>`).join("")}</select></label>`;
V.staff = () => {
  if (!member) return requireMember();
  if (staffError) return block("Staff portal", empty(staffError));
  if (!queue) {
    loadStaff().catch((e) => {
      staffError = e.message;
      if (["staff", "admin"].includes(S.view)) go();
    });
    return block("Staff portal", empty("Loading your staff workspace…"));
  }
  return block(
    "Staff portal",
    `<p class="note">Staff member reference: ${safe(member.id)}. Case contents require assignment; opening a case is logged.</p><div class="service-actions">${staffRole(["trustee"]) ? '<a class="btn gold" href="#decision-bench">Decision Bench · Suggestions</a>' : ""}<a class="btn" href="#services/article">Reviewed publishing</a><a class="btn" href="#services/volunteer_review">Volunteer checks</a><a class="btn" href="#services/callout">Emergency call-out</a><a class="btn" href="#services/training">Training & badges</a>${staffRole(["scholar", "city_coordinator"]) ? '<a class="btn gold" href="#content-tools">Manage events & courses</a>' : ""}${staffRole([]) ? '<a class="btn" href="#submissions">Website submissions</a>' : ""}</div>${staffRole(["trustee", "city_coordinator"]) ? `<details class="card"><summary>Roles, assignments & unit verification</summary><div class="grid g2"><form class="service-form" data-platform-form="assign"><h3>Assign a case handler</h3>${userSelect()}<label>Case / report reference<input name="caseId" required></label><p class="err"></p><button class="btn">Assign handler</button></form><form class="service-form" data-platform-form="verify-unit"><h3>Verify unit membership</h3>${userSelect()}<label><input name="verified" type="checkbox"> Verified city, unit and wing</label><p class="err"></p><button class="btn">Save verification</button></form>${staffRole(["trustee"]) ? `<form class="service-form" data-platform-form="role"><h3>Staff roles</h3>${userSelect()}<label>Role<select name="role">${STAFF_ROLES.map((r) => `<option>${r}</option>`).join("")}</select></label><label><input type="checkbox" name="remove"> Remove role</label><p class="err"></p><button class="btn">Save role</button></form><form class="service-form" data-platform-form="settings"><h3>Trust settings</h3><label>Two-approver threshold (Rs)<input name="paymentThreshold" type="number" min="1" value="${context.paymentThreshold}" required></label><label><input type="checkbox" name="taxExempt" ${context.taxExempt ? "checked" : ""}> Trust has verified tax-exempt status</label><label>Tax registration reference<input name="taxRegistration"></label><p class="err"></p><button class="btn">Save settings</button></form>` : ""}</div></details>` : ""}<h3 class="service-group-title">Case review queues</h3><div class="card"><div class="tw"><table><thead><tr><th>Reference</th><th>Service</th><th>Status</th><th>Action</th></tr></thead><tbody>${[...queue.items, ...queue.reports, ...(queue.support || []).map((r) => ({ ...r, kind: "anonymous_support" }))].map((r) => `<tr><td>${safe(r.id)}</td><td>${safe(WORKFLOWS[r.kind]?.title || r.kind)}</td><td>${safe(r.status)}</td><td>${button(r.kind === "report" ? "report" : r.kind === "anonymous_support" ? "support-case" : "open", "Open assigned case", r.id)}</td></tr>`).join("")}</tbody></table></div></div>${staffRole(["finance", "trustee"]) ? financeView() : ""}${staffRole(["trustee"]) ? button("audit", "View access & change audit") : ""}`,
  );
};
const staffContactBase = V.staff;
V.staff = () =>
  staffContactBase() +
  (member && staffRole(["trustee", "city_coordinator"])
    ? '<section class="sec"><div class="wrap"><a class="btn" href="#contact-inbox">Contact enquiries inbox →</a></div></section>'
    : "");
V.admin = V.staff;
function financeView() {
  return `<h3 class="service-group-title">Finance & reconciliation</h3><div class="grid g2"><div class="card"><h3>Request an outgoing payment</h3><form class="service-form" data-platform-form="payment"><label>Approved help case reference (optional)<input name="caseId"></label><label>Amount (Rs)<input type="number" name="amount" min="0.01" step="0.01" required></label><label>Fund<select name="fund"><option value="general">General</option><option value="zakat">Zakat</option></select></label><label>Purpose (no personal details)<input name="purpose" required></label><p class="err"></p><button class="btn em">Request payment</button></form></div><div class="card"><h3>Allocate a donor’s confirmed gift</h3><form class="service-form" data-platform-form="allocation"><label>Confirmed donation reference<input name="donationId" required></label><label>Approved case reference<input name="caseId" required></label><label>Payment reference (optional)<input name="paymentId"></label><label>Amount<input type="number" name="amount" min="0.01" step="0.01" required></label><p class="err"></p><button class="btn">Save allocation</button></form></div></div><div class="card"><h3>Outgoing payments</h3><div class="tw"><table><thead><tr><th>Payment</th><th>Fund</th><th>Amount</th><th>Approvals</th><th>Status</th><th>Actions</th></tr></thead><tbody>${payments.map((p) => `<tr><td>${safe(p.id)}<br>${safe(p.purpose)}</td><td>${safe(p.fund)}</td><td>Rs ${p.amount_paisa / 100}</td><td>${p.approvals}/${p.amount_paisa > p.threshold_paisa ? 2 : 1}</td><td>${safe(p.state)}</td><td>${p.state === "pending" ? button("approve-payment", "Approve", p.id) : p.state === "approved" ? button("paid-payment", "Record bank payment", p.id) : ""}</td></tr>`).join("")}</tbody></table></div></div><div class="card"><h3>Incoming donations</h3><div class="tw"><table><thead><tr><th>Donation</th><th>Member</th><th>Fund</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${donationRows.map((r) => `<tr><td>${safe(r.id)}</td><td>${safe(r.user_id)}</td><td>${safe(r.data.fund)}</td><td>${safe(r.data.currency)} ${r.data.amount}</td><td>${safe(r.status)}</td><td>${button("reconcile", "Reconcile transfer", r.id)}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function refreshPlatform() {
  clearOverview();
  serviceRows = {};
  serviceErrors = {};
  context = null;
  contextUser = null;
  queue = null;
  staffError = "";
  trackingRows = null;
  communityRows = null;
  alerts = null;
  spending = null;
  route();
}
async function handleAction(b) {
  const key = b.dataset.platform,
    val = b.dataset.value;
  if (key === "portal-home") {
    S.pTab = "over";
    if (location.hash === "#portal") go();
    else location.hash = "portal";
    return;
  }
  if (key === "open") return openRecord(val);
  if (key === "print") {
    window.print();
    return;
  }
  if (key === "read-alert") {
    await send("/v2/notifications", { id: val }, "PATCH");
    alerts = null;
    go();
    return;
  }
  if (key === "respond") {
    const [entryId, response] = val.split("|");
    await send("/v2/respond", { entryId, response });
    toast("Your response has been saved.");
    return;
  }
  if (key === "dedication") {
    const r = await api("/v2/entry/" + val);
    await printDocument("Donation dedication", [
      member.name,
      "Dedicated to " + r.item.data.dedicatedTo,
      r.item.data.message || "",
      "Donation reference " + r.item.data.donationId,
      "This certificate records the dedication; it does not make a claim about acceptance or reward.",
    ]);
    return;
  }
  if (key === "volunteer-card") {
    openMd(
      "Issue volunteer ID",
      `<p>Your name, city, unit and expiry will be verifiable by anyone with the QR link. Your address and phone will not be shown.</p><form class="service-form" data-platform-form="volunteer-credential" data-id="${val}"><label><input name="consent" type="checkbox" required> I consent to this limited public verification.</label><p class="err"></p><button class="btn em">Issue QR ID</button></form>`,
    );
    return;
  }
  if (key === "print-credential") {
    const c = credentials.find((x) => x.id === val);
    return printDocument(
      c.kind === "course"
        ? "Course completion certificate"
        : "Volunteer identification",
      [
        c.display_name,
        ...Object.entries(c.details).map(([k, v]) => k + ": " + v),
        ...(c.expires ? ["Valid until " + c.expires] : []),
      ],
      c.id,
    );
  }
  if (key === "loan-summary") {
    const r = await api("/v2/loan-summary?id=" + val);
    openMd(
      "Interest-free loan statement",
      `<p>Principal: Rs ${r.principal}</p><p>Confirmed repaid: Rs ${r.repaid}</p><p>Balance: Rs ${r.balance}</p><p>Next due: ${safe(r.nextDue)} · Installment: Rs ${r.installment}</p><h4>Interest-free schedule</h4><table><thead><tr><th>Due date</th><th>Installment</th></tr></thead><tbody>${(r.schedule || []).map((x) => `<tr><td>${safe(x.date)}</td><td>Rs ${x.amount}</td></tr>`).join("")}</tbody></table>`,
    );
    return;
  }
  if (key === "approve-payment") {
    await send("/v2/payment/" + val, { action: "approve" });
    refreshPlatform();
    return;
  }
  if (key === "paid-payment") {
    openMd(
      "Record bank payment",
      `<form class="service-form" data-platform-form="paid" data-id="${val}"><p>Mark this paid only after the bank transfer has completed.</p><label>Bank reference<input name="bankReference" required></label><p class="err"></p><button class="btn em">Confirm paid</button></form>`,
    );
    return;
  }
  if (key === "reconcile") {
    openMd(
      "Bank reconciliation",
      `<form class="service-form" data-platform-form="reconcile" data-id="${val}"><label>Verified bank reference<input name="bankReference" required></label><label>Status<select name="status"><option>confirmed</option><option>awaiting_transfer</option><option>cancelled</option></select></label><p class="err"></p><button class="btn em">Save reconciliation</button></form>`,
    );
    return;
  }
  if (key === "report") {
    const r = await api("/v2/staff/report/" + val);
    openMd(
      "Confidential report",
      `${recordDetails(r.item)}${(r.item.data.attachments || []).map((key) => `<a class="btn sm" href="/api/attachments/${encodeURIComponent(key)}">Download private evidence</a>`).join("")}<form class="service-form" data-platform-form="report-update" data-id="${val}"><label>Status<select name="status">${["received", "checked", "forwarded", "closed"].map((s) => `<option ${r.item.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Authority (police / FIA)<input name="authority" value="${safe(r.authority?.authority || "")}"></label><label>Official reference<input name="authorityReference" value="${safe(r.authority?.authority_reference || "")}"></label><p class="err"></p><button class="btn em">Save review</button></form>`,
    );
    return;
  }
  if (key === "support-case") {
    const r = await api("/v2/staff/support/" + val);
    openMd(
      "Confidential support",
      `<p>${safe(r.item.data.message)}</p><p>Safe contact: ${safe(r.item.data.safeContact || "None provided")}</p><form class="service-form" data-platform-form="support-reply" data-id="${val}"><label>Status<select name="status">${["received", "assigned", "supported", "closed"].map((s) => `<option ${r.item.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Private reply<textarea name="reply" required>${safe(r.item.reply || "")}</textarea></label><p class="err"></p><button class="btn">Save reply</button></form>`,
    );
    return;
  }
  if (key === "audit") {
    const r = await api("/v2/staff/audit");
    openMd(
      "Access & change audit",
      `<div class="tw"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Record</th></tr></thead><tbody>${r.items.map((e) => `<tr><td>${safe(e.created_at)}</td><td>${safe(e.actor_id)}</td><td>${safe(e.action)}</td><td>${safe(e.entity_id)}</td></tr>`).join("")}</tbody></table></div>`,
    );
  }
}
document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest("[data-platform]");
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    b.disabled = true;
    handleAction(b)
      .catch((err) => toast(err.message))
      .finally(() => (b.disabled = false));
  },
  true,
);
document.addEventListener(
  "submit",
  (e) => {
    const f = e.target;
    if (!f.dataset.platformForm) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (f.dataset.pending) return;
    f.dataset.pending = "1";
    const error = f.querySelector(".err");
    if (error) error.textContent = "";
    const submit = f.querySelector('button:not([type="button"])');
    if (submit) submit.disabled = true;
    const data = Object.fromEntries(new FormData(f)),
      kind = f.dataset.platformForm;
    (async () => {
      if (kind === "create") {
        const w = WORKFLOWS[f.dataset.kind];
        await send("/v2/entries", {
          kind: f.dataset.kind,
          ownerId: data.ownerId || undefined,
          publicConsent: f.elements.publicConsent?.checked || false,
          data: values(f, w.fields),
        });
        refreshPlatform();
        toast("Record saved.");
      } else if (kind === "update") {
        const w = WORKFLOWS[f.dataset.kind];
        const fields = [...w.fields, ...(w.staffFields || [])];
        await send(
          "/v2/entry/" + f.dataset.id,
          {
            version: Number(f.dataset.version),
            status: data.status,
            data: values(f, fields),
          },
          "PATCH",
        );
        await openRecord(f.dataset.id);
        serviceRows[f.dataset.kind] = null;
      } else if (kind === "upload") {
        const file = f.elements.file.files[0];
        if (file.size > 5 * 1024 * 1024)
          throw new Error("Choose a file smaller than 5 MB.");
        const r = await fetch("/api/v2/files/" + f.dataset.id, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!r.ok) throw new Error((await r.json()).error);
        await openRecord(f.dataset.id);
      } else if (kind === "profile") {
        await send("/v2/profile", { ...data });
        refreshPlatform();
      } else if (kind === "role") {
        await send("/v2/staff/roles", {
          ...data,
          remove: f.elements.remove.checked,
        });
        refreshPlatform();
      } else if (kind === "assign") {
        await send("/v2/staff/assign", data);
        refreshPlatform();
      } else if (kind === "verify-unit") {
        await send("/v2/staff/verify-unit", {
          ...data,
          verified: f.elements.verified.checked,
        });
        refreshPlatform();
      } else if (kind === "settings") {
        await send(
          "/v2/settings",
          { ...data, taxExempt: f.elements.taxExempt.checked },
          "PATCH",
        );
        refreshPlatform();
      } else if (kind === "payment") {
        await send("/v2/payments", data);
        refreshPlatform();
      } else if (kind === "allocation") {
        await send("/v2/allocations", data);
        refreshPlatform();
      } else if (kind === "paid") {
        await send("/v2/payment/" + f.dataset.id, { action: "paid", ...data });
        closeAll();
        refreshPlatform();
      } else if (kind === "reconcile") {
        await send(
          "/v2/staff/donations",
          { id: f.dataset.id, ...data },
          "PATCH",
        );
        closeAll();
        refreshPlatform();
      } else if (kind === "report-update") {
        await send("/v2/staff/report/" + f.dataset.id, data, "PATCH");
        closeAll();
        refreshPlatform();
      } else if (kind === "support-reply") {
        await send("/v2/staff/support/" + f.dataset.id, data, "PATCH");
        closeAll();
        refreshPlatform();
      } else if (kind === "tax") {
        const r = await api("/v2/tax?year=" + data.year);
        await printDocument("Annual tax certificate " + r.year, [
          r.name,
          "Registration " + r.registration,
          ...Object.entries(r.totals).map(([c, a]) => c + " " + a),
          ...r.receipts.map(
            (x) => x.id + " · " + x.date + " · " + x.currency + " " + x.amount,
          ),
        ]);
      } else if (
        kind === "course-credential" ||
        kind === "volunteer-credential"
      ) {
        const r = await send("/v2/credentials", {
          entryId: f.dataset.id,
          courseId: data.courseId,
          consent: f.elements.consent.checked,
        });
        credentials = (await api("/v2/credentials")).items;
        await handleAction({
          dataset: { platform: "print-credential", value: r.id },
        });
      } else if (kind === "support") {
        const r = await send("/v2/support", data);
        openMd(
          "Private support request saved",
          `<p>Request: <b>${safe(r.id)}</b></p><p>Private key: <b>${safe(r.secret)}</b></p><p>Keep both values. The key cannot be recovered, and the request is not linked to your login.</p>`,
        );
        f.reset();
      } else if (kind === "support-track") {
        const r = await send("/v2/support/track", data);
        document.getElementById("support-result").textContent =
          "Status: " +
          r.status +
          " · Reply: " +
          (r.reply || "Awaiting a case handler reply.");
      } else if (kind === "prayer") {
        const A = window.PrayerTools,
          coords = new A.Coordinates(...cities[data.city]),
          params = A.CalculationMethod[data.method]();
        params.madhab = A.Madhab[data.madhab];
        const date = new Date(data.date + "T12:00:00");
        const format = (time) =>
          time.toLocaleTimeString("en-PK", {
            timeZone: "Asia/Karachi",
            hour: "2-digit",
            minute: "2-digit",
          });
        const times = new A.PrayerTimes(coords, date, params);
        const qibla = A.Qibla(coords);
        let html = `<p><b>Qibla:</b> ${qibla.toFixed(1)}° clockwise from true north</p><p><b>Hijri:</b> ${safe(new Intl.DateTimeFormat("en-u-ca-islamic", { dateStyle: "full" }).format(date))}</p><table>${["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"].map((k) => `<tr><th>${k}</th><td>${format(times[k])}</td></tr>`).join("")}</table><details><summary>30-day fasting timetable</summary><table><thead><tr><th>Date</th><th>Fajr / fast begins</th><th>Maghrib / iftar</th></tr></thead><tbody>`;
        for (let i = 0; i < 30; i++) {
          const day = new Date(date);
          day.setDate(day.getDate() + i);
          const p = new A.PrayerTimes(coords, day, params);
          html += `<tr><td>${day.toLocaleDateString("en-PK")}</td><td>${format(p.fajr)}</td><td>${format(p.maghrib)}</td></tr>`;
        }
        html += "</tbody></table></details>";
        document.getElementById("prayer-result").innerHTML = html;
      }
    })()
      .catch((err) => {
        if (error) error.textContent = err.message;
        else toast(err.message);
      })
      .finally(() => {
        delete f.dataset.pending;
        if (submit) submit.disabled = false;
      });
  },
  true,
);

route();

let cachedMemberId = null;
const platformBaseGo = go;
go = () => {
  const next = member?.id || null;
  if (next !== cachedMemberId) {
    clearOverview();
    if (cachedMemberId !== null) donationDraft = null;
    cachedMemberId = next;
    context = null;
    contextUser = null;
    serviceRows = {};
    serviceErrors = {};
    queue = null;
    staffError = "";
    staffUsers = [];
    payments = [];
    donationRows = [];
    credentials = [];
    trackingRows = null;
    alerts = null;
  }
  platformBaseGo();
  const subpage =
    S.view.startsWith("services/") ||
    [
      "hub",
      "donation-tracking",
      "notifications",
      "unit-profile",
      "credentials",
      "staff",
      "admin",
      "content-tools",
      "community",
      "tools",
      "transparency",
      "support-line",
    ].includes(S.view) ||
    (S.view === "portal" && S.pTab !== "over");
  if (member && subpage) {
    const wrap = document.querySelector("#view .wrap");
    if (wrap)
      wrap.insertAdjacentHTML(
        "afterbegin",
        '<a class="portal-back" href="#portal" data-platform="portal-home"><span aria-hidden="true">←</span> Back to portal</a>',
      );
  }
};

document.addEventListener(
  "click",
  (event) => {
    const link = event.target.closest("[data-solution-section]");
    if (!link) return;
    event.preventDefault();
    document.getElementById(link.dataset.solutionSection)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  },
  true,
);

installAudioQuran();
installBukhari();
installContact();
installImpact();
installSeerah();
installNavigation();
