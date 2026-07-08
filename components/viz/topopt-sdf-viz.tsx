"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { Play, Pause, StepForward, RotateCcw, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const ROSE = "#f43f5e";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const LIME = "#a3e635";

/* ------------------------------------------------------------------ */
/*  Domain + optimization model                                        */
/* ------------------------------------------------------------------ */

const COLS = 30;
const ROWS = 16;
const CS = 18;
const X0 = 116;
const Y0 = 66;
const DOM_W = COLS * CS;
const DOM_H = ROWS * CS;

const ITERS = 40;
const UNIFORM = 0.4; // volume fraction target
const C0 = 100; // initial compliance (uniform grey blob is very compliant)
const CINF = 23.7; // converged compliance

/* Truss members of the target cantilever, in normalized [0,1]^2 (y downwards). */
interface Member {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  w: number;
}
const MEMBERS: Member[] = [
  { ax: 0.0, ay: 0.24, bx: 0.98, by: 0.46, w: 0.09 }, // upper chord
  { ax: 0.0, ay: 0.76, bx: 0.98, by: 0.54, w: 0.09 }, // lower chord
  { ax: 0.0, ay: 0.5, bx: 0.98, by: 0.5, w: 0.055 }, // spine to load
  { ax: 0.0, ay: 0.24, bx: 0.5, by: 0.62, w: 0.05 }, // brace
  { ax: 0.0, ay: 0.76, bx: 0.5, by: 0.38, w: 0.05 }, // brace
  { ax: 0.33, ay: 0.3, bx: 0.66, by: 0.62, w: 0.045 }, // diagonal
  { ax: 0.33, ay: 0.7, bx: 0.66, by: 0.38, w: 0.045 }, // diagonal
  { ax: 0.98, ay: 0.42, bx: 0.98, by: 0.58, w: 0.07 }, // load post
];

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
function distToSeg(px: number, py: number, m: Member): number {
  const dx = m.bx - m.ax;
  const dy = m.by - m.ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - m.ax) * dx + (py - m.ay) * dy) / len2;
  t = clamp01(t);
  const cx = m.ax + t * dx;
  const cy = m.ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function rawTarget(nx: number, ny: number): number {
  let v = 0;
  for (const m of MEMBERS) {
    const d = distToSeg(nx, ny, m);
    v = Math.max(v, 1 - smoothstep(m.w * 0.4, m.w, d));
  }
  return v;
}

/* Normalize the target field so its mean equals the volume fraction exactly. */
const TARGET_FIELD: number[] = (() => {
  const raw = new Array<number>(COLS * ROWS);
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      raw[j * COLS + i] = rawTarget((i + 0.5) / COLS, (j + 0.5) / ROWS);
    }
  }
  // bisect a multiplier λ so mean(clamp(λ·raw)) == UNIFORM
  let lo = 0;
  let hi = 20;
  for (let it = 0; it < 46; it++) {
    const mid = (lo + hi) / 2;
    let s = 0;
    for (let k = 0; k < raw.length; k++) s += clamp01(mid * raw[k]);
    const mean = s / raw.length;
    if (mean > UNIFORM) hi = mid;
    else lo = mid;
  }
  const lambda = (lo + hi) / 2;
  return raw.map((r) => clamp01(lambda * r));
})();

function smooth01(p: number): number {
  const x = clamp01(p);
  return x * x * (3 - 2 * x);
}
function computeField(iter: number): number[] {
  const p = smooth01(iter / ITERS);
  const out = new Array<number>(COLS * ROWS);
  for (let k = 0; k < out.length; k++) out[k] = UNIFORM * (1 - p) + TARGET_FIELD[k] * p;
  return out;
}
function compliance(iter: number): number {
  const p = iter / ITERS;
  return CINF + (C0 - CINF) * Math.exp(-3.1 * p);
}

