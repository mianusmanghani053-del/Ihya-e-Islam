import { READINGS } from "./seerah.mjs";
import { WORKFLOWS, GROUPS } from "./workflows.mjs";
const publicPages = [
  ["home", "Home"],
  ["quran", "Quran"],
  ["hadith", "Hadith"],
  ["seerah", "Seerah & Khulafa"],
  ["programs", "Programs"],
  ["volunteer", "Volunteer"],
  ["activities", "Activities"],
  ["digital-solutions", "Our Digital Solutions"],
  ["report", "Report a Crime"],
  ["track", "Track a report or idea"],
  ["community", "Community"],
  ["tools", "Islamic tools"],
  ["transparency", "Fund transparency"],
  ["support-line", "Confidential support"],
  ["privacy", "Privacy & service information"],
  ["about-manhaj", "Our approach"],
  ["register", "Create account"],
  ["route-map", "Route map"],
];
const tabs = [
  ["over", "Overview"],
  ["don", "Donations"],
  ["vol", "Volunteering"],
  ["learn", "Learning"],
  ["rep", "My reports"],
  ["settings", "Settings"],
];
const memberPages = [
  ["portal", "Portal overview"],
  ...tabs
    .filter(([key]) => key !== "over")
    .map(([key, label]) => ["portal/" + key, label]),
  ["hub", "All Services"],
  ["donation-tracking", "Track & confirm donations"],
  ["notifications", "Alerts & reminders"],
  ["credentials", "Verified credentials"],
  ["unit-profile", "Unit & blood profile"],
];
const staffPages = [
  ["staff", "Staff portal"],
  ["decision-bench", "Decision Bench"],
  ["admin", "Administration (staff portal)"],
  ["content-tools", "Courses, events & shifts"],
];
const nameOf = (route) =>
  [
    ...publicPages,
    ...memberPages,
    ...staffPages,
    ...READINGS.map((r) => ["seerah/" + r.slug, r.title]),
  ].find(([key]) => key === route)?.[1] ||
  WORKFLOWS[route.replace("services/", "")]?.title ||
  route.replaceAll("-", " ");
