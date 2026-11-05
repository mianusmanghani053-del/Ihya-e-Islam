export const normalizeHadith = (text) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "");
export function searchBukhari(index, query, book = 0) {
  const words = normalizeHadith(query).match(/[\p{L}\p{N}.]+/gu) || [];
  if (!words.length) return [];
  let matches = null;
  for (const word of words) {
    const posting = new Set();
    for (const [token, ids] of Object.entries(index.terms))
      if (token.includes(word)) for (const id of ids) posting.add(id);
    matches =
      matches === null
        ? posting
        : new Set([...matches].filter((id) => posting.has(id)));
    if (!matches.size) break;
  }
  return [...matches]
    .sort((a, b) => a - b)
    .map((i) => index.entries[i])
    .filter(([, b]) => !book || b === Number(book));
}
