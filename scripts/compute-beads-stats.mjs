#!/usr/bin/env node
// ============================================================================
//  compute-beads-stats.mjs — Derive the roadmap's tracker numbers and phase
//  statuses from FrankenSim's beads issue tracker, then rewrite `beadsStats`
//  and the `status` of each entry of `phases` in lib/content.ts in place.
//
//  Run:  bun scripts/compute-beads-stats.mjs
//        FRANKENSIM_DIR=/path/to/frankensim bun scripts/compute-beads-stats.mjs
//        bun scripts/compute-beads-stats.mjs --dry   (print, do not write)
//
//  Source: <FRANKENSIM_DIR>/.beads/issues.jsonl (the tracker's JSONL export;
//  run `br sync --flush-only` in the frankensim repo first so it is current).
//
//  What it counts:
//    • Every issue except tombstones (deleted issues).
//    • Types by `issue_type`. Milestones are the issues whose title starts
//      "MILESTONE <phase>:" (one per roadmap phase, PV → P6).
//    • Statuses: open, in_progress, blocked, deferred, closed.
//    • Ambition: the label ambition-s / ambition:S (and F, M; any case); an
//      issue without such a label but with a title starting "[S]", "[F]" or
//      "[M]" counts by its title.
//    • Phase status: a phase is "done" when its MILESTONE issue is closed,
//      "planned" when it is deferred, otherwise "active". A phase without a
//      MILESTONE issue fails the run.
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
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

const FRANKENSIM_DIR = path.resolve(expandHome(process.env.FRANKENSIM_DIR || "~/projects/frankensim"));
const ISSUES = path.join(FRANKENSIM_DIR, ".beads", "issues.jsonl");
if (!fs.existsSync(ISSUES)) {
  console.error(`[compute-beads-stats] ${ISSUES} not found; set FRANKENSIM_DIR to the frankensim repo root.`);
  process.exit(1);
}

const issues = fs
  .readFileSync(ISSUES, "utf8")
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line))
  .filter((issue) => issue.status !== "tombstone");

const count = (pred) => issues.filter(pred).length;
const KNOWN_STATUS = new Set(["open", "in_progress", "blocked", "deferred", "closed"]);
const unknownStatus = issues.filter((i) => !KNOWN_STATUS.has(i.status));
if (unknownStatus.length) {
  console.error(
    `[compute-beads-stats] ${unknownStatus.length} issue(s) with an unknown status, e.g. ` +
      `${unknownStatus[0].id}: ${unknownStatus[0].status}. Nothing written.`,
  );
  process.exit(2);
}

function ambitionOf(issue) {
  for (const label of issue.labels || []) {
    const m = /^ambition[-:]([sfm])$/i.exec(label);
    if (m) return m[1].toUpperCase();
  }
  const t = /^\[([SFM])\]/.exec(issue.title || "");
  return t ? t[1] : null;
}

const MILESTONE_RE = /^MILESTONE (PV|P\d+):/;
const milestones = new Map();
for (const issue of issues) {
  const m = MILESTONE_RE.exec(issue.title || "");
  if (!m) continue;
  if (milestones.has(m[1])) {
    console.error(`[compute-beads-stats] two MILESTONE ${m[1]} issues. Nothing written.`);
    process.exit(2);
  }
  milestones.set(m[1], issue);
}

const total = issues.length;
const closed = count((i) => i.status === "closed");
const stats = {
  total,
  features: count((i) => i.issue_type === "feature"),
  tasks: count((i) => i.issue_type === "task"),
  epics: count((i) => i.issue_type === "epic"),
  milestones: milestones.size,
  bugs: count((i) => i.issue_type === "bug"),
  chores: count((i) => i.issue_type === "chore"),
  open: count((i) => i.status === "open"),
  closed,
  inProgress: count((i) => i.status === "in_progress"),
  blocked: count((i) => i.status === "blocked"),
  deferred: count((i) => i.status === "deferred"),
  closedPct: Math.round((closed / total) * 100),
  ambition: {
    S: count((i) => ambitionOf(i) === "S"),
    F: count((i) => ambitionOf(i) === "F"),
    M: count((i) => ambitionOf(i) === "M"),
  },
};

const block =
  "export const beadsStats = {\n" +
  Object.entries(stats)
    .map(([k, v]) =>
      typeof v === "object"
        ? `  ${k}: { ${Object.entries(v).map(([a, b]) => `${a}: ${b}`).join(", ")} },`
        : `  ${k}: ${v},`,
    )
    .join("\n") +
  "\n};";

const BLOCK_RE = /export const beadsStats = \{[\s\S]*?\n\};/;
let content = fs.readFileSync(CONTENT_TS, "utf8");
if (!BLOCK_RE.test(content)) {
  console.error("[compute-beads-stats] `beadsStats` not found in lib/content.ts. Nothing written.");
  process.exit(2);
}
let updated = content.replace(BLOCK_RE, block);

const PHASE_RE = /(\{ id: "(PV|P\d+)", name: "[^"]*", status: )"(done|active|planned)"/g;
const phaseStatus = {};
let missing = null;
updated = updated.replace(PHASE_RE, (whole, head, id) => {
  const milestone = milestones.get(id);
  if (!milestone) {
    missing = id;
    return whole;
  }
  const status =
    milestone.status === "closed" ? "done" : milestone.status === "deferred" ? "planned" : "active";
  phaseStatus[id] = `${status} (${milestone.id} ${milestone.status})`;
  return `${head}"${status}"`;
});
if (missing) {
  console.error(`[compute-beads-stats] phase ${missing} has no MILESTONE issue. Nothing written.`);
  process.exit(2);
}
if (Object.keys(phaseStatus).length === 0) {
  console.error("[compute-beads-stats] no phase entries matched in lib/content.ts. Nothing written.");
  process.exit(2);
}

console.log(JSON.stringify({ source: ISSUES, tombstonesExcluded: true, stats, phaseStatus }, null, 2));

if (DRY) {
  console.error("\n[compute-beads-stats] --dry: nothing written.");
} else if (updated === content) {
  console.error("\n[compute-beads-stats] already up to date: no change written.");
} else {
  fs.writeFileSync(CONTENT_TS, updated);
  console.error(`\n[compute-beads-stats] updated beadsStats and phase statuses in ${path.relative(WEBSITE_DIR, CONTENT_TS)}.`);
}
