/* Persistent portal integration for the original design. */
let member = null,
  resources = [],
  records = [],
  enrollments = [],
  adminRecords = [],
  loaded = false,
  portalError = "";
const h = esc;
async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
const send = (path, data, method = "POST") =>
  api(path, { method, body: JSON.stringify(data) });
const empty = (message) => `<p class="note">${h(message)}</p>`;
const field = (name, label, type = "text", required = true) =>
  `<div><label for="${name}">${label}</label><input name="${name}" id="${name}" type="${type}" ${required ? "required" : ""} ${type === "password" ? 'minlength="12" autocomplete="new-password"' : ""}></div>`;
const action = (name, label, value = "", css = "") =>
  `<button type="button" class="btn sm ${css}" data-live="${name}" data-value="${h(value)}">${h(label)}</button>`;
function authView(register = false) {
  return `<section class="sec"><div class="wrap"><div class="card login"><span class="eyebrow">Member portal</span><h2>${register ? "Join Ihya-e-Islam" : "Assalamu alaikum"}</h2><p>${register ? "Create your member account." : "Sign in to your saved donations, learning and volunteering."}</p><form class="form" data-live-form="${register ? "register" : "login"}" style="grid-template-columns:1fr">${register ? field("name", "Full name") : ""}${field("email", "Email", "email")}${field("password", "Password", "password")}<p class="err" role="alert"></p><button class="btn em">${register ? "Create account" : "Sign in"}</button></form><p>${action(register ? "show-login" : "show-register", register ? "Already a member? Sign in" : "Create an account")}</p></div></div></section>`;
}
V.portal = () =>
  !loaded ? empty("Loading your portal…") : !member ? authView() : portalView();
V.register = () => authView(true);
function resourceCard(r) {
  const joined = enrollments.find((x) => x.id === r.id);
  return `<div class="card"><span class="eyebrow">${h(r.kind)}</span><h3>${h(r.data.title)}</h3><p>${h(r.data.description)}</p>${r.data.date ? `<p>${h(new Date(r.data.date).toLocaleString("en-PK"))} · ${h(r.data.location)}</p>` : ""}<div style="margin-top:12px">${action(joined ? "leave" : "join", joined ? "Cancel enrollment" : "Enroll / register", r.id)} ${r.kind === "course" && joined ? action("course", "Open course", r.id) : ""}${member?.role === "admin" ? " " + action("archive", "Archive", r.id) : ""}</div></div>`;
}
V.activities = () =>
  `<section class="sec"><div class="wrap"><div class="sh"><div><span class="eyebrow">Community</span><h2>Events, shifts & courses</h2></div></div><div class="grid g2">${resources.map(resourceCard).join("") || empty("New activities will appear here when published by the team.")}</div></div></section>`;
V.track = () =>
  `<section class="sec"><div class="wrap"><div class="card login"><h2>Track a report</h2><p>Use the report number and private tracking key provided when you submitted it.</p><form class="form" data-live-form="track">${field("reportId", "Report number")}${field("secret", "Private tracking key")}<p class="err w" role="alert"></p><button class="btn em">Check status</button><div class="w" id="track-result"></div></form></div></div></section>`;
