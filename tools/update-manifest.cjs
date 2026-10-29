/* Only emit a manifest when real .sig companions exist. Signatures are verified
   by the desktop updater, not by this packaging step. Never generate fake ones. */
const fs = require("node:fs"),
  path = require("node:path");
const root = process.argv[2] || "artifacts",
  tag = process.env.RELEASE_TAG;
if (!/^v\d+\.\d+\.\d+$/.test(tag || ""))
  throw new Error("RELEASE_TAG must be vMAJOR.MINOR.PATCH");
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
const platforms = {};
const names = new Set();
for (const file of walk(root)
  .filter((f) => f.endsWith(".sig"))
  .sort()) {
  const artifact = file.slice(0, -4);
  if (!fs.existsSync(artifact)) continue;
  const name = path.basename(artifact);
  let targets = [];
  if (/x64.*setup\.exe$/i.test(name)) targets = ["windows-x86_64"];
  else if (/x64.*\.msi$/i.test(name) && !platforms["windows-x86_64"])
    targets = ["windows-x86_64"];
  else if (/\.app\.tar\.gz$/i.test(name))
    targets = file.includes("universal")
      ? ["darwin-aarch64", "darwin-x86_64"]
      : [file.includes("aarch64") ? "darwin-aarch64" : "darwin-x86_64"];
  else if (/\.AppImage(\.tar\.gz)?$/i.test(name)) targets = ["linux-x86_64"];
  if (!targets.length) continue;
  if (names.has(name)) throw new Error("Duplicate asset name: " + name);
  names.add(name);
  const signature = fs.readFileSync(file, "utf8").trim();
  if (!signature) throw new Error("Empty signature: " + file);
  for (const target of targets)
    platforms[target] = {
      signature,
      url: `https://github.com/amhasani2a/Nron-Editor/releases/download/${tag}/${encodeURIComponent(name)}`,
    };
}
if (Object.keys(platforms).length) {
  fs.writeFileSync(
    path.join(root, "latest.json"),
    JSON.stringify(
      {
        version: tag.slice(1),
        notes: "Release " + tag,
        pub_date: new Date().toISOString(),
        platforms,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Signed updater targets:", Object.keys(platforms).join(", "));
} else
  console.log(
    "No signed updater artifacts; latest.json intentionally not created.",
  );
