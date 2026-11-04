const FUNDS_WORK = [
  {
    id: "gen",
    title: "Where most needed",
    intro: "Flexible support for the trust’s current priorities.",
    sections: [
      [
        "Relief & urgent needs",
        "Rations, essential supplies and urgent assistance according to assessed need.",
      ],
      [
        "How support is recorded",
        "Published updates should identify the fund, reporting period, general area, activity and expenditure, without revealing private case details.",
      ],
    ],
  },
  {
    id: "zakat",
    title: "Zakat",
    intro: "A separate view of zakat-funded support and its use.",
    sections: [
      [
        "Eligibility & distribution",
        "Eligibility is assessed by the authorised team. Zakat records stay separate from general donations.",
      ],
      [
        "Your allocation",
        "Sign in to see allocations recorded against your confirmed zakat donation. Personal recipient details require recorded consent and appropriate access.",
      ],
    ],
  },
  {
    id: "winter",
    title: "Winter relief",
    intro: "Follow seasonal support for families facing cold weather.",
    sections: [
      [
        "Warmth & essential supplies",
        "Updates can cover quilts, blankets and other approved winter essentials.",
      ],
      [
        "Distribution evidence",
        "Dated reports and consented media should explain what was distributed, where at a general level, and which fund paid for it.",
      ],
    ],
  },
  {
    id: "orphan",
    title: "Orphan sponsorship",
    intro: "Support that respects a child’s safety and dignity.",
    sections: [
      [
        "Education & ongoing care",
        "Sponsorship updates can describe schooling and essential support without exposing children publicly.",
      ],
      [
        "Private progress reports",
        "Individual progress reports belong in the sponsor’s protected account. Children’s photographs, contact details and exact locations are not displayed here.",
      ],
    ],
  },
  {
    id: "ilm",
    title: "Knowledge & Maktab",
    intro: "Learning, teaching and access to educational resources.",
    sections: [
      [
        "Quran & community learning",
        "Updates can cover Maktab support, Quran resources and learning activities.",
      ],
      [
        "Learning outcomes",
        "Reports should describe the period, resources provided and documented outcomes without identifying children or publishing unverified completion figures.",
      ],
    ],
  },
  {
    id: "water",
    title: "Water wells & hand pumps",
    intro:
      "Follow water projects from planning through completion and maintenance.",
    sections: [
      [
        "Project milestones",
        "A project report should distinguish assessment, construction, completion and follow-up maintenance.",
      ],
      [
        "Lasting benefit",
        "Dated completion evidence and maintenance updates help donors understand how a project continues to serve its community.",
      ],
    ],
  },
];
let media = null,
  mediaError = false,
  loading = false,
  installPrompt = null;
