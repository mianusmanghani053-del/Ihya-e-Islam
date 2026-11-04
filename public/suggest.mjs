// "Share an idea": sticky suggestion button and short 4-step flow.
// Submissions go to /api/records (kind "suggestion"); an optional voice note
// is uploaded to /api/suggestions/:id/audio with the private tracking key.
import { WORKFLOWS } from "./workflows.mjs";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const BULB =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></svg>';
const SHIELD =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>';
const TYPES = [
  [
    "idea",
    "New idea",
    "Something we could start",
    "#0e7a5c",
    "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z",
  ],
  [
    "improve",
    "Improve something",
    "Make an existing thing better",
    "#2563eb",
    "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
  ],
  [
    "problem",
    "Point out a problem",
    "Something isn't working",
    "#b45309",
    "M12 3 2 20h20zM12 10v4M12 17v.5",
  ],
  [
    "appreciation",
    "Appreciation",
    "Thank a team or volunteer",
    "#c2417a",
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z",
  ],
];
const CONTACT = [
  ["whatsapp", "WhatsApp"],
  ["call", "Phone call"],
  ["sms", "SMS"],
  ["none", "No reply needed"],
];
const URGENCY = [
  ["can_wait", "Can wait"],
  ["soon", "Soon"],
  ["urgent", "Urgent"],
];
const STEPS = ["What", "Your idea", "Contact", "Send"];
const REASSURE = [
  "Every suggestion is read by a real person and taken to our Decision Bench.",
  "A few words is enough. If we need more, we will ask you.",
  "Your number is used only to update you about this suggestion. It is never shared or published.",
  "Once sent, our team reviews it and records a decision. You can track it at any time.",
];
const MAX_SECONDS = 120;

let draft = fresh();
let step = 0;
let activities = null;
let recorder = null;
let chunks = [];
let timer = null;
let seconds = 0;
let audio = null; // { blob, url, type }

function fresh() {
  return {
    type: "",
    area: "",
    areaGroup: "",
    summary: "",
    details: "",
    urgency: "can_wait",
    wantsToHelp: false,
    contactPref: "whatsapp",
    phone: "",
    name: "",
    city: "",
  };
}

async function loadActivities() {
  if (activities) return activities;
  try {
    const r = await fetch("/api/resources", { credentials: "same-origin" });
    activities = r.ok ? (await r.json()).items || [] : [];
  } catch {
    activities = [];
  }
  return activities;
}

function areaGroups() {
  const groups = [];
  const programs = typeof PROGRAMS !== "undefined" ? PROGRAMS : [];
  for (const p of programs)
    groups.push([
      "Program: " + p.t,
      [p.t + " (in general)", ...(p.it || []).map((i) => i[0])],
    ]);
  groups.push([
    "Activities",
    [
      ...(activities || [])
        .map((a) => a.data?.title || a.title)
        .filter(Boolean),
      "Events in general",
      "Volunteer shifts",
      "Courses and classes",
    ],
  ]);
  const funds = typeof FUNDS !== "undefined" ? FUNDS : [];
  groups.push([
    "Donations and funds",
    [...funds.map((f) => f.n), "Donation process", "Receipts and transparency"],
  ]);
  groups.push([
    "Member portal services",
    Object.values(WORKFLOWS).map((w) => w.title),
  ]);
  groups.push([
    "Other",
    [
      "Website or mobile experience",
      "Mosques and partners",
      "Staff or volunteer conduct",
      "Something else",
    ],
  ]);
  return groups.map(([label, items]) => [label, [...new Set(items)]]);
}

const $ = (sel) => dialog.querySelector(sel);

const dock = document.createElement("button");
dock.type = "button";
dock.className = "suggest-dock";
dock.setAttribute("aria-haspopup", "dialog");
dock.innerHTML = `<span class="suggest-dock-icon">${BULB}</span><span class="suggest-dock-label">Share an idea</span>`;
dock.setAttribute("aria-label", "Share an idea or suggestion");
document.body.append(dock);

const dialog = document.createElement("dialog");
dialog.className = "suggest-dialog";
dialog.setAttribute("aria-labelledby", "suggest-title");
document.body.append(dialog);

function header(title) {
  return `<div class="sg-head"><h2 id="suggest-title">${esc(title)}</h2><button type="button" class="sg-x" data-sg="close" aria-label="Close">✕</button></div>${
    step < 4
      ? `<ol class="sg-steps" aria-label="Step ${step + 1} of 4">${STEPS.map((s, i) => `<li class="${i < step ? "done" : i === step ? "on" : ""}" ${i === step ? 'aria-current="step"' : ""}><span>${i + 1}</span>${esc(s)}</li>`).join("")}</ol>`
      : ""
  }`;
}
const reassure = (i) =>
  `<p class="sg-assure">${SHIELD}<span>${esc(REASSURE[i])}</span></p>`;
