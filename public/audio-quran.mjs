const CATEGORIES = [
  ["recitations", "Recitations"],
  ["haramain", "Recitations from Haramain Taraweeh"],
  ["non-hafs", "Non-Hafs Recitations"],
  ["translations", "Recitations with Translations"],
];
const root = "quran/audio";
let catalogue = null,
  loading = false,
  error = "",
  category = "recitations",
  filter = "",
  initial = "",
  selected = null,
  trackQuery = "",
  audio = null,
  dock = null,
  current = null,
  queue = [],
  position = -1,
  repeat = "off",
  speed = 1;
const recordings = new Map(),
  pending = new Map(),
  failures = new Map();
const normalize = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
const safeAudio = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" &&
      ["download.quranicaudio.com", "quranicaudio.com"].includes(u.hostname)
      ? u.href
      : "";
  } catch {
    return "";
  }
};
const isAudioView = () => S.view === "quran" && S.qTab === "audio";
const titleOf = (track) => track.title || "Surah " + track.surah;
function dataFetch(path) {
  return fetch("/data/audio-quran/" + path).then((r) => {
    if (!r.ok) throw Error("The audio catalogue could not be loaded.");
    return r.json();
  });
}
function loadCatalogue() {
  if (loading || catalogue) return;
  loading = true;
  error = "";
  dataFetch("catalogue.json")
    .then((data) => {
      catalogue = data;
    })
    .catch((e) => {
      error = "The audio catalogue is unavailable. Please try again later.";
    })
    .finally(() => {
      loading = false;
      if (isAudioView()) renderContent();
    });
}
async function loadTracks(id) {
  if (recordings.has(id)) return recordings.get(id);
  if (pending.has(id)) return pending.get(id);
  const promise = dataFetch("reciter-" + id + ".json")
    .then((data) => {
      recordings.set(id, data);
      failures.delete(id);
      return data;
    })
    .catch((e) => {
      failures.set(id, e.message);
      throw e;
    })
    .finally(() => pending.delete(id));
  pending.set(id, promise);
  return promise;
}
function audioTabs() {
  return `<div class="tabs aq-main-tabs" role="tablist" aria-label="Quran sections">${[
    ["surah", "Surahs"],
    ["theme", "Themes"],
    ["saved", "Saved verses"],
    ["audio", "Audio Quran"],
  ]
    .map(
      ([id, label]) =>
        `<button role="tab" aria-selected="${S.qTab === id}" data-a="qtab" data-v="${id}" class="${S.qTab === id ? "on" : ""}">${label}</button>`,
    )
    .join("")}</div>`;
}
function page() {
  queueMicrotask(() => {
    if (!catalogue && !loading && !error) loadCatalogue();
    renderContent();
  });
  return `<section class="band"><div class="wrap sec"><span class="eyebrow">The Noble Quran · Listen & reflect</span><h1>Audio Quran</h1><p>Explore recitations, Taraweeh recordings, different readings and recitations with translations.</p></div></section><section class="sec"><div class="wrap">${audioTabs()}<div class="aq-category-tabs" role="tablist" aria-label="Audio Quran categories">${CATEGORIES.map(([id, label]) => `<a role="tab" aria-selected="${category === id}" class="${category === id ? "on" : ""}" href="#${root}/${id}">${label}${catalogue ? `<small>${catalogue.reciters.filter((r) => r.category === id).length}</small>` : ""}</a>`).join("")}</div><div id="aq-content" aria-live="polite"></div><details class="aq-credit"><summary>Recording credits & availability</summary><p>Recordings are credited to their named reciters and, where supplied, translators. Audio streams from the original hosting servers. Availability and completeness vary by recording; only published tracks are listed.</p><p>Recordings and catalogue courtesy of <a href="https://quranicaudio.com/" target="_blank" rel="noopener">QuranicAudio.com</a>, shared free of charge for non-commercial listening. May Allah reward everyone who recorded and shared them.</p><p><a href="/data/audio-quran/provenance.json" target="_blank" rel="noopener">Catalogue source details</a></p></details></div></section>`;
}
function filteredReciters() {
  return catalogue.reciters.filter(
    (r) =>
      r.category === category &&
      (!filter ||
        normalize(
          r.name + " " + r.arabicName + " " + (r.description || ""),
        ).includes(normalize(filter))) &&
      (!initial || letter(r.name) === initial),
  );
}
function letter(name) {
  return /^[a-z]/i.test(name) ? name[0].toUpperCase() : "#";
}
function listMarkup() {
  const list = filteredReciters(),
    groups = new Map();
  for (const r of list) {
    const key = letter(r.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return `${
    list.length
      ? `<p class="aq-result-count">${list.length} recitation collections</p>${[
          ...groups,
        ]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([key, rows]) =>
              `<section class="aq-letter-group"><h2>${key}</h2><div class="aq-reciter-grid">${rows
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(
                  (r) =>
                    `<button class="aq-reciter" data-aq-reciter="${r.id}"><span>${esc(r.name)}</span>${r.arabicName ? `<small lang="ar" dir="rtl">${esc(r.arabicName)}</small>` : ""}<small>${r.trackCount} recordings${r.reading ? " · " + esc(r.reading) : ""}</small><b aria-hidden="true">↗</b></button>`,
                )
                .join("")}</div></section>`,
          )
          .join("")}`
      : '<p class="note">No reciters match this search in this category.</p>'
  }`;
}
function renderContent() {
  const container = document.getElementById("aq-content");
  if (!container) return;
  if (!catalogue) {
    container.innerHTML = error
      ? `<div class="note"><p>${esc(error)}</p><button class="btn" data-aq-retry-catalogue>Try again</button></div>`
      : '<p class="note" role="status">Loading the audio catalogue…</p>';
    return;
  }
  if (selected) {
    renderReciter(container);
    return;
  }
  container.innerHTML = `<div class="aq-list-heading"><div><span class="eyebrow">Choose a reciter</span><h2>${esc(CATEGORIES.find(([id]) => id === category)[1])}</h2><p>Browse by name, then choose a published recording to listen.</p></div><label>Search reciters<input id="aq-reciter-search" type="search" placeholder="Reciter, reading or language…" value="${esc(filter)}"></label></div><nav class="aq-alphabet" aria-label="Filter reciters by initial"><button data-aq-letter="" class="${!initial ? "on" : ""}" aria-pressed="${!initial}">All</button>${"ABCDEFGHIJKLMNOPQRSTUVWXYZ#"
    .split("")
    .map(
      (l) =>
        `<button data-aq-letter="${l}" class="${initial === l ? "on" : ""}" aria-pressed="${initial === l}">${l}</button>`,
    )
    .join("")}</nav><div id="aq-reciter-list">${listMarkup()}</div>`;
}
function renderReciter(container) {
  const reciter = catalogue.reciters.find(
    (r) => String(r.id) === String(selected),
  );
  if (!reciter) {
    selected = null;
    renderContent();
    return;
  }
  const data = recordings.get(reciter.id);
  if (!data) {
    container.innerHTML = `<button class="btn" data-aq-back>← All reciters</button><h2>${esc(reciter.name)}</h2>${failures.has(reciter.id) ? `<p class="note">${esc(failures.get(reciter.id))}</p><button class="btn" data-aq-retry-reciter="${reciter.id}">Try again</button>` : '<p class="note" role="status">Loading published recordings…</p>'}`;
    if (!pending.has(reciter.id) && !failures.has(reciter.id))
      loadTracks(reciter.id)
        .then(() => {
          if (isAudioView() && String(selected) === String(reciter.id))
            renderContent();
        })
        .catch(() => {
          if (isAudioView()) renderContent();
        });
    return;
  }
  container.innerHTML = `<button class="btn" data-aq-back>← All reciters</button><div class="aq-reciter-heading"><div><span class="eyebrow">${esc(CATEGORIES.find(([id]) => id === reciter.category)[1])}</span><h2>${esc(reciter.name)}</h2>${reciter.arabicName ? `<p class="ar" lang="ar" dir="rtl">${esc(reciter.arabicName)}</p>` : ""}<p>${esc(reciter.description || "")}${reciter.reading ? " · " + esc(reciter.reading) : ""}</p><p>${data.tracks.length} published recordings</p></div><button class="btn em" data-aq-play-all="${reciter.id}" ${data.tracks.length ? "" : "disabled"}>▶ Play collection</button></div><label class="aq-track-filter">Find a surah or recording<input type="search" id="aq-track-search" value="${esc(trackQuery)}" placeholder="Surah name or number…"></label><div id="aq-track-list">${trackMarkup(data, reciter)}</div>`;
}
function trackMarkup(data, reciter) {
  const tracks = data.tracks.filter(
    (t) =>
      !trackQuery ||
      normalize(t.title + " " + t.surah).includes(normalize(trackQuery)),
  );
  return `<div class="aq-tracks">${tracks.map((t) => `<article class="aq-track ${current?.reciter.id === reciter.id && current?.track.id === t.id ? "is-current" : ""}"><button class="aq-play" data-aq-play="${esc(t.id)}" data-reciter="${reciter.id}" aria-label="Play ${esc(titleOf(t))}">▶</button><div><h3>${esc(titleOf(t))}</h3><small>${t.surah ? "Surah " + t.surah : ""}${t.duration ? " · " + esc(t.duration) : ""}</small></div><a class="btn sm" href="${esc(safeAudio(t.url))}" target="_blank" rel="noopener noreferrer">Open recording ↗</a></article>`).join("") || '<p class="note">No published recordings match your search.</p>'}</div>`;
}
function createPlayer() {
  if (audio) return;
  dock = document.createElement("section");
  dock.className = "aq-player";
  dock.hidden = true;
  dock.setAttribute("aria-label", "Audio Quran player");
  dock.innerHTML =
    '<div class="aq-player-info"><b id="aq-now-title"></b><span id="aq-now-reciter"></span><p id="aq-player-status" role="status"></p></div><div class="aq-player-controls"><button class="btn sm" data-aq-previous aria-label="Previous recording">←</button><audio id="aq-audio" controls preload="none"></audio><button class="btn sm" data-aq-next aria-label="Next recording">→</button></div><div class="aq-player-options"><label>Repeat<select id="aq-repeat"><option value="off">Off</option><option value="one">This recording</option><option value="all">Collection</option></select></label><label>Speed<select id="aq-speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><button class="btn sm" data-aq-close aria-label="Close player and stop playback">✕</button></div>';
  document.body.append(dock);
  audio = dock.querySelector("audio");
  audio.addEventListener("ended", () => {
    if (repeat === "one") {
      audio.currentTime = 0;
      audio.play().catch(playError);
    } else next();
  });
  audio.addEventListener("error", () => {
    document.getElementById("aq-player-status").textContent =
      "This recording could not be played. Try another recording or open its source link.";
  });
  audio.addEventListener("playing", () => {
    document.getElementById("aq-player-status").textContent = "";
  });
}
function playError() {
  document.getElementById("aq-player-status").textContent =
    "Press Play in the audio controls to start listening.";
}
async function play(reciter, tracks, index) {
  const track = tracks[index];
  if (!track || !safeAudio(track.url)) return;
  createPlayer();
  queue = tracks;
  position = index;
  current = { reciter, track };
  dock.hidden = false;
  document.body.classList.add("has-aq-player");
  document.getElementById("aq-now-title").textContent = titleOf(track);
  document.getElementById("aq-now-reciter").textContent = reciter.name;
  document.getElementById("aq-player-status").textContent =
    "Loading recording…";
  audio.src = safeAudio(track.url);
  audio.playbackRate = speed;
  try {
    await audio.play();
  } catch {
    playError();
  }
  if (isAudioView()) renderContent();
}
function next() {
  if (!current) return;
  let index = position + 1;
  if (index >= queue.length) {
    if (repeat !== "all") return;
    index = 0;
  }
  play(current.reciter, queue, index);
}
export function installAudioQuran() {
  const original = V.quran;
  V.quran = () => {
    if (S.qTab === "audio") return page();
    const t = document.createElement("template");
    t.innerHTML = original();
    const tabs = t.content.querySelector(".tabs");
    if (tabs) tabs.outerHTML = audioTabs();
    return t.innerHTML;
  };
  V[root] = () => {
    S.qTab = "audio";
    S.view = "quran";
    category = "recitations";
    return page();
  };
  for (const [id] of CATEGORIES)
    V[root + "/" + id] = () => {
      S.qTab = "audio";
      S.view = "quran";
      if (category !== id) {
        selected = null;
        filter = "";
        initial = "";
        trackQuery = "";
      }
      category = id;
      return page();
    };
  document.addEventListener(
    "click",
    async (event) => {
      const tab = event.target.closest('[data-a="qtab"]');
      if (tab) {
        if (tab.dataset.v === "audio") {
          event.preventDefault();
          event.stopImmediatePropagation();
          S.qTab = "audio";
          location.hash = root;
          return;
        }
        if (location.hash.startsWith("#" + root)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          S.qTab = tab.dataset.v;
          location.hash = "quran";
          return;
        }
      }
      const reciter = event.target.closest("[data-aq-reciter]");
      if (reciter) {
        selected = reciter.dataset.aqReciter;
        trackQuery = "";
        renderContent();
      }
      const initialButton = event.target.closest("[data-aq-letter]");
      if (initialButton) {
        initial = initialButton.dataset.aqLetter;
        renderContent();
      }
      if (event.target.closest("[data-aq-back]")) {
        selected = null;
        trackQuery = "";
        renderContent();
      }
      if (event.target.closest("[data-aq-retry-catalogue]")) {
        error = "";
        loadCatalogue();
        renderContent();
      }
      const retry = event.target.closest("[data-aq-retry-reciter]");
      if (retry) {
        failures.delete(Number(retry.dataset.aqRetryReciter));
        renderContent();
      }
      const button = event.target.closest("[data-aq-play],[data-aq-play-all]");
      if (button) {
        try {
          const id = Number(button.dataset.reciter || button.dataset.aqPlayAll),
            r = catalogue.reciters.find((r) => r.id === id),
            data = await loadTracks(id);
          const index = button.dataset.aqPlay
            ? data.tracks.findIndex(
                (t) => String(t.id) === button.dataset.aqPlay,
              )
            : 0;
          play(r, data.tracks, index);
        } catch (e) {
          toast(e.message);
        }
      }
      if (event.target.closest("[data-aq-next]")) next();
      if (event.target.closest("[data-aq-previous]") && current)
        play(current.reciter, queue, Math.max(0, position - 1));
      if (event.target.closest("[data-aq-close]")) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        dock.hidden = true;
        document.body.classList.remove("has-aq-player");
        current = null;
        if (isAudioView()) renderContent();
      }
    },
    true,
  );
  document.addEventListener("input", (event) => {
    if (event.target.id === "aq-reciter-search") {
      filter = event.target.value;
      document.getElementById("aq-reciter-list").innerHTML = listMarkup();
    }
    if (event.target.id === "aq-track-search") {
      trackQuery = event.target.value;
      const r = catalogue.reciters.find(
        (r) => String(r.id) === String(selected),
      );
      document.getElementById("aq-track-list").innerHTML = trackMarkup(
        recordings.get(r.id),
        r,
      );
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "aq-repeat") repeat = event.target.value;
    if (event.target.id === "aq-speed") {
      speed = Number(event.target.value);
      if (audio) audio.playbackRate = speed;
    }
  });
}