function portalView() {
  const tabs = [
    ["over", "Overview"],
    ["don", "Donations"],
    ["vol", "Volunteering"],
    ["learn", "Learning"],
    ["rep", "My reports"],
    ["settings", "Settings"],
  ];
  const mine = (kind) => records.filter((r) => r.kind === kind);
  const cards = (rows) =>
    rows
      .map(
        (r) =>
          `<div class="card"><span class="tag m">${h(r.status.replaceAll("_", " "))}</span><h3>${h(r.kind === "donation" ? r.data.currency + " " + r.data.amount : r.data.category || r.data.unit || r.kind)}</h3><p>${h(r.id)} · ${h(r.created_at)}</p>${r.kind === "donation" && r.data.frequency === "month" ? `<p>Monthly pledge: ${h(r.data.currency)} ${h(r.data.pledgeAmount || r.data.amount)} · ${r.data.pledgePaused ? "Paused" : "Active (manual transfer)"}</p>${action("pledge", r.data.pledgePaused ? "Resume pledge" : "Pause pledge", r.id)}` : ""}${r.kind === "donation" && r.status === "confirmed" ? `<a class="btn sm" href="/api/receipt/${encodeURIComponent(r.id)}">Download receipt</a>` : ""}</div>`,
      )
      .join("") || empty("No records yet.");
  const panes = {
    over: () =>
      `<div class="grid g3">${[
        ["Donation records", mine("donation").length],
        ["Applications", mine("volunteer").length],
        ["Enrollments", enrollments.length],
      ]
        .map(
          ([label, n]) =>
            `<div class="card stat"><b style="color:var(--em)">${n}</b><span>${label}</span></div>`,
        )
        .join(
          "",
        )}</div><p class="note" style="margin-top:18px">Only your actual activity is shown here. Bank transfers appear as pending until the finance team confirms receipt.</p>`,
    don: () => cards(mine("donation")),
    vol: () =>
      cards(mine("volunteer")) +
      `<h3 style="margin:20px 0">Available shifts & events</h3><div class="grid g2">${
        resources
          .filter((r) => r.kind !== "course")
          .map(resourceCard)
          .join("") || empty("No shifts or events are currently published.")
      }</div>`,
    learn: () =>
      `<div class="grid g2">${resources
        .filter((r) => r.kind === "course")
        .map(resourceCard)
        .join("")}</div>`,
    rep: () =>
      cards(mine("report")) +
      `<p><a href="#track">Track an anonymous report</a></p>`,
    settings: () =>
      `<div class="card"><h3>Change password</h3><p>Changing your password signs out every session.</p><form class="form" data-live-form="password">${field("currentPassword", "Current password", "password")}${field("password", "New password", "password")}<p class="err w"></p><button class="btn em">Update password</button></form></div>`,
  };
  return `<section class="sec"><div class="wrap"><div class="sh"><div><span class="eyebrow">Member portal</span><h2>Assalamu alaikum, ${h(member.name)}</h2><p>${h(member.email)}</p></div><div>${action("logout", "Sign out")} ${member.role === "admin" ? '<a href="#admin" class="btn sm">Administration</a>' : ""}</div></div>${portalError ? empty(portalError) : ""}<div class="pl"><div class="pside">${tabs.map(([key, label]) => `<button data-a="ptab" data-v="${key}" class="${S.pTab === key ? "on" : ""}">${label}</button>`).join("")}</div><div class="grid">${(panes[S.pTab] || panes.over)()}</div></div></div></section>`;
}
V.admin = () =>
  member?.role !== "admin"
    ? empty("Administrator access required.")
    : `<section class="sec"><div class="wrap"><h2>Administration</h2><p>Private submissions are visible only to administrators. Report status records your team’s actual actions; it does not notify authorities automatically.</p><div class="card"><h3>Publish an activity</h3><form class="form" data-live-form="resource"><div><label for="kind">Type</label><select name="kind" id="kind"><option value="event">Event</option><option value="shift">Volunteer shift</option><option value="course">Course</option></select></div>${field("title", "Title")}${field("description", "Description")}${field("date", "Date and time", "datetime-local", false)}${field("location", "Location", "text", false)}<div class="w"><label for="lessons">Course lessons</label><div id="lesson-fields"><div class="lesson-fields"><label>Lesson title <input name="lessonTitle"></label><label>Lesson content <textarea name="lessonBody"></textarea></label></div></div>${action("add-lesson", "Add another lesson")}</div><p class="err w"></p><button class="btn em">Publish</button></form></div><h3 style="margin:24px 0">Submissions</h3><div class="grid">${adminRecords.map((r) => `<div class="card"><span class="eyebrow">${h(r.kind)}</span><h3>${h(r.id)}</h3><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${h(JSON.stringify({ ...r.data, trackingHash: undefined, attachments: undefined }, null, 2))}</pre>${(r.data.attachments || []).map((key) => `<a class="btn sm" href="/api/attachments/${encodeURIComponent(key)}">Download private attachment</a>`).join("")}<label>Status <select data-live-status="${h(r.id)}">${{ report: ["received", "checked", "forwarded", "closed"], volunteer: ["received", "approved", "declined"], donation: ["awaiting_transfer", "confirmed", "cancelled"], newsletter: ["received", "unsubscribed"] }[r.kind].map((status) => `<option ${r.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label></div>`).join("") || empty("No submissions yet.")}</div></div></section>`;
async function refresh() {
  portalError = "";
  try {
    const session = await api("/auth/me");
    member = session.user;
    S.auth = !!member;
    resources = (await api("/resources")).items;
    if (member) {
      records = (await api("/records")).items;
      enrollments = (await api("/enrollments")).items;
      S.book = new Set((await api("/bookmarks")).items);
      if (member.role === "admin")
        adminRecords = (await api("/admin/records")).items;
    } else {
      records = [];
      enrollments = [];
      S.book = new Set();
    }
  } catch (e) {
    portalError = e.message;
  }
  loaded = true;
  route();
}
let donationDraft = null;
const HEART =
  '<svg class="donation-heart" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';
function rememberDonation(form) {
  const values = Object.fromEntries(new FormData(form));
  donationDraft = {
    ...donationDraft,
    ...values,
    anonymous:
      form.elements.anonymous?.checked ?? donationDraft?.anonymous ?? false,
    cover: form.elements.cover?.checked ?? donationDraft?.cover ?? true,
  };
}
function donationProcessingCost() {
  return Math.round(Number(donationDraft.amount) * 2.5) / 100;
}
function donationContribution() {
  return donationDraft?.cover ? donationProcessingCost() : 0;
}
function donationTotal() {
  return (
    Math.round((Number(donationDraft.amount) + donationContribution()) * 100) /
    100
  );
}
function donationMoney(value) {
  return (
    (donationDraft.currency === "PKR" ? "Rs " : "$") +
    Number(value).toLocaleString("en-PK", { maximumFractionDigits: 2 })
  );
}
function donationSummary(includeDonor = true) {
  const d = donationDraft;
  return `<div class="sum"><div><span>Fund</span><b>${h(FUNDS.find((f) => f.id === d.fund)?.n || d.fund)}</b></div><div><span>Gift</span><b>${donationMoney(d.amount)}</b></div>${d.cover ? `<div><span>Optional processing contribution</span><b>${donationMoney(donationContribution())}</b></div>` : ""}<div class="tot"><span>Total</span><span>${donationMoney(donationTotal())}</span></div><div><span>Frequency</span><b>${d.frequency === "month" ? "Monthly pledge (manual transfer)" : "One-time"}</b></div>${includeDonor ? `<div><span>Donor</span><b>${h(d.donorName || "")}</b></div><div><span>Email</span><b>${h(d.email || "")}</b></div><div><span>Public name</span><b>${d.anonymous ? "Anonymous" : "May be shown"}</b></div>` : ""}</div>`;
}
const FUND_LOOK = {
  gen: {
    color: "#0f7a4f",
    path: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z",
  },
  zakat: {
    color: "#b7791f",
    path: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  },
  winter: {
    color: "#2563eb",
    path: "M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1L19.1 4.9M9 3l3 3 3-3M9 21l3-3 3 3",
  },
  orphan: {
    color: "#c2417a",
    path: "M9 7a3 3 0 1 0 0-.01M17 9a2.5 2.5 0 1 0 0-.01M3 21v-2a5 5 0 0 1 10 0v2M14 21v-1.5a4 4 0 0 1 7 0V21",
  },
  ilm: {
    color: "#6d4aff",
    path: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM20 17v4H6.5",
  },
  water: {
    color: "#0891b2",
    path: "M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z",
  },
};
const fundIcon = (id) =>
  `<span class="fund-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="${(FUND_LOOK[id] || FUND_LOOK.gen).path}"/></svg></span>`;
