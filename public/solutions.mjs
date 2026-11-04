const icon = (path) =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const ideas = [
  [
    "Welfare & ration support",
    "Help families apply privately, book verification visits and track assistance through to delivery.",
    "Private cases · Delivery records",
    "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z",
  ],
  [
    "Volunteer coordination",
    "Manage volunteer registration, training, duty rosters and emergency availability in one place.",
    "Unit rosters · Training · Alerts",
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7a4 4 0 0 1 0 8m1 3a4 4 0 0 1 4 4v2",
  ],
  [
    "Schools & skills centres",
    "Bring admissions, class schedules, attendance and parent updates into a simple learning portal.",
    "Admissions · Attendance · Progress",
    "M3 4h7a2 2 0 0 1 2 2v15a3 3 0 0 0-3-3H3zm18 0h-7a2 2 0 0 0-2 2v15a3 3 0 0 1 3-3h6z",
  ],
  [
    "Medical camps & blood requests",
    "Organize appointment requests and reviewed blood appeals, with access limited to the people handling them.",
    "Appointments · Donor matching",
    "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
  ],
  [
    "Qard-e-Hasana records",
    "Keep interest-free loan applications, approvals, repayment schedules and balances clear for both sides.",
    "Principal only · Repayment records",
    "M3 7h18v12H3zM3 11h18m-4 4h1M7 3h10",
  ],
  [
    "Rozgar & local opportunities",
    "Publish checked job listings, apprenticeships and skills courses, and help applicants register interest.",
    "Reviewed jobs · Skills · Applications",
    "M8 7V3h8v4M3 7h18v14H3zm0 5c6 3 12 3 18 0m-9 0v4",
  ],
  [
    "Ramadan & community campaigns",
    "Plan iftar, ration, Qurbani and emergency appeals with fund categories and staff-recorded fulfilment updates.",
    "Campaign pages · Fund tracking",
    "M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10z",
  ],
  [
    "Community websites & directories",
    "Create accessible Urdu and English pages for prayer schedules, partner mosques, announcements and local support.",
    "Local information · Urdu & English",
    "M3 4h18v14H3zm4 18h10m-5-4v4M3 8h18",
  ],
];
export function digitalSolutionsPage() {
  return `
<section class="solutions-hero"><div class="wrap solutions-hero-grid"><div class="solutions-intro"><span class="eyebrow">Our Digital Solutions</span><h1>Digital tools for maktabs, mosques and the people they serve.</h1><p>From online donation and atiya records to student progress and community services, we help you plan a system that fits the way your organization works.</p><div class="solutions-hero-actions"><a class="btn gold" href="#contact/form" data-contact-digital>Request a digital solution ${icon("M5 12h14m-6-6 6 6-6 6")}</a><a class="btn ghost" href="#digital-solutions" data-solution-section="solutions-catalogue">Explore the solutions</a></div><p class="solutions-account-note">Tell us what your organization needs through our contact form. No member account is required.</p><div class="solutions-audiences"><span>Maktabs & madaris</span><span>Mosques & committees</span><span>Community trusts</span></div></div><div class="solutions-preview" aria-label="Example mosque portal"><div class="solutions-preview-top"><span class="solutions-preview-symbol">${icon("M4 21V10h16v11M8 10V7l4-4 4 4v3m-4 5v6M2 21h20")}</span><div><strong>Your mosque, online</strong><small>Illustrative donation & atiya workspace</small></div><span class="solutions-example">Example</span></div><div class="solutions-preview-body"><span class="eyebrow">Clear records for every gift</span><h2>Give with purpose.<br>Keep the record clear.</h2><div class="solutions-fund-list"><div><span class="solutions-fund-dot"></span><span><b>Atiya / عطیہ</b><small>Daily upkeep & mosque needs</small></span><span class="solutions-preview-tag">General fund</span></div><div><span class="solutions-fund-dot gold"></span><span><b>Zakat</b><small>Eligible recipients, recorded separately</small></span><span class="solutions-preview-tag">Separate fund</span></div><div><span class="solutions-fund-dot"></span><span><b>Sadaqah Jariyah</b><small>Projects with completion updates</small></span><span class="solutions-preview-tag">Project record</span></div></div><div class="solutions-preview-flow"><span>Gift details</span><i>→</i><span>Reconciliation</span><i>→</i><span>Receipt & report</span></div></div><div class="solutions-preview-footer">A proposed workspace, adapted to your organization’s needs.</div></div></div></section>
<section class="sec" id="solutions-catalogue"><div class="wrap"><div class="sh"><div><span class="eyebrow">Start with your institution</span><h2>Less paperwork. Clearer records.</h2><p>Two practical starting points for religious education and mosque administration.</p></div></div><div class="solutions-flagships"><article class="card solutions-flagship"><div class="solutions-card-icon">${icon("M3 4h7a2 2 0 0 1 2 2v15a3 3 0 0 0-3-3H3zm18 0h-7a2 2 0 0 0-2 2v15a3 3 0 0 1 3-3h6z")}</div><span class="eyebrow">For religious maktabs & madaris</span><h3>A connected maktab, from admission to progress.</h3><p>Give teachers a manageable daily register and parents a clear picture of their child’s learning.</p><ul><li>Admissions, class lists and parent-managed student records</li><li>Attendance, Hifz revision plans and teacher tajweed notes</li><li>Fees, scholarships, donations and atiya registers</li><li>Class announcements, course material and certificates</li></ul><a href="#contact/form" data-contact-digital class="solutions-text-link">Discuss your maktab’s needs <span aria-hidden="true">↗</span></a></article><article class="card solutions-flagship"><div class="solutions-card-icon gold">${icon("M4 21V10h16v11M8 10V7l4-4 4 4v3m-4 5v6M2 21h20")}</div><span class="eyebrow">For mosques & mosque committees</span><h3>A simple home for giving and community updates.</h3><p>Help your committee organize appeals, acknowledge contributions and explain how funds were used.</p><ul><li>A mosque website with prayer schedules and announcements</li><li>Donation and atiya pages with clear fund categories</li><li>Bank-transfer reconciliation, receipts and spending reports</li><li>Ramadan campaigns, project updates and committee approvals</li></ul><a href="#contact/form" data-contact-digital class="solutions-text-link">Plan your mosque’s portal <span aria-hidden="true">↗</span></a></article></div><div class="solutions-payment-note">${icon("M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z")}<p><b>Start with clear records; connect payments when ready.</b> Online collections need the organization’s bank instructions and an approved payment-provider setup. Zakat, general donations and project funds should remain clearly identified.</p></div></div></section>
<section class="sec solutions-ideas"><div class="wrap"><div class="sh"><div><span class="eyebrow">More ways to serve society</span><h2>Digital solutions worth building next.</h2><p>These are suggested services we can scope with your team, based on local needs, staffing and consent requirements.</p></div></div><div class="grid solutions-ideas-grid">${ideas.map(([title, description, tags, path]) => `<article class="card solutions-idea"><div class="solutions-card-icon">${icon(path)}</div><h3>${title}</h3><p>${description}</p><span>${tags}</span></article>`).join("")}</div></div></section>
<section class="sec"><div class="wrap"><div class="sh"><div><span class="eyebrow">A practical way forward</span><h2>Build around the people using it.</h2></div></div><ol class="solutions-process">${[
    [
      "Understand",
      "Tell us about your institution, current records and the work that takes the most time.",
    ],
    [
      "Agree the scope",
      "Choose a useful first version, clear permissions and the reports your team actually needs.",
    ],
    [
      "Set up & train",
      "Prepare the workflows and help staff learn how to keep records accurate.",
    ],
    [
      "Review & improve",
      "Gather feedback, maintain access controls and add features as your service grows.",
    ],
  ]
    .map(
      ([title, description], i) =>
        `<li><span>0${i + 1}</span><h3>${title}</h3><p>${description}</p></li>`,
    )
    .join(
      "",
    )}</ol><div class="solutions-final-cta"><div><span class="eyebrow">Your institution’s next step</span><h2>Tell us what your community needs.</h2><p>Start with one useful service. We can discuss the scope, privacy needs and support before building further.</p></div><a class="btn gold" href="#contact/form" data-contact-digital>Request a digital solution ${icon("M5 12h14m-6-6 6 6-6 6")}</a></div></div></section>`;
}
