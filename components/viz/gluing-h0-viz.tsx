"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import {
  Plus,
  Minus,
  RotateCcw,
  Scissors,
  Sparkles,
  ChevronRight,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7"; // overlap / restriction accent
const GOOD = "#10b981"; // emerald — it glues
const BAD = "#f43f5e"; // rose — the seam leaks

/* ------------------------------------------------------------------ */
/*  Epistemic grades (the local certified colour of each chart)        */
/* ------------------------------------------------------------------ */

type Grade = "verified" | "validated" | "estimated";

const GRADE_COLOR: Record<Grade, string> = {
  verified: "#22d3ee", // cyan  — interval-certified
  validated: "#a3e635", // lime  — anchored to data
  estimated: "#fbbf24", // amber — best-effort
};
const GRADE_RANK: Record<Grade, number> = { verified: 2, validated: 1, estimated: 0 };

// the whole is only as certified as its weakest chart (meet in the grade lattice)
function meet(gs: Grade[]): Grade {
  return gs.reduce((a, b) => (GRADE_RANK[a] <= GRADE_RANK[b] ? a : b));
}

/* ------------------------------------------------------------------ */
/*  The cover: overlapping charts over a 1-D base region X             */
/* ------------------------------------------------------------------ */

interface Chart {
  id: string;
  x0: number;
  x1: number;
  coreX0: number;
  coreX1: number;
  grade: Grade;
}

// U₂ is validated (lime) → forces a non-trivial global grade when it glues.
const CHARTS: Chart[] = [
  { id: "U₀", x0: 40, x1: 250, coreX0: 40, coreX1: 210, grade: "verified" },
  { id: "U₁", x0: 210, x1: 420, coreX0: 250, coreX1: 380, grade: "verified" },
  { id: "U₂", x0: 380, x1: 590, coreX0: 420, coreX1: 550, grade: "validated" },
  { id: "U₃", x0: 550, x1: 720, coreX0: 590, coreX1: 720, grade: "verified" },
];

interface Overlap {
  i: number;
  j: number;
  x0: number;
  x1: number;
}
const OVERLAPS: Overlap[] = [
  { i: 0, j: 1, x0: 210, x1: 250 },
  { i: 1, j: 2, x0: 380, x1: 420 },
  { i: 2, j: 3, x0: 550, x1: 590 },
];

const coreCenter = (c: Chart) => (c.coreX0 + c.coreX1) / 2;
const overlapMid = (o: Overlap) => (o.x0 + o.x1) / 2;
const overlapName = (o: Overlap) => `${CHARTS[o.i].id}∩${CHARTS[o.j].id}`;

/* ------------------------------------------------------------------ */
/*  Geometry                                                           */
/* ------------------------------------------------------------------ */

const DOMAIN_X0 = 40;
const DOMAIN_X1 = 720;
const BAND_TOP = 122;
const BAND_BOT = 330;
const V_MIN = 0;
const V_MAX = 4;
const BASE_Y = 304;
const STEP = 34;
const yOf = (v: number) => BASE_Y - v * STEP; // v=0 → 304 … v=4 → 168

const DEFAULT_VALUES = [2, 2, 2, 2];

/* ------------------------------------------------------------------ */
/*  Phases                                                             */
/* ------------------------------------------------------------------ */

const PHASES: { n: string; label: string }[] = [
  { n: "1", label: "The cover" },
  { n: "2", label: "Local sections" },
  { n: "3", label: "Check overlaps" },
  { n: "4", label: "Glue" },
];

