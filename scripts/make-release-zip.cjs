/**
 * Builds the COMPLETE hand-over ZIP that the owner copies into the local
 * project before pushing to GitHub/Vercel.
 *
 *   node scripts/make-release-zip.cjs
 *
 * Output: public/downloads/mediterranic-<CODE_VERSION>.zip (served by the
 * sandbox at /downloads/... and linked from /sos and /api/sos-context).
 *
 * Never included: .env (secrets), .git, node_modules, .next, build caches,
 * logs, database copies/backups and previous ZIPs.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const versionSource = fs.readFileSync(path.join(ROOT, "src/lib/version.ts"), "utf8");
const match = versionSource.match(/CODE_VERSION\s*=\s*"([^"]+)"/);
if (!match) throw new Error("CODE_VERSION not found in src/lib/version.ts");
const CODE_VERSION = match[1];

const outDir = path.join(ROOT, "public/downloads");
fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
  if (file.endsWith(".zip")) fs.rmSync(path.join(outDir, file), { force: true });
}
const outFile = path.join(outDir, `mediterranic-${CODE_VERSION}.zip`);

const EXCLUDES = [
  ".git/*",
  ".git",
  "node_modules/*",
  ".next/*",
  ".env",
  ".env.*",
  "*.tsbuildinfo",
  "tsconfig.tsbuildinfo",
  "*.log",
  "npm-debug.log*",
  ".DS_Store",
  "*/.DS_Store",
  ".vercel/*",
  "public/downloads/*",
  "backups/*",
  "*.sqlite",
  "*.sqlite3",
  "*.db",
  "*.dump",
  "*.sql",
  "*.sql.gz",
  "*backup*.json",
  ".checks/*",
  "test-results/*",
  "playwright-report/*",
  ".cache/*",
  ".mirror*",
  "* [0-9]*",
];

const args = ["-r", "-q", "-X", outFile, "."];
for (const pattern of EXCLUDES) args.push("-x", pattern);

execFileSync("zip", args, { cwd: ROOT, stdio: "inherit" });

const entries = execFileSync("unzip", ["-Z1", outFile], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const size = fs.statSync(outFile).size;

const required = ["src/lib/version.ts", "src/app/page.tsx", "src/components/site-footer.tsx", "src/app/api/uploads/[id]/route.ts", "scripts/pull-live.cjs", "scripts/lib/live-public.cjs", "vercel.json", "package.json", "package-lock.json", "public/icon.png"];
for (const file of required) {
  if (!entries.includes(file)) throw new Error(`ZIP is incomplete, missing ${file}`);
}
const forbidden = entries.filter((entry) => /^\.env|(^|\/)node_modules\/|(^|\/)\.next\/|(^|\/)\.git\//.test(entry));
if (forbidden.length > 0) throw new Error(`ZIP must not carry secrets or build output: ${forbidden.slice(0, 5).join(", ")}`);

console.log(
  `public/downloads/mediterranic-${CODE_VERSION}.zip — ${entries.length} files, ${(size / 1024 / 1024).toFixed(2)} MB. ` +
    "No .env, .git, node_modules, .next, caches, logs or database copies.",
);
