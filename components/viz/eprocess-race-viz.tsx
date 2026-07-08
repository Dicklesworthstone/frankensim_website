"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Play, Pause, StepForward, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const TEAL = "#14b8a6";
const VIOLET = "#a855f7";
const AMBER = "#f59e0b";
const BLUE = "#3b82f6";
const ROSE = "#f43f5e";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Race model                                                         */
/* ------------------------------------------------------------------ */

const THRESHOLD = 20; // 1/α with α = 0.05 — anytime-valid rejection boundary
const MAX_GEN = 30;
const HORIZON = 30; // fixed-horizon core-hours a classical multi-arm test would burn per design

interface Design {
  id: string;
  label: string;
  color: string;
  edge: number; // drift of the betting martingale under its alternative
}

const DESIGNS: Design[] = [
  { id: "A", label: "design A", color: VIOLET, edge: 0.12 },
  { id: "B", label: "design B", color: AMBER, edge: 0.2 },
  { id: "C", label: "design C", color: CYAN_GLOW, edge: 0.35 },
  { id: "D", label: "design D", color: TEAL, edge: 0.16 },
  { id: "E", label: "design E", color: BLUE, edge: 0.09 },
];

/* deterministic LCG — no Math.random */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Series = Record<string, number[]>;
const initialSeries = (): Series => Object.fromEntries(DESIGNS.map((d) => [d.id, [1]]));

/* ------------------------------------------------------------------ */
/*  Chart geometry                                                     */
/* ------------------------------------------------------------------ */