/* density → colour (dark void → bright cyan solid) */
const VOID_RGB = { r: 7, g: 19, b: 27 };
const SOLID_RGB = { r: 34, g: 211, b: 238 };
function densityColor(d: number): string {
  const t = Math.pow(clamp01(d), 0.82);
  const r = Math.round(VOID_RGB.r + (SOLID_RGB.r - VOID_RGB.r) * t);
  const g = Math.round(VOID_RGB.g + (SOLID_RGB.g - VOID_RGB.g) * t);
  const b = Math.round(VOID_RGB.b + (SOLID_RGB.b - VOID_RGB.b) * t);
  return `rgb(${r},${g},${b})`;
}

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  color,
  label,
  ariaLabel,
  active,
  children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  ariaLabel: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-xs transition-colors hover:bg-white/5",
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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function TopoptSdfViz() {
  const reduced = useReducedMotion() ?? false;

  const [iter, setIter] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const playingRef = useRef(false);
  const iterRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const field = useMemo(() => computeField(iter), [iter]);
  const vol = useMemo(() => field.reduce((a, b) => a + b, 0) / field.length, [field]);
  const comp = compliance(iter);

  const stopPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const stepOnce = useCallback(() => {
    if (iterRef.current >= ITERS) {
      stopPlay();
      return;
    }
    iterRef.current += 1;
    setIter(iterRef.current);
    if (iterRef.current >= ITERS) stopPlay();
  }, [stopPlay]);

  const start = useCallback(() => {
    if (playingRef.current || iterRef.current >= ITERS) return;
    playingRef.current = true;
    setPlaying(true);
    intervalRef.current = setInterval(stepOnce, reduced ? 90 : 170);
  }, [stepOnce, reduced]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) stopPlay();
    else start();
  }, [start, stopPlay]);

  const step = useCallback(() => {
    stopPlay();
    stepOnce();
  }, [stepOnce, stopPlay]);

  const reset = useCallback(() => {
    stopPlay();
    iterRef.current = 0;
    setIter(0);
  }, [stopPlay]);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const done = iter >= ITERS;
  const lamp = playing ? CYAN_GLOW : iter > 0 ? EMERALD : SLATE;
  const readout = `iter ${iter} · compliance ${comp.toFixed(1)} ↓ · vol ${vol.toFixed(2)} · certified ✓ · mesh steps: 0`;

  const loadX = X0 + DOM_W;
  const loadY = Y0 + DOM_H / 2;

  // volume bar geometry
  const barX = X0;
  const barY = Y0 + DOM_H + 26;
  const barW = DOM_W;
  const barH = 12;

  // compliance sparkline (0..iter) in a small inset, top-right of the canvas
  const spX = 560;
  const spY = 30;
  const spW = 168;
  const spH = 20;
  const compPath = Array.from({ length: iter + 1 }, (_, i) => {
    const px = spX + (i / ITERS) * spW;
    const py = spY + spH - ((compliance(i) - CINF) / (C0 - CINF)) * spH;
    return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border"
      style={{ background: SURFACE, borderColor: BORDER }}
    >
      {/* Header control bar */}
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
            {readout}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CtrlButton onClick={step} color={CYAN} label="Step" ariaLabel="Run one optimization iteration">
            <StepForward size={12} />
          </CtrlButton>
          <CtrlButton
            onClick={togglePlay}
            color={CYAN_GLOW}
            label={playing ? "Pause" : "Play"}
            ariaLabel={playing ? "Pause optimization" : "Run topology optimization"}
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </CtrlButton>
          <CtrlButton
            onClick={() => setShowGrid((g) => !g)}
            color={LIME}
            label="SDF grid"
            ariaLabel="Toggle the background SDF grid"
            active={showGrid}
          >
            <Grid3x3 size={12} />
          </CtrlButton>
          <CtrlButton onClick={reset} color={SLATE} label="Reset" ariaLabel="Reset optimization">
            <RotateCcw size={12} />
          </CtrlButton>
        </div>
      </div>

      {/* SVG canvas */}
      <svg
        viewBox="0 0 760 440"
        className="w-full"
        style={{ maxHeight: 500 }}
        role="img"
        aria-label="Topology optimization on a raw signed-distance field: a SIMP density field on a fixed background grid evolves from a uniform blob into a cantilever truss that minimizes compliance at a fixed volume fraction, with a fixed support on the left, a downward load on the right, and zero body-fitted meshing"
      >
        <defs>
          <filter id="topo-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <text x={X0} y={30} fill={MUTED} fontSize={11} fontFamily="monospace" letterSpacing={0.5}>
          DESIGN DOMAIN · SIMP density on CutFEM-on-SDF
        </text>

        {/* compliance sparkline inset */}
        <text x={spX} y={spY - 6} fill={`${MUTED}aa`} fontSize={9} fontFamily="monospace">
          compliance ↓
        </text>
        <rect x={spX} y={spY} width={spW} height={spH} rx={4} fill={`${SLATE}14`} stroke={BORDER} strokeWidth={0.8} />
        <path d={compPath} fill="none" stroke={AMBER} strokeWidth={1.6} strokeLinejoin="round" />

        {/* domain backing */}
        <rect x={X0} y={Y0} width={DOM_W} height={DOM_H} fill="#050d13" stroke={BORDER} strokeWidth={1} />

        {/* density cells */}
        {field.map((d, k) => {
          if (d < 0.05) return null;
          const i = k % COLS;
          const j = Math.floor(k / COLS);
          const solid = d > 0.72;
          return (
            <motion.rect
              key={k}
              x={X0 + i * CS}
              y={Y0 + j * CS}
              width={CS}
              height={CS}
              initial={false}
              animate={{ fill: densityColor(d), opacity: 0.35 + 0.65 * clamp01(d) }}
              transition={{ duration: reduced ? 0 : 0.25 }}
              filter={solid ? "url(#topo-glow)" : undefined}
            />
          );
        })}

        {/* SDF background grid overlay */}
        {showGrid && (
          <g stroke={`${LIME}44`} strokeWidth={0.5}>
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <line key={`v${i}`} x1={X0 + i * CS} y1={Y0} x2={X0 + i * CS} y2={Y0 + DOM_H} />
            ))}
            {Array.from({ length: ROWS + 1 }, (_, j) => (
              <line key={`h${j}`} x1={X0} y1={Y0 + j * CS} x2={X0 + DOM_W} y2={Y0 + j * CS} />
            ))}
          </g>
        )}

        {/* Fixed support — hatched wall + triangles on the left edge */}
        <rect x={X0 - 12} y={Y0} width={12} height={DOM_H} fill={`${SLATE}22`} />
        {Array.from({ length: 9 }, (_, i) => {
          const ty = Y0 + (i + 0.5) * (DOM_H / 9);
          return (
            <path
              key={`sup${i}`}
              d={`M ${X0} ${ty} L ${X0 - 12} ${ty - 7} L ${X0 - 12} ${ty + 7} Z`}
              fill={`${SLATE}88`}
            />
          );
        })}
        <text
          x={X0 - 20}
          y={Y0 + DOM_H / 2}
          textAnchor="middle"
          fill={MUTED}
          fontSize={10}
          fontFamily="monospace"
          transform={`rotate(-90, ${X0 - 20}, ${Y0 + DOM_H / 2})`}
        >
          fixed support
        </text>

        {/* Downward load on the right edge */}
        <g filter="url(#topo-glow)">
          <line x1={loadX} y1={loadY - 4} x2={loadX} y2={loadY + 40} stroke={ROSE} strokeWidth={2.4} />
          <path d={`M ${loadX - 6} ${loadY + 32} L ${loadX} ${loadY + 44} L ${loadX + 6} ${loadY + 32} Z`} fill={ROSE} />
        </g>
        <text x={loadX + 10} y={loadY + 26} fill={ROSE} fontSize={12} fontFamily="monospace" fontWeight={700}>
          F
        </text>

        {/* Volume-fraction bar */}
        <text x={barX} y={barY - 6} fill={`${MUTED}aa`} fontSize={9.5} fontFamily="monospace">
          volume fraction — held at V/V₀ = {UNIFORM.toFixed(2)}
        </text>
        <rect x={barX} y={barY} width={barW} height={barH} rx={4} fill={`${SLATE}18`} stroke={BORDER} strokeWidth={0.8} />
        <motion.rect
          x={barX}
          y={barY}
          height={barH}
          rx={4}
          fill={EMERALD}
          initial={false}
          animate={{ width: Math.max(2, vol * barW) }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          opacity={0.85}
        />
        <line
          x1={barX + UNIFORM * barW}
          y1={barY - 4}
          x2={barX + UNIFORM * barW}
          y2={barY + barH + 4}
          stroke={CYAN_GLOW}
          strokeWidth={1.2}
          strokeDasharray="3 3"
        />
        <text x={barX + barW} y={barY + barH + 16} textAnchor="end" fill={`${SLATE}`} fontSize={9} fontFamily="monospace">
          every iterate carries a composed error certificate · body-fitted mesh steps: 0
        </text>

        {/* Convergence chip */}
        <rect
          x={X0 + DOM_W - 150}
          y={Y0 + 8}
          width={142}
          height={22}
          rx={11}
          fill={done ? `${EMERALD}1e` : `${CYAN}14`}
          stroke={done ? EMERALD : `${CYAN_GLOW}55`}
          strokeWidth={1}
        />
        <text
          x={X0 + DOM_W - 79}
          y={Y0 + 23}
          textAnchor="middle"
          fill={done ? EMERALD : CYAN_GLOW}
          fontSize={10}
          fontFamily="monospace"
          fontWeight={600}
        >
          {done ? "converged ✓" : `iter ${iter}/${ITERS}`}
        </text>
      </svg>

      {/* Legend / footer */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: BORDER, color: MUTED }}
      >
        <span className="inline-flex items-center gap-1.5">
          <svg width={54} height={12} aria-hidden="true">
            <defs>
              <linearGradient id="topo-legend" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={densityColor(0.05)} />
                <stop offset="0.5" stopColor={densityColor(0.5)} />
                <stop offset="1" stopColor={densityColor(1)} />
              </linearGradient>
            </defs>
            <rect x={0} y={2} width={54} height={8} rx={2} fill="url(#topo-legend)" />
          </svg>
          <span>void 0 → solid 1</span>
        </span>
        <LegendChip color={SLATE} text="fixed support" />
        <LegendChip color={ROSE} text="applied load F" />
        <LegendChip color={EMERALD} text="volume held at 0.40" />
        <span style={{ color: SLATE }}>load-carrying members emerge; the mesh never does</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legend chip                                                        */
/* ------------------------------------------------------------------ */

function LegendChip({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
      <span style={{ color }}>{text}</span>
    </span>
  );
}
