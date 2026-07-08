"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { Play, Pause, StepForward, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette (FrankenSim)                                               */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const AMBER = "#f59e0b";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Data + deterministic hashing                                       */
/* ------------------------------------------------------------------ */

const VALUES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
const THREAD_OPTS = [2, 4, 8, 16] as const;

const HEX_PREFIX = "3FF921F9"; // fixed high bits (both agree)
const FRANKEN_LOW = "B7"; // fixed-shape reduction tree: always identical

function mix(a: number, b: number) {
  let x = (Math.imul(a, 2654435761) ^ Math.imul(b + 1, 40503)) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 2246822519) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return x >>> 0;
}

/** Naive parallel sum: last byte depends on thread count AND interleaving. */
function naiveLow(threads: number, run: number) {
  return (mix(threads, run) & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

/** Deterministic Fisher–Yates permutation of partial indices (combine order). */
function permute(n: number, seed: number) {
  const arr = Array.from({ length: n }, (_, i) => i);
  let s = (seed >>> 0) || 1;
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

const kPartials = (threads: number) => Math.min(threads, VALUES.length);

/* ------------------------------------------------------------------ */
/*  Tree geometry (fixed shape: 8 -> 4 -> 2 -> 1)                      */
/* ------------------------------------------------------------------ */

const LEAF_W = 30;
const leafX = (i: number) => 414 + i * 46;
const leafCX = (i: number) => leafX(i) + LEAF_W / 2;
const L1_CX = (j: number) => (leafCX(2 * j) + leafCX(2 * j + 1)) / 2;
const L2_CX = (j: number) => (L1_CX(2 * j) + L1_CX(2 * j + 1)) / 2;
const ROOT_CX = (L2_CX(0) + L2_CX(1)) / 2;
const Y_LEAF = 96;
const Y_L1 = 152;
const Y_L2 = 200;
const Y_ROOT = 248;

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  active,
  color,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5",
        "font-mono text-xs font-semibold tracking-wide transition-colors hover:bg-white/5",
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
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function DeterminismViz() {
  const reduced = !!useReducedMotion();

  const [threads, setThreads] = useState(8);
  const [run, setRun] = useState(0);
  const [order, setOrder] = useState<number[]>(() => permute(kPartials(8), mix(8, 0)));
  const [displayLow, setDisplayLow] = useState(() => naiveLow(8, 0));
  const [pulse, setPulse] = useState(3);
  const [playing, setPlaying] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const threadsRef = useRef(threads);
  const runRef = useRef(run);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const schedule = useCallback(
    (fn: () => void, ms: number) => {
      const id = setTimeout(fn, reduced ? 0 : ms);
      timersRef.current.push(id);
    },
    [reduced],
  );

  /* ---- re-run both summations ---- */
  const rerun = useCallback(
    (t: number, r: number) => {
      clearTimers();
      const k = kPartials(t);
      setOrder(permute(k, mix(t, r)));

      // naive side: low byte wobbles through a few interleaving-dependent
      // candidates, then settles (still non-deterministic vs other runs)
      const settled = naiveLow(t, r);
      if (reduced) {
        setDisplayLow(settled);
      } else {
        const cands = [
          naiveLow(t, r * 7 + 1),
          naiveLow(t, r * 7 + 2),
          naiveLow(t, r * 7 + 3),
          settled,
        ];
        cands.forEach((h, i) => schedule(() => setDisplayLow(h), i * 90));
      }

      // franken side: fixed-shape reduction tree fires level by level,
      // always yielding the identical bit pattern
      if (reduced) {
        setPulse(3);
      } else {
        setPulse(-1);
        [0, 1, 2, 3].forEach((lvl) => schedule(() => setPulse(lvl), 120 + lvl * 130));
      }
    },
    [clearTimers, schedule, reduced],
  );

  const selectThreads = useCallback(
    (t: number) => {
      setThreads(t);
      rerun(t, run);
    },
    [rerun, run],
  );

  const step = useCallback(() => {
    const r = run + 1;
    setRun(r);
    rerun(threads, r);
  }, [run, threads, rerun]);

  const stopPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (intervalRef.current) return;
    setPlaying(true);
    intervalRef.current = setInterval(
      () => {
        const idx = THREAD_OPTS.indexOf(threadsRef.current as (typeof THREAD_OPTS)[number]);
        const nextT = THREAD_OPTS[(idx + 1) % THREAD_OPTS.length];
        const r = runRef.current + 1;
        setThreads(nextT);
        setRun(r);
        rerun(nextT, r);
      },
      reduced ? 400 : 1150,
    );
  }, [rerun, reduced]);

  const togglePlay = useCallback(() => {
    if (playing) stopPlay();
    else play();
  }, [playing, play, stopPlay]);

  const reset = useCallback(() => {
    stopPlay();
    clearTimers();
    setThreads(8);
    setRun(0);
    setOrder(permute(kPartials(8), mix(8, 0)));
    setDisplayLow(naiveLow(8, 0));
    setPulse(3);
  }, [stopPlay, clearTimers]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  /* ---- derived ---- */
  const k = kPartials(threads);
  const idle = threads - k;

  // combine-step number badge for each partial index
  const rankOf = useMemo(() => {
    const r = new Array<number>(k).fill(0);
    order.forEach((partialIdx, stepIdx) => {
      if (partialIdx < k) r[partialIdx] = stepIdx + 1;
    });
    return r;
  }, [order, k]);

  // partial box layout inside the left panel
  const pw = k <= 4 ? 58 : 36;
  const gap = (350 - k * pw) / (k + 1);
  const partialX = (j: number) => 30 + gap + j * (pw + gap);
  const ACC_CX = 205;

  const emeraldNode = (lvl: number) => (pulse >= lvl ? EMERALD : `${CYAN}55`);

  return (
    <section
      className="w-full rounded-2xl border p-4 sm:p-5"
      style={{ background: BG, borderColor: BORDER }}
      aria-label="Determinism visualization"
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-bold tracking-tight" style={{ color: BRIGHT }}>
            Determinism is a feature, not an accident
          </h3>
          <p className="mt-0.5 font-mono text-[11px]" style={{ color: MUTED }}>
            fixed-shape reduction trees → bit-identical across runs, threads, ISAs
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border px-3 py-1" style={{ borderColor: BORDER }}>
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
            threads
          </span>
          <span className="font-mono text-xs font-bold" style={{ color: CYAN_GLOW }}>
            {threads}
          </span>
        </div>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 800 360"
        className="w-full"
        role="img"
        aria-label="Left: a naive parallel sum whose low bits wobble with thread count and interleaving. Right: a fixed-shape reduction tree that always yields the identical bit pattern."
      >
        <defs>
          <filter id="det-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* panels */}
        <rect x={12} y={30} width={378} height={318} rx={12} fill={`${ROSE}08`} stroke={`${ROSE}30`} />
        <rect x={410} y={30} width={378} height={318} rx={12} fill={`${EMERALD}08`} stroke={`${EMERALD}30`} />

        <text x={26} y={22} fontFamily="monospace" fontSize={12} fontWeight={700} fill={ROSE}>
          naive parallel sum
        </text>
        <text x={424} y={22} fontFamily="monospace" fontSize={12} fontWeight={700} fill={EMERALD}>
          FrankenSim fixed-shape reduction tree
        </text>

        {/* ---- shared value chips (left) ---- */}
        {VALUES.map((v, i) => (
          <g key={`chip-${i}`}>
            <rect x={26 + i * 44} y={44} width={38} height={22} rx={5} fill={`${SLATE}22`} stroke={`${SLATE}88`} />
            <text
              x={26 + i * 44 + 19}
              y={59}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={10}
              fill={MUTED}
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* ---- naive partial sums ---- */}
        {Array.from({ length: k }).map((_, j) => (
          <g key={`p-${j}`}>
            <line
              x1={partialX(j) + pw / 2}
              y1={150 + 34}
              x2={ACC_CX}
              y2={244}
              stroke={`${ROSE}55`}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <rect x={partialX(j)} y={150} width={pw} height={34} rx={6} fill={`${ROSE}18`} stroke={`${ROSE}88`} />
            <text
              x={partialX(j) + pw / 2}
              y={171}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={k <= 4 ? 11 : 9}
              fill={ROSE}
            >
              Σt{j}
            </text>
            {/* combine-order badge (varies each run) */}
            <circle cx={partialX(j) + pw / 2} cy={140} r={8} fill={AMBER} />
            <text
              x={partialX(j) + pw / 2}
              y={143.5}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={10}
              fontWeight={700}
              fill={BG}
            >
              {rankOf[j]}
            </text>
          </g>
        ))}
        <text x={30} y={132} fontFamily="monospace" fontSize={9} fill={`${AMBER}dd`}>
          combine order (scheduler-dependent, varies) ↓
        </text>

        {/* naive accumulator */}
        <rect x={ACC_CX - 60} y={244} width={120} height={30} rx={7} fill={`${ROSE}22`} stroke={ROSE} strokeWidth={1.5} />
        <text x={ACC_CX} y={263} textAnchor="middle" fontFamily="monospace" fontSize={11} fill={ROSE}>
          accumulator
        </text>

        {/* ---- franken tree ---- */}
        {/* connecting lines (fixed shape) */}
        {[0, 1, 2, 3].map((j) => (
          <g key={`e1-${j}`}>
            <line x1={leafCX(2 * j)} y1={Y_LEAF + 22} x2={L1_CX(j)} y2={Y_L1} stroke={`${EMERALD}66`} strokeWidth={1} />
            <line x1={leafCX(2 * j + 1)} y1={Y_LEAF + 22} x2={L1_CX(j)} y2={Y_L1} stroke={`${EMERALD}66`} strokeWidth={1} />
          </g>
        ))}
        {[0, 1].map((j) => (
          <g key={`e2-${j}`}>
            <line x1={L1_CX(2 * j)} y1={Y_L1 + 12} x2={L2_CX(j)} y2={Y_L2} stroke={`${EMERALD}66`} strokeWidth={1} />
            <line x1={L1_CX(2 * j + 1)} y1={Y_L1 + 12} x2={L2_CX(j)} y2={Y_L2} stroke={`${EMERALD}66`} strokeWidth={1} />
          </g>
        ))}
        <line x1={L2_CX(0)} y1={Y_L2 + 12} x2={ROOT_CX} y2={Y_ROOT} stroke={`${EMERALD}66`} strokeWidth={1} />
        <line x1={L2_CX(1)} y1={Y_L2 + 12} x2={ROOT_CX} y2={Y_ROOT} stroke={`${EMERALD}66`} strokeWidth={1} />

        {/* leaves (same values) */}
        {VALUES.map((v, i) => (
          <g key={`leaf-${i}`}>
            <rect x={leafX(i)} y={Y_LEAF} width={LEAF_W} height={22} rx={5} fill={`${CYAN}18`} stroke={`${CYAN}99`} />
            <text
              x={leafCX(i)}
              y={Y_LEAF + 15}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={9}
              fill={CYAN_GLOW}
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* level 1 */}
        {[0, 1, 2, 3].map((j) => (
          <motion.circle
            key={`n1-${j}`}
            cx={L1_CX(j)}
            cy={Y_L1}
            r={11}
            stroke={EMERALD}
            strokeWidth={1.5}
            animate={{ fill: emeraldNode(1) === EMERALD ? `${EMERALD}44` : `${CYAN}18` }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            filter={pulse === 1 ? "url(#det-glow)" : undefined}
          />
        ))}
        {/* level 2 */}
        {[0, 1].map((j) => (
          <motion.circle
            key={`n2-${j}`}
            cx={L2_CX(j)}
            cy={Y_L2}
            r={12}
            stroke={EMERALD}
            strokeWidth={1.5}
            animate={{ fill: pulse >= 2 ? `${EMERALD}55` : `${CYAN}18` }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            filter={pulse === 2 ? "url(#det-glow)" : undefined}
          />
        ))}
        {/* root */}
        <motion.circle
          cx={ROOT_CX}
          cy={Y_ROOT}
          r={15}
          stroke={EMERALD}
          strokeWidth={2}
          animate={{ fill: pulse >= 3 ? `${EMERALD}66` : `${CYAN}18` }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          filter={pulse >= 3 ? "url(#det-glow)" : undefined}
        />
        <text x={ROOT_CX} y={Y_ROOT + 4} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={700} fill={BRIGHT}>
          Σ
        </text>

        {/* ---- hash readouts ---- */}
        <text x={26} y={300} fontFamily="monospace" fontSize={12} fill={BRIGHT}>
          0x{HEX_PREFIX}
          <tspan fill={MUTED}>…</tspan>
          <motion.tspan
            key={displayLow}
            fill={ROSE}
            fontWeight={700}
            initial={reduced ? false : { opacity: 0.3 }}
            animate={{ opacity: 1 }}
          >
            {displayLow}
          </motion.tspan>
        </text>
        <text x={26} y={320} fontFamily="monospace" fontSize={10} fill={ROSE}>
          ✗ varies with thread count &amp; interleaving
        </text>

        <text x={424} y={300} fontFamily="monospace" fontSize={12} fill={BRIGHT}>
          0x{HEX_PREFIX}
          <tspan fill={MUTED}>…</tspan>
          <tspan fill={EMERALD} fontWeight={700}>
            {FRANKEN_LOW}
          </tspan>
        </text>
        <text x={424} y={320} fontFamily="monospace" fontSize={10} fill={EMERALD}>
          ✓ stable · bit-identical for any thread count
        </text>

        {idle > 0 && (
          <text x={26} y={338} fontFamily="monospace" fontSize={9} fill={`${AMBER}cc`}>
            {threads} threads · {idle} idle (only {k} partials)
          </text>
        )}
      </svg>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          threads
        </span>
        {THREAD_OPTS.map((t) => (
          <CtrlButton
            key={t}
            onClick={() => selectThreads(t)}
            active={threads === t}
            color={CYAN_GLOW}
            label={`Run with ${t} threads`}
          >
            {t}
          </CtrlButton>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <CtrlButton onClick={togglePlay} active={playing} color={EMERALD} label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? "Pause" : "Play"}
        </CtrlButton>
        <CtrlButton onClick={step} color={AMBER} label="Re-run with a new interleaving">
          <StepForward size={13} />
          Re-run
        </CtrlButton>
        <CtrlButton onClick={reset} color={SLATE} label="Reset">
          <RotateCcw size={13} />
          Reset
        </CtrlButton>
      </div>

      {/* Status readout */}
      <div
        className="mt-3 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span> threads: {threads}
        {idle > 0 ? ` (${idle} idle)` : ""} · naive:{" "}
        <span style={{ color: ROSE }}>
          0x{HEX_PREFIX}…{displayLow} (varies ✗)
        </span>{" "}
        · franken:{" "}
        <span style={{ color: EMERALD }}>
          0x{HEX_PREFIX}…{FRANKEN_LOW} (stable ✓ bit-identical)
        </span>
      </div>
    </section>
  );
}
