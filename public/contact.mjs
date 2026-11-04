import { CONTACT_SERVICES } from "./contact-options.mjs";
const TOPICS = [
  "Donation & receipt",
  "Member portal",
  "Volunteering",
  "Learning & courses",
  "Digital solutions",
  "General enquiry",
];
const FAQ = [
  [
    "How do I check my donation?",
    "Sign in to your member account to see bank-transfer status, receipts and recorded allocations. A saved transfer stays pending until Finance verifies receipt.",
    "Track my donation",
    "#track-donation",
  ],
  [
    "Where can I see your fieldwork?",
    "Browse each fund’s public updates, photos and videos in Our Work & Your Impact. Individual donor and beneficiary information is kept private.",
    "Explore our work",
    "#our-work",
  ],
  [
    "How do I get help with my account?",
    "Use the contact form, select Member portal and describe what went wrong. Include your account email, but never send your password, temporary password or verification codes.",
    "Open the form",
    "#contact/form",
  ],
  [
    "Can I volunteer or join a course?",
    "Volunteer applications and published learning activities have their own pages. Use the form if you need help finding the right programme.",
    "Explore activities",
    "#activities",
  ],
  [
    "How do I request welfare or confidential support?",
    "Use the dedicated help or confidential support services for personal cases. The general contact form is for ordinary enquiries and does not accept CNIC documents or medical records.",
    "Confidential support",
    "#support-line",
  ],
  [
    "Can a mosque or Maktab request digital solutions?",
    "Explore the available digital services, then send your requirements through the dedicated enquiry workflow or the contact form.",
    "Our digital solutions",
    "#digital-solutions",
  ],
];
let settings = null,
  settingsError = false,
  settingsLoading = false;
const allowed = () =>
  member &&
  (member.roles || [member.role]).some((r) =>
    ["admin", "chairman", "trustee", "city_coordinator"].includes(r),
  );
