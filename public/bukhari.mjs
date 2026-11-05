import { BUKHARI } from "./data/bukhari/catalogue.mjs";
import { searchBukhari, normalizeHadith } from "./bukhari-search.mjs";
const root = "hadith/bukhari",
  pageSize = 20,
  books = new Map(),
  pending = new Map(),
  failures = new Map();
let searchIndex = null,
  searchPending = null,
  searchError = "",
  query = "",
  searchPage = 1,
  selectedBook = 0,
  results = null,
  language = "both",
  fontSize = 28;
const pages = new Map();
const url = (path) =>
  "/data/bukhari/" + path + "?v=" + BUKHARI.revision.slice(0, 12);
const bookInfo = (id) => BUKHARI.books.find((b) => b.id === Number(id));
const label = (id) =>
  String(id).includes(".")
    ? String(id).split(".")[0] + " (variant " + String(id).split(".")[1] + ")"
    : String(id);
const link = (id) => "#" + root + "/" + id;
function refreshReader() {
  if (S.view === root || S.view.startsWith(root + "/")) renderContent();
}
async function loadBook(id) {
  if (books.has(id)) return books.get(id);
  if (pending.has(id)) return pending.get(id);
  const task = fetch(url("book-" + id + ".json"))
    .then((r) => {
      if (!r.ok) throw Error("The book could not be loaded.");
      return r.json();
    })
    .then((data) => {
      books.set(id, data);
      failures.delete(id);
      return data;
    })
    .catch((e) => {
      failures.set(id, e.message);
      throw e;
    })
    .finally(() => pending.delete(id));
  pending.set(id, task);
  return task;
}
function bookFor(id) {
  const number = Math.floor(Number(id));
  return BUKHARI.books.find((b) => number >= b.first && number <= b.last);
}
function card(row, book) {
  const source = row.sharedTextId
    ? book.rows.find((r) => r.id === row.sharedTextId)
    : row;
  const text =
    (language !== "en"
      ? `<p class="bukhari-ar" lang="ar" dir="rtl" style="font-size:${fontSize}px">${esc(source.ar)}</p>`
      : "") +
    (language !== "ar"
      ? `<p class="bukhari-en" lang="en">${esc(source.en)}</p>`
      : "");
  return `<article class="card bukhari-entry" id="bukhari-${row.id.replace(".", "-")}"><div class="bukhari-entry-heading"><div><span class="eyebrow">Book ${row.book} · ${esc(bookInfo(row.book).title)}</span><h2><a href="${link(row.id)}">Sahih al-Bukhari ${esc(label(row.id))}</a></h2></div><span class="tag z">Sahih collection</span></div>${row.sharedTextId ? `<p class="note">This edition leaves this entry’s separate text empty. It is part of the grouped report ${esc(row.groupRange.join("–"))}; the shared text from entry ${esc(row.sharedTextId)} is displayed below.</p>` : ""}${text}<div class="bukhari-entry-footer">${row.inBook ? `<span>In-book reference: Book ${row.book}, Hadith ${row.inBook}</span>` : ""}<a href="https://sunnah.com/bukhari:${row.number}" target="_blank" rel="noopener noreferrer">Check on Sunnah.com ↗</a><button class="btn sm" data-bukhari-copy="${row.id}">Copy</button><button class="btn sm" data-a="bm" data-v="hBukhari ${row.id}">${S.book.has("hBukhari " + row.id) ? "Saved" : "Save"}</button></div></article>`;
}
function pagination(current, total) {
  return total > pageSize
    ? `<nav class="bukhari-pagination" aria-label="Hadith result pages"><button class="btn" data-bukhari-page="${current - 1}" ${current === 1 ? "disabled" : ""}>← Previous</button><span>Page ${current} of ${Math.ceil(total / pageSize)}</span><button class="btn" data-bukhari-page="${current + 1}" ${current * pageSize >= total ? "disabled" : ""}>Next →</button></nav>`
    : "";
}
function controls() {
  return `<div class="bukhari-reading-options"><label>Display<select id="bukhari-language"><option value="both" ${language === "both" ? "selected" : ""}>Arabic & English</option><option value="ar" ${language === "ar" ? "selected" : ""}>Arabic</option><option value="en" ${language === "en" ? "selected" : ""}>English</option></select></label><label>Arabic size<input type="range" id="bukhari-font" min="22" max="42" value="${fontSize}"></label></div>`;
}
function sourceNote() {
  return `<details class="bukhari-source-note"><summary>Sources, numbering & edition notes</summary><p>Arabic and English text: <a href="${BUKHARI.source}/tree/${BUKHARI.revision}" target="_blank" rel="noopener noreferrer">Hadith API, pinned edition</a>, published under the <a href="/data/bukhari/LICENSE.txt" target="_blank" rel="noopener">Unlicense</a>. English translator: ${esc(BUKHARI.translator)}. Reference links open Sunnah.com; this reader is independently maintained and is not an official Sunnah.com mirror.</p><p>All 97 books and 7,589 edition entries are included, covering numbered hadith 1–7563. Split entries use the edition’s decimal identifiers. ${BUKHARI.sharedTextEntries} entries share grouped text. ${BUKHARI.repairedBookReferences} book assignments missing from the source were recovered from their combined-report group. In-book numbering is shown only where supplied. Numbering and wording can vary by edition; compare the linked source before quoting.</p><p>“Sahih collection” identifies the collection, rather than a new grading by this trust. Text has not been rewritten or supplemented with generated translations.</p></details>`;
}
function page() {
  const path = S.view.slice(root.length),
    bookMatch = path.match(/^\/book\/(\d+)$/),
    entryMatch = path.match(/^\/(\d+(?:\.\d+)?)$/);
  const title = bookMatch
    ? bookInfo(bookMatch[1])?.title
    : entryMatch
      ? "Hadith " + label(entryMatch[1])
      : "Read Sahih al-Bukhari";
  return `<section class="band"><div class="wrap sec"><span class="eyebrow">The hadith library · صحيح البخاري</span><h1>${esc(title || "Sahih al-Bukhari")}</h1><p>Arabic text, English translation and references across all 97 books.</p><div class="bukhari-summary"><span>97 books</span><span>7,589 edition entries</span><span>Hadith 1–7563</span></div></div></section><section class="sec"><div class="wrap"><div class="bukhari-back"><a class="btn" href="#hadith">← Hadith library</a>${path ? `<a class="btn" href="#${root}">All Bukhari books</a>` : ""}</div><div class="card bukhari-search-controls"><form id="bukhari-search-form"><label for="bukhari-query">Search the entire collection in Arabic or English</label><div class="bukhari-search-row"><input id="bukhari-query" type="search" maxlength="150" placeholder="Search intentions, charity, الصلاة…" value="${esc(query)}"><select id="bukhari-search-book" aria-label="Limit search to book"><option value="0">All 97 books</option>${BUKHARI.books.map((b) => `<option value="${b.id}" ${selectedBook === b.id ? "selected" : ""}>${b.id}. ${esc(b.title)}</option>`).join("")}</select><button class="btn em">Search</button></div></form><form id="bukhari-jump-form"><label for="bukhari-number">Go to a hadith number</label><div class="bukhari-search-row"><input id="bukhari-number" inputmode="decimal" required pattern="[0-9]+([.][0-9]+)?" placeholder="1–7563, or 402.2" aria-describedby="bukhari-jump-error"><button class="btn">Go →</button></div><p class="err" id="bukhari-jump-error" role="alert"></p></form></div>${controls()}<div id="bukhari-content" aria-live="polite"></div>${sourceNote()}</div></section>`;
}
function catalog() {
  return `<div class="bukhari-catalog-heading"><h2>Browse all 97 books</h2><p>Choose a book to load its Arabic and English text.</p><label>Find a book<input id="bukhari-book-filter" type="search" placeholder="Book title or number…"></label></div><div class="bukhari-book-grid">${BUKHARI.books.map((b) => `<a class="card bukhari-book" href="#${root}/book/${b.id}" data-book-title="${esc(normalizeHadith(b.id + " " + b.title + " " + b.arabicTitle))}"><span class="bukhari-book-number">${b.id}</span><div><h3>${esc(b.title)}</h3><p class="ar" lang="ar" dir="rtl">${esc(b.arabicTitle)}</p><small>${b.count} edition entries · ${b.first}–${b.last}</small></div><span aria-hidden="true">→</span></a>`).join("")}</div><p id="bukhari-books-empty" hidden>No books match that title.</p>`;
}
function loading(error, id) {
  return error
    ? `<div class="note"><p>${esc(error)}</p><button class="btn" data-bukhari-retry="${id}">Try again</button></div>`
    : '<p class="note" role="status">Loading the selected book…</p>';
}
function requestBook(id) {
  if (!books.has(id) && !pending.has(id) && !failures.has(id))
    loadBook(id).then(refreshReader).catch(refreshReader);
}
function renderContent() {
  const el = document.getElementById("bukhari-content");
  if (!el) return;
  const path = S.view.slice(root.length);
  if (path === "") {
    if (results !== null) {
      renderSearch(el);
      return;
    }
    el.innerHTML = catalog();
    return;
  }
  const bookMatch = path.match(/^\/book\/(\d+)$/),
    entryMatch = path.match(/^\/(\d+(?:\.\d+)?)$/);
  const info = bookMatch
    ? bookInfo(bookMatch[1])
    : entryMatch
      ? bookFor(entryMatch[1])
      : null;
  if (!info) {
    el.innerHTML =
      '<p class="note">This book or hadith number was not found.</p>';
    return;
  }
  const book = books.get(info.id);
  if (!book) {
    el.innerHTML = loading(failures.get(info.id), info.id);
    requestBook(info.id);
    return;
  }
  if (entryMatch) {
    const index = book.rows.findIndex((r) => r.id === entryMatch[1]);
    if (index < 0) {
      el.innerHTML =
        '<p class="note">This edition entry was not found. Use a number from 1–7563 or a listed variant.</p>';
      return;
    }
    const previous = book.rows[index - 1],
      next = book.rows[index + 1];
    el.innerHTML =
      card(book.rows[index], book) +
      `<nav class="bukhari-pagination" aria-label="Adjacent hadith">${previous ? `<a class="btn" href="${link(previous.id)}">← ${esc(label(previous.id))}</a>` : ""}<a class="btn" href="#${root}/book/${info.id}">Back to ${esc(info.title)}</a>${next ? `<a class="btn" href="${link(next.id)}">${esc(label(next.id))} →</a>` : ""}</nav>`;
    return;
  }
  const current = pages.get(info.id) || 1,
    start = (current - 1) * pageSize;
  el.innerHTML = `<div class="bukhari-catalog-heading"><h2>${info.id}. ${esc(info.title)}</h2><p>${info.count} edition entries · Showing ${start + 1}–${Math.min(start + pageSize, info.count)}</p></div>${book.rows
    .slice(start, start + pageSize)
    .map((r) => card(r, book))
    .join(
      "",
    )}${pagination(current, info.count)}<nav class="bukhari-pagination" aria-label="Adjacent books">${info.id > 1 ? `<a class="btn" href="#${root}/book/${info.id - 1}">← Previous book</a>` : ""}${info.id < 97 ? `<a class="btn" href="#${root}/book/${info.id + 1}">Next book →</a>` : ""}</nav>`;
}
function renderSearch(el) {
  if (results === "loading") {
    el.innerHTML =
      '<p class="note" role="status">Loading the full-collection search index…</p>';
    return;
  }
  if (searchError) {
    el.innerHTML = `<p class="note">${esc(searchError)}</p><button class="btn" data-bukhari-search-retry>Try search again</button>`;
    return;
  }
  const list = results.slice(
    (searchPage - 1) * pageSize,
    searchPage * pageSize,
  );
  const missing = [...new Set(list.map(([, id]) => id))].filter(
    (id) => !books.has(id),
  );
  for (const id of missing) requestBook(id);
  el.innerHTML = `<div class="bukhari-catalog-heading"><h2>${results.length} matching entries</h2><p>Results for “${esc(query)}”. Search ignores Arabic vowel marks and matches words containing your terms.</p><button class="btn" data-bukhari-clear>Back to books</button></div>${
    list
      .map(([id, b]) => {
        const book = books.get(b);
        return book
          ? card(
              book.rows.find((r) => r.id === id),
              book,
            )
          : loading(failures.get(b), b);
      })
      .join("") ||
    '<p class="note">No matching entries. Try a different word or remove the book filter.</p>'
  }${pagination(searchPage, results.length)}`;
}
async function search() {
  const input = document.getElementById("bukhari-query");
  query = input ? input.value.trim() : query;
  selectedBook = Number(
    document.getElementById("bukhari-search-book")?.value || selectedBook,
  );
  if (!query) {
    results = null;
    refreshReader();
    return;
  }
  results = "loading";
  searchError = "";
  searchPage = 1;
  if (S.view !== root) {
    location.hash = root;
    return;
  }
  refreshReader();
  try {
    if (!searchIndex) {
      searchPending ??= fetch(url("search.json"))
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .finally(() => (searchPending = null));
      searchIndex = await searchPending;
    }
    results = searchBukhari(searchIndex, query, selectedBook);
  } catch {
    searchError =
      "Search could not be loaded. Check your connection and try again.";
    results = [];
  }
  refreshReader();
}
export function installBukhari() {
  const original = V.hadith;
  V.hadith = () => {
    const template = document.createElement("template");
    template.innerHTML = original();
    const button = template.content.querySelector(
      '[data-a="hcol"][data-v="Bukhari"]',
    );
    if (button) {
      const a = document.createElement("a");
      a.className = button.className + " bukhari-collection-link";
      a.href = "#" + root;
      a.innerHTML =
        '<span class="eyebrow">Complete collection</span><h3>Sahih al-Bukhari</h3><p>97 books · 7,589 edition entries</p><b>Read & search the collection →</b>';
      button.replaceWith(a);
    }
    template.content
      .querySelector("#hlist")
      ?.insertAdjacentHTML(
        "beforebegin",
        `<p class="note">The selections below are a short reading list. Open <a href="#${root}">Sahih al-Bukhari</a> to browse all 97 books in Arabic and English.</p>`,
      );
    template.content.querySelectorAll(".note").forEach((n) => {
      if (n.textContent.includes("For the live site:")) n.remove();
    });
    return template.innerHTML;
  };
  V[root] = () => {
    queueMicrotask(() => {
      renderContent();
      if (results === "loading") search();
    });
    return page();
  };
  for (const book of BUKHARI.books)
    V[root + "/book/" + book.id] = () => {
      queueMicrotask(renderContent);
      return page();
    };
  const registerHadithRoute = () => {
    const raw = location.hash.slice(1);
    if (/^hadith\/bukhari\/\d+(?:\.\d+)?$/.test(raw))
      V[raw] = () => {
        queueMicrotask(renderContent);
        return page();
      };
  };
  const previousRoute = route;
  route = () => {
    registerHadithRoute();
    previousRoute();
  };
  // Classic-script hash listeners keep their original function reference.
  // Resolve a newly registered entry after that listener has run as well.
  window.addEventListener("hashchange", () => {
    if (/^hadith\/bukhari\/\d+(?:\.\d+)?$/.test(location.hash.slice(1)))
      route();
  });
  document.addEventListener(
    "change",
    (event) => {
      if (event.target.id === "hcol" && event.target.value === "Bukhari") {
        event.stopImmediatePropagation();
        location.hash = root;
      }
      if (event.target.id === "bukhari-language") {
        language = event.target.value;
        refreshReader();
      }
    },
    true,
  );
  document.addEventListener("input", (event) => {
    if (event.target.id === "bukhari-font") {
      fontSize = Number(event.target.value);
      document
        .querySelectorAll(".bukhari-ar")
        .forEach((el) => (el.style.fontSize = fontSize + "px"));
    }
    if (event.target.id === "bukhari-book-filter") {
      const q = normalizeHadith(event.target.value);
      let count = 0;
      document.querySelectorAll("[data-book-title]").forEach((el) => {
        el.hidden = !el.dataset.bookTitle.includes(q);
        if (!el.hidden) count++;
      });
      document.getElementById("bukhari-books-empty").hidden = !!count;
    }
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id === "bukhari-search-form") {
      event.preventDefault();
      search();
    }
    if (event.target.id === "bukhari-jump-form") {
      event.preventDefault();
      const value = document.getElementById("bukhari-number").value.trim();
      if (!bookFor(value) || Number(value) < 1 || Number(value) > 7563.9) {
        document.getElementById("bukhari-jump-error").textContent =
          "Choose a hadith number between 1 and 7563.";
        return;
      }
      location.hash = root + "/" + value;
    }
  });
  document.addEventListener(
    "click",
    async (event) => {
      const old = event.target.closest('[data-a="hcol"][data-v="Bukhari"]');
      if (old) {
        event.preventDefault();
        event.stopImmediatePropagation();
        location.hash = root;
        return;
      }
      const clear = event.target.closest("[data-bukhari-clear]");
      if (clear) {
        query = "";
        results = null;
        document.getElementById("bukhari-query").value = "";
        refreshReader();
      }
      const pg = event.target.closest("[data-bukhari-page]");
      if (pg) {
        const value = Number(pg.dataset.bukhariPage);
        if (S.view === root) searchPage = value;
        else pages.set(Number(S.view.split("/").at(-1)), value);
        refreshReader();
        document
          .getElementById("bukhari-content")
          .scrollIntoView({ block: "start" });
      }
      const retry = event.target.closest("[data-bukhari-retry]");
      if (retry) {
        const id = Number(retry.dataset.bukhariRetry);
        failures.delete(id);
        requestBook(id);
        refreshReader();
      }
      if (event.target.closest("[data-bukhari-search-retry]")) search();
      const copy = event.target.closest("[data-bukhari-copy]");
      if (copy) {
        const info = bookFor(copy.dataset.bukhariCopy),
          book = books.get(info.id),
          row = book.rows.find((r) => r.id === copy.dataset.bukhariCopy),
          text = row.sharedTextId
            ? book.rows.find((r) => r.id === row.sharedTextId)
            : row;
        try {
          await navigator.clipboard.writeText(
            text.ar +
              "\n\n" +
              text.en +
              "\n\nSahih al-Bukhari " +
              label(row.id) +
              "\nhttps://sunnah.com/bukhari:" +
              row.number,
          );
          toast("Hadith copied with reference.");
        } catch {
          toast(
            "Copy is unavailable in this browser. Select the text to copy it.",
          );
        }
      }
    },
    true,
  );
}