const nav = (next = "Next", back = true) =>
  `<p class="sg-err" role="alert"></p><div class="sg-nav">${back ? '<button type="button" class="sg-btn" data-sg="back">← Back</button>' : '<button type="button" class="sg-btn" data-sg="close">Cancel</button>'}<button type="submit" class="sg-btn sg-primary">${esc(next)}</button></div>`;

function render() {
  const d = draft;
  let body = "";
  if (step === 0) {
    body = `${header("Share an idea with us")}<form data-sg-form novalidate>${reassure(0)}<fieldset class="sg-types"><legend>What would you like to share?</legend>${TYPES.map(([v, label, sub, color, path]) => `<label class="sg-type" style="--c:${color}"><input type="radio" name="type" value="${v}" ${d.type === v ? "checked" : ""} required><span class="sg-type-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg></span><span><b>${esc(label)}</b><small>${esc(sub)}</small></span></label>`).join("")}</fieldset><label class="sg-label" for="sg-area">Which area is it about?</label><select id="sg-area" name="area" required><option value="">Choose a program, activity or service</option>${areaGroups()
      .map(
        ([g, items]) =>
          `<optgroup label="${esc(g)}">${items.map((i) => `<option data-group="${esc(g)}" ${d.area === i && d.areaGroup === g ? "selected" : ""}>${esc(i)}</option>`).join("")}</optgroup>`,
      )
      .join("")}</select>${nav("Next", false)}</form>`;
  } else if (step === 1) {
    const voiceSupported =
      typeof MediaRecorder !== "undefined" &&
      navigator.mediaDevices?.getUserMedia;
    body = `${header("Tell us in a few words")}<form data-sg-form novalidate>${reassure(1)}<label class="sg-label" for="sg-summary">Your suggestion in one line</label><input id="sg-summary" name="summary" maxlength="140" value="${esc(d.summary)}" placeholder="e.g. Start a weekend Quran class for children in our area" aria-describedby="sg-summary-count"><small class="sg-count" id="sg-summary-count">${d.summary.length}/140</small><label class="sg-label" for="sg-details">More detail <span>(optional)</span></label><textarea id="sg-details" name="details" maxlength="1500" rows="3" placeholder="Where, who it helps, or how it could work">${esc(d.details)}</textarea>${
      voiceSupported
        ? `<div class="sg-voice"><span class="sg-label" style="margin:0">Or record a voice note <span>(optional, up to 2 minutes)</span></span><div id="sg-voice-ui"></div></div>`
        : ""
    }<fieldset class="sg-chips"><legend>How soon does this need attention?</legend>${URGENCY.map(([v, l]) => `<label><input type="radio" name="urgency" value="${v}" ${d.urgency === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</fieldset><p class="sg-urgent-note" ${d.urgency === "urgent" ? "" : "hidden"}>If someone is in danger or a crime is happening, please use <a href="#report" data-sg="close">Report a Crime</a> or call 15.</p><label class="sg-check"><input type="checkbox" name="wantsToHelp" ${d.wantsToHelp ? "checked" : ""}> I would like to help make this happen</label>${nav()}</form>`;
  } else if (step === 2) {
    const none = d.contactPref === "none";
    body = `${header("How can we update you?")}<form data-sg-form novalidate>${reassure(2)}<fieldset class="sg-chips"><legend>Best way to reach you</legend>${CONTACT.map(([v, l]) => `<label><input type="radio" name="contactPref" value="${v}" ${d.contactPref === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</fieldset><div class="sg-contact" ${none ? "hidden" : ""}><label class="sg-label" for="sg-phone">Mobile / WhatsApp number</label><input id="sg-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" value="${esc(d.phone)}" placeholder="03XX XXXXXXX"><div class="sg-two"><div><label class="sg-label" for="sg-name">Your name <span>(optional)</span></label><input id="sg-name" name="name" autocomplete="name" maxlength="100" value="${esc(d.name)}"></div><div><label class="sg-label" for="sg-city">City <span>(optional)</span></label><input id="sg-city" name="city" autocomplete="address-level2" maxlength="100" value="${esc(d.city)}"></div></div></div><p class="sg-none-note" ${none ? "" : "hidden"}>That's fine. Your suggestion still goes to the Decision Bench, and you can check its status with your tracking key.</p>${nav()}</form>`;
  } else if (step === 3) {
    const t = TYPES.find((x) => x[0] === d.type);
    const c = CONTACT.find((x) => x[0] === d.contactPref);
    const row = (k, v, s) =>
      `<div><dt>${esc(k)}</dt><dd>${v}</dd><dd><button type="button" class="sg-edit" data-sg="goto" data-step="${s}" aria-label="Edit ${esc(k)}">Edit</button></dd></div>`;
    body = `${header("Check and send")}<form data-sg-form novalidate>${reassure(3)}<dl class="sg-review">${row("Type", esc(t?.[1]), 0)}${row("Area", esc(d.area), 0)}${row("Suggestion", esc(d.summary || "Voice note"), 1)}${d.details ? row("Detail", esc(d.details), 1) : ""}${audio ? row("Voice note", `Recorded (${fmtTime(seconds)})`, 1) : ""}${row("Urgency", esc(URGENCY.find((u) => u[0] === d.urgency)?.[1]), 1)}${d.wantsToHelp ? row("Help", "Would like to help", 1) : ""}${row("Contact", d.contactPref === "none" ? "No reply needed" : `${esc(c?.[1])} · ${esc(d.phone)}${d.name ? " · " + esc(d.name) : ""}`, 2)}</dl>${nav("Send suggestion")}</form>`;
  }
  dialog.innerHTML = `<div class="sg-wrap">${body}</div>`;
  if (step === 1) voiceUi();
  dialog
    .querySelector("input:not([type=radio]):not([type=checkbox]),select")
    ?.focus();
}

const fmtTime = (s) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function voiceUi() {
  const ui = $("#sg-voice-ui");
  if (!ui) return;
  if (recorder?.state === "recording")
    ui.innerHTML = `<div class="sg-rec"><span class="sg-dot" aria-hidden="true"></span><span aria-live="polite">Recording ${fmtTime(seconds)} / ${fmtTime(MAX_SECONDS)}</span><button type="button" class="sg-btn" data-sg="stop">Stop</button></div>`;
  else if (audio)
    ui.innerHTML = `<div class="sg-rec"><audio controls src="${audio.url}"></audio><button type="button" class="sg-btn" data-sg="discard">Delete</button></div>`;
  else
    ui.innerHTML = `<button type="button" class="sg-btn sg-mic" data-sg="record"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg> Record voice note</button>`;
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/webm",
    ].find((t) => MediaRecorder.isTypeSupported?.(t));
    recorder = new MediaRecorder(stream, {
      ...(type ? { mimeType: type } : {}),
      audioBitsPerSecond: 32000,
    });
    chunks = [];
    seconds = 0;
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, {
        type: (recorder.mimeType || type || "audio/webm").split(";")[0],
      });
      audio = blob.size
        ? { blob, url: URL.createObjectURL(blob), type: blob.type }
        : null;
      voiceUi();
    };
    recorder.start(1000);
    timer = setInterval(() => {
      seconds++;
      if (seconds >= MAX_SECONDS) recorder.stop();
      voiceUi();
    }, 1000);
    voiceUi();
  } catch {
    const err = $(".sg-err");
    if (err)
      err.textContent =
        "We couldn't use your microphone. Please allow microphone access, or type your suggestion instead.";
  }
}