const MEDIA_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/></svg>';
let fundMedia = null;
async function loadFundMedia() {
  if (fundMedia) return fundMedia;
  try {
    const r = await fetch("/data/fund-media.json", { cache: "no-cache" });
    fundMedia = r.ok ? await r.json() : {};
  } catch {
    fundMedia = {};
  }
  return fundMedia;
}
const safeMediaSrc = (src) =>
  /^(\/|media\/|https:\/\/)/.test(String(src || "")) ? String(src) : "";
function mediaHeader(id) {
  return `<div class="fund-media-nav"><button type="button" class="fund-media-back" data-live="${id === undefined ? "donation-edit" : "fund-media"}" ${id === undefined ? "" : `data-value="${h(id)}"`}>← Back</button></div>`;
}
async function fundMediaMd(id) {
  const fund = FUNDS.find((f) => f.id === id);
  if (!fund) return;
  const items = ((await loadFundMedia())[id] || []).filter((m) =>
    safeMediaSrc(m.src),
  );
  const look = FUND_LOOK[id] || FUND_LOOK.gen;
  const grid = items.length
    ? `<div class="fund-media-grid">${items
        .map(
          (m, i) =>
            `<figure>${
              m.type === "video"
                ? `<video src="${h(safeMediaSrc(m.src))}" ${m.poster ? `poster="${h(safeMediaSrc(m.poster))}"` : ""} controls preload="metadata" playsinline></video>`
                : `<button type="button" class="fund-media-thumb" data-live="fund-media-view" data-value="${h(id)}:${i}" aria-label="Open photo${m.caption ? ": " + h(m.caption) : ""}"><img src="${h(safeMediaSrc(m.src))}" alt="${h(m.alt || m.caption || fund.n)}" loading="lazy"></button>`
            }${m.caption ? `<figcaption>${h(m.caption)}</figcaption>` : ""}</figure>`,
        )
        .join("")}</div>`
    : `<div class="fund-media-empty" style="--fund:${look.color}">${fundIcon(id)}<p><b>Photos and videos are on their way</b><br>Pictures of our ${h(fund.n.toLowerCase())} work will be shared here soon, in sha Allah.</p></div>`;
  openMd(
    `${h(fund.n)}: our work`,
    `${mediaHeader()}<div class="fund-media-head" style="--fund:${look.color}">${fundIcon(id)}<div><b>${h(fund.n)}</b><small>${h(fund.d)}</small></div></div>${grid}<button type="button" class="btn gold donation-next" data-live="donation-fund-give" data-value="${h(id)}">Give to ${h(fund.n)}</button>`,
  );
  $("#md").classList.add("donation-modal", "fund-media-modal");
}
async function fundMediaView(value) {
  const [id, index] = String(value).split(":");
  const fund = FUNDS.find((f) => f.id === id);
  const m = ((await loadFundMedia())[id] || [])[Number(index)];
  if (!fund || !m || !safeMediaSrc(m.src)) return fundMediaMd(id);
  openMd(
    `${h(fund.n)}: our work`,
    `${mediaHeader(id)}<figure class="fund-media-full"><img src="${h(safeMediaSrc(m.src))}" alt="${h(m.alt || m.caption || fund.n)}">${m.caption ? `<figcaption>${h(m.caption)}</figcaption>` : ""}</figure>`,
  );
  $("#md").classList.add("donation-modal", "fund-media-modal");
}
async function bankDonation(fund) {
  donationDraft = {
    amount: 10000,
    currency: "PKR",
    fund: "gen",
    frequency: "month",
    donorName: member?.name || "",
    email: member?.email || "",
    anonymous: false,
    reference: "",
    cover: true,
    paymentMethod: "bank",
    ...donationDraft,
  };
  if (FUNDS.some((f) => f.id === fund)) donationDraft.fund = fund;
  if (member) {
    donationDraft.donorName ||= member.name;
    donationDraft.email ||= member.email;
  }
  const d = donationDraft;
  openMd(
    "Give in the way of Allah",
    `<form class="donation-picker" data-live-form="donation-details"><div class="seg" role="group" aria-label="Donation frequency">${[
      ["once", "One-time"],
      ["month", "Monthly"],
    ]
      .map(
        ([value, label]) =>
          `<button type="button" class="${d.frequency === value ? "on" : ""}" aria-pressed="${d.frequency === value}" data-live="donation-frequency" data-value="${value}">${value === "month" ? HEART : ""}${label}</button>`,
      )
      .join(
        "",
      )}</div>${d.frequency === "once" ? `<div class="donation-monthly-nudge" role="note"><p>${HEART}<span>Thank you for your generosity. If you are able, please consider giving monthly instead. A regular gift, even a smaller one, helps us plan steady support for families all year round. You can pause or stop it at any time.</span></p><button type="button" data-live="donation-frequency" data-value="month">Make it monthly</button></div>` : ""}<div class="donation-amount-heading"><label class="lb" for="donation-amount">Amount</label><div class="seg donation-currency" role="group" aria-label="Currency">${["PKR", "USD"].map((value) => `<button type="button" class="${d.currency === value ? "on" : ""}" aria-pressed="${d.currency === value}" data-live="donation-currency" data-value="${value}">${value}</button>`).join("")}</div></div><div class="amts">${AMTS[d.currency].map((amount) => `<button type="button" class="${Number(d.amount) === amount ? "on" : ""}" aria-pressed="${Number(d.amount) === amount}" data-live="donation-preset" data-value="${amount}">${donationMoney(amount)}</button>`).join("")}</div><div class="amtin"><span aria-hidden="true">${d.currency === "PKR" ? "Rs" : "$"}</span><input id="donation-amount" name="amount" type="number" min="0.01" max="10000000" step="0.01" value="${h(d.amount)}" required></div><span class="lb" id="donation-fund-label">Fund</span><div class="funds" role="group" aria-labelledby="donation-fund-label">${FUNDS.map((f) => `<div class="fund-card${d.fund === f.id ? " on" : ""}" style="--fund:${(FUND_LOOK[f.id] || FUND_LOOK.gen).color}"><button type="button" class="fund-pick" aria-pressed="${d.fund === f.id}" data-live="donation-fund" data-value="${f.id}">${fundIcon(f.id)}<span><b>${h(f.n)}</b><small>${h(f.d)}</small></span></button><button type="button" class="fund-media-link" data-live="fund-media" data-value="${f.id}" aria-label="See our work: ${h(f.n)}">${MEDIA_ICON}See our work</button></div>`).join("")}</div>${d.fund === "zakat" ? `<p style="margin:10px 0">${action("open-zakat", "Calculate zakat")}</p>` : ""}<div class="chk donation-cover"><input id="donation-cover" name="cover" type="checkbox" ${d.cover ? "checked" : ""}><label for="donation-cover" id="donation-cover-label">Add ${donationMoney(donationProcessingCost())} toward processing costs</label></div><p class="err" role="alert"></p><button id="donation-next" class="btn gold donation-next">Donate ${donationMoney(donationTotal())}${d.frequency === "month" ? " monthly" : ""}</button><p class="donation-footnote">Review your details next · No money is collected here</p></form>`,
  );
  $("#md").classList.add("donation-modal");
}
function reviewDonation() {
  const d = donationDraft;
  openMd(
    "Confirm your donation",
    `${donationSummary(false)}<form class="form donation-contact" data-live-form="donation-contact"><div><label for="donation-name">Full name</label><input id="donation-name" name="donorName" autocomplete="name" maxlength="100" value="${h(d.donorName)}" ${d.anonymous ? "" : "required"} placeholder="For your receipt"></div><div><label for="donation-email">Email</label><input id="donation-email" name="email" type="email" autocomplete="email" maxlength="254" value="${h(d.email)}" required placeholder="you@example.com"></div><div class="w chk"><input id="donation-anonymous" name="anonymous" type="checkbox" ${d.anonymous ? "checked" : ""}><label for="donation-anonymous">Give anonymously (hide my name from public donor lists)</label></div><div class="w"><span class="lb" id="donation-method-label">Pay with</span><div class="pm" role="group" aria-labelledby="donation-method-label">${[
      ["card", "Card"],
      ["jazz", "JazzCash"],
      ["easy", "Easypaisa"],
      ["bank", "Bank transfer"],
    ]
      .map(
        ([value, label]) =>
          `<button type="button" class="${d.paymentMethod === value ? "on" : ""}" aria-pressed="${d.paymentMethod === value}" data-live="donation-method" data-value="${value}">${label}</button>`,
      )
      .join(
        "",
      )}</div><p class="note" style="margin-top:12px">${d.paymentMethod === "bank" ? "Bank transfer instructions and availability are checked at the next step." : "Payment provider availability is checked at the next step. Never share a card or wallet PIN with the trust."}</p></div><p class="err w" role="alert"></p><div class="w donation-review-actions">${action("donation-edit", "Back")}<button class="btn gold">${d.paymentMethod === "bank" ? "Get reference number" : "Continue to secure payment"}</button></div></form>`,
  );
}
function updateDonationAmount() {
  const amount = $("#donation-amount");
  if (!amount) return;
  donationDraft.amount = amount.value;
  const contribution = Number.isFinite(Number(amount.value))
    ? donationContribution()
    : 0;
  $("#donation-cover-label").textContent =
    "Add " +
    donationMoney(
      donationDraft.cover
        ? contribution
        : Math.round(Number(amount.value) * 2.5) / 100,
    ) +
    " toward processing costs";
  $("#donation-next").textContent =
    "Donate " +
    donationMoney(donationTotal()) +
    (donationDraft.frequency === "month" ? " monthly" : "");
  document.querySelectorAll('[data-live="donation-preset"]').forEach((b) => {
    const selected = Number(b.dataset.value) === Number(amount.value);
    b.classList.toggle("on", selected);
    b.setAttribute("aria-pressed", String(selected));
  });
}
async function finishDonation() {
  const settings = await api("/donation-settings");
  if (donationDraft.paymentMethod !== "bank") {
    openMd(
      "Payment option opening soon",
      `<p class="eyebrow">Final step · Payment availability</p>${donationSummary()}${empty("This payment provider is not connected yet. No money has been collected.")}<p>No donation record has been saved.</p>${action("donation-review", "Back to confirmation")}`,
    );
    return;
  }
  if (!settings.enabled) {
    openMd(
      "Donations opening soon",
      `<p class="eyebrow">Step 3 of 3 · Payment availability</p>${donationSummary()}${empty("The organization has not published bank account details yet. No money has been collected.")}<p>No donation record has been saved.</p>${action("donation-edit", "Back to details")}`,
    );
    return;
  }
  if (!member) {
    openMd(
      "Sign in to complete your donation",
      `<p class="eyebrow">Step 3 of 3 · Bank transfer</p>${donationSummary()}<p>Please sign in to save your bank-transfer record and track it in the portal. Your entered details will remain in this tab; click Donate after signing in to resume.</p>${action("donation-login", "Sign in")}${action("donation-edit", "Back to details")}`,
    );
    return;
  }
  openMd(
    "Bank transfer donation",
    `<p class="eyebrow">Step 3 of 3 · Bank transfer</p>${donationSummary()}<p class="note" style="white-space:pre-wrap">${h(settings.bankDetails)}</p><p>${h(settings.notice)}</p><form class="form" data-live-form="donation"><div class="w"><label for="donation-reference">Your bank transfer reference (optional)</label><input id="donation-reference" name="reference" maxlength="200" value="${h(donationDraft.reference || "")}"></div><p class="err w" role="alert"></p><button class="btn gold">Save transfer for review</button>${action("donation-edit", "Back to details")}<p class="note w">Saving this record does not move money. Transfer through your own bank. A receipt becomes available after the finance team verifies payment.</p></form>`,
  );
}
async function runAction(button) {
  const key = button.dataset.live,
    value = button.dataset.value;
  if (key === "pledge") {
    const r = records.find((x) => x.id === value);
    await send(
      "/records",
      { id: value, paused: !r.data.pledgePaused },
      "PATCH",
    );
    await refresh();
    return;
  }
  if (
    [
      "donation-frequency",
      "donation-currency",
      "donation-preset",
      "donation-fund",
    ].includes(key)
  ) {
    const form = $('[data-live-form="donation-details"]');
    if (form) rememberDonation(form);
    if (key === "donation-frequency") donationDraft.frequency = value;
    if (key === "donation-currency") {
      donationDraft.currency = value;
      donationDraft.amount = value === "PKR" ? 10000 : 100;
    }
    if (key === "donation-preset") donationDraft.amount = Number(value);
    if (key === "donation-fund") donationDraft.fund = value;
    await bankDonation();
    return;
  }
  if (key === "donation-review") {
    reviewDonation();
    return;
  }
  if (key === "donation-method") {
    const form = $('[data-live-form="donation-contact"]');
    if (form) rememberDonation(form);
    donationDraft.paymentMethod = value;
    reviewDonation();
    return;
  }
  if (key === "donation-edit") {
    await bankDonation();
    return;
  }
  if (key === "donation-final") {
    await finishDonation();
    return;
  }
  if (key === "donation-login") {
    closeAll();
    location.hash = "portal";
    return;
  }
  if (key === "fund-media" || key === "fund-media-view") {
    const form = $('[data-live-form="donation-details"]');
    if (form) rememberDonation(form);
    await (key === "fund-media" ? fundMediaMd(value) : fundMediaView(value));
    return;
  }
  if (key === "donation-fund-give") {
    donationDraft = { ...donationDraft, fund: value };
    await bankDonation(value);
    return;
  }
  if (key === "open-zakat") {
    const form = $('[data-live-form="donation-details"]');
    if (form) rememberDonation(form);
    zakatMd();
    return;
  }
  if (key === "share") {
    const verse = button.closest(".verse");
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    const ctx = canvas.getContext("2d");
    function wrap(value, font) {
      ctx.font = font;
      const lines = [];
      let line = "";
      for (const word of value.split(/\s+/)) {
        const next = line ? line + " " + word : word;
        if (ctx.measureText(next).width > 1040 && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      return lines;
    }
    const arabic = wrap(verse.querySelector(".ar").textContent, "38px serif");
    const translation = wrap(
      verse.querySelector(".tr").textContent,
      "28px sans-serif",
    );
    canvas.height = 300 + arabic.length * 58 + translation.length * 44;
    ctx.fillStyle = "#0f3b2f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#c9973a";
    ctx.lineWidth = 3;
    ctx.strokeRect(25, 25, 1150, canvas.height - 50);
    let y = 85;
    ctx.fillStyle = "#f3efe2";
    ctx.font = "38px serif";
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    for (const line of arabic) {
      ctx.fillText(line, 1120, y);
      y += 58;
    }
    y += 24;
    ctx.font = "28px sans-serif";
    ctx.direction = quranLanguage === "ur" ? "rtl" : "ltr";
    ctx.textAlign = quranLanguage === "ur" ? "right" : "left";
    for (const line of translation) {
      ctx.fillText(line, quranLanguage === "ur" ? 1120 : 80, y);
      y += 44;
    }
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.fillStyle = "#c9973a";
    ctx.font = "22px sans-serif";
    ctx.fillText(verse.querySelector(".ref b").textContent, 80, y + 30);
    ctx.font = "18px sans-serif";
    ctx.fillText(
      "Ihya-e-Islam · Quran JSON 3.1.2 / Risan Bagja Pradana · CC BY-SA 4.0",
      80,
      canvas.height - 65,
    );
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ihya-e-islam-verse.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return;
  }
  if (key === "add-lesson") {
    const block = document.createElement("div");
    block.className = "lesson-fields";
    block.innerHTML =
      '<label>Lesson title <input name="lessonTitle"></label><label>Lesson content <textarea name="lessonBody"></textarea></label>';
    $("#lesson-fields").append(block);
    return;
  }
  if (key === "show-register") {
    location.hash = "register";
    return;
  }
  if (key === "show-login") {
    location.hash = "portal";
    return;
  }
  if (key === "logout") {
    await send("/auth/logout", {});
    await refresh();
    return;
  }
  if (key === "join") {
    if (!member) {
      location.hash = "portal";
      toast("Please sign in to enroll.");
      return;
    }
    await send("/enrollments", { resourceId: value });
    await refresh();
    toast("Enrollment saved.");
  }
  if (key === "leave") {
    await send("/enrollments", { resourceId: value }, "DELETE");
    await refresh();
  }
  if (key === "archive") {
    await api("/resources/" + encodeURIComponent(value), { method: "DELETE" });
    await refresh();
  }
  if (key === "course") {
    const r = resources.find((x) => x.id === value);
    const enrolled = enrollments.find((x) => x.id === value);
    openMd(
      h(r.data.title),
      r.data.lessons
        .map(
          (l, i) =>
            `<article class="card" style="margin-bottom:12px"><h3>${h(l.title)}</h3><p style="white-space:pre-wrap">${h(l.body)}</p>${i < (enrolled?.progress || 0) ? '<span class="tag z">Completed</span>' : action("complete", "Mark lesson complete", r.id + ":" + (i + 1))}</article>`,
        )
        .join("") +
        ((enrolled?.progress || 0) >= r.data.lessons.length
          ? action("certificate", "Download completion certificate", r.id)
          : ""),
    );
  }
  if (key === "complete") {
    const split = value.lastIndexOf(":");
    await send(
      "/enrollments",
      { resourceId: value.slice(0, split), progress: +value.slice(split + 1) },
      "PATCH",
    );
    enrollments = (await api("/enrollments")).items;
    await runAction({
      dataset: { live: "course", value: value.slice(0, split) },
    });
  }
  if (key === "certificate") {
    const r = resources.find((x) => x.id === value);
    const blob = new Blob(
      [
        `Ihya-e-Islam\nCertificate of completion\n${member.name}\n${r.data.title}\nCompleted ${new Date().toLocaleDateString("en-PK")}\nSelf-paced learning acknowledgment; not a professional qualification.`,
      ],
      { type: "text/plain" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "completion.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
document.addEventListener(
  "click",
  (event) => {
    const live = event.target.closest("[data-live]");
    if (live) {
      event.preventDefault();
      event.stopImmediatePropagation();
      runAction(live).catch((e) => toast(e.message));
      return;
    }
    const b = event.target.closest("[data-a]");
    if (!b) return;
    const a = b.dataset.a;
    if (
      ["donate", "enroll", "rsvp", "bm", "lang", "zuse", "zback"].includes(a)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      (async () => {
        if (a === "donate" || a === "zback")
          await bankDonation(a === "donate" ? b.dataset.v : undefined);
        if (a === "zuse") {
          S.D.amt = +b.dataset.v;
          donationDraft = {
            ...donationDraft,
            amount: S.D.amt,
            currency: "PKR",
            fund: "zakat",
          };
          await bankDonation("zakat");
        }
        if (a === "enroll" || a === "rsvp") location.hash = "activities";
        if (a === "bm") {
          if (!member) {
            toast("Sign in to save verses across devices.");
            location.hash = "portal";
            return;
          }
          const key = b.dataset.v;
          await send(
            "/bookmarks",
            { key },
            S.book.has(key) ? "DELETE" : "POST",
          );
          S.book.has(key) ? S.book.delete(key) : S.book.add(key);
          go();
        }
        if (a === "lang") {
          LANG = b.dataset.v;
          localStorage.setItem("language", LANG);
          go();
        }
      })().catch((e) => toast(e.message));
    }
    if (a === "toast") {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast("This document has not been published by the organization yet.");
    }
  },
  true,
);
document.addEventListener(
  "change",
  (event) => {
    const control = event.target.closest("[data-live-status]");
    if (control)
      send(
        "/admin/records",
        { id: control.dataset.liveStatus, status: control.value },
        "PATCH",
      )
        .then(() => toast("Status saved."))
        .catch((e) => toast(e.message));
  },
  true,
);
document.addEventListener(
  "submit",
  (event) => {
    const form = event.target,
      kind = form.dataset.liveForm || form.dataset.f;
    if (!kind || ["v0", "v1", "qsearch"].includes(kind)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (form.dataset.busy) return;
    form.dataset.busy = "1";
    const button = form.querySelector(
      'button[type="submit"],button:not([type])',
    );
    if (button) button.disabled = true;
    const error = form.querySelector(".err");
    if (error) error.textContent = "";
    const f = Object.fromEntries(new FormData(form));
    (async () => {
      if (kind === "login" || kind === "register") {
        await send("/auth/" + kind, f);
        location.hash = "portal";
        await refresh();
      } else if (kind === "password") {
        await send("/auth/password", f);
        await refresh();
        toast("Password updated. Please sign in again.");
      } else if (kind === "resource") {
        let lessons = [];
        if (f.kind === "course") {
          const entries = new FormData(form);
          lessons = entries.getAll("lessonTitle").map((title, index) => ({
            title,
            body: entries.getAll("lessonBody")[index],
          }));
        }
        await send("/resources", { ...f, lessons });
        await refresh();
        toast("Activity published.");
      } else if (kind === "donation-details") {
        rememberDonation(form);
        if (
          !Number.isFinite(Number(donationDraft.amount)) ||
          Number(donationDraft.amount) <= 0 ||
          Number(donationDraft.amount) > 10000000
        )
          throw new Error("Enter a valid donation amount.");
        reviewDonation();
      } else if (kind === "donation-contact") {
        rememberDonation(form);
        await finishDonation();
      } else if (kind === "donation") {
        donationDraft.reference = f.reference || "";
        const result = await send("/records", {
          ...donationDraft,
          amount: donationTotal(),
          giftAmount: Number(donationDraft.amount),
          processingContribution: donationContribution(),
          kind,
        });
        donationDraft = null;
        await refresh();
        openMd(
          "Transfer saved",
          empty(
            "Reference " +
              result.id +
              ". Status: awaiting transfer review. No payment has been processed by this website.",
          ),
        );
      } else if (kind === "track") {
        const result = await send("/track", {
          id: f.reportId,
          secret: f.secret,
        });
        $("#track-result").textContent =
          "Status: " + result.status + " · Received " + result.created_at;
      } else if (kind === "nl") {
        await send("/records", { kind: "newsletter", email: $("#nle").value });
        form.reset();
        toast(
          "Subscription request saved. Delivery begins when the team enables email.",
        );
      } else if (kind === "v2") {
        if (!member) {
          location.hash = "portal";
          throw new Error(
            "Please sign in before submitting your application. Your current form remains in this tab.",
          );
        }
        const result = await send("/records", {
          kind: "volunteer",
          name: S.v.name,
          phone: S.v.ph,
          city: S.v.c,
          unit: S.v.u.join(", "),
          skills: (S.v.s || []).join(", "),
          hours: S.v.h,
          pledge: !!form.querySelector('input[type="checkbox"]:checked'),
        });
        await refresh();
        openMd(
          "Application received",
          empty(
            "Application " +
              result.id +
              " has been saved for coordinator review.",
          ),
        );
      } else if (kind === "rep") {
        const secret = crypto.randomUUID();
        const file = $("#rf").files[0];
        if (file && file.size > 10 * 1024 * 1024)
          throw new Error("Choose an attachment under 10 MB.");
        const result = await send("/records", {
          kind: "report",
          category: form.querySelector('[name="rc"]:checked').value,
          location: $("#rl").value,
          when: $("#rw").value,
          description: $("#rd").value,
          anonymous: $("#ranon").checked,
          contact: $("#rn").value + " " + $("#rp").value,
          truthful: $("#rt").checked,
          trackingSecret: secret,
        });
        let uploadWarning = "";
        if (file) {
          try {
            const r = await fetch(
              "/api/uploads?record=" + encodeURIComponent(result.id),
              {
                method: "POST",
                headers: {
                  "Content-Type": file.type,
                  "X-Tracking-Key": secret,
                },
                body: file,
              },
            );
            if (!r.ok) throw new Error((await r.json()).error);
          } catch (e) {
            uploadWarning = " Attachment was not saved: " + e.message;
          }
        }
        await refresh();
        openMd(
          "Report saved",
          `<p>Keep both values below. Anonymous tracking keys cannot be recovered.</p><p class="note">Report: ${h(result.id)}<br>Private key: ${h(secret)}</p><p>Your report is awaiting review. It has not been forwarded to authorities automatically.</p>${uploadWarning ? empty(uploadWarning) : ""}<a class="btn" href="#track">Track report</a>`,
        );
      }
    })()
      .catch((e) => {
        if (error) error.textContent = e.message;
        else toast(e.message);
      })
      .finally(() => {
        delete form.dataset.busy;
        if (button) button.disabled = false;
      });
  },
  true,
);
// Replace mock statistics and availability claims with the live activity catalogue.
const originalHome = V.home;
V.home = () => {
  const template = document.createElement("template");
  template.innerHTML = originalHome();
  template.content
    .querySelectorAll(".stat,.appeal")
    .forEach((el) => el.closest("section")?.remove());
  new Set(
    [...template.content.querySelectorAll(".evt")].map(
      (el) => el.parentElement.parentElement,
    ),
  ).forEach((column) => {
    column.innerHTML =
      '<h3>Upcoming activities</h3><p><a href="#activities">See the published schedule</a></p>';
  });
  return (
    template.innerHTML +
    `<section class="sec"><div class="wrap"><h2>Join our community</h2><p>Find published events, volunteer shifts and courses.</p><a class="btn em" href="#activities">View activities</a> <a class="btn" href="#track">Track a report</a></div></section>`
  );
};
const oldVolunteer = V.volunteer;
V.volunteer = () =>
  oldVolunteer().replace(/\d+ volunteers enrolled/g, "Applications open");
const oldReport = V.report;
V.report = () =>
  oldReport()
    .replace(
      'value="2026-11-03T20:00"',
      `value="${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"`,
    )
    .replace(
      "A trained reviewer checks the details within 24 hours. False reports are discarded.",
      "Your submission is queued for review by the organization.",
    )
    .replace(
      "You can check status with your tracking number in the portal.",
      "Track status with your report number and private tracking key.",
    );
NAV.push(
  ["activities", "Activities", "سرگرمیاں"],
  ["digital-solutions", "Our Digital Solutions", "ہماری ڈیجیٹل خدمات"],
);
LANG = localStorage.getItem("language") || "en";
refresh();
let quranData = [],
  quranLanguage = localStorage.getItem("quran-language") || "en",
  quranQuery = "",
  quranLoaded = false;
async function loadQuran() {
  quranLoaded = false;
  try {
    const response = await fetch("/data/quran_" + quranLanguage + ".json");
    if (!response.ok) throw new Error("Quran text could not be loaded.");
    quranData = await response.json();
    quranLoaded = true;
    if (S.view === "quran") go();
  } catch (e) {
    toast(e.message);
  }
}
V.quran = () =>
  `<section class="band"><div class="wrap sec"><span class="eyebrow">The Noble Quran</span><h2>Read, reflect and save</h2><p>114 surahs · 6,236 ayat · Arabic with English or Urdu translation</p></div></section><section class="sec"><div class="wrap"><div class="tabs"><button data-a="qtab" data-v="surah" class="${S.qTab === "surah" ? "on" : ""}">Surahs</button><button data-a="qtab" data-v="theme" class="${S.qTab === "theme" ? "on" : ""}">Themes</button><button data-a="qtab" data-v="saved" class="${S.qTab === "saved" ? "on" : ""}">Saved verses</button></div><div class="ctl"><label for="q-lang">Translation <select id="q-lang"><option value="en" ${quranLanguage === "en" ? "selected" : ""}>English — Saheeh International</option><option value="ur" ${quranLanguage === "ur" ? "selected" : ""}>Urdu — Abul A’la Maududi</option></select></label><label for="q-select">Surah <select id="q-select">${quranData.map((c) => `<option value="${c.id}" ${c.id === S.qSel ? "selected" : ""}>${c.id}. ${h(c.transliteration)} — ${h(c.name)}</option>`).join("")}</select></label><label for="fs">Arabic size <input type="range" id="fs" min="22" max="44" value="${S.fs}"></label></div><form class="ctl" data-live-form="qsearch"><input name="query" aria-label="Search Arabic or translation" placeholder="Search Arabic or translation…" value="${h(quranQuery)}"><button class="btn">Search</button>${action("qsaved", "Saved verses")}</form><div class="card">${!quranLoaded ? empty("Loading Quran…") : renderQuran()}</div><p class="note" style="margin-top:18px">Arabic text: QuranEnc. English: Umm Muhammad (Saheeh International). Urdu: Abul A’la Maududi. Distributed through <a href="https://github.com/risan/quran-json/tree/v3.1.2" target="_blank" rel="noopener">Quran JSON 3.1.2, Risan Bagja Pradana</a>, <a href="/data/LICENSE-quran.txt">CC BY-SA 4.0</a>. Translation is an interpretation of meaning. Text is bundled verbatim; no independent scholarly review is claimed.</p></div></section>`;
function renderQuran() {
  if (S.qTab === "theme") return qTheme();
  if (S.qTab === "saved") quranQuery = ":saved";
  const selected = quranQuery
    ? quranData
    : quranData.filter((c) => c.id === S.qSel);
  const rows = [];
  for (const c of selected)
    for (const v of c.verses) {
      const key = "q" + c.id + ":" + v.id;
      const match =
        quranQuery === ":saved"
          ? S.book.has(key)
          : !quranQuery ||
            (v.text + " " + v.translation + " " + c.transliteration)
              .toLowerCase()
              .includes(quranQuery.toLowerCase());
      if (match)
        rows.push(
          verseBlock(
            v.text,
            `<span ${quranLanguage === "ur" ? 'lang="ur" dir="rtl"' : ""}>${h(v.translation)}</span>`,
            h(c.transliteration) + " " + c.id + ":" + v.id,
            key,
          ),
        );
    }
  if (quranQuery === ":saved")
    for (const [key, verse] of Object.entries(AYAT)) {
      if (S.book.has("a" + key))
        rows.push(verseBlock(verse[0], h(verse[1]), h(verse[2]), "a" + key));
    }
  return rows.join("") || empty("No matching verses.");
}
document.addEventListener(
  "change",
  (event) => {
    if (event.target.id === "q-lang") {
      quranLanguage = event.target.value;
      localStorage.setItem("quran-language", quranLanguage);
      loadQuran();
    }
    if (event.target.id === "q-select") {
      S.qSel = +event.target.value;
      S.qTab = "surah";
      quranQuery = "";
      go();
    }
  },
  true,
);
document.addEventListener(
  "submit",
  (event) => {
    if (event.target.dataset.liveForm === "qsearch") {
      event.preventDefault();
      event.stopImmediatePropagation();
      S.qTab = "surah";
      quranQuery = new FormData(event.target).get("query").trim();
      go();
    }
  },
  true,
);
document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest('[data-live="qsaved"]');
    if (button) {
      event.preventDefault();
      S.qTab = "saved";
      quranQuery = ":saved";
      go();
    }
  },
  true,
);
loadQuran();

V.privacy = () =>
  `<section class="sec"><div class="wrap"><div class="card"><h2>Privacy & service information</h2><p>Account details, applications, donations, enrollments and bookmarks are stored in the organization’s database. Reports and attachments are available to authorized administrators; attachments are not public.</p><p>Choosing anonymous reporting omits your account identity and contact details from the report. Keep the private tracking key to check its status. Infrastructure providers may still process connection metadata. This website is not an emergency service: use the emergency numbers listed on the reporting page.</p><p>Bank transfers are reviewed by the organization. The website never requests a bank password or card PIN. Subscription requests are saved; email delivery has not yet been enabled.</p><p>The organization must publish its contact information and retention policy before public launch. Contact an administrator to request correction or deletion of your records.</p></div></div></section>`;
document
  .querySelector("footer .wrap")
  ?.insertAdjacentHTML(
    "beforeend",
    '<p><a href="#privacy">Privacy & service information</a> · <a href="#track">Track a report</a></p>',
  );

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest('[data-a="qtab"]');
    if (button) quranQuery = "";
  },
  true,
);

document.addEventListener(
  "input",
  (event) => {
    if (event.target.id === "donation-amount") updateDonationAmount();
  },
  true,
);
document.addEventListener(
  "change",
  (event) => {
    if (event.target.id === "donation-anonymous") {
      $("#donation-name").required = !event.target.checked;
    }
    if (event.target.id === "donation-cover") {
      donationDraft.cover = event.target.checked;
      updateDonationAmount();
    }
  },
  true,
);
