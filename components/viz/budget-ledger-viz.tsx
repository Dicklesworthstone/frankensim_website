"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Gauge, RotateCcw, AlertTriangle, ChevronRight, Clock, Sigma } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette (FrankenSim)                                               */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const TEAL = "#14b8a6";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const BLUE = "#3b82f6";
const AMBER = "#f59e0b";
const ROSE = "#f43f5e";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Model                                                              */
/* ------------------------------------------------------------------ */

type Mode = "base" | "tight" | "fix1" | "fix2";

const OP_ORDER = ["geom", "mesh", "assemble", "solve", "adjoint"] as const;
type OpId = (typeof OP_ORDER)[number];

const OP_META: Record<OpId, { name: string; color: string }> = {
  geom: { name: "geom", color: CYAN },
  mesh: { name: "mesh", color: TEAL },
  assemble: { name: "assemble", color: BLUE },
  solve: { name: "solve", color: VIOLET },
  adjoint: { name: "adjoint", color: AMBER },
};

// [ time (hours), error contribution (units of 1e-2) ] per op, per mode
const VAL: Record<Mode, Record<OpId, [number, number]>> = {
  base: { geom: [0.2, 0.3], mesh: [0.35, 0.6], assemble: [0.25, 0.35], solve: [0.45, 0.3], adjoint: [0.15, 0.25] },
  tight: { geom: [0.2, 0.3], mesh: [0.55, 0.4], assemble: [0.35, 0.25], solve: [1.05, 0.15], adjoint: [0.2, 0.2] },
  fix1: { geom: [0.2, 0.4], mesh: [0.35, 0.9], assemble: [0.25, 0.55], solve: [0.7, 0.7], adjoint: [0.2, 0.45] },
  fix2: { geom: [0.2, 0.3], mesh: [0.45, 0.4], assemble: [0.3, 0.3], solve: [0.75, 0.55], adjoint: [0.2, 0.35] },
};

const WALL = 2.0; // wall-time budget (hours)
const ERRCAP: Record<Mode, number> = { base: 2.0, tight: 2.0, fix1: 4.0, fix2: 2.0 };

const sum = (mode: Mode, metric: 0 | 1) => OP_ORDER.reduce((a, id) => a + VAL[mode][id][metric], 0);
const fmtH = (x: number) => `${x.toFixed(1)}h`;
const fmtE = (x: number) => `${x.toFixed(1)}e-2`;

/* geometry */
const X0 = 64;
const BARW = 672;
const TIME_FULL = 2.6;
const ERR_FULL = 4.5;
const TIME_SCALE = BARW / TIME_FULL;
const ERR_SCALE = BARW / ERR_FULL;
const TIME_Y = 58;
const ERR_Y = 170;
const BAR_H = 42;

interface Seg {
  id: OpId;
  x: number;
  w: number;
  v: number;
}
function segs(mode: Mode, metric: 0 | 1, scale: number): Seg[] {
  let acc = 0;
  return OP_ORDER.map((id) => {
    const v = VAL[mode][id][metric];
    const x = X0 + acc * scale;
    const w = v * scale;
    acc += v;
    return { id, x, w, v };
  });
}

