import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const revision = "df57907be35291c91ad6a6691180e22ca9920784";
const root = resolve(process.argv[2] || "");
if (!process.argv[2])
  throw Error(
    "Pass the directory containing the pinned ara-bukhari.json, eng-bukhari.json and LICENSE files.",
  );
const [arBytes, enBytes, license] = await Promise.all(
  ["ara-bukhari.json", "eng-bukhari.json", "LICENSE"].map((f) =>
    readFile(resolve(root, f)),
  ),
);
const ar = JSON.parse(arBytes),
  en = JSON.parse(enBytes);
const arabic = new Map(ar.hadiths.map((h) => [String(h.hadithnumber), h]));
if (arabic.size !== 7589 || en.hadiths.length !== 7589)
  throw Error(
    "Unexpected edition size; review upstream changes before importing.",
  );
const books = Object.entries(en.metadata.sections)
  .filter(([id]) => id !== "0")
  .map(([id, title]) => ({
    id: Number(id),
    title,
    arabicTitle: ar.metadata.sections[id],
    first: en.metadata.section_details[id].hadithnumber_first,
    last: en.metadata.section_details[id].hadithnumber_last,
    rows: [],
  }));
let repairedBooks = 0,
  sharedTexts = 0;
for (const h of en.hadiths) {
  const a = arabic.get(String(h.hadithnumber));
  if (!a) throw Error("Missing Arabic counterpart");
  const sourceBook =
    h.reference.book ||
    en.hadiths.find(
      (next) => next.hadithnumber > h.hadithnumber && next.reference.book,
    )?.reference.book;
  const book = books.find((b) => b.id === sourceBook);
  if (!book) throw Error("Book range missing for " + h.hadithnumber);
  if (h.reference.book && h.reference.book !== book.id)
    throw Error("Conflicting book assignment");
  if (!h.reference.book) repairedBooks++;
  book.rows.push({
    id: String(h.hadithnumber),
    number: Math.floor(h.hadithnumber),
    book: book.id,
    inBook: h.reference.book ? h.reference.hadith : null,
    ar: a.text,
    en: h.text,
  });
}
// Some combined reports have text in an earlier entry and empty continuation numbers.
// Preserve their original strings and explicitly link to the shared imported text.
for (const book of books) {
  let group = [];
  for (const row of book.rows) {
    group.push(row);
    if (row.inBook !== null) {
      if (group.length > 1) {
        const textRows = group.filter((r) => r.ar.trim() || r.en.trim());
        for (const r of group) {
          r.groupRange = [group[0].id, group.at(-1).id];
          if (!r.ar.trim() && !r.en.trim()) {
            if (textRows.length !== 1)
              throw Error("Ambiguous empty entry " + r.id);
            r.sharedTextId = textRows[0].id;
            sharedTexts++;
          }
        }
      }
      group = [];
    }
  }
  if (group.length) throw Error("Unterminated group");
}
const output = resolve("public/data/bukhari");
await mkdir(output, { recursive: true });
const normalize = (s) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "");
const terms = Object.create(null),
  entries = [];
const metadata = [];
for (const book of books) {
  book.first = Math.min(...book.rows.map((r) => r.number));
  book.last = Math.max(...book.rows.map((r) => r.number));
  const text = JSON.stringify({ book: book.id, rows: book.rows });
  const hash = createHash("sha256").update(text).digest("hex");
  await writeFile(resolve(output, `book-${book.id}.json`), text);
  metadata.push({
    ...Object.fromEntries(Object.entries(book).filter(([k]) => k !== "rows")),
    count: book.rows.length,
    sha256: hash,
  });
  for (const row of book.rows) {
    const source = row.sharedTextId
      ? book.rows.find((r) => r.id === row.sharedTextId)
      : row;
    const index = entries.length;
    entries.push([row.id, book.id]);
    const words = new Set(
      normalize(row.id + " " + source.ar + " " + source.en).match(
        /[\p{L}\p{N}.]+/gu,
      ) || [],
    );
    for (const word of words) (terms[word] ??= []).push(index);
  }
}
const catalogue = {
  name: "Sahih al-Bukhari",
  revision,
  entries: entries.length,
  numberedHadiths: 7563,
  bookCount: books.length,
  sharedTextEntries: sharedTexts,
  repairedBookReferences: repairedBooks,
  translator: "Muhsin Khan (as identified by the upstream edition)",
  books: metadata,
  source: "https://github.com/fawazahmed0/hadith-api",
  reference: "https://sunnah.com/bukhari",
  license: "Unlicense",
  sourceFiles: [
    ["ara-bukhari.json", arBytes],
    ["eng-bukhari.json", enBytes],
  ].map(([name, data]) => ({
    url: `https://raw.githubusercontent.com/fawazahmed0/hadith-api/${revision}/editions/${name}`,
    sha256: createHash("sha256").update(data).digest("hex"),
  })),
};
await writeFile(
  resolve(output, "catalogue.mjs"),
  "export const BUKHARI = " + JSON.stringify(catalogue) + ";\n",
);
await writeFile(
  resolve(output, "search.json"),
  JSON.stringify({ entries, terms }),
);
await writeFile(resolve(output, "LICENSE.txt"), license);
console.log(
  JSON.stringify({
    books: books.length,
    entries: entries.length,
    sharedTextEntries: sharedTexts,
    repairedBookReferences: repairedBooks,
    searchTerms: Object.keys(terms).length,
  }),
);
