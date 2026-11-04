export function redactPrivateEmails(value, addresses) {
  if (!addresses.length) return value;
  const patterns = addresses.map(
    (address) =>
      new RegExp(address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
  );
  const redact = (item) => {
    if (typeof item === "string")
      return patterns.reduce(
        (text, pattern) => text.replace(pattern, "[private email]"),
        item,
      );
    if (Array.isArray(item)) return item.map(redact);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item).map(([key, val]) => [key, redact(val)]),
      );
    return item;
  };
  return redact(value);
}