function discardAudio() {
  if (audio) URL.revokeObjectURL(audio.url);
  audio = null;
  seconds = 0;
  voiceUi();
}

function collect(form) {
  const f = new FormData(form);
  for (const k of ["summary", "details", "phone", "name", "city"])
    if (f.has(k)) draft[k] = String(f.get(k)).trim();
  for (const k of ["type", "urgency", "contactPref"])
    if (f.has(k)) draft[k] = String(f.get(k));
  if (form.elements.wantsToHelp)
    draft.wantsToHelp = form.elements.wantsToHelp.checked;
  if (form.elements.area) {
    const opt = form.elements.area.selectedOptions[0];
    draft.area = opt?.value || "";
    draft.areaGroup = opt?.dataset.group || "";
  }
}

function validate() {
  const d = draft;
  if (step === 0) {
    if (!d.type) return "Please choose what you would like to share.";
    if (!d.area) return "Please choose the area it is about.";
  }
  if (step === 1) {
    if (recorder?.state === "recording")
      return "Please stop the recording first.";
    if (!audio && d.summary.length < 5)
      return "Please write your suggestion in a few words, or record a voice note.";
  }
  if (step === 2 && d.contactPref !== "none") {
    if (!/^\+?\d{10,15}$/.test(d.phone.replace(/[\s()-]/g, "")))
      return "Please enter a valid mobile number, e.g. 0300 1234567.";
  }
  return "";
}

