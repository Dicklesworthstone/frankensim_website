"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion, springs } from "@/components/motion";
import {
  Play,
  Pause,
  StepForward,
  ChevronLeft,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Hash,
  GitBranch,
  FlaskConical,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const CARD = "#061019";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const VERIFIED = "#22d3ee"; // cyan  — interval-certified numerics
const VALIDATED = "#a3e635"; // lime  — anchored to experiment
const ESTIMATED = "#fbbf24"; // amber — best-effort estimate
const VIOLET = "#a855f7";
const BLUE = "#3b82f6";
const TEAL = "#14b8a6";
const ROSE = "#f43f5e";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Domain model — one physical question flowing through the engine    */
/* ------------------------------------------------------------------ */

const MAX_PHASE = 5;
const BUDGET = 100; // credits

/* the QoI + the two local claims that will compose then glue */
const QOI = "drag";
const A_VALUE = 12.47; // survivor claim (verified, from certified numerics)
const B_VALUE = 9.83; // neighbour subdomain claim (validated, wind-tunnel anchored)
const C_VALUE = Math.sqrt(A_VALUE * A_VALUE + B_VALUE * B_VALUE); // 15.88 resultant

const SLICES = [
  { key: "numerical", label: "numerical", desc: "discretization · interval bound", color: CYAN },
  { key: "statistical", label: "statistical", desc: "Monte-Carlo / sampling error", color: VIOLET },
  { key: "model", label: "model-form", desc: "physics approximation / closure", color: "#f59e0b" },
  { key: "sensitivity", label: "sensitivity", desc: "propagated input uncertainty", color: TEAL },
] as const;

const A_SLICES = [0.5, 0.8, 1.4, 0.7]; // total 3.4e-2  (verified)
const B_SLICES = [0.4, 1.0, 1.6, 0.9]; // total 3.9e-2  (validated)
const C_SLICES = A_SLICES.map((v, i) => v + B_SLICES[i]); // conservative add → 7.3e-2
const SLICE_FULL = 3.2; // bar full-scale (1e-2)

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const A_TOTAL = sum(A_SLICES); // 3.4
const C_TOTAL = sum(C_SLICES); // 7.3
const fmtErr = (v: number) => `${v.toFixed(1)}e-2`;

/* deterministic short hash → blake3:xxxx…xx  (FNV-1a, no Math.random) */
function fnv(s: string): string {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let h2 = (h ^ 0x9e3779b9) >>> 0;
  h2 = Math.imul(h2, 0x01000193) >>> 0;
  return (h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}
const HASH_A = fnv(`${QOI}|verified|${fmtErr(A_TOTAL)}`);
const HASH_G = fnv(`global|validated|${fmtErr(C_TOTAL)}`);
const shortHash = (h: string) => `blake3:${h.slice(0, 4)}…${h.slice(-2)}`;

/* proposers — plural, cheap; all fire candidates born ESTIMATED (amber) */
const LANE_Y = [86, 150, 214];
const PROPOSERS = [
  { key: "surrogate", label: "surrogate", tag: "NN emulator", color: VIOLET, guess: "σ̂ 12.7", accept: false },
  { key: "coarse", label: "coarse solve", tag: "h/2 mesh", color: BLUE, guess: "12.47", accept: true },
  { key: "ml", label: "ML guess", tag: "learned prior", color: TEAL, guess: "ŷ 12.9", accept: false },
] as const;

/* cost ledger — cheap screening for everyone, expensive confirmation only for the survivor */
const COST = { propose: 9, verify: 6, confirm: 38, compose: 4, glue: 3 };
function spentAt(phase: number, reject: boolean): number {
  let s = 0;
  if (phase >= 1) s += COST.propose;
  if (phase >= 2) s += COST.verify;
  if (!reject) {
    if (phase >= 3) s += COST.confirm;
    if (phase >= 4) s += COST.compose;
    if (phase >= 5) s += COST.glue;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/*  Status / verdict line                                              */
/* ------------------------------------------------------------------ */

function statusText(phase: number, reject: boolean): string {
  if (reject) {
    if (phase === 0) return `physical question posed · QoI = ${QOI} · budget ${BUDGET}cr`;
    if (phase === 1) return "3 proposers fired candidates · all estimated (amber)";
    if (phase === 2) return "Prager–Synge accept test FAILED · fail-closed · nothing certified";
    return "no accept, no answer — the engine returns ⊥ (no claim)";
  }
  switch (phase) {
    case 0:
      return `physical question posed · QoI = ${QOI} · budget ${BUDGET}cr`;
    case 1:
      return "3 proposers fired candidates · all estimated (amber)";
    case 2:
      return "accept test · 2 rejected (fail-closed) · 1 accepted → verified";
    case 3:
      return `verified claim · total rel-err ${fmtErr(A_TOTAL)} · ${shortHash(HASH_A)} · adjoint attached`;
    case 4:
      return `verified ⊗ validated → validated · weakest colour wins · slices add → ${fmtErr(C_TOTAL)}`;
    default:
      return `global certified claim · validated · ${fmtErr(C_TOTAL)} · justified belief at minimum cost`;
  }
}

/* ------------------------------------------------------------------ */
/*  Token target positions (framer transforms on motion.g)            */
/* ------------------------------------------------------------------ */

interface TokTarget {
  x: number;
  y: number;
  color: string;
  opacity: number;
  scale: number;
}
function tokenTarget(phase: number, lane: number, accept: boolean, reject: boolean): TokTarget {
  const y0 = LANE_Y[lane];
  if (phase < 1) return { x: 344, y: y0, color: ESTIMATED, opacity: 0, scale: 0.5 };
  if (phase === 1) return { x: 452, y: y0, color: ESTIMATED, opacity: 1, scale: 1 };
  const accepted = accept && !reject;
  if (accepted) return { x: 642, y: 150, color: VERIFIED, opacity: 1, scale: 1.1 };
  return { x: 498, y: y0 + 92, color: ROSE, opacity: 0, scale: 0.7 }; // fail-closed drain
}

/* ------------------------------------------------------------------ */
/*  Small UI atoms                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  color,
  label,
  ariaLabel,
  active,
  disabled,
  children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  ariaLabel: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 py-2 font-mono text-xs transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40",
      )}
      style={{
        borderColor: `${color}${active ? "" : "44"}`,
        color,
        background: active ? `${color}1a` : "transparent",
      }}
    >
      {children}
      {label}
    </button>
  );
}

function Chip({ color, text }: { color: string; text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}

/* mini stacked slice bar used in the dossier cards */
function SliceBar({ values, tint }: { values: number[]; tint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {SLICES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className="w-[70px] shrink-0 font-mono text-[10px]" style={{ color: MUTED }}>
            {s.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "#0a1620" }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.min(100, (values[i] / SLICE_FULL) * 100)}%`,
                background: tint ?? s.color,
                opacity: 0.9,
              }}
            />
          </div>
          <span className="w-[42px] shrink-0 text-right font-mono text-[10px]" style={{ color: BRIGHT }}>
            {values[i].toFixed(1)}e-2
          </span>
        </div>
      ))}
    </div>
  );
}

type StageState = "pending" | "active" | "failed";
function stageState(phase: number, reject: boolean, min: number): StageState {
  if (reject && phase >= 2) return "failed";
  return phase >= min ? "active" : "pending";
}

/* dossier card shell */
function DossierCard({
  title,
  icon,
  accent,
  state,
  children,
}: {
  title: string;
  icon: ReactNode;
  accent: string;
  state: StageState;
  children: ReactNode;
}) {
  const border = state === "failed" ? `${ROSE}55` : state === "active" ? `${accent}55` : BORDER;
  return (
    <div
      className="flex flex-col rounded-xl border p-3 transition-colors"
      style={{ background: CARD, borderColor: border, opacity: state === "pending" ? 0.55 : 1 }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span style={{ color: state === "failed" ? ROSE : accent }}>{icon}</span>
        <span className="font-mono text-[11px] font-semibold tracking-wide" style={{ color: BRIGHT }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EpistemicEngineViz() {
  const reduced = useReducedMotion() ?? false;

  const [phase, setPhase] = useState(0);
  const [reject, setReject] = useState(false);
  const [playing, setPlaying] = useState(false);

  const phaseRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    // if finished, restart from the top
    if (phaseRef.current >= MAX_PHASE) {
      phaseRef.current = 0;
      setPhase(0);
    }
    setPlaying(true);
    intervalRef.current = setInterval(
      () => {
        const cur = phaseRef.current;
        if (cur >= MAX_PHASE) {
          stopPlay();
          return;
        }
        setPhase(cur + 1);
      },
      reduced ? 320 : 1250,
    );
  }, [reduced, stopPlay]);

  const runToggle = useCallback(() => {
    if (intervalRef.current) stopPlay();
    else start();
  }, [start, stopPlay]);

  const stepFwd = useCallback(() => {
    stopPlay();
    setPhase((p) => Math.min(MAX_PHASE, p + 1));
  }, [stopPlay]);

  const stepBack = useCallback(() => {
    stopPlay();
    setPhase((p) => Math.max(0, p - 1));
  }, [stopPlay]);

  const toggleReject = useCallback(() => {
    stopPlay();
    setReject((r) => !r);
    setPhase(0);
  }, [stopPlay]);

  const reset = useCallback(() => {
    stopPlay();
    setPhase(0);
  }, [stopPlay]);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  /* ---- derived ---- */
  const spent = spentAt(phase, reject);
  const remaining = BUDGET - spent;
  const status = statusText(phase, reject);
  const budgetW = (spent / BUDGET) * 116;

  const eviState = stageState(phase, reject, 3);
  const composeState = stageState(phase, reject, 4);
  const globalState = stageState(phase, reject, 5);

  const lamp =
    reject && phase >= 2
      ? ROSE
      : phase >= 4
        ? VALIDATED
        : phase >= 3
          ? VERIFIED
          : phase >= 1
            ? ESTIMATED
            : SLATE;

  const gateActive = phase === 2;
  const proposing = phase === 1;

  const springT = reduced ? { duration: 0 } : springs.smooth;

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border"
      style={{ background: SURFACE, borderColor: BORDER }}
    >
      {/* Header status line */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: BORDER, background: BG }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: lamp, boxShadow: `0 0 8px ${lamp}aa` }}
          />
          <span className="truncate font-mono text-xs sm:text-sm" style={{ color: BRIGHT }}>
            {status}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[11px]" style={{ color: MUTED }}>
          step {phase}/{MAX_PHASE}
        </span>
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Pipeline strip (SVG — scrolls horizontally on small screens)   */}
      {/* -------------------------------------------------------------- */}
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 900 300"
          className="w-full min-w-[680px]"
          style={{ maxHeight: 340, display: "block" }}
          role="img"
          aria-label="The epistemic engine pipeline: a physical question with a budget feeds plural cheap proposers that fire estimated candidate answers; a certified Prager–Synge accept test rejects most of them fail-closed and stamps one survivor verified; the survivor becomes an Evidence value carrying its colour, four uncertainty slices, a provenance hash and an adjoint hook, then composes conservatively with a neighbouring claim so the weakest colour wins, and finally glues into a single global certified claim at minimum cost"
        >
          <defs>
            <filter id="ee-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="ee-gate" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={CYAN} stopOpacity="0.05" />
              <stop offset="0.5" stopColor={VERIFIED} stopOpacity="0.22" />
              <stop offset="1" stopColor={CYAN} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* stage column labels */}
          <text x={90} y={22} textAnchor="middle" fill={MUTED} fontSize={10.5} fontFamily="monospace" letterSpacing={0.5}>
            QUESTION · QoI
          </text>
          <text x={271} y={22} textAnchor="middle" fill={ESTIMATED} fontSize={10.5} fontFamily="monospace" letterSpacing={0.5}>
            PROPOSERS
          </text>
          <text x={498} y={22} textAnchor="middle" fill={VERIFIED} fontSize={10.5} fontFamily="monospace" letterSpacing={0.5}>
            VERIFIER
          </text>
          <text x={676} y={22} textAnchor="middle" fill={VERIFIED} fontSize={10.5} fontFamily="monospace" letterSpacing={0.5}>
            VERIFIED ✓
          </text>

          {/* rails */}
          <line x1={158} y1={150} x2={192} y2={150} stroke={`${SLATE}66`} strokeWidth={1.2} strokeDasharray="3 4" />
          <line x1={352} y1={150} x2={468} y2={150} stroke={`${SLATE}55`} strokeWidth={1.2} strokeDasharray="3 4" />
          <line x1={528} y1={150} x2={594} y2={150} stroke={`${VERIFIED}44`} strokeWidth={1.4} strokeDasharray="3 4" />

          {/* ---- Stage 1: question + budget meter ---- */}
          <rect x={24} y={104} width={132} height={92} rx={12} fill={CARD} stroke={`${VERIFIED}44`} strokeWidth={1.2} />
          <text x={38} y={128} fill={BRIGHT} fontSize={12} fontFamily="monospace" fontWeight={700}>
            {QOI} on bracket
          </text>
          <text x={38} y={145} fill={MUTED} fontSize={9.5} fontFamily="monospace">
            QoI · resultant N
          </text>
          <text x={38} y={170} fill={MUTED} fontSize={9} fontFamily="monospace">
            budget
          </text>
          <rect x={38} y={175} width={116} height={8} rx={4} fill="#0a1620" stroke={BORDER} strokeWidth={0.8} />
          <motion.rect
            x={38}
            y={175}
            height={8}
            rx={4}
            fill={spent > 70 ? ROSE : ESTIMATED}
            initial={false}
            animate={{ width: Math.max(0, budgetW) }}
            transition={springT}
          />
          <text x={154} y={170} textAnchor="end" fill={BRIGHT} fontSize={9} fontFamily="monospace">
            {spent}/{BUDGET}cr
          </text>
          <text x={90} y={276} textAnchor="middle" fill={`${MUTED}cc`} fontSize={9} fontFamily="monospace">
            a quantity + a budget
          </text>

          {/* ---- Stage 2: proposer bank ---- */}
          {PROPOSERS.map((p, i) => {
            const y = LANE_Y[i] - 22;
            return (
              <g key={p.key}>
                <rect x={196} y={y} width={150} height={44} rx={10} fill={`${p.color}12`} stroke={`${p.color}66`} strokeWidth={1} />
                <motion.circle
                  cx={212}
                  cy={LANE_Y[i]}
                  r={4.5}
                  fill={p.color}
                  animate={proposing && !reduced ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.75 }}
                  transition={{ duration: reduced ? 0 : 0.9, repeat: proposing && !reduced ? Infinity : 0, ease: "easeInOut" }}
                />
                <text x={228} y={LANE_Y[i] - 3} fill={BRIGHT} fontSize={11} fontFamily="monospace" fontWeight={600}>
                  {p.label}
                </text>
                <text x={228} y={LANE_Y[i] + 11} fill={MUTED} fontSize={9} fontFamily="monospace">
                  {p.tag}
                </text>
              </g>
            );
          })}
          <text x={271} y={276} textAnchor="middle" fill={`${MUTED}cc`} fontSize={9} fontFamily="monospace">
            cheap guesses · all estimated
          </text>

          {/* ---- Stage 3: verifier gate ---- */}
          <rect x={470} y={56} width={56} height={196} rx={13} fill="url(#ee-gate)" stroke={`${VERIFIED}66`} strokeWidth={1.4} />
          <motion.line
            x1={470}
            x2={526}
            y1={68}
            y2={68}
            stroke={gateActive ? VERIFIED : `${VERIFIED}77`}
            strokeWidth={1.6}
            animate={
              gateActive && !reduced
                ? { y1: [68, 240, 68], y2: [68, 240, 68] }
                : { y1: 154, y2: 154 }
            }
            transition={{ duration: reduced ? 0 : 1.6, repeat: gateActive && !reduced ? Infinity : 0, ease: "easeInOut" }}
          />
          <text x={498} y={266} textAnchor="middle" fill={VERIFIED} fontSize={9.5} fontFamily="monospace">
            Prager–Synge
          </text>
          <text x={498} y={278} textAnchor="middle" fill={`${MUTED}cc`} fontSize={8.5} fontFamily="monospace">
            equilibrated-flux accept test
          </text>
          {/* fail-closed drain marker */}
          {phase >= 2 && (
            <text x={498} y={44} textAnchor="middle" fill={`${ROSE}cc`} fontSize={9} fontFamily="monospace">
              fail-closed ↓
            </text>
          )}

          {/* ---- Stage 4: survivor slot / reject notice ---- */}
          <rect
            x={596}
            y={118}
            width={160}
            height={64}
            rx={12}
            fill={reject && phase >= 2 ? `${ROSE}0c` : `${VERIFIED}0c`}
            stroke={reject && phase >= 2 ? `${ROSE}55` : `${VERIFIED}44`}
            strokeWidth={1.2}
            strokeDasharray={reject && phase >= 2 ? "5 4" : undefined}
          />
          {reject && phase >= 2 ? (
            <>
              <text x={676} y={146} textAnchor="middle" fill={ROSE} fontSize={13} fontFamily="monospace" fontWeight={700}>
                ⊥ no claim
              </text>
              <text x={676} y={164} textAnchor="middle" fill={`${MUTED}cc`} fontSize={9} fontFamily="monospace">
                no accept, no answer
              </text>
            </>
          ) : (
            <>
              <text x={608} y={140} fill={MUTED} fontSize={9} fontFamily="monospace">
                survivor
              </text>
              <text x={608} y={170} fill={phase >= 2 ? VERIFIED : SLATE} fontSize={9.5} fontFamily="monospace">
                {phase >= 2 ? "→ Evidence<T> ↓" : "awaiting accept"}
              </text>
            </>
          )}
          <text x={676} y={276} textAnchor="middle" fill={`${MUTED}cc`} fontSize={9} fontFamily="monospace">
            stamped verified (cyan)
          </text>

          {/* rejected-count caption at gate once resolved */}
          {phase >= 2 && (
            <text x={498} y={102} textAnchor="middle" fill={reject ? ROSE : MUTED} fontSize={8.5} fontFamily="monospace">
              {reject ? "3 rejected" : "2 rejected · 1 pass"}
            </text>
          )}

          {/* ---- travelling candidate tokens ---- */}
          {PROPOSERS.map((p, i) => {
            const t = tokenTarget(phase, i, p.accept, reject);
            const isSurvivor = p.accept && !reject && phase >= 2;
            return (
              <motion.g
                key={p.key}
                initial={false}
                animate={{ x: t.x, y: t.y, opacity: t.opacity, scale: t.scale }}
                transition={springT}
              >
                <motion.rect
                  x={-25}
                  y={-13}
                  width={50}
                  height={26}
                  rx={7}
                  strokeWidth={1.2}
                  initial={false}
                  animate={{ fill: `${t.color}26`, stroke: t.color }}
                  transition={springT}
                  filter={isSurvivor ? "url(#ee-glow)" : undefined}
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill={t.color}
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight={700}
                  style={{ pointerEvents: "none" }}
                >
                  {p.guess}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Dossier region — Evidence<T> → Compose → Global (stacks)       */}
      {/* -------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-3 border-t px-4 py-4 lg:grid-cols-3" style={{ borderColor: BORDER }}>
        {/* ---- Evidence<T> dossier ---- */}
        <DossierCard title="Evidence<T>" icon={<Hash className="h-4 w-4" />} accent={VERIFIED} state={eviState}>
          {eviState === "failed" ? (
            <FailBody text="verifier rejected — no evidence minted. An estimate is never laundered into a certificate." />
          ) : eviState === "pending" ? (
            <PendingBody text="a survivor accretes its certificate here once the accept test passes" />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="evi"
                initial={{ opacity: 0, y: reduced ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : 0.3 }}
                className="flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-bold" style={{ color: BRIGHT }}>
                      {A_VALUE.toFixed(2)}
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: MUTED }}>
                      {QOI} · N
                    </span>
                  </div>
                  <Chip color={VERIFIED} text="verified" />
                </div>
                <SliceBar values={A_SLICES} />
                <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: BORDER }}>
                  <span className="font-mono text-[11px]" style={{ color: MUTED }}>
                    total rel-err
                  </span>
                  <span className="font-mono text-sm font-bold" style={{ color: VERIFIED }}>
                    {fmtErr(A_TOTAL)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: CYAN }}>
                    <Hash className="h-3 w-3" /> {shortHash(HASH_A)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: MUTED }}>
                    <GitBranch className="h-3 w-3" /> ∂({QOI})/∂inputs attached
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </DossierCard>

        {/* ---- Compose (weakest-colour-wins) ---- */}
        <DossierCard title="Compose · weakest wins" icon={<FlaskConical className="h-4 w-4" />} accent={VALIDATED} state={composeState}>
          {composeState === "failed" ? (
            <FailBody text="nothing to compose — the pipeline produced no claim." />
          ) : composeState === "pending" ? (
            <PendingBody text="the verified claim combines with a neighbouring subdomain claim" />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
              className="flex flex-col gap-2.5"
            >
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]" style={{ color: MUTED }}>
                <Chip color={VERIFIED} text="verified" />
                <span style={{ color: BRIGHT }}>⊗</span>
                <Chip color={VALIDATED} text="validated" />
                <span style={{ color: BRIGHT }}>→</span>
                <Chip color={VALIDATED} text="validated" />
              </div>
              <p className="font-mono text-[10px] leading-relaxed" style={{ color: SLATE }}>
                neighbour = wind-tunnel-anchored subdomain (validated · lime). The weakest colour wins — a
                certificate can&apos;t upgrade a validation.
              </p>
              <SliceBar values={C_SLICES} tint={VALIDATED} />
              <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: BORDER }}>
                <span className="font-mono text-[11px]" style={{ color: MUTED }}>
                  slices add → total
                </span>
                <span className="font-mono text-sm font-bold" style={{ color: VALIDATED }}>
                  {fmtErr(C_TOTAL)}
                </span>
              </div>
            </motion.div>
          )}
        </DossierCard>

        {/* ---- Global glue ---- */}
        <DossierCard title="Global certified claim" icon={<Boxes className="h-4 w-4" />} accent={VALIDATED} state={globalState}>
          {globalState === "failed" ? (
            <FailBody text="⊥ — the global result is honestly empty rather than falsely certified." />
          ) : globalState === "pending" ? (
            <PendingBody text="local certified claims glue into one global result over the whole domain" />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
              className="flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-bold" style={{ color: BRIGHT }}>
                    {C_VALUE.toFixed(2)}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: MUTED }}>
                    ‖F‖ · N
                  </span>
                </div>
                <Chip color={VALIDATED} text="validated" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-6 w-6 rounded" style={{ background: `${VERIFIED}33`, border: `1px solid ${VERIFIED}` }} />
                <span className="inline-block h-6 w-6 rounded" style={{ background: `${VALIDATED}33`, border: `1px solid ${VALIDATED}` }} />
                <span className="font-mono text-[10px]" style={{ color: MUTED }}>
                  → glued: 2 local certified tiles, watertight
                </span>
              </div>
              <div className="rounded-lg border p-2 font-mono text-[10px] leading-relaxed" style={{ borderColor: `${VALIDATED}44`, background: `${VALIDATED}0c`, color: BRIGHT }}>
                validated global claim · rel-err {fmtErr(C_TOTAL)} · {shortHash(HASH_G)} · adjoint attached
                <div style={{ color: VALIDATED }}>justified belief at minimum cost</div>
              </div>
            </motion.div>
          )}
        </DossierCard>
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Cost ledger — certified-speculation economics                 */}
      {/* -------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3" style={{ borderColor: BORDER }}>
        <LedgerItem label="proposers ×3" value={COST.propose} on={phase >= 1} color={ESTIMATED} />
        <LedgerItem label="verify gate" value={COST.verify} on={phase >= 2} color={VERIFIED} />
        <LedgerItem label="confirmation" value={COST.confirm} on={phase >= 3 && !reject} color={VERIFIED} note="survivor only" />
        <LedgerItem label="compose" value={COST.compose} on={phase >= 4 && !reject} color={VALIDATED} />
        <LedgerItem label="glue" value={COST.glue} on={phase >= 5 && !reject} color={VALIDATED} />
        <span className="ml-auto font-mono text-[11px]" style={{ color: remaining < 30 ? ESTIMATED : MUTED }}>
          spent <b style={{ color: BRIGHT }}>{spent}</b> · {remaining}cr left
        </span>
        <span className="w-full font-mono text-[10px]" style={{ color: SLATE }}>
          {reject
            ? `failed closed for ${spentAt(phase, true)}cr — no confirmation budget wasted on a wrong guess`
            : "most candidates are screened for pennies; only the survivor pays for the expensive confirmation"}
        </span>
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Controls                                                       */}
      {/* -------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3" style={{ borderColor: BORDER, background: BG }}>
        <CtrlButton
          onClick={runToggle}
          color={VERIFIED}
          label={playing ? "Pause" : phase >= MAX_PHASE ? "Replay" : "Run a claim"}
          ariaLabel={playing ? "Pause the pipeline" : "Run one physical claim through the whole engine"}
          active={playing}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </CtrlButton>
        <CtrlButton onClick={stepBack} color={SLATE} label="Back" ariaLabel="Step back one stage" disabled={phase === 0}>
          <ChevronLeft size={13} />
        </CtrlButton>
        <CtrlButton onClick={stepFwd} color={CYAN} label="Step" ariaLabel="Advance one stage" disabled={phase >= MAX_PHASE}>
          <StepForward size={13} />
        </CtrlButton>
        <CtrlButton
          onClick={toggleReject}
          color={reject ? ROSE : SLATE}
          label="Force rejection"
          ariaLabel="Make the verifier reject every candidate to show fail-closed behaviour"
          active={reject}
        >
          {reject ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
        </CtrlButton>
        <CtrlButton onClick={reset} color={SLATE} label="Reset" ariaLabel="Reset the engine to the start">
          <RotateCcw size={13} />
        </CtrlButton>
      </div>

      {/* Legend / footer */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: BORDER, color: MUTED }}
      >
        <LegendChip color={ESTIMATED} text="estimated — proposer guess, no proof" />
        <LegendChip color={VERIFIED} text="verified — accept test passed" />
        <LegendChip color={VALIDATED} text="validated — anchored to experiment" />
        <LegendChip color={ROSE} text="rejected · fail-closed" />
        <span style={{ color: SLATE }}>machine learning proposes · certified numerics disposes</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaf helpers                                                       */
/* ------------------------------------------------------------------ */

function PendingBody({ text }: { text: string }) {
  return (
    <p className="font-mono text-[10.5px] leading-relaxed" style={{ color: SLATE }}>
      {text}
    </p>
  );
}

function FailBody({ text }: { text: string }) {
  return (
    <p className="font-mono text-[10.5px] leading-relaxed" style={{ color: `${ROSE}dd` }}>
      {text}
    </p>
  );
}

function LedgerItem({
  label,
  value,
  on,
  color,
  note,
}: {
  label: string;
  value: number;
  on: boolean;
  color: string;
  note?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] transition-opacity"
      style={{
        borderColor: on ? `${color}55` : BORDER,
        color: on ? color : SLATE,
        opacity: on ? 1 : 0.45,
        background: on ? `${color}10` : "transparent",
      }}
    >
      <span>{label}</span>
      <b style={{ color: on ? BRIGHT : SLATE }}>{value}cr</b>
      {note && <span style={{ color: SLATE }}>· {note}</span>}
    </span>
  );
}

function LegendChip({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
      <span style={{ color }}>{text}</span>
    </span>
  );
}
