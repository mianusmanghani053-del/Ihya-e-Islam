import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";
await build({
  stdin: {
    contents:
      "import QRCode from 'qrcode'; import * as Adhan from 'adhan'; window.PortalQR=QRCode; window.PrayerTools=Adhan;",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: "public/vendor/tools.js",
  minify: true,
});

const notices = [];
for (const [name, file] of [
  ["qrcode", "license"],
  ["adhan", "LICENSE"],
  ["dijkstrajs", "LICENSE.md"],
])
  notices.push(
    name + "\n" + (await readFile("node_modules/" + name + "/" + file, "utf8")),
  );
await writeFile("public/vendor/THIRD_PARTY_LICENSES.txt", notices.join("\n\n"));
