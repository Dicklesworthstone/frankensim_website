#!/usr/bin/env node
// ============================================================================
//  generate-atlas.mjs — Derive the COMPLETE FrankenSim crate atlas from the
//  Rust workspace and splice it into lib/content.ts, so the atlas is a true,
//  self-maintaining inventory instead of a hand-curated subset.
//
//  Run:  bun scripts/generate-atlas.mjs           (writes lib/content.ts)
//        FRANKENSIM_DIR=/path/to/frankensim bun scripts/generate-atlas.mjs
//        bun scripts/generate-atlas.mjs --dry      (print JSON, do not write)
//
//  What it reads, per crates/<name>/Cargo.toml:
//    • package `name`                       (e.g. "fs-math")
//    • package `description`                (one line)
//    • [package.metadata.frankensim].layer  ("L0"…"L6" or "UTIL")
//
//  What it EXCLUDES (kept consistent with compute-stats.mjs's crate count):
//    • the pure end-to-end harness crates whose name ends in "-e2e"
//      (fs-diffreal-e2e, fs-epi-e2e, fs-flywheel-e2e). Their metadata layer is
//      L6, so leaving them in would inflate L6 and the headline total.
//    • xtask — it lives OUTSIDE crates/, so it is never seen here anyway.
//  Every other crate under crates/ that carries a Cargo.toml is included, which
//  matches compute-stats.mjs's "libraryCrates" headline exactly.
//
//  Blurb rule:
//    • If a crate already has a hand-written blurb in the current
//      lib/content.ts `crates[]`, that curated blurb is KEPT verbatim.
//    • Otherwise a blurb is derived from the Cargo.toml `description`: the first
//      sentence, trimmed at a clause boundary to roughly <= 140 characters, with
//      trailing connective words / punctuation cleaned off, so the cards stay
//      uniform instead of dumping a long paragraph.
//
//  What it writes into lib/content.ts (precise, idempotent, re-parsed after):
//    • the `crates: [...]` array inside each layers[] object (L0…L6) — only that
//      array; id / code / name / color / tagline / responsibility are untouched.
//    • the top-level `crates: Crate[] = [...]` array (every included crate).
//  Cross-cutting UTIL crates are NOT added to any layer array (they belong to no
//  single layer); they only appear in the top-level crates[] with layer "UTIL".
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
    `[generate-atlas] crates/ not found at ${CRATES_DIR}\n` +
      `Set FRANKENSIM_DIR to the frankensim repo root (currently: ${FRANKENSIM_DIR}).`,
  );
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/*  Cargo.toml parsing                                                        */
/* -------------------------------------------------------------------------- */

function parseCargo(text) {
  const nameM = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
  const descM = text.match(/^\s*description\s*=\s*"((?:[^"\\]|\\.)*)"/m);
  let layer = null;
  const sec = text.match(/\[package\.metadata\.frankensim\]([\s\S]*?)(?:\n\s*\[|$)/);
  if (sec) {
    const lm = sec[1].match(/layer\s*=\s*"([^"]+)"/);
    if (lm) layer = lm[1];
  }
  // description may itself contain escaped chars — decode as a JS/JSON string.
  let description = null;
  if (descM) {
    try {
      description = JSON.parse('"' + descM[1] + '"');
    } catch {
      description = descM[1];
    }
  }
  return { name: nameM ? nameM[1] : null, description, layer };
}

/* -------------------------------------------------------------------------- */
/*  Blurb derivation                                                          */
/* -------------------------------------------------------------------------- */

const MAX = 140; // target length for the trimmed body
const SOFT = 150; // a complete first sentence up to here is kept whole
const MIN = 40; // a clause boundary shorter than this is ignored
const STOP = new Set([
  "and", "or", "the", "a", "an", "of", "with", "plus", "by", "via", "for",
  "to", "in", "on", "that", "into", "under", "over", "as", "at", "from",
  "its", "their", "where", "so", "each", "only", "which", "whose", "when",
  "while", "than", "then", "both", "either", "not", "no",
]);

// Drop everything from the first unmatched "(" (a chopped-open parenthetical).
function balanceParens(s) {
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") stack.push(i);
    else if (s[i] === ")") stack.pop();
  }
  return stack.length ? s.slice(0, stack[0]) : s;
}

