#!/usr/bin/env node
// ============================================================================
//  compute-stats.mjs — Derive the REAL FrankenSim hero stats from the Rust
//  source, then rewrite the `heroStats` array in lib/content.ts in place.
//
//  Run:  bun scripts/compute-stats.mjs            (or: node scripts/compute-stats.mjs)
//        FRANKENSIM_DIR=/path/to/frankensim bun scripts/compute-stats.mjs
//        bun scripts/compute-stats.mjs --dry      (print, do not write)
//
//  What it counts (documented, so the numbers are defensible):
//    • Rust crates   — directories under crates/ that contain a Cargo.toml.
//                      Headline count EXCLUDES pure end-to-end harness crates
//                      (name ends in "-e2e"); the raw crates/ dir count is also
//                      reported. xtask lives outside crates/ and is not counted.
//    • Lines of Rust — total newline count across crates/**/*.rs, excluding any
//                      `target/` build dirs. (src-only LOC — i.e. excluding
//                      crate `tests/` dirs — is also reported for reference.)
//    • Inline tests  — count of #[test] / #[tokio::test] / #[wasm_bindgen_test]
//                      attributes across crates/**/*.rs.
//    • Conformance   — number of integration/conformance suite FILES: .rs files
//      suites          living under a crate `tests/` directory.
//    • Kernel layers — 7 (L0 SUBSTRATE → L6 HELM). Structural; see lib/content.ts
//                      `layers` (L0–L6). Verified below against that file.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIR = path.resolve(__dirname, "..");
const CONTENT_TS = path.join(WEBSITE_DIR, "lib", "content.ts");

const DRY = process.argv.includes("--dry") || process.argv.includes("--dry-run");

function expandHome(p) {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

const FRANKENSIM_DIR = path.resolve(
  expandHome(process.env.FRANKENSIM_DIR || "~/projects/frankensim"),
);
const CRATES_DIR = path.join(FRANKENSIM_DIR, "crates");

if (!fs.existsSync(CRATES_DIR)) {
  console.error(
    `[compute-stats] crates/ not found at ${CRATES_DIR}\n` +
      `Set FRANKENSIM_DIR to the frankensim repo root (currently: ${FRANKENSIM_DIR}).`,
  );
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/*  Filesystem walk (skips target/ build dirs)                                */
/* -------------------------------------------------------------------------- */

/** Recursively collect *.rs files under `dir`, skipping any `target` dir. */
function walkRs(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "target") continue; // build artifacts
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRs(full, acc);
    } else if (entry.isFile() && entry.name.endsWith(".rs")) {
      acc.push(full);
    }
  }
  return acc;
}

