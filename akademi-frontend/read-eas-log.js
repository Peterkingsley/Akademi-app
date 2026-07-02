const { execSync } = require("child_process");
const fs = require("fs");
const zlib = require("zlib");

const buildId = "362f02a4-836f-41e1-80fd-af39fba6f9d4";
const raw = execSync(`npx eas-cli@latest build:view ${buildId} --json`, { encoding: "utf8" });
const jsonStart = raw.indexOf("{");
const build = JSON.parse(raw.slice(jsonStart));
const url = build.logFiles[0];

(async () => {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());

  let text = null;

  for (const decompress of [
    zlib.gunzipSync,
    zlib.brotliDecompressSync,
    zlib.inflateSync,
  ]) {
    try {
      text = decompress(buffer).toString("utf8");
      break;
    } catch {}
  }

  if (!text) {
    text = buffer.toString("utf8");
  }

  fs.writeFileSync("eas-new-log-readable.txt", text);

  const lines = text.split(/\r?\n/);
  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    if (/FAILURE|Execution failed|What went wrong|BUILD FAILED|error/i.test(lines[i])) {
      const start = Math.max(0, i - 10);
      const end = Math.min(lines.length, i + 30);
      matches.push(lines.slice(start, end).join("\n"));
    }
  }

  console.log(matches.slice(-3).join("\n\n----------------------\n\n") || lines.slice(-250).join("\n"));
})();