// Trim connective words + dangling punctuation off the tail of a cut clause.
function cleanTail(s) {
  let prev;
  do {
    prev = s;
    s = balanceParens(s);
    s = s.replace(/[\s,;:—–(\-]+$/u, "");
    const words = s.split(" ");
    const last = words[words.length - 1] || "";
    if (words.length > 3 && STOP.has(last.toLowerCase().replace(/[^a-z']/g, ""))) {
      words.pop();
      s = words.join(" ");
    }
  } while (s !== prev);
  return s;
}

// First sentence: up to the first period that is followed by whitespace and an
// uppercase letter or "(" (a real sentence break, not a decimal or abbrev).
function firstSentence(s) {
  const m = s.match(/^([\s\S]*?[.])\s+(?=[A-Z(])/);
  return m ? m[1] : s;
}

function deriveBlurb(description) {
  let s = String(description).replace(/\s+/g, " ").trim();
  s = firstSentence(s);

  if (s.length > SOFT) {
    // 1) Cut at the FIRST strong clause boundary (em/en dash, semicolon) that
    //    yields a self-contained lead clause — punchy over exhaustive.
    let cut = -1;
    for (const sep of [" — ", " – ", "; "]) {
      let idx = s.indexOf(sep);
      while (idx !== -1 && idx < MIN) idx = s.indexOf(sep, idx + 1);
      if (idx >= MIN && idx <= SOFT && (cut === -1 || idx < cut)) cut = idx;
    }
    if (cut === -1) {
      // 2) Else end at the LAST comma-delimited list item before the cap.
      const idx = s.lastIndexOf(", ", SOFT);
      if (idx >= MIN) cut = idx;
    }
    if (cut !== -1) {
      s = s.slice(0, cut);
    } else {
      // 3) Else hard word-boundary trim.
      s = s.slice(0, MAX);
      const sp = s.lastIndexOf(" ");
      if (sp > MIN) s = s.slice(0, sp);
    }
    s = cleanTail(s);
  } else {
    s = balanceParens(s).trim();
  }

  // Uniform terminal punctuation.
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

/* -------------------------------------------------------------------------- */
/*  Read the workspace                                                        */
/* -------------------------------------------------------------------------- */

const dirs = fs
  .readdirSync(CRATES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((n) => fs.existsSync(path.join(CRATES_DIR, n, "Cargo.toml")))
  .sort();

const all = [];
for (const d of dirs) {
  const p = parseCargo(fs.readFileSync(path.join(CRATES_DIR, d, "Cargo.toml"), "utf8"));
  if (!p.name) {
    console.error(`[generate-atlas] ${d}/Cargo.toml has no package name — skipped.`);
    continue;
  }
  all.push({ dir: d, ...p });
}

const excludedE2e = all.filter((c) => /-e2e$/.test(c.name)).map((c) => c.name).sort();
const included = all.filter((c) => !/-e2e$/.test(c.name));

/* -------------------------------------------------------------------------- */
/*  Existing curated blurbs (kept verbatim)                                   */
/* -------------------------------------------------------------------------- */

const content = fs.readFileSync(CONTENT_TS, "utf8");

const CRATES_BLOCK_RE = /export const crates: Crate\[\] = \[[\s\S]*?\n\];/;
const cratesBlockM = content.match(CRATES_BLOCK_RE);
if (!cratesBlockM) {
  console.error("[generate-atlas] Could not locate `crates: Crate[]` array in lib/content.ts.");
  process.exit(2);
}
const curatedBlurbs = new Map();
{
  const entryRe = /\{\s*name:\s*"([^"]+)",\s*layer:\s*"[^"]+",\s*blurb:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let m;
  while ((m = entryRe.exec(cratesBlockM[0])) !== null) {
    let value;
    try {
      value = JSON.parse('"' + m[2] + '"');
    } catch {
      value = m[2];
    }
    curatedBlurbs.set(m[1], value);
  }
}

/* -------------------------------------------------------------------------- */
/*  Layer metadata (ids + codes) parsed from content.ts (self-maintaining)    */
/* -------------------------------------------------------------------------- */

const layerCode = new Map();
{
  const re = /id:\s*"(L[0-6])",\s*code:\s*"([A-Z]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) layerCode.set(m[1], m[2]);
}
const LAYER_IDS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"];

/* -------------------------------------------------------------------------- */
/*  Build records: { name, layer, blurb }                                     */
/* -------------------------------------------------------------------------- */

let curatedKept = 0;
let derived = 0;
const records = included.map((c) => {
  let blurb;
  if (curatedBlurbs.has(c.name)) {
    blurb = curatedBlurbs.get(c.name);
    curatedKept++;
  } else if (c.description) {
    blurb = deriveBlurb(c.description);
    derived++;
  } else {
    blurb = c.name;
    derived++;
  }
  return { name: c.name, layer: c.layer || "UTIL", blurb };
});

const byLayer = new Map();
for (const r of records) {
  if (!byLayer.has(r.layer)) byLayer.set(r.layer, []);
  byLayer.get(r.layer).push(r);
}
for (const list of byLayer.values()) list.sort((a, b) => a.name.localeCompare(b.name));

const perLayerCount = {};
for (const id of [...LAYER_IDS, "UTIL"]) perLayerCount[id] = (byLayer.get(id) || []).length;
const total = records.length;

/* -------------------------------------------------------------------------- */
/*  Render + splice                                                           */
/* -------------------------------------------------------------------------- */

// Layer arrays (L0…L6 only). UTIL crates belong to no single layer.
let updated = content;
for (const id of LAYER_IDS) {
  const names = (byLayer.get(id) || []).map((r) => r.name);
  const arr = "[" + names.map((n) => JSON.stringify(n)).join(", ") + "]";
  const re = new RegExp('(id:\\s*"' + id + '"[\\s\\S]*?\\bcrates:\\s*)\\[[^\\]]*\\]');
  if (!re.test(updated)) {
    console.error(`[generate-atlas] Could not find layer ${id} crates array in lib/content.ts.`);
    process.exit(3);
  }
  updated = updated.replace(re, `$1${arr}`);
}

// Top-level crates[] — grouped by layer with section comments, UTIL first.
function renderEntry(r) {
  return `  { name: ${JSON.stringify(r.name)}, layer: ${JSON.stringify(
    r.layer,
  )}, blurb: ${JSON.stringify(r.blurb)} },`;
}
const sections = [];
{
  const util = byLayer.get("UTIL") || [];
  if (util.length) {
    sections.push("  // Cross-cutting (present workspace-wide)");
    sections.push(...util.map(renderEntry));
  }
  for (const id of LAYER_IDS) {
    const list = byLayer.get(id) || [];
    if (!list.length) continue;
    sections.push(`  // ${id} ${layerCode.get(id) || ""}`.trimEnd());
    sections.push(...list.map(renderEntry));
  }
}
const newCratesBlock = `export const crates: Crate[] = [\n${sections.join("\n")}\n];`;
updated = updated.replace(CRATES_BLOCK_RE, newCratesBlock);

/* -------------------------------------------------------------------------- */
/*  Verify by re-parsing the spliced result                                   */
/* -------------------------------------------------------------------------- */

function reparseCrates(src) {
  const block = src.match(CRATES_BLOCK_RE);
  if (!block) return null;
  const out = [];
  const entryRe = /\{\s*name:\s*"([^"]+)",\s*layer:\s*"([^"]+)",\s*blurb:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let m;
  while ((m = entryRe.exec(block[0])) !== null) out.push({ name: m[1], layer: m[2] });
  return out;
}

const reparsed = reparseCrates(updated);
if (!reparsed || reparsed.length !== total) {
  console.error(
    `[generate-atlas] Verification failed: re-parsed ${reparsed ? reparsed.length : 0} crates, expected ${total}. File NOT written.`,
  );
  process.exit(4);
}
// Confirm every layer array is a strict subset of the reparsed crates and sums.
{
  let layerSum = 0;
  for (const id of LAYER_IDS) {
    const re = new RegExp('id:\\s*"' + id + '"[\\s\\S]*?\\bcrates:\\s*\\[([^\\]]*)\\]');
    const m = updated.match(re);
    const n = m ? (m[1].match(/"/g) || []).length / 2 : 0;
    layerSum += n;
    if (n !== perLayerCount[id]) {
      console.error(`[generate-atlas] Verification failed: layer ${id} array has ${n}, expected ${perLayerCount[id]}.`);
      process.exit(5);
    }
  }
  if (layerSum + perLayerCount.UTIL !== total) {
    console.error(`[generate-atlas] Verification failed: layer arrays (${layerSum}) + UTIL (${perLayerCount.UTIL}) != total (${total}).`);
    process.exit(6);
  }
}

/* -------------------------------------------------------------------------- */
/*  Summary + write                                                           */
/* -------------------------------------------------------------------------- */

const summary = {
  source: FRANKENSIM_DIR,
  totals: {
    dirsWithCargo: dirs.length,
    included: total,
    excludedE2e,
  },
  perLayer: perLayerCount,
  blurbs: { curatedKept, derived, total: curatedKept + derived },
};
console.log(JSON.stringify(summary, null, 2));

if (DRY) {
  console.error("\n[generate-atlas] --dry: lib/content.ts NOT written.");
} else if (updated === content) {
  console.error("\n[generate-atlas] Atlas already up to date — no change written.");
} else {
  fs.writeFileSync(CONTENT_TS, updated);
  console.error(`\n[generate-atlas] Updated crates[] + layers[].crates in ${path.relative(WEBSITE_DIR, CONTENT_TS)}.`);
}