function countLines(text) {
  if (text.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  // count a final non-terminated line as a line too
  if (text.length > 0 && text[text.length - 1] !== "\n") n++;
  return n;
}

function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

/* -------------------------------------------------------------------------- */
/*  Crates                                                                    */
/* -------------------------------------------------------------------------- */

const crateDirs = fs
  .readdirSync(CRATES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => fs.existsSync(path.join(CRATES_DIR, name, "Cargo.toml")))
  .sort();

const e2eCrates = crateDirs.filter((n) => /-e2e$/.test(n));
const libraryCrates = crateDirs.filter((n) => !/-e2e$/.test(n));

/* -------------------------------------------------------------------------- */
/*  LOC + tests (single pass over every .rs file)                             */
/* -------------------------------------------------------------------------- */

const rsFiles = walkRs(CRATES_DIR);

let locTotal = 0;
let locSrcOnly = 0; // excludes crate tests/ dirs
let testAttr = 0; // #[test]
let tokioTestAttr = 0; // #[tokio::test]
let wasmTestAttr = 0; // #[wasm_bindgen_test]
let inlineTestsSrc = 0; // #[test]* inside src (non-tests dir)
let suiteFileSet = new Set();

const RE_TEST = /#\[\s*test\s*\]/g;
const RE_TOKIO = /#\[\s*tokio::test/g;
const RE_WASM = /#\[\s*wasm_bindgen_test/g;

for (const file of rsFiles) {
  const rel = path.relative(CRATES_DIR, file);
  const inTestsDir = /(^|\/)tests\//.test(rel); // crate integration/conformance dir
  const text = fs.readFileSync(file, "utf8");
  const lines = countLines(text);
  locTotal += lines;
  if (!inTestsDir) locSrcOnly += lines;

  const t = countMatches(text, RE_TEST);
  const tk = countMatches(text, RE_TOKIO);
  const wa = countMatches(text, RE_WASM);
  testAttr += t;
  tokioTestAttr += tk;
  wasmTestAttr += wa;
  if (!inTestsDir) inlineTestsSrc += t + tk + wa;
  if (inTestsDir) suiteFileSet.add(file);
}

const testTotal = testAttr + tokioTestAttr + wasmTestAttr;
const suiteFiles = suiteFileSet.size;

/* -------------------------------------------------------------------------- */
/*  Kernel layers — structural, verified against lib/content.ts `layers`      */
/* -------------------------------------------------------------------------- */

let kernelLayers = 7;
let layersVerified = false;
try {
  const contentSrc = fs.readFileSync(CONTENT_TS, "utf8");
  const ids = new Set();
  const re = /id:\s*"(L[0-6])"/g;
  let m;
  while ((m = re.exec(contentSrc)) !== null) ids.add(m[1]);
  if (ids.size >= 1) {
    kernelLayers = ids.size;
    layersVerified = [...ids].sort().join(",") === "L0,L1,L2,L3,L4,L5,L6";
  }
} catch {
  /* keep default 7 */
}

/* -------------------------------------------------------------------------- */
/*  Human rounding                                                            */
/* -------------------------------------------------------------------------- */

function humanK(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/* -------------------------------------------------------------------------- */
/*  Derived hero-stat values                                                  */
/* -------------------------------------------------------------------------- */

const crateCount = libraryCrates.length; // headline (excludes -e2e harnesses)
const locHuman = humanK(locTotal); // e.g. "149K"

const heroStats = [
  { label: "Kernel Layers", value: String(kernelLayers), helper: "L0 Substrate → L6 Helm" },
  { label: "Rust Crates", value: String(crateCount), helper: "one acyclic workspace" },
  { label: "Lines of Rust", value: locHuman, helper: "pure, memory-safe, Franken-only deps" },
  { label: "Inline Tests", value: String(testTotal), helper: `+ ${suiteFiles} conformance suites` },
];

/* -------------------------------------------------------------------------- */
/*  JSON summary                                                              */
/* -------------------------------------------------------------------------- */

const summary = {
  source: FRANKENSIM_DIR,
  crates: {
    rawDirCount: crateDirs.length,
    libraryCrates: libraryCrates.length,
    excludedE2e: e2eCrates,
    headline: crateCount,
  },
  linesOfRust: {
    total: locTotal,
    srcOnly: locSrcOnly,
    testsDirs: locTotal - locSrcOnly,
    human: locHuman,
    rsFiles: rsFiles.length,
  },
  tests: {
    testAttr,
    tokioTestAttr,
    wasmTestAttr,
    total: testTotal,
    inlineSrc: inlineTestsSrc,
    inSuiteDirs: testTotal - inlineTestsSrc,
    conformanceSuiteFiles: suiteFiles,
  },
  kernelLayers: { count: kernelLayers, verifiedL0toL6: layersVerified },
  heroStats,
};

console.log(JSON.stringify(summary, null, 2));

/* -------------------------------------------------------------------------- */
/*  Rewrite heroStats in lib/content.ts (precise, idempotent)                 */
/* -------------------------------------------------------------------------- */

function renderHeroStats(stats) {
  const lines = stats.map(
    (s) =>
      `  { label: ${JSON.stringify(s.label)}, value: ${JSON.stringify(
        s.value,
      )}, helper: ${JSON.stringify(s.helper)} },`,
  );
  return `export const heroStats: Stat[] = [\n${lines.join("\n")}\n];`;
}

const newBlock = renderHeroStats(heroStats);
const content = fs.readFileSync(CONTENT_TS, "utf8");
const BLOCK_RE = /export const heroStats: Stat\[\] = \[[\s\S]*?\];/;

if (!BLOCK_RE.test(content)) {
  console.error(
    "\n[compute-stats] Could not locate the `heroStats` array in lib/content.ts. " +
      "Nothing written (file left untouched).",
  );
  process.exit(2);
}

const updated = content.replace(BLOCK_RE, newBlock);

if (DRY) {
  console.error("\n[compute-stats] --dry: would write this heroStats block:\n");
  console.error(newBlock);
} else if (updated === content) {
  console.error("\n[compute-stats] heroStats already up to date — no change written.");
} else {
  fs.writeFileSync(CONTENT_TS, updated);
  console.error(`\n[compute-stats] Updated heroStats in ${path.relative(WEBSITE_DIR, CONTENT_TS)}.`);
}