const PHASE_TITLE = [
  "①  the cover",
  "②  local sections",
  "③  check overlaps",
  "④  glue",
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GluingH0Viz() {
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const [values, setValues] = useState<number[]>([...DEFAULT_VALUES]);
  const [phase, setPhase] = useState<number>(0); // 0..3

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Reduced motion: jump straight to the meaningful final frame (the glued verdict).
  useEffect(() => {
    if (reduced) setPhase(3);
  }, [reduced]);

  /* ---- derived compatibility / gluing logic ---- */
  const agree = OVERLAPS.map((o) => values[o.i] === values[o.j]);
  const glued = agree.every(Boolean);
  const commonV = values[0];
  const grades = CHARTS.map((c) => c.grade);
  const globalGrade = meet(grades);
  const globalGradeColor = GRADE_COLOR[globalGrade];
  const failIdx = agree.findIndex((a) => !a);
  const failOverlap = failIdx >= 0 ? OVERLAPS[failIdx] : null;
  const failName = failOverlap ? overlapName(failOverlap) : "";

  /* ---- interactions ---- */
  const nudge = useCallback((i: number, delta: number) => {
    setValues((prev) => {
      const next = [...prev];
      next[i] = Math.max(V_MIN, Math.min(V_MAX, next[i] + delta));
      return next;
    });
    setPhase((p) => Math.max(p, 3)); // jump to the consequence
  }, []);

  const cycle = useCallback((i: number) => {
    setValues((prev) => {
      const next = [...prev];
      next[i] = next[i] >= V_MAX ? V_MIN : next[i] + 1;
      return next;
    });
    setPhase((p) => Math.max(p, 3));
  }, []);

  const breakSeam = useCallback(() => {
    setValues([2, 2, 2, 3]); // only U₂∩U₃ disagrees
    setPhase(3);
  }, []);

  const healAll = useCallback(() => {
    setValues([2, 2, 2, 2]);
    setPhase(3);
  }, []);

  const nextPhase = useCallback(() => {
    setPhase((p) => Math.min(3, p + 1));
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setValues([...DEFAULT_VALUES]);
    setPhase(reduced ? 3 : 0);
  }, [clearTimers, reduced]);

  /* ---- status / header readout ---- */
  const lampColor = phase < 3 ? CYAN_GLOW : glued ? GOOD : BAD;

  const header =
    phase === 0 ? (
      <span style={{ color: BRIGHT }}>
        the open cover — four overlapping charts form a presheaf F
      </span>
    ) : phase === 1 ? (
      <span style={{ color: BRIGHT }}>
        local sections — each chart certifies sᵢ = value + grade
      </span>
    ) : phase === 2 ? (
      <span style={{ color: BRIGHT }}>
        check overlaps — does sᵢ = sⱼ on every Uᵢ∩Uⱼ?
      </span>
    ) : glued ? (
      <span style={{ color: GOOD }}>
        H⁰ — the data glues to a global section · s = {commonV} ·{" "}
        <span style={{ color: globalGradeColor }}>{globalGrade}</span>
      </span>
    ) : (
      <span style={{ color: BAD }}>
        no global section — {failName} disagrees ({values[failOverlap!.i]} ≠{" "}
        {values[failOverlap!.j]})
      </span>
    );

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 font-mono text-xs transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="w-full rounded-2xl border" style={{ background: BG, borderColor: BORDER }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: lampColor, boxShadow: `0 0 8px ${lampColor}aa` }}
          />
          <span className="truncate font-mono text-xs sm:text-sm">{header}</span>
        </div>
        <button
          onClick={reset}
          aria-label="Reset the gluing demo"
          className={cn(btnClass, "shrink-0")}
          style={{ borderColor: `${CYAN_GLOW}44`, color: CYAN_GLOW }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* SVG canvas */}
      <svg
        viewBox="0 0 760 452"
        className="w-full"
        style={{ maxHeight: 520 }}
        role="img"
        aria-label="Sheaf gluing: four overlapping charts each carry a local certified value; when the values agree on every overlap they glue into a single global section (zeroth cohomology H-zero), otherwise the disagreeing overlap leaks and no global section exists."
      >
        <defs>
          <filter id="glue-glow" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* value grid + axis (once sections exist) */}
        {phase >= 1 &&
          Array.from({ length: V_MAX + 1 }, (_, v) => (
            <g key={`grid-${v}`}>
              <line
                x1={DOMAIN_X0}
                y1={yOf(v)}
                x2={DOMAIN_X1}
                y2={yOf(v)}
                stroke={SLATE}
                strokeWidth={1}
                strokeDasharray="1 6"
                opacity={0.28}
              />
              <text
                x={26}
                y={yOf(v) + 3.5}
                textAnchor="middle"
                fill={SLATE}
                fontSize={10}
                fontFamily="monospace"
              >
                {v}
              </text>
            </g>
          ))}
        {phase >= 1 && (
          <text
            x={26}
            y={yOf(V_MAX) - 12}
            textAnchor="middle"
            fill={SLATE}
            fontSize={9}
            fontFamily="monospace"
          >
            s
          </text>
        )}

        {/* base region X */}
        <line
          x1={DOMAIN_X0}
          y1={BAND_BOT + 12}
          x2={DOMAIN_X1}
          y2={BAND_BOT + 12}
          stroke={`${CYAN}66`}
          strokeWidth={1.4}
        />
        <text x={DOMAIN_X0} y={BAND_BOT + 28} fill={MUTED} fontSize={10.5} fontFamily="monospace">
          X — base region
        </text>
        <text
          x={DOMAIN_X1}
          y={BAND_BOT + 28}
          textAnchor="end"
          fill={SLATE}
          fontSize={10}
          fontFamily="monospace"
        >
          {glued && phase >= 3 ? "covered by one global section" : "covered by { U₀ … U₃ }"}
        </text>

        {/* chart patches (translucent open sets) */}
        {CHARTS.map((c) => (
          <g key={`patch-${c.id}`}>
            <rect
              x={c.x0}
              y={BAND_TOP}
              width={c.x1 - c.x0}
              height={BAND_BOT - BAND_TOP}
              rx={14}
              fill={`${CYAN}0f`}
              stroke={`${CYAN}55`}
              strokeWidth={1.2}
            />
            {/* watermark id */}
            <text
              x={coreCenter(c)}
              y={BAND_TOP + 46}
              textAnchor="middle"
              fill={`${BRIGHT}18`}
              fontSize={40}
              fontFamily="monospace"
              fontWeight={700}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {c.id}
            </text>
          </g>
        ))}

        {/* overlap bands (violet — carry the restriction maps) */}
        {OVERLAPS.map((o, idx) => {
          const disagree = phase >= 2 && !agree[idx];
          const col = disagree ? BAD : VIOLET;
          return (
            <motion.rect
              key={`ob-${idx}`}
              x={o.x0}
              y={BAND_TOP}
              width={o.x1 - o.x0}
              height={BAND_BOT - BAND_TOP}
              rx={6}
              strokeWidth={1.3}
              strokeDasharray="4 3"
              animate={{ fill: `${col}1f`, stroke: col }}
              transition={{ duration: reduced ? 0 : 0.35 }}
            />
          );
        })}

        {/* transparent per-chart tap targets (tap a chart's core to raise its value) */}
        {CHARTS.map((c, i) => (
          <rect
            key={`hit-${c.id}`}
            x={c.coreX0}
            y={BAND_TOP}
            width={c.coreX1 - c.coreX0}
            height={BAND_BOT - BAND_TOP}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onClick={() => cycle(i)}
          >
            <title>{`Tap chart ${c.id} to raise its local value`}</title>
          </rect>
        ))}

        {/* local sections (value = height, colour = grade) */}
        {phase >= 1 &&
          CHARTS.map((c, i) => {
            const gc = GRADE_COLOR[c.grade];
            const cc = coreCenter(c);
            return (
              <motion.g
                key={`sec-${c.id}`}
                initial={false}
                animate={{ y: yOf(values[i]) }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 200, damping: 25 }
                }
                style={{ pointerEvents: "none" }}
              >
                <line
                  x1={c.x0 + 4}
                  y1={0}
                  x2={c.x1 - 4}
                  y2={0}
                  stroke={gc}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                {/* certified local-section chip: value + epistemic dot */}
                <rect
                  x={cc - 36}
                  y={-28}
                  width={72}
                  height={20}
                  rx={10}
                  fill={SURFACE}
                  stroke={`${gc}88`}
                  strokeWidth={1.1}
                />
                <circle cx={cc - 23} cy={-18} r={3.5} fill={gc} />
                <text
                  x={cc - 13}
                  y={-14}
                  fill={BRIGHT}
                  fontSize={11}
                  fontFamily="monospace"
                  fontWeight={600}
                >
                  s = {values[i]}
                </text>
              </motion.g>
            );
          })}

        {/* mismatch "jump" connectors inside disagreeing overlaps */}
        {phase >= 2 &&
          OVERLAPS.map((o, idx) => {
            if (agree[idx]) return null;
            const mid = overlapMid(o);
            const ya = yOf(values[o.i]);
            const yb = yOf(values[o.j]);
            return (
              <motion.g
                key={`jump-${idx}`}
                initial={{ opacity: reduced ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.3 }}
                style={{ pointerEvents: "none" }}
              >
                <line
                  x1={mid}
                  y1={ya}
                  x2={mid}
                  y2={yb}
                  stroke={BAD}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
                <circle cx={mid} cy={ya} r={3.5} fill={BAD} />
                <circle cx={mid} cy={yb} r={3.5} fill={BAD} />
                <text
                  x={mid + 10}
                  y={(ya + yb) / 2 + 4}
                  fill={BAD}
                  fontSize={11}
                  fontFamily="monospace"
                  fontWeight={700}
                >
                  {values[o.i]} ≠ {values[o.j]}
                </text>
              </motion.g>
            );
          })}

        {/* overlap check chips (top) */}
        {OVERLAPS.map((o, idx) => {
          const mid = overlapMid(o);
          const showResult = phase >= 2;
          const ok = agree[idx];
          const col = !showResult ? VIOLET : ok ? GOOD : BAD;
          const pulsing = showResult && !ok && !reduced;
          return (
            <g key={`chip-${idx}`}>
              {/* stem to the band */}
              <line
                x1={mid}
                y1={108}
                x2={mid}
                y2={BAND_TOP}
                stroke={`${col}66`}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <rect
                x={mid - 52}
                y={84}
                width={104}
                height={24}
                rx={12}
                fill={`${col}1a`}
                stroke={col}
                strokeWidth={1.2}
              />
              <text
                x={mid - 8}
                y={100}
                textAnchor="middle"
                fill={col}
                fontSize={11}
                fontFamily="monospace"
                fontWeight={600}
              >
                {overlapName(o)}
              </text>
              {showResult &&
                (ok ? (
                  <path
                    d={`M ${mid + 30} 96 l 3 4 l 7 -8`}
                    fill="none"
                    stroke={GOOD}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <motion.g
                    animate={pulsing ? { opacity: [0.45, 1, 0.45] } : { opacity: 1 }}
                    transition={
                      pulsing
                        ? { duration: 1.3, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0 }
                    }
                  >
                    <line
                      x1={mid + 30}
                      y1={92}
                      x2={mid + 40}
                      y2={102}
                      stroke={BAD}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <line
                      x1={mid + 40}
                      y1={92}
                      x2={mid + 30}
                      y2={102}
                      stroke={BAD}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </motion.g>
                ))}
            </g>
          );
        })}

        {/* GLUE: the single global section sweeps across when everything agrees */}
        <AnimatePresence>
          {phase >= 3 && glued && (
            <motion.g
              key={`glue-${commonV}-${globalGrade}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
              style={{ pointerEvents: "none" }}
            >
              {/* one global open region */}
              <motion.rect
                x={DOMAIN_X0 - 6}
                y={BAND_TOP - 6}
                width={DOMAIN_X1 - DOMAIN_X0 + 12}
                height={BAND_BOT - BAND_TOP + 12}
                rx={18}
                fill="none"
                stroke={GOOD}
                strokeWidth={1.6}
                filter="url(#glue-glow)"
                initial={{ opacity: reduced ? 0.9 : 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ duration: reduced ? 0 : 0.4 }}
              />
              {/* the consensus section, drawn left→right */}
              <motion.line
                x1={DOMAIN_X0}
                y1={yOf(commonV)}
                x2={DOMAIN_X1}
                y2={yOf(commonV)}
                stroke={globalGradeColor}
                strokeWidth={5}
                strokeLinecap="round"
                filter="url(#glue-glow)"
                initial={{ pathLength: reduced ? 1 : 0, opacity: 0.95 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.7, ease: "easeInOut" }}
              />
            </motion.g>
          )}
        </AnimatePresence>

        {/* verdict badge */}
        <AnimatePresence mode="wait">
          {phase >= 3 && (
            <motion.g
              key={glued ? "v-ok" : "v-bad"}
              initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
            >
              {glued ? (
                <g>
                  <rect
                    x={244}
                    y={20}
                    width={272}
                    height={30}
                    rx={15}
                    fill={`${GOOD}1a`}
                    stroke={GOOD}
                    strokeWidth={1.4}
                    filter="url(#glue-glow)"
                  />
                  <path
                    d="M 262 35 l 4 5 l 8 -10"
                    fill="none"
                    stroke={GOOD}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <text x={284} y={39} fill={GOOD} fontSize={12.5} fontFamily="monospace" fontWeight={700}>
                    H⁰ · global section exists
                  </text>
                  <circle cx={470} cy={35} r={4} fill={globalGradeColor} />
                  <text x={480} y={39} fill={globalGradeColor} fontSize={11.5} fontFamily="monospace">
                    {globalGrade}
                  </text>
                </g>
              ) : (
                <g>
                  <rect
                    x={244}
                    y={20}
                    width={272}
                    height={30}
                    rx={15}
                    fill={`${BAD}1a`}
                    stroke={BAD}
                    strokeWidth={1.4}
                  />
                  <line x1={262} y1={30} x2={272} y2={40} stroke={BAD} strokeWidth={2.2} strokeLinecap="round" />
                  <line x1={272} y1={30} x2={262} y2={40} stroke={BAD} strokeWidth={2.2} strokeLinecap="round" />
                  <text x={284} y={39} fill={BAD} fontSize={12.5} fontFamily="monospace" fontWeight={700}>
                    no global section · {failName} leaks
                  </text>
                </g>
              )}
            </motion.g>
          )}
        </AnimatePresence>

        {/* phase title */}
        <text x={DOMAIN_X0} y={30} fill={CYAN_GLOW} fontSize={13} fontFamily="monospace" fontWeight={700}>
          {PHASE_TITLE[phase]}
        </text>
        <text x={DOMAIN_X0} y={48} fill={SLATE} fontSize={10.5} fontFamily="monospace">
          presheaf F · sections restrict along Uᵢ∩Uⱼ · they glue ⇔ they agree there
        </text>

        {/* bottom teaching line */}
        <text x={380} y={444} textAnchor="middle" fill={`${MUTED}cc`} fontSize={11} fontFamily="monospace">
          {phase < 2
            ? "tap a chart (or use − / +) to change its local value"
            : glued
              ? "gluing axiom satisfied — a unique global section s ∈ H⁰(X, F)  ·  watertight ≡ it glues"
              : "restrictions clash on the overlap — the local data does not glue"}
        </text>
      </svg>

      {/* Controls */}
      <div className="flex flex-col gap-3 border-t px-4 py-3" style={{ borderColor: BORDER }}>
        {/* phase stepper */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: SLATE }}>
            walkthrough
          </span>
          {PHASES.map((p, idx) => {
            const active = idx === phase;
            return (
              <button
                key={p.n}
                onClick={() => setPhase(idx)}
                aria-label={`Go to phase ${p.n}: ${p.label}`}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 font-mono text-[11px] transition-colors",
                  active ? "" : "hover:bg-white/5",
                )}
                style={{
                  borderColor: active ? `${CYAN_GLOW}88` : `${SLATE}44`,
                  background: active ? `${CYAN_GLOW}14` : "transparent",
                  color: active ? CYAN_GLOW : MUTED,
                }}
              >
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                  style={{
                    background: active ? CYAN_GLOW : `${SLATE}55`,
                    color: active ? "#04090d" : BRIGHT,
                  }}
                >
                  {p.n}
                </span>
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            );
          })}
          <button
            onClick={nextPhase}
            disabled={phase >= 3}
            aria-label="Advance to the next phase"
            className={cn(btnClass, "ml-auto")}
            style={{ borderColor: `${CYAN_GLOW}55`, color: CYAN_GLOW }}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* per-chart value steppers */}
        <div className="flex flex-wrap items-center gap-2">
          {CHARTS.map((c, i) => {
            const gc = GRADE_COLOR[c.grade];
            return (
              <div
                key={`ctl-${c.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1"
                style={{ borderColor: `${gc}44`, background: `${gc}0a` }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: gc }} />
                <span className="font-mono text-xs font-semibold" style={{ color: BRIGHT }}>
                  {c.id}
                </span>
                <button
                  onClick={() => nudge(i, -1)}
                  disabled={values[i] <= V_MIN}
                  aria-label={`Decrease value of chart ${c.id}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ borderColor: `${gc}55`, color: gc }}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span
                  className="w-5 text-center font-mono text-sm font-bold tabular-nums"
                  style={{ color: gc }}
                  aria-live="polite"
                >
                  {values[i]}
                </span>
                <button
                  onClick={() => nudge(i, 1)}
                  disabled={values[i] >= V_MAX}
                  aria-label={`Increase value of chart ${c.id}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ borderColor: `${gc}55`, color: gc }}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* scenario buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={breakSeam}
            aria-label="Break a seam: make one chart disagree with its neighbour"
            className={btnClass}
            style={{ borderColor: `${BAD}55`, color: BAD }}
          >
            <Scissors className="h-3.5 w-3.5" />
            Break a seam
          </button>
          <button
            onClick={healAll}
            aria-label="Heal all seams: set every chart to the same value so it glues"
            className={btnClass}
            style={{ borderColor: `${GOOD}66`, color: GOOD }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Heal all seams
          </button>
        </div>
      </div>

      {/* Legend / teaching footnote */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: BORDER, color: MUTED }}
      >
        <span className="inline-flex items-center gap-1.5">
          <svg width={16} height={12} aria-hidden="true">
            <rect x={1} y={2} width={14} height={8} rx={2} fill={`${CYAN}22`} stroke={`${CYAN}88`} strokeWidth={1} />
          </svg>
          <span>chart Uᵢ — a local open set, F(Uᵢ)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width={16} height={12} aria-hidden="true">
            <rect x={1} y={2} width={14} height={8} rx={2} fill={`${VIOLET}30`} stroke={VIOLET} strokeWidth={1} strokeDasharray="3 2" />
          </svg>
          <span>overlap Uᵢ∩Uⱼ — restriction ρ</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" style={{ color: GOOD }} />
          <span style={{ color: SLATE }}>
            agree on every overlap ⇒ a unique global section s ∈ H⁰ (watertight ≡ it glues)
          </span>
        </span>
      </div>
    </div>
  );
}