function routeMap() {
  const groups = [
    [
      "Seerah reading library",
      READINGS.map((r) => ({
        route: "seerah/" + r.slug,
        label: r.title,
        access: "Public",
      })),
    ],
    [
      "Website",
      publicPages.map(([route, label]) => ({ route, label, access: "Public" })),
    ],
    [
      "Member portal",
      memberPages.map(([route, label]) => ({
        route,
        label,
        access: "Members",
      })),
    ],
    ...Object.entries(GROUPS).map(([key, title]) => [
      title,
      Object.entries(WORKFLOWS)
        .filter(([, w]) => w.group === key)
        .map(([kind, w]) => ({
          route: "services/" + kind,
          label: w.title,
          access: key === "staff" ? "Staff" : "Members",
        })),
    ]),
    [
      "Staff portal",
      staffPages.map(([route, label]) => ({ route, label, access: "Staff" })),
    ],
  ];
  const known = new Set(
    groups.flatMap(([, rows]) => rows.map((row) => row.route)),
  );
  const other = Object.keys(V).filter(
    (route) =>
      !known.has(route) &&
      !route.startsWith("verify/") &&
      !route.startsWith("portal/"),
  );
  if (other.length)
    groups.push([
      "Other pages",
      other.map((route) => ({
        route,
        label: nameOf(route),
        access: "Access checked on page",
      })),
    ]);
  return `<section class="sec route-map-page"><div class="wrap"><div class="sh"><div><span class="eyebrow">Website & member portal</span><h1>Route map</h1><p>Find every page in one place. Member pages require sign-in, and staff pages check your assigned permissions.</p></div></div><label class="route-search">Find a page<input id="route-map-search" type="search" placeholder="Search donations, learning, help, staff…" autocomplete="off"></label><p class="route-map-count" aria-live="polite">${groups.reduce((n, [, rows]) => n + rows.length, 0)} pages</p>${groups.map(([title, rows]) => `<section class="route-map-group"><h2>${esc(title)}</h2><div class="route-map-grid">${rows.map((row) => `<a class="route-map-link" href="#${row.route}" data-search="${esc((row.label + " " + title + " " + row.route).toLowerCase())}"><span>${esc(row.label)}</span><small>${esc(row.access)}</small><span class="route-map-path">#${esc(row.route)}</span><b aria-hidden="true">↗</b></a>`).join("")}</div></section>`).join("")}<section class="route-map-group"><h2>Guided screens</h2><div class="card"><h3>Donation workflow</h3><p>Choose a gift → donor details & payment method → payment availability or transfer instructions.</p><button class="btn" data-a="donate">Open donation popup</button><h3 style="margin-top:24px">Credential verification</h3><p>An issued QR code opens its own public verification page. Personal credential links are not listed in this route map.</p><a class="btn" href="#credentials">My verified credentials</a><p class="note" style="margin-top:16px">Private record details, documents, certificates and finance actions open from their parent service pages. This directory does not list anyone’s case or document identifiers.</p></div></section></div></section>`;
}
function breadcrumb() {
  const raw = location.hash.slice(1) || "home";
  let rows = [{ label: "Home", href: "#home" }];
  if (raw.startsWith("seerah/"))
    rows.push(
      { label: "Seerah & Khulafa", href: "#seerah" },
      { label: nameOf(raw) },
    );
  else if (raw === "register")
    rows.push(
      { label: "Portal", href: "#portal" },
      { label: "Create account" },
    );
  else if (S.view === "portal" || raw.startsWith("portal/"))
    rows.push(
      { label: "Portal", href: "#portal" },
      {
        label: member
          ? tabs.find(([key]) => key === S.pTab)?.[1] || "Overview"
          : "Sign in",
      },
    );
  else if (raw.startsWith("services/") && WORKFLOWS[raw.slice(9)]) {
    const w = WORKFLOWS[raw.slice(9)];
    rows.push(
      { label: "Portal", href: "#portal" },
      { label: "All Services", href: "#hub" },
      { label: GROUPS[w.group] },
      { label: w.title },
    );
  } else if (
    [
      "hub",
      "donation-tracking",
      "notifications",
      "credentials",
      "unit-profile",
      "staff",
      "admin",
      "content-tools",
    ].includes(S.view)
  )
    rows.push(
      { label: "Portal", href: "#portal" },
      ...(S.view === "content-tools"
        ? [{ label: "Staff portal", href: "#staff" }]
        : []),
      { label: nameOf(S.view) },
    );
  else if (raw.startsWith("verify/"))
    rows.push({ label: "Credential verification" });
  else if (raw === "track")
    rows.push(
      { label: "Report a Crime", href: "#report" },
      { label: "Track a report" },
    );
  else if (raw === "about-manhaj") rows.push({ label: "Our approach" });
  else if (S.view !== "home") rows.push({ label: nameOf(S.view) });
  const html = rows
    .map(
      (row, i) =>
        `<li>${row.href && i < rows.length - 1 ? `<a href="${row.href}">${esc(row.label)}</a>` : `<span ${i === rows.length - 1 ? 'aria-current="page"' : ""}>${esc(row.label)}</span>`}</li>`,
    )
    .join("");
  document
    .getElementById("view")
    .insertAdjacentHTML(
      "afterbegin",
      `<div class="route-strip"><div class="wrap"><nav aria-label="Breadcrumb"><ol>${html}</ol></nav><a class="route-directory" href="#route-map">Route map <span aria-hidden="true">↗</span></a></div></div>`,
    );
}
export function installNavigation() {
  V["route-map"] = routeMap;
  for (const [key] of tabs) {
    V["portal/" + key] = () => {
      S.pTab = key;
      S.view = "portal";
      return V.portal();
    };
  }
  const previousGo = go;
  go = () => {
    previousGo();
    breadcrumb();
  };
  document.addEventListener(
    "click",
    (event) => {
      const a = event.target.closest('a[href="#portal"]');
      if (!a) return;
      event.preventDefault();
      S.pTab = "over";
      if (location.hash === "#portal") go();
      else location.hash = "portal";
    },
    true,
  );
  document.addEventListener("input", (event) => {
    if (event.target.id !== "route-map-search") return;
    const q = event.target.value.toLowerCase().trim();
    let count = 0;
    document.querySelectorAll(".route-map-link").forEach((link) => {
      const visible = link.dataset.search.includes(q);
      link.hidden = !visible;
      if (visible) count++;
    });
    document.querySelectorAll(".route-map-group").forEach((group) => {
      const links = group.querySelectorAll(".route-map-link");
      if (links.length) group.hidden = ![...links].some((link) => !link.hidden);
    });
    document.querySelector(".route-map-count").textContent = count + " pages";
  });

  route();
}
