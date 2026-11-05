import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { BUKHARI } from "../public/data/bukhari/catalogue.mjs";
import { searchBukhari } from "../public/bukhari-search.mjs";
const base = new URL("../public/data/bukhari/", import.meta.url);
test("Bukhari edition includes every numbered entry, verified book files and explicit shared text", async () => {
  assert.equal(BUKHARI.books.length, 97);
  const ids = new Set(),
    canonical = new Set();
  let total = 0,
    shared = 0;
  for (const book of BUKHARI.books) {
    const bytes = await readFile(new URL("book-" + book.id + ".json", base));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), book.sha256);
    const data = JSON.parse(bytes);
    assert.equal(data.rows.length, book.count);
    for (const row of data.rows) {
      assert.ok(!ids.has(row.id), "Duplicate edition identifier " + row.id);
      ids.add(row.id);
      canonical.add(row.number);
      total++;
      assert.equal(row.book, book.id);
      if (row.sharedTextId) {
        const parent = data.rows.find((r) => r.id === row.sharedTextId);
        assert.ok(parent.ar.trim() && parent.en.trim());
        assert.equal(row.ar, "");
        assert.equal(row.en, "");
        shared++;
      } else
        assert.ok(
          row.ar.trim() && row.en.trim(),
          "Blank unaccounted text " + row.id,
        );
    }
  }
  assert.equal(total, 7589);
  assert.equal(shared, 9);
  assert.equal(canonical.size, 7563);
  for (let n = 1; n <= 7563; n++)
    assert.ok(canonical.has(n), "Missing canonical number " + n);
  assert.ok(ids.has("402.2"));
  const search = JSON.parse(await readFile(new URL("search.json", base)));
  assert.deepEqual(new Set(search.entries.map(([id]) => id)), ids);
});
test("Bukhari search finds Arabic and English evidence and respects book filtering", async () => {
  const index = JSON.parse(await readFile(new URL("search.json", base)));
  assert.ok(searchBukhari(index, "intentions").some(([id]) => id === "1"));
  assert.ok(
    searchBukhari(index, "الأَعْمَالُ بِالنِّيَّاتِ").some(
      ([id]) => id === "1",
    ),
  );
  assert.ok(searchBukhari(index, "two words").some(([id]) => id === "7563"));
  const scoped = searchBukhari(index, "Allah", 1);
  assert.ok(scoped.length);
  assert.ok(scoped.every(([, book]) => book === 1));
  assert.deepEqual(searchBukhari(index, "zzqv-not-a-realword"), []);
});