const W = 760;
const H = 440;
const PAD_L = 52;
const PAD_R = 22;
const PAD_T = 54;
const PAD_B = 46;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  color,
  label,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-xs transition-colors hover:bg-white/5",
      )}
      style={{ borderColor: `${color}44`, color }}
    >
      {children}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function EprocessRaceViz() {
  const reduced = useReducedMotion() ?? false;

  const [series, setSeries] = useState<Series>(initialSeries);
  const [gen, setGen] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerE, setWinnerE] = useState(0);
  const [winnerGen, setWinnerGen] = useState(0);
  const [playing, setPlaying] = useState(false);

  const rngRef = useRef(makeRng(0x1a5eba11));
  const seriesRef = useRef<Series>(initialSeries());
  const genRef = useRef(0);
  const winnerRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    playingRef.current = false;
    setPlaying(false);
  }, []);

  /* ---- advance one generation ---- */
  const advance = useCallback(() => {
    if (winnerRef.current || genRef.current >= MAX_GEN) {
      stopPlay();
      return;
    }
    const rng = rngRef.current;
    genRef.current += 1;
    const g = genRef.current;

    const next: Series = {};
    for (const d of DESIGNS) {
      const cur = seriesRef.current[d.id];
      const last = cur[cur.length - 1];
      const noise = 0.55 + rng() * 0.9; // deterministic evidence draw
      const e = Math.max(0.2, last * (1 + d.edge * noise));
      next[d.id] = [...cur, e];
    }
    seriesRef.current = next;

    // decisive stop: highest e-value that has crossed the threshold wins
    let winId: string | null = null;
    let winVal = 0;
    for (const d of DESIGNS) {
      const arr = next[d.id];
      const e = arr[arr.length - 1];
      if (e >= THRESHOLD && e > winVal) {
        winId = d.id;
        winVal = e;
      }
    }

    setSeries(next);
    setGen(g);

    if (winId) {
      winnerRef.current = winId;
      setWinner(winId);
      setWinnerE(winVal);
      setWinnerGen(g);
      stopPlay();
    } else if (g >= MAX_GEN) {
      stopPlay();
    }
  }, [stopPlay]);

  const start = useCallback(() => {
    if (playingRef.current || winnerRef.current || genRef.current >= MAX_GEN) return;
    playingRef.current = true;
    setPlaying(true);
    advance();
    intervalRef.current = setInterval(advance, reduced ? 140 : 260);
  }, [advance, reduced]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) stopPlay();
    else start();
  }, [start, stopPlay]);

  const step = useCallback(() => {
    stopPlay();
    advance();
  }, [advance, stopPlay]);

  const reset = useCallback(() => {
    stopPlay();
    rngRef.current = makeRng(0x1a5eba11);
    seriesRef.current = initialSeries();
    genRef.current = 0;
    winnerRef.current = null;
    setSeries(initialSeries());
    setGen(0);
    setWinner(null);
    setWinnerE(0);
    setWinnerGen(0);
  }, [stopPlay]);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  /* ---- scales ---- */
  const maxE = DESIGNS.reduce((m, d) => {
    const arr = series[d.id];
    return Math.max(m, arr[arr.length - 1]);
  }, 1);
  const vmin = 0.7;
  const vmax = Math.max(THRESHOLD * 1.45, maxE * 1.18);
  const xmax = Math.max(12, Math.min(MAX_GEN, gen + 1));

  const xScale = (t: number) => PAD_L + (t / xmax) * PLOT_W;
  const y = (v: number) =>
    PAD_T + PLOT_H - (Math.log(Math.max(vmin, v) / vmin) / Math.log(vmax / vmin)) * PLOT_H;

  const pathOf = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const thresholdY = y(THRESHOLD);
  const savedX = winnerGen > 0 ? HORIZON / winnerGen : 0;

  const readout = winner
    ? `winner ${DESIGNS.find((d) => d.id === winner)?.label ?? winner} · e=${winnerE.toFixed(1)} > ${THRESHOLD} ✓ decisive`
    : `max e ${maxE.toFixed(1)} · gen ${gen} · ${playing ? "racing…" : gen === 0 ? "idle" : "paused"}`;
  const lamp = winner ? CYAN_GLOW : playing ? CYAN : SLATE;

  /* gridlines (log ticks) */
  const ticks = [1, 2, 5, 10, THRESHOLD, 30];

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
          <CtrlButton onClick={step} color={CYAN} label="Step" ariaLabel="Advance one generation">
            <StepForward size={12} />
          </CtrlButton>
          <CtrlButton
            onClick={togglePlay}
            color={CYAN_GLOW}
            label={playing ? "Pause" : "Play"}
            ariaLabel={playing ? "Pause the race" : "Run the e-value race"}
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </CtrlButton>
          <CtrlButton onClick={reset} color={SLATE} label="Reset" ariaLabel="Reset the race">
            <RotateCcw size={12} />
          </CtrlButton>
        </div>
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 500 }}
        role="img"
        aria-label="Several candidate designs race by accumulating anytime-valid e-values; the instant the leading curve crosses the decisive threshold of twenty the winner is frozen and the losing designs are cancelled mid-solve to save core-hours"
      >
        <defs>
          <filter id="race-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <text x={PAD_L} y={30} fill={MUTED} fontSize={11} fontFamily="monospace" letterSpacing={0.5}>
          E-VALUE WEALTH · anytime-valid · peek continuously, stop anytime
        </text>

        {/* Y gridlines + labels */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              y1={y(v)}
              x2={W - PAD_R}
              y2={y(v)}
              stroke={`${SLATE}22`}
              strokeWidth={0.6}
              strokeDasharray="3 4"
            />
            <text x={PAD_L - 8} y={y(v) + 3} textAnchor="end" fill={`${MUTED}99`} fontSize={9} fontFamily="monospace">
              {v}
            </text>
          </g>
        ))}

        {/* X axis ticks */}
        {Array.from({ length: Math.floor(xmax / 4) + 1 }, (_, i) => i * 4).map((t) => (
          <text
            key={t}
            x={xScale(t)}
            y={H - PAD_B + 18}
            textAnchor="middle"
            fill={`${MUTED}88`}
            fontSize={9}
            fontFamily="monospace"
          >
            {t}
          </text>
        ))}
        <text x={PAD_L + PLOT_W / 2} y={H - 8} textAnchor="middle" fill={`${MUTED}88`} fontSize={10} fontFamily="monospace">
          generation / evidence step
        </text>
        <text
          x={16}
          y={PAD_T + PLOT_H / 2}
          textAnchor="middle"
          fill={`${MUTED}88`}
          fontSize={10}
          fontFamily="monospace"
          transform={`rotate(-90, 16, ${PAD_T + PLOT_H / 2})`}
        >
          e-value (log)
        </text>

        {/* Threshold line */}
        <line
          x1={PAD_L}
          y1={thresholdY}
          x2={W - PAD_R}
          y2={thresholdY}
          stroke={CYAN_GLOW}
          strokeWidth={1.5}
          strokeDasharray="7 4"
        />
        <text x={W - PAD_R} y={thresholdY - 6} textAnchor="end" fill={CYAN_GLOW} fontSize={10} fontFamily="monospace" fontWeight={700}>
          1/α = {THRESHOLD} · decisive
        </text>

        {/* Curves */}
        {DESIGNS.map((d) => {
          const arr = series[d.id];
          const last = arr[arr.length - 1];
          const isWinner = winner === d.id;
          const isLoser = winner !== null && !isWinner;
          return (
            <g key={d.id}>
              <motion.path
                d={pathOf(arr)}
                fill="none"
                stroke={d.color}
                strokeWidth={isWinner ? 3 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                animate={{ opacity: isLoser ? 0.22 : 1 }}
                transition={{ duration: reduced ? 0 : 0.5 }}
                strokeDasharray={isLoser ? "4 4" : undefined}
                filter={isWinner ? "url(#race-glow)" : undefined}
              />
              {/* leading marker */}
              <motion.circle
                r={isWinner ? 5.5 : 3.5}
                fill={d.color}
                animate={{ cx: xScale(arr.length - 1), cy: y(last), opacity: isLoser ? 0.3 : 1 }}
                transition={{ duration: reduced ? 0 : 0.25, ease: "easeOut" }}
                filter={isWinner ? "url(#race-glow)" : undefined}
              />
              {/* cancel mark on losers */}
              {isLoser && (
                <motion.g
                  initial={{ opacity: 0, scale: reduced ? 1 : 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reduced ? 0 : 0.35 }}
                  style={{ transformOrigin: `${xScale(arr.length - 1)}px ${y(last)}px` }}
                >
                  <line x1={xScale(arr.length - 1) - 4} y1={y(last) - 4} x2={xScale(arr.length - 1) + 4} y2={y(last) + 4} stroke={ROSE} strokeWidth={1.6} />
                  <line x1={xScale(arr.length - 1) - 4} y1={y(last) + 4} x2={xScale(arr.length - 1) + 4} y2={y(last) - 4} stroke={ROSE} strokeWidth={1.6} />
                </motion.g>
              )}
            </g>
          );
        })}

        {/* Winner badge */}
        <AnimatePresence>
          {winner && (
            <motion.g
              key="winner-badge"
              initial={{ opacity: 0, y: reduced ? PAD_T + 8 : PAD_T }}
              animate={{ opacity: 1, y: PAD_T + 8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
            >
              <rect x={PAD_L + 8} y={0} width={214} height={26} rx={13} fill={`${CYAN_GLOW}1c`} stroke={CYAN_GLOW} strokeWidth={1.3} />
              <text x={PAD_L + 20} y={17} fill={CYAN_GLOW} fontSize={11} fontFamily="monospace" fontWeight={700}>
                ✓ {DESIGNS.find((d) => d.id === winner)?.label} · e={winnerE.toFixed(1)}
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* Legend + result strip */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: BORDER, color: MUTED }}
      >
        {DESIGNS.map((d) => {
          const arr = series[d.id];
          const e = arr[arr.length - 1];
          const isWinner = winner === d.id;
          const isLoser = winner !== null && !isWinner;
          return (
            <span key={d.id} className="inline-flex items-center gap-1.5" style={{ opacity: isLoser ? 0.5 : 1 }}>
              <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: d.color }} />
              <span style={{ color: isWinner ? CYAN_GLOW : d.color }}>
                {d.label} {isWinner ? "✓" : isLoser ? "✕" : ""} {e.toFixed(1)}
              </span>
            </span>
          );
        })}
      </div>

      {/* Result readout */}
      <div className="border-t px-4 py-2.5 font-mono text-[11px]" style={{ borderColor: BORDER }}>
        {winner ? (
          <span style={{ color: BRIGHT }}>
            winner: {DESIGNS.find((d) => d.id === winner)?.label} · losers cancelled mid-solve ·{" "}
            <span style={{ color: CYAN_GLOW }}>core-hours saved {savedX.toFixed(1)}×</span> at identical guarantees
          </span>
        ) : (
          <span style={{ color: SLATE }}>
            e-processes are anytime-valid — no p-hacking penalty for peeking; the first curve to reach {THRESHOLD} wins
          </span>
        )}
      </div>
    </div>
  );
}
