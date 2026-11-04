let overview = null,
  owner = null,
  loading = false,
  error = "",
  generation = 0;
export function clearOverview() {
  overview = null;
  owner = null;
  loading = false;
  error = "";
  generation++;
}
const money = (totals) => {
  const entries = Object.entries(totals);
  return entries.length
    ? entries
        .map(
          ([currency, amount]) =>
            (currency === "PKR"
              ? "Rs "
              : currency === "USD"
                ? "$"
                : currency + " ") +
            Number(amount).toLocaleString("en-PK", {
              maximumFractionDigits: 2,
            }),
        )
        .join(" · ")
    : "Rs 0";
};
const label = (status) =>
  status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ");
export function renderPortalOverview() {
  if (!member) return "";
  if (owner !== member.id) {
    clearOverview();
    owner = member.id;
  }
  if (!overview && !loading && !error) {
    loading = true;
    const version = generation,
      uid = member.id;
    api("/v2/overview")
      .then((result) => {
        if (version !== generation || member?.id !== uid) return;
        overview = result;
        loading = false;
        if (S.view === "portal" && S.pTab === "over") {
          const host = document.querySelector(".portal-overview");
          if (host) host.outerHTML = renderPortalOverview();
        }
      })
      .catch((e) => {
        if (version !== generation) return;
        loading = false;
        error = e.message;
        if (S.view === "portal" && S.pTab === "over") {
          const host = document.querySelector(".portal-overview");
          if (host) host.outerHTML = renderPortalOverview();
        }
      });
  }
  if (error)
    return `<div class="portal-overview"><div class="card"><h3>Overview temporarily unavailable</h3><p role="alert">${esc(error)}</p><button type="button" class="btn" data-overview-retry>Try again</button></div></div>`;
  const d = overview;
  const metric = (title, value, note, href) =>
    `<a class="card overview-kpi" href="${href}"><small>${esc(title)}</small><b>${esc(value)}</b><span>${esc(note)}</span></a>`;
  const metrics = d
    ? [
        [
          "Given in " + d.period.label,
          money(d.donations.totals),
          `${d.donations.receipts} confirmed receipt${d.donations.receipts === 1 ? "" : "s"}`,
          "#portal/don",
        ],
        [
          "Monthly pledge",
          money(d.pledges.totals),
          d.pledges.active
            ? `${d.pledges.active} active · manual transfers`
            : d.pledges.paused
              ? "Pledges paused"
              : "No monthly pledge yet",
          "#portal/don",
        ],
        [
          "Volunteer hours",
          String(d.volunteering.hours),
          "Lead-confirmed this year",
          "#portal/vol",
        ],
        [
          d.learning.title,
          d.learning.percentage + "%",
          d.learning.enrolled
            ? `${d.learning.completed} of ${d.learning.total} lessons complete`
            : "Not enrolled yet",
          "#portal/learn",
        ],
      ]
    : [
        ["Given this year", "—", "Loading confirmed receipts", "#portal/don"],
        ["Monthly pledge", "—", "Loading your pledges", "#portal/don"],
        ["Volunteer hours", "—", "Loading confirmed hours", "#portal/vol"],
        ["Seerah School", "—", "Loading learning progress", "#portal/learn"],
      ];
  const next = d?.nextShift;
  const report = d?.report;
  return `<div class="portal-overview" ${loading ? 'aria-busy="true"' : ""}><div class="kp portal-kpis">${metrics.map((args) => metric(...args)).join("")}</div><div class="grid g2 overview-panels"><section class="card overview-panel"><div class="overview-panel-heading"><h3>Next shift</h3><a href="#portal/vol">View volunteering <span aria-hidden="true">↗</span></a></div>${!d ? "<p>Loading your booked shifts…</p>" : next ? `<h4>${esc(next.title)}</h4><p>${esc(new Date(next.date).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }))}</p><p>${esc(next.location)}${next.hours ? " · " + esc(next.hours) + " hours" : ""}</p><span class="tag z">Booked</span>` : `<div class="overview-empty"><span aria-hidden="true">◷</span><p>No upcoming shift booked.</p><a class="btn sm" href="#portal/vol">Find a volunteer shift</a></div>`}</section><section class="card overview-panel"><div class="overview-panel-heading"><h3>${report ? "Report " + esc(report.id) : "My latest report"}</h3><a href="#portal/rep">View reports <span aria-hidden="true">↗</span></a></div>${!d ? "<p>Loading your report status…</p>" : report ? `<p>${esc(report.category || "Your report")}</p><div class="track overview-track">${report.stages.map((s) => `<span class="${s.done ? "d" : ""}"><i>${s.done ? "✓" : ""}</i>${label(s.key)}</span>`).join("")}</div><p class="overview-report-note">${report.authorityReference ? "Authority: " + esc(report.authority) + " · Reference " + esc(report.authorityReference) : "Current status: " + esc(label(report.status)) + "."}</p>` : `<div class="overview-empty"><span aria-hidden="true">⌁</span><p>No report linked to your account yet.</p><a class="btn sm" href="#track">Track an anonymous report</a></div>`}</section></div><p class="note overview-note">${d?.donations.pending ? `${d.donations.pending} bank transfer${d.donations.pending === 1 ? " is" : "s are"} awaiting finance confirmation. ` : ""}Figures use your actual records. Pending transfers are excluded from confirmed giving, and volunteer hours appear after a lead confirms them.</p></div>`;
}
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-overview-retry]")) {
    clearOverview();
    go();
  }
});