interface Fix {
  key: "fix1" | "fix2";
  rank: number;
  title: string;
  detail: string;
  est: string;
  impact: string;
}
const FIXES: Fix[] = [
  {
    key: "fix1",
    rank: 1,
    title: "relax qoi-rel-error to 4e-2",
    detail: "loosen the objective's accuracy budget so the solve can coarsen",
    est: "est 1.7h",
    impact: "quality: rel-err 1.3e-2 → 3.0e-2",
  },
  {
    key: "fix2",
    rank: 2,
    title: "surrogate screen, certify top-4",
    detail: "cheap surrogate ranks candidates; certify only the best four",
    est: "est 1.9h",
    impact: "quality: keeps 2e-2 target on the certified set",
  },
];

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  active,
  disabled,
  color,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  color: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5",
        "font-mono text-xs font-semibold tracking-wide transition-colors hover:bg-white/5",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
      style={{
        borderColor: active ? color : `${color}55`,
        color: active ? BG : color,
        background: active ? color : "transparent",
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Ledger bar                                                         */
/* ------------------------------------------------------------------ */

function LedgerBar({
  mode,
  metric,
  scale,
  y,
  cap,
  capLabel,
  fullLabel,
  infeasible,
  reduced,
}: {
  mode: Mode;
  metric: 0 | 1;
  scale: number;
  y: number;
  cap: number;
  capLabel: string;
  fullLabel: string;
  infeasible: boolean;
  reduced: boolean;
}) {
  const s = segs(mode, metric, scale);
  const total = sum(mode, metric);
  const capX = X0 + cap * scale;
  const totalX = X0 + total * scale;
  const tr = reduced ? { duration: 0 } : { duration: 0.55, ease: "easeInOut" as const };

  return (
    <g>
      {/* track */}
      <rect x={X0} y={y} width={BARW} height={BAR_H} rx={8} fill="#0a1620" stroke={infeasible ? ROSE : BORDER} strokeWidth={infeasible ? 1.6 : 1} />

      {/* segments */}
      {s.map((seg) => (
        <motion.rect
          key={seg.id}
          y={y + 3}
          height={BAR_H - 6}
          rx={4}
          fill={OP_META[seg.id].color}
          opacity={0.9}
          initial={false}
          animate={{ x: seg.x + 2, width: Math.max(0, seg.w - 4) }}
          transition={tr}
        />
      ))}

      {/* overflow beyond cap */}
      {infeasible && (
        <motion.rect
          y={y + 1}
          height={BAR_H - 2}
          rx={4}
          fill={`${ROSE}44`}
          stroke={ROSE}
          strokeWidth={1}
          initial={false}
          animate={{ x: capX, width: Math.max(0, totalX - capX) }}
          transition={tr}
        />
      )}

      {/* cap line */}
      <line x1={capX} y1={y - 8} x2={capX} y2={y + BAR_H + 8} stroke={infeasible ? ROSE : AMBER} strokeWidth={1.6} strokeDasharray="4 3" />
      <text x={capX} y={y - 12} textAnchor="middle" fontFamily="monospace" fontSize={9.5} fontWeight={700} fill={infeasible ? ROSE : AMBER}>
        {capLabel}
      </text>

      {/* full-scale tick */}
      <text x={X0 + BARW} y={y + BAR_H + 15} textAnchor="end" fontFamily="monospace" fontSize={9} fill={SLATE}>
        {fullLabel} full-scale
      </text>

      {/* running total marker */}
      <motion.g initial={false} animate={{ x: totalX }} transition={tr}>
        <line x1={0} y1={y - 4} x2={0} y2={y + BAR_H + 4} stroke={infeasible ? ROSE : CYAN_GLOW} strokeWidth={1.4} />
        <circle cx={0} cy={y + BAR_H + 4} r={2.5} fill={infeasible ? ROSE : CYAN_GLOW} />
      </motion.g>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function BudgetLedgerViz() {
  const reduced = !!useReducedMotion();
  const [mode, setMode] = useState<Mode>("base");

  const timeTotal = sum(mode, 0);
  const errTotal = sum(mode, 1);
  const errCap = ERRCAP[mode];
  const timeFeasible = timeTotal <= WALL + 1e-9;
  const errFeasible = errTotal <= errCap + 1e-9;
  const feasible = timeFeasible && errFeasible;
  const overBy = Math.max(0, timeTotal - WALL);

  const tighten = useCallback(() => setMode("tight"), []);
  const relax = useCallback(() => setMode("fix1"), []);
  const applyFix = useCallback((k: "fix1" | "fix2") => setMode(k), []);
  const reset = useCallback(() => setMode("base"), []);

  const label = feasible ? "feasible ✓" : "BudgetInfeasible";
  const lamp = feasible ? EMERALD : ROSE;

  const status = useMemo(
    () => `${label} · wall ${fmtH(timeTotal)} / ${fmtH(WALL)} · rel-err ${fmtE(errTotal)} / ${fmtE(errCap)}`,
    [label, timeTotal, errTotal, errCap],
  );

  return (
    <section
      className="w-full rounded-2xl border p-4 sm:p-5"
      style={{ background: BG, borderColor: BORDER }}
      aria-label="Budget Ledger visualization: Time Ledger and Error Ledger"
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: lamp, boxShadow: `0 0 8px ${lamp}88` }}
          />
          <div className="min-w-0">
            <h3 className="font-mono text-sm font-bold tracking-tight" style={{ color: BRIGHT }}>
              Budgets first — Error &amp; Time Ledgers
            </h3>
            <p className="truncate font-mono text-[11px]" style={{ color: MUTED }}>
              every op takes an accuracy / time / memory budget; they compose end-to-end
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border px-3 py-1"
          style={{ borderColor: feasible ? `${EMERALD}44` : `${ROSE}55` }}
        >
          {feasible ? (
            <span className="font-mono text-[11px] font-bold" style={{ color: EMERALD }}>
              within budget
            </span>
          ) : (
            <>
              <AlertTriangle size={12} color={ROSE} />
              <span className="font-mono text-[11px] font-bold" style={{ color: ROSE }}>
                over by {fmtH(overBy)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 800 262"
        className="w-full"
        role="img"
        aria-label="Two stacked ledger bars for a five-operation plan. The Time Ledger sums each op's seconds toward a wall-time cap; the Error Ledger sums each op's relative-error contribution toward a target cap. Tightening accuracy grows the solve's time segment past the wall cap, turning the bar rose."
      >
        {/* Time ledger */}
        <g>
          <text x={X0} y={44} fontFamily="monospace" fontSize={11} fontWeight={700} fill={CYAN_GLOW}>
            TIME LEDGER
          </text>
          <text x={X0 + 96} y={44} fontFamily="monospace" fontSize={10} fill={MUTED}>
            seconds → hours, summing toward the wall budget
          </text>
          <LedgerBar
            mode={mode}
            metric={0}
            scale={TIME_SCALE}
            y={TIME_Y}
            cap={WALL}
            capLabel={`wall ${fmtH(WALL)}`}
            fullLabel={fmtH(TIME_FULL)}
            infeasible={!timeFeasible}
            reduced={reduced}
          />
        </g>

        {/* Error ledger */}
        <g>
          <text x={X0} y={156} fontFamily="monospace" fontSize={11} fontWeight={700} fill={CYAN_GLOW}>
            ERROR LEDGER
          </text>
          <text x={X0 + 104} y={156} fontFamily="monospace" fontSize={10} fill={MUTED}>
            rel-error contributions, summing toward the target
          </text>
          <LedgerBar
            mode={mode}
            metric={1}
            scale={ERR_SCALE}
            y={ERR_Y}
            cap={errCap}
            capLabel={`target ${fmtE(errCap)}`}
            fullLabel={fmtE(ERR_FULL)}
            infeasible={!errFeasible}
            reduced={reduced}
          />
        </g>

        {/* op legend */}
        <g transform="translate(64, 244)">
          {OP_ORDER.map((id, i) => (
            <g key={id} transform={`translate(${i * 138}, 0)`}>
              <rect x={0} y={-9} width={11} height={11} rx={2.5} fill={OP_META[id].color} />
              <text x={17} y={0} fontFamily="monospace" fontSize={10} fill={BRIGHT} fontWeight={600}>
                {OP_META[id].name}
              </text>
              <text x={17} y={13} fontFamily="monospace" fontSize={8.5} fill={MUTED}>
                {fmtH(VAL[mode][id][0])} · {fmtE(VAL[mode][id][1])}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CtrlButton onClick={tighten} active={mode === "tight"} disabled={mode === "tight"} color={AMBER} label="Tighten the required accuracy">
          <Gauge size={13} />
          Tighten accuracy
        </CtrlButton>
        <CtrlButton onClick={relax} disabled={feasible} color={CYAN_GLOW} label="Relax to restore feasibility">
          <ChevronRight size={13} />
          Relax (apply fix #1)
        </CtrlButton>
        <CtrlButton onClick={reset} color={SLATE} label="Reset the plan">
          <RotateCcw size={13} />
          Reset
        </CtrlButton>
      </div>

      {/* BudgetInfeasible card */}
      <AnimatePresence>
        {!feasible && (
          <motion.div
            key="infeasible"
            initial={reduced ? false : { opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 10, height: 0 }}
            transition={{ duration: reduced ? 0 : 0.3 }}
            className="mt-3 overflow-hidden rounded-lg border"
            style={{ borderColor: `${ROSE}55`, background: `${ROSE}0d` }}
          >
            <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: `${ROSE}33` }}>
              <AlertTriangle size={15} color={ROSE} />
              <span className="font-mono text-xs font-bold" style={{ color: ROSE }}>
                BudgetInfeasible
              </span>
              <span className="font-mono text-[11px]" style={{ color: MUTED }}>
                time ledger exceeds wall budget by {fmtH(overBy)} — refusing to grind. ranked fixes:
              </span>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {FIXES.map((f) => (
                <div
                  key={f.key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                  style={{ borderColor: BORDER, background: SURFACE }}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold"
                      style={{ background: `${CYAN}22`, color: CYAN_GLOW }}
                    >
                      {f.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] font-semibold" style={{ color: BRIGHT }}>
                        {f.title}
                      </div>
                      <div className="font-mono text-[10.5px]" style={{ color: MUTED }}>
                        {f.detail}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[10px]" style={{ color: SLATE }}>
                        <span className="inline-flex items-center gap-1" style={{ color: EMERALD }}>
                          <Clock size={10} /> {f.est}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Sigma size={10} /> {f.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyFix(f.key)}
                    aria-label={`Apply fix: ${f.title}`}
                    className="shrink-0 rounded-md border px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors hover:bg-white/5"
                    style={{ borderColor: `${EMERALD}66`, color: EMERALD }}
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status readout */}
      <div
        className="mt-3 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: feasible ? EMERALD : ROSE }}>›</span>{" "}
        <span style={{ color: feasible ? EMERALD : ROSE }}>{status}</span>
        <span style={{ color: SLATE }}> │ </span>
        <span style={{ color: MUTED }}>
          {mode === "base"
            ? "baseline plan fits both budgets"
            : mode === "tight"
              ? "solve segment grew — a refusal that teaches, not a silent grind"
              : mode === "fix1"
                ? "qoi-rel-error relaxed → back under the wall cap"
                : "surrogate screen + certify → feasible at the tight target"}
        </span>
      </div>
    </section>
  );
}