const safeMedia = (src) =>
  typeof src === "string" && /^\/(?!\/)[^\\]*$/.test(src) && !/[<>"']/.test(src)
    ? src
    : "";
function loadMedia() {
  if (loading || media || mediaError) return;
  loading = true;
  fetch("/data/fund-media.json")
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then((data) => {
      media = data;
    })
    .catch(() => {
      mediaError = true;
    })
    .finally(() => {
      loading = false;
      if (S.view === "our-work" || S.view.startsWith("our-work/")) {
        document.querySelectorAll(".impact-fund").forEach((el) => {
          const fund = FUNDS_WORK.find((f) => "work-" + f.id === el.id);
          if (fund) el.querySelector(".impact-media").outerHTML = gallery(fund);
        });
      }
    });
}
function gallery(fund) {
  const items = (Array.isArray(media?.[fund.id]) ? media[fund.id] : []).filter(
    (m) => safeMedia(m.src),
  );
  return `<section class="impact-media"><h3>Fieldwork photos & videos</h3>${items.length ? `<div class="grid g2">${items.map((m) => `<figure class="card">${m.type === "video" ? `<video controls preload="metadata" src="${esc(safeMedia(m.src))}" aria-label="${esc(m.caption || fund.title)}"></video>` : `<img loading="lazy" src="${esc(safeMedia(m.src))}" alt="${esc(m.alt || m.caption || fund.title)}">`}<figcaption>${esc(m.caption || "")}${m.date ? ` · ${esc(m.date)}` : ""}${m.location ? ` · ${esc(m.location)}` : ""}</figcaption></figure>`).join("")}</div>` : `<p class="note">${mediaError ? "Media could not be loaded. Please try again later." : !media ? "Loading fieldwork media…" : "No fieldwork media has been published for this fund yet. Dated reports and consented photos or videos will appear here when available."}</p>`}</section>`;
}
function section(fund) {
  return `<section class="card impact-fund" id="work-${fund.id}"><span class="eyebrow">Fund updates</span><h2>${esc(fund.title)}</h2><p class="impact-lead">${esc(fund.intro)}</p><div class="grid g2">${fund.sections.map(([title, text]) => `<div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`).join("")}</div>${gallery(fund)}<div class="impact-actions"><button class="btn gold" data-a="donate" data-v="${fund.id}">Give to this fund</button><a class="btn" href="#track-donation">Track my donation</a>${S.view === "our-work" ? `<a class="btn" href="#our-work/${fund.id}">Open fund page →</a>` : '<a class="btn" href="#our-work">All fieldwork</a>'}</div></section>`;
}
function work(fund) {
  loadMedia();
  return `<section class="band"><div class="wrap sec"><span class="eyebrow">Our Work & Your Impact</span><h1>${esc(fund?.title || "Follow the work. See your impact.")}</h1><p>Explore the purpose of each fund, published fieldwork and your own donation records.</p><div class="impact-actions"><a class="btn gold" href="#track-donation">Track your donation</a><a class="btn" href="#transparency">Fund transparency</a></div></div></section><section class="sec"><div class="wrap">${!fund ? `<nav class="impact-filters" aria-label="Explore fieldwork by fund">${FUNDS_WORK.map((f) => `<a class="btn" href="#our-work/${f.id}">${esc(f.title)}</a>`).join("")}</nav>` : ""}<p class="note">The descriptions below explain each fund’s purpose and reporting approach. They are not completion claims. Actual activities and media are published only when recorded; personal donation details remain private.</p>${(fund ? [fund] : FUNDS_WORK).map(section).join("")}</div></section>`;
}
function trackingEntry() {
  if (member?.must_change_password) return firstPasswordView();
  if (member)
    return `<section class="sec"><div class="wrap"><span class="eyebrow">Your impact</span><h1>Track your donations</h1><p>Review your donation records, payment status, receipts and any recorded allocations.</p><div class="impact-actions"><a class="btn em" href="#portal/don">My donations & receipts (${records.filter((r) => r.kind === "donation").length})</a><a class="btn" href="#donation-tracking">Where my donation was allocated</a><button class="btn gold" data-a="donate">Make another donation</button></div></div></section>`;
  return `<section class="sec"><div class="wrap"><span class="eyebrow">Your donation journey</span><h1>Track your donation</h1><div class="grid g2"><article class="card"><h2>Already a member?</h2><p>Sign in to view only your own donation records, receipts and recorded allocations.</p><a class="btn em" href="#portal" data-impact-login>Sign in & track</a></article><article class="card"><h2>Making your first donation?</h2><p>Choose a fund and amount. When you save your bank-transfer record, create a member account to follow it in the portal.</p><button class="btn gold" data-a="donate">Make my first donation</button></article></div><p class="note">You can explore <a href="#our-work">our public fieldwork</a> without an account. A donation is confirmed only after Finance verifies receipt.</p></div></section>`;
}
export function installImpact() {
  V["our-work"] = () => work();
  V["track-donation"] = trackingEntry;
  for (const fund of FUNDS_WORK) V["our-work/" + fund.id] = () => work(fund);
  const dock = document.createElement("a");
  dock.href = "#our-work";
  dock.className = "impact-dock";
  dock.textContent = "Our Work & Your Impact";
  dock.setAttribute(
    "aria-label",
    "Our Work & Your Impact — explore fieldwork and track your donation",
  );
  document.body.append(dock);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    toast("Portal installed. Open it from your home screen.");
  });
  document.addEventListener("click", async (event) => {
    const link = event.target.closest(
      "[data-impact-login],[data-donation-track]",
    );
    if (link) {
      closeAll();
      sessionStorage.setItem("donationLoginReturn", "donation-tracking");
    }
    if (!event.target.closest("[data-install-portal]")) return;
    if (matchMedia("(display-mode: standalone)").matches) {
      toast("You are already using the installed portal.");
      return;
    }
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      await prompt.prompt();
      await prompt.userChoice;
      return;
    }
    // Keep the completion popup and its one-time credentials visible.
    const container =
      event.target.closest(".donation-thanks") || event.target.parentElement;
    if (!container.querySelector(".install-instructions"))
      container.insertAdjacentHTML(
        "beforeend",
        '<p class="note install-instructions" role="status">To install: on iPhone or iPad, open this site in Safari, tap Share, then Add to Home Screen. On Android, use your browser menu → Install app or Add to Home screen. On desktop, use the browser’s install icon if available. You can also bookmark the member portal.</p>',
      );
  });
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("/sw.js").catch(() => {});
}
