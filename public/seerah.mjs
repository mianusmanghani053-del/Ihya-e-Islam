import { READINGS } from "./seerah-data.mjs";
export { READINGS };
const reference = (ref) => {
  const [kind, chapter, verses] = ref.split("/");
  if (kind === "quran")
    return `<a href="https://quran.com/${chapter}/${verses}" target="_blank" rel="noopener noreferrer">Quran ${chapter}:${verses}</a>`;
  if (kind === "bukhari")
    return `<a href="https://sunnah.com/bukhari:${chapter}" target="_blank" rel="noopener noreferrer">Sahih al-Bukhari ${chapter}</a>`;
  return "<span>Ibn Hisham, al-Sirah al-Nabawiyyah, account of Hilf al-Fudul (historical biography; editions and pagination vary).</span>";
};
const card = (r) =>
  `<a class="card seerah-card" href="#seerah/${r.slug}"><span class="eyebrow">${esc(r.period)}</span><h3>${esc(r.title)}</h3><p>${esc(r.intro)}</p><span class="seerah-more">Read the account & sources →</span></a>`;
function landing() {
  return `<section class="band"><div class="wrap sec"><span class="eyebrow">Seerah & Khulafa Rashidun</span><h1>The Prophet ﷺ and the rightly guided caliphs</h1><p>Explore the events, relationships and principles that continue to guide our learning and service.</p></div></section><section class="sec"><div class="wrap"><div class="card seerah-method"><h2>Read with the sources</h2><p>Each reading links to Quranic passages and named reports. Gregorian dates are conventional approximations. Historical biography is identified separately, and practical reflections are our applications rather than words attributed to the Prophet ﷺ or his companions.</p></div>${[
    "Timeline",
    "Khulafa Rashidun",
    "Themes",
  ]
    .map(
      (group) =>
        `<section class="seerah-group"><span class="eyebrow">${group === "Timeline" ? "Seerah timeline" : group === "Themes" ? "Explore his example" : "Al-Khulafa ar-Rashidun"}</span><h2>${group === "Timeline" ? "Moments that shape our work" : group === "Themes" ? "Character, worship and community" : "Four rightly guided leaders"}</h2><div class="grid ${group === "Khulafa Rashidun" ? "g4" : "g2"}">${READINGS.filter(
          (r) => r.group === group,
        )
          .map(card)
          .join("")}</div></section>`,
    )
    .join(
      "",
    )}<div class="card"><h2>Continue your learning</h2><p>Explore Quran, hadith and available courses. Read longer passages alongside these introductions.</p><div class="seerah-links"><a class="btn" href="#quran">Read Quran</a><a class="btn" href="#hadith">Study hadith</a><a class="btn" href="#activities">Courses & activities</a></div></div></div></section>`;
}
function reading(r) {
  return `<section class="sec"><article class="wrap seerah-reading"><a class="btn" href="#seerah">← Back to Seerah & Khulafa</a><header><span class="eyebrow">${esc(r.group)} · ${esc(r.period)}</span><h1>${esc(r.title)}</h1><p class="seerah-intro">${esc(r.intro)}</p></header><nav class="card seerah-contents" aria-label="In this reading"><h2>In this reading</h2>${r.sections.map((s, i) => `<button class="btn" type="button" data-reading-section="reading-section-${i}">${i + 1}. ${esc(s.title)}</button>`).join("")}</nav>${r.sections.map((s, i) => `<section class="card seerah-section" id="reading-section-${i}"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p><div class="seerah-sources"><b>Sources & further reading</b><ul>${s.refs.map((ref) => `<li>${reference(ref)}</li>`).join("")}</ul></div></section>`).join("")}<aside class="seerah-method"><p>Dates follow conventional historical chronology and may be approximate. Hadith numbers follow commonly used online numbering and may differ between editions. Summaries are explanatory paraphrases; follow each reference for the full text and context.</p></aside><section class="seerah-group"><h2>Continue exploring</h2><div class="grid g2">${r.related
    .map((slug) => READINGS.find((x) => x.slug === slug))
    .map(card)
    .join(
      "",
    )}</div></section><div class="seerah-links"><a class="btn" href="#seerah">All readings</a><a class="btn" href="#services/scholar_question">Ask a scholar</a></div></article></section>`;
}
export function installSeerah() {
  V.seerah = landing;
  for (const r of READINGS) V["seerah/" + r.slug] = () => reading(r);
  // The homepage shares the timeline data. Use the same source-conscious summaries.
  const timeline = READINGS.filter((r) => r.group === "Timeline");
  SEERAH.forEach((item, i) => {
    const r = timeline[i];
    item[0] = r.period;
    item[1] = "";
    item[2] = r.title;
    item[3] = r.intro;
  });
  const home = V.home;
  V.home = () => {
    const template = document.createElement("template");
    template.innerHTML = home();
    template.content.querySelectorAll(".ev").forEach((el, i) => {
      const r = timeline[i];
      if (!r) return;
      const link = document.createElement("a");
      link.href = "#seerah/" + r.slug;
      link.className = "seerah-more";
      link.textContent = "Read the account & sources →";
      el.lastElementChild?.append(link);
    });
    return template.innerHTML;
  };
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reading-section]");
    if (button)
      document
        .getElementById(button.dataset.readingSection)
        ?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
  });
}