async function submit() {
  const secret = crypto.randomUUID();
  const d = draft;
  const payload = {
    kind: "suggestion",
    ...d,
    summary: d.summary || `Voice note about ${d.area}`.slice(0, 140),
    phone: d.contactPref === "none" ? "" : d.phone,
    trackingSecret: secret,
  };
  const r = await fetch("/api/records", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(result.error || "Please try again.");
  let voiceWarning = "";
  if (audio) {
    try {
      const v = await fetch(
        `/api/suggestions/${encodeURIComponent(result.id)}/audio`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": audio.type, "X-Tracking-Key": secret },
          body: audio.blob,
        },
      );
      if (!v.ok)
        voiceWarning =
          (await v.json().catch(() => ({}))).error ||
          "The voice note could not be uploaded.";
    } catch {
      voiceWarning = "The voice note could not be uploaded.";
    }
  }
  return { id: result.id, secret, voiceWarning };
}

function done({ id, secret, voiceWarning }) {
  step = 4;
  const via =
    draft.contactPref === "none"
      ? "on the tracking page"
      : `by ${CONTACT.find((c) => c[0] === draft.contactPref)[1]} on ${esc(draft.phone)}`;
  dialog.innerHTML = `<div class="sg-wrap">${header("JazakAllahu khayran")}<div class="sg-done"><p class="sg-done-lead">Your suggestion has reached us. It will be reviewed and decided at our Decision Bench, in sha Allah.</p>${voiceWarning ? `<p class="sg-warn">${esc(voiceWarning)} Your written suggestion was saved.</p>` : ""}<ol class="sg-timeline"><li class="done"><b>Received</b><span>Saved just now</span></li><li><b>Team review</b><span>A team member reads it in full</span></li><li><b>Decision Bench</b><span>Discussed and a decision is recorded</span></li><li><b>We update you</b><span>${via}</span></li></ol><div class="sg-keys"><p>Keep these to check the status any time:</p><div><span>Reference</span><code>${esc(id)}</code></div><div><span>Private tracking key</span><code>${esc(secret)}</code></div><button type="button" class="sg-btn" data-sg="copy">Copy both</button></div><div class="sg-nav"><a class="sg-btn" href="#track" data-sg="close">Track it</a><button type="button" class="sg-btn sg-primary" data-sg="close">Done</button></div></div></div>`;
  dialog.dataset.ref = id;
  dialog.dataset.key = secret;
  draft = fresh();
  if (audio) URL.revokeObjectURL(audio.url);
  audio = null;
  seconds = 0;
}

function close() {
  if (recorder?.state === "recording") recorder.stop();
  if (dialog.open) dialog.close();
  if (step === 4) step = 0;
}

async function open() {
  if (step === 4) step = 0;
  await loadActivities();
  render();
  if (!dialog.open) dialog.showModal();
}

dock.addEventListener("click", open);
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-open-suggest]");
  if (t) {
    e.preventDefault();
    open();
  }
});

dialog.addEventListener("click", async (e) => {
  if (e.target === dialog) return close();
  const b = e.target.closest("[data-sg]");
  if (!b) return;
  const a = b.dataset.sg;
  const form = dialog.querySelector("[data-sg-form]");
  if (a === "close") close();
  if (a === "back") {
    if (form) collect(form);
    step = Math.max(0, step - 1);
    render();
  }
  if (a === "goto") {
    step = Number(b.dataset.step);
    render();
  }
  if (a === "record") startRecording();
  if (a === "stop") recorder?.stop();
  if (a === "discard") discardAudio();
  if (a === "copy") {
    const text = `Reference: ${dialog.dataset.ref}\nTracking key: ${dialog.dataset.key}`;
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = "Copied";
    } catch {
      b.textContent = "Select and copy the text above";
    }
  }
});

dialog.addEventListener("change", (e) => {
  const form = e.target.form;
  if (!form) return;
  const err = form.querySelector(".sg-err");
  if (err) err.textContent = "";
  if (e.target.name === "contactPref") {
    const none = e.target.value === "none";
    form.querySelector(".sg-contact").hidden = none;
    form.querySelector(".sg-none-note").hidden = !none;
  }
  if (e.target.name === "urgency")
    form.querySelector(".sg-urgent-note").hidden = e.target.value !== "urgent";
});
dialog.addEventListener("input", (e) => {
  const err = dialog.querySelector(".sg-err");
  if (err) err.textContent = "";
  if (e.target.id === "sg-summary")
    $("#sg-summary-count").textContent = `${e.target.value.length}/140`;
});

dialog.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  collect(form);
  const err = form.querySelector(".sg-err");
  const problem = validate();
  if (problem) {
    err.textContent = problem;
    return;
  }
  if (step < 3) {
    step++;
    render();
    return;
  }
  const button = form.querySelector(".sg-primary");
  button.disabled = true;
  button.textContent = "Sending…";
  try {
    done(await submit());
  } catch (error) {
    err.textContent = error.message;
    button.disabled = false;
    button.textContent = "Send suggestion";
  }
});
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  close();
});