function settingsLoad() {
  if (settings || settingsError || settingsLoading) return;
  settingsLoading = true;
  api("/contact-settings")
    .then((data) => {
      settings = data;
    })
    .catch(() => {
      settingsError = true;
    })
    .finally(() => {
      settingsLoading = false;
      const el = document.getElementById("contact-whatsapp");
      if (el) el.innerHTML = whatsapp();
    });
}
function whatsapp() {
  if (!settings && !settingsError) {
    settingsLoad();
    return '<p role="status">Checking WhatsApp availability…</p>';
  }
  return `<div class="contact-channel-symbol" aria-hidden="true">↗</div><h2>Continue the conversation on WhatsApp</h2><p>For general enquiries, open a conversation with the trust’s published number. You choose whether to send the message.</p>${settings?.whatsapp ? `<a class="btn em" href="https://wa.me/${settings.whatsapp}?text=${encodeURIComponent("Assalamu alaikum. I would like help with an Ihya-e-Islam enquiry.")}" target="_blank" rel="noopener noreferrer">Open WhatsApp · +${esc(settings.whatsapp)}</a>` : `<p class="note">${settingsError ? "WhatsApp availability could not be checked. Please use the contact form." : "Our WhatsApp contact will appear here once the trust publishes its official number."}</p><a class="btn em" href="#contact/form">Use the contact form</a>`}<p><button class="btn gold" type="button" data-contact-private>Write a Private Message</button></p><p class="contact-small">WhatsApp is an external service. Do not send passwords, bank PINs, CNIC images or confidential case documents. This channel is not an emergency service.</p>`;
}
function serviceField(selected = "") {
  return `<label>Related service<select name="service"><option value="">General enquiry / not sure</option>${[
    ...new Set(CONTACT_SERVICES.map((s) => s.group)),
  ]
    .map(
      (group) =>
        `<optgroup label="${esc(group)}">${CONTACT_SERVICES.filter(
          (s) => s.group === group,
        )
          .map(
            (s) =>
              `<option value="${esc(s.id)}" ${s.id === selected ? "selected" : ""}>${esc(s.label)}</option>`,
          )
          .join("")}</optgroup>`,
    )
    .join("")}</select></label>`;
}
function form() {
  const digital = sessionStorage.getItem("contactDigitalEnquiry") === "yes";
  sessionStorage.removeItem("contactDigitalEnquiry");
  return `<div class="contact-form-layout"><div><span class="eyebrow">Send an enquiry</span><h2>How can we help?</h2><p>Tell us what you need and leave an email address so the team can respond.</p><div class="contact-guidance"><h3>Keep your message safe</h3><p>For a donation query, include the donation reference if you have one. Please leave out passwords, bank PINs and sensitive personal documents.</p><a href="#support-line">Need confidential support? →</a></div></div><form class="contact-form" data-contact-form><div class="contact-form-row"><label>Full name<input name="name" autocomplete="name" maxlength="100" required></label><label>Email address<input type="email" name="email" autocomplete="email" maxlength="254" required></label></div><div class="contact-form-row"><label>Phone / WhatsApp (optional)<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label><label>What is your enquiry about?<select name="topic" required><option value="">Choose a topic</option>${TOPICS.map((t) => `<option ${digital && t === "Digital solutions" ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>${serviceField(digital ? "services/digital_enquiry" : "")}<label>Subject<input name="subject" maxlength="150" required></label><label>Your message<textarea name="message" rows="6" minlength="10" maxlength="5000" required placeholder="Please include the details that will help us understand your enquiry."></textarea></label><div class="contact-honey" aria-hidden="true"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="contact-consent"><input name="consent" type="checkbox" required><span>I agree that the trust may use these details to respond to this enquiry. <a href="#privacy">Privacy information</a></span></label><p class="err" role="alert"></p><button class="btn gold" type="submit">Send my message <span aria-hidden="true">→</span></button><p class="contact-small">Your message is saved for the authorised team. We do not promise an immediate response or send an automatic email.</p></form></div>`;
}
function help() {
  return `<div class="contact-help-heading"><div><span class="eyebrow">Find your next step</span><h2>A little guidance, before you write</h2><p>Find answers and the right place to continue.</p></div><a class="btn" href="#contact/form">I still need help →</a></div><div class="grid g2 contact-faq">${FAQ.map(([q, a, label, href], i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p><a href="${href}">${esc(label)} →</a></details>`).join("")}</div>`;
}
function page(tab = "help") {
  return `<section class="contact-hero"><div class="wrap"><span class="eyebrow">We’re here to listen</span><h1>Let’s connect.</h1><p>Questions, support or a conversation about serving the community. Find the right way to reach Ihya-e-Islam.</p><div class="contact-hero-note"><span aria-hidden="true">✦</span> Every sincere question is a place to begin.</div></div></section><section class="contact-section"><div class="wrap"><div class="contact-tabs" role="tablist" aria-label="Ways to contact us">${[
    ["help", "Help & Support", "?"],
    ["form", "Contact Us Form", "✉"],
    ["whatsapp", "WhatsApp", "↗"],
  ]
    .map(
      ([key, label, icon]) =>
        `<a id="contact-tab-${key}" class="contact-tab ${tab === key ? "active" : ""}" href="#contact/${key}" role="tab" aria-selected="${tab === key}" aria-controls="contact-panel" tabindex="${tab === key ? "0" : "-1"}"><span aria-hidden="true">${icon}</span>${label}</a>`,
    )
    .join(
      "",
    )}</div><div class="card contact-panel" id="contact-panel" role="tabpanel" aria-labelledby="contact-tab-${tab}">${tab === "form" ? form() : tab === "whatsapp" ? `<div id="contact-whatsapp">${whatsapp()}</div>` : help()}</div><div class="contact-bottom"><p><b>Need to report a crime or a person at risk?</b><br>Use the dedicated reporting service. For immediate danger, contact your local emergency service.</p><a class="btn" href="#report">Go to reporting →</a></div></div></section>`;
}
async function inbox() {
  const el = document.getElementById("contact-inbox-list");
  if (!el) return;
  try {
    const { items } = await api("/contact/messages");
    if (!el.isConnected) return;
    el.innerHTML =
      items
        .map(
          (r) =>
            `<article class="card"><div class="service-heading"><h2>${esc(r.data.subject)}</h2><span class="tag">${esc(r.status.replaceAll("_", " "))}</span></div><p>${esc(r.data.topic)}${r.data.service ? " · " + esc(CONTACT_SERVICES.find((s) => s.id === r.data.service)?.label || r.data.service) : ""} · ${esc(r.created_at)}</p><p><b>${esc(r.data.name)}</b> · <a href="mailto:${esc(r.data.email)}">${esc(r.data.email)}</a>${r.data.phone ? " · " + esc(r.data.phone) : ""}</p><p class="contact-message">${esc(r.data.message)}</p><p class="contact-small">Reference: ${esc(r.id)}</p><form data-contact-status data-id="${esc(r.id)}"><label>Status <select name="status">${["received", "in_progress", "closed"].map((s) => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label><button class="btn">Save status</button><p class="err" role="alert"></p></form></article>`,
        )
        .join("") ||
      '<p class="note">No contact enquiries have been received.</p>';
  } catch (e) {
    if (el.isConnected) el.textContent = e.message;
  }
}
function privateMessage() {
  openMd(
    "Send a Private Message",
    `<p>Your website message is visible to the authorised contact team. For sensitive support cases, use <a href="#support-line">Confidential support</a>.</p><form class="contact-form" data-contact-form><input type="hidden" name="topic" value="General enquiry"><input type="hidden" name="subject" value="Private contact message">${serviceField()}<label>Your message<textarea name="message" rows="5" minlength="10" maxlength="3000" required placeholder="How can we help?"></textarea></label>${settings?.whatsapp ? `<button class="btn" type="button" data-private-whatsapp>Continue privately on WhatsApp</button><p class="contact-small">This opens WhatsApp with your draft. Nothing is sent until you press Send there. To use the website inbox instead, complete the details below.</p>` : '<p class="note">The official WhatsApp number has not been published. You can send a private website enquiry below.</p>'}<div class="contact-form-row"><label>Your name<input name="name" maxlength="100" autocomplete="name" value="${esc(member?.name || "")}" required></label><label>Reply email<input name="email" type="email" maxlength="254" autocomplete="email" value="${esc(member?.email || "")}" required></label></div><label class="contact-consent"><input name="consent" type="checkbox" required><span>I agree the team may use these details to respond to my enquiry.</span></label><p class="err" role="alert"></p><button class="btn em" type="submit">Send private website message</button><p class="contact-small">Never send passwords, bank PINs or identity documents. This is not an emergency service.</p></form>`,
  );
  document.querySelector("#md textarea")?.focus();
}
export function installContact() {
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest("[data-contact-digital]"))
        sessionStorage.setItem("contactDigitalEnquiry", "yes");
    },
    true,
  );
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-contact-private]")) privateMessage();
    const button = event.target.closest("[data-private-whatsapp]");
    if (button && settings?.whatsapp) {
      const message = button.closest("form").elements.message;
      if (!message.reportValidity()) return;
      window.open(
        "https://wa.me/" +
          settings.whatsapp +
          "?text=" +
          encodeURIComponent(
            (CONTACT_SERVICES.find(
              (s) => s.id === button.closest("form").elements.service.value,
            )?.label
              ? "Service: " +
                CONTACT_SERVICES.find(
                  (s) => s.id === button.closest("form").elements.service.value,
                ).label +
                "\n\n"
              : "") + message.value,
          ),
        "_blank",
        "noopener,noreferrer",
      );
    }
  });
  V.contact = () => page();
  for (const tab of ["help", "form", "whatsapp"])
    V["contact/" + tab] = () => page(tab);
  V["contact-inbox"] = () => {
    if (!member) return authView();
    if (member.must_change_password) return firstPasswordView();
    if (!allowed())
      return '<section class="sec"><div class="wrap"><p>Contact inbox access is restricted to the authorised team.</p></div></section>';
    queueMicrotask(inbox);
    return '<section class="sec"><div class="wrap"><a class="btn" href="#staff">← Staff portal</a><h1>Contact enquiries</h1><p>Latest 100 enquiries. Viewing this inbox is logged. Reply through the supplied contact address; changing a status does not send an email.</p><div class="contact-inbox" id="contact-inbox-list" aria-live="polite">Loading enquiries…</div></div></section>';
  };
  document.addEventListener("keydown", (event) => {
    const tab = event.target.closest(".contact-tab");
    if (!tab || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key))
      return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll(".contact-tab")],
      i = tabs.indexOf(tab);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 2
          : (i + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    location.hash = tabs[next].hash;
    setTimeout(() => document.getElementById(tabs[next].id)?.focus(), 0);
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!form.matches("[data-contact-form],[data-contact-status]")) return;
    event.preventDefault();
    const button = form.querySelector(
      'button[type="submit"],button:not([type])',
    );
    button.disabled = true;
    const error = form.querySelector(".err");
    error.textContent = "";
    try {
      const values = Object.fromEntries(new FormData(form));
      if (form.matches("[data-contact-status]")) {
        await send(
          "/contact/messages",
          { id: form.dataset.id, status: values.status },
          "PATCH",
        );
        await inbox();
        toast("Message status updated.");
      } else {
        const result = await send("/contact", {
          ...values,
          consent: form.elements.consent.checked,
        });
        form.innerHTML = `<div class="contact-success" role="status"><span aria-hidden="true">✓</span><h2>Thank you for reaching out.</h2><p>Your message has been saved for our team.</p><p class="note">Enquiry reference<br><b>${esc(result.id)}</b></p><p>Keep this reference if you contact us again. The team can use the contact details you provided to respond. No automatic email has been sent.</p><a class="btn" href="#contact/help">Back to Help & Support</a></div>`;
      }
    } catch (e) {
      error.textContent = e.message;
    } finally {
      button.disabled = false;
    }
  });
}
