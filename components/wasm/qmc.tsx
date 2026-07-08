"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView, useEasedText } from "@/lib/use-viz-anim";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */
const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const AMBER = "#fbbf24";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";

function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted ? !!rm : false;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="h-px w-8" style={{ background: `${CYAN}66` }} />
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">{children}</span>
    </div>
  );
}

function LiveBadge({ computing }: { computing: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.2em]"
      style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d`, color: CYAN_GLOW }}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", computing && "animate-pulse")}
        style={{ background: computing ? AMBER : EMERALD, boxShadow: "0 0 6px currentColor" }}
      />
      {computing ? "Computing…" : "Computed live in WASM"}
    </span>
  );
}

function Pill({
  onClick,
  active,
  color = CYAN,
  children,
  ariaLabel,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  color?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/5",
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

function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}
    >
      <AlertTriangle size={13} />
      kernel error: {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Illustrative reference sequences for the uniformity scatter.       */
/*  (The convergence curves are the live kernel; these deterministic  */
/*   Halton / LCG sets just picture *why* QMC wins.)                   */
/* ------------------------------------------------------------------ */

function halton(i: number, base: number): number {
  let f = 1;
  let r = 0;
  let n = i;
  while (n > 0) {
    f /= base;
    r += f * (n % base);
    n = Math.floor(n / base);
  }
  return r;
}

function haltonPoints(count: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 1; i <= count; i++) pts.push([halton(i, 2), halton(i, 3)]);
  return pts;
}

function lcgPoints(count: number, seed: number): [number, number][] {
  // Numerical-Recipes LCG — a deterministic pseudorandom stream.
  let s = (seed * 2654435761 + 1013904223) >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pts: [number, number][] = [];
  for (let i = 0; i < count; i++) pts.push([next(), next()]);
  return pts;
}

/* ------------------------------------------------------------------ */
/*  Animated disk-estimator scatter (points landing, colored by disk)  */
/* ------------------------------------------------------------------ */

function ScatterCanvas({
  pts,
  accent,
  reduced,
  animKey,
  panelInView,
}: {
  pts: [number, number][];
  accent: string;
  reduced: boolean;
  animKey: string;
  panelInView?: { current: boolean };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const S = 320;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pad = 10;
    const span = S - 2 * pad;
    const cx = S / 2;
    const cy = S / 2;
    const R = span / 2;

    const paint = (progress: number) => {
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = SURFACE;
      ctx.fillRect(0, 0, S, S);

      // faint grid
      ctx.strokeStyle = `${SLATE}14`;
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g++) {
        const t = pad + (span * g) / 4;
        ctx.beginPath();
        ctx.moveTo(t, pad);
        ctx.lineTo(t, S - pad);
        ctx.moveTo(pad, t);
        ctx.lineTo(S - pad, t);
        ctx.stroke();
      }

      // inscribed disk (the estimator's integrand)
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(168,85,247,0.06)";
      ctx.fill();
      ctx.strokeStyle = `${VIOLET}77`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      const N = pts.length;
      for (let i = 0; i < N; i++) {
        const ti = (i / N) * 0.85;
        const a = Math.max(0, Math.min(1, (progress - ti) / 0.15));
        if (a <= 0) continue;
        const [px, py] = pts[i];
        const x = pad + px * span;
        const y = pad + py * span;
        const dx = px - 0.5;
        const dy = py - 0.5;
        const inside = dx * dx + dy * dy <= 0.25;
        ctx.globalAlpha = a * (inside ? 0.95 : 0.42);
        ctx.beginPath();
        ctx.arc(x, y, 2.1 * (0.6 + 0.4 * a), 0, Math.PI * 2);
        ctx.fillStyle = inside ? accent : SLATE;
        if (inside) {
          ctx.shadowColor = accent;
          ctx.shadowBlur = 5;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    };

    // Reduced-motion, or a reveal that landed while the panel is off-screen:
    // paint the final frame once, no rAF.
    if (reduced || (panelInView && !panelInView.current)) {
      paint(1);
      return;
    }
    const start = performance.now();
    const dur = 1300;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      paint(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [pts, accent, reduced, animKey, panelInView]);

  return (
    <canvas
      ref={ref}
      width={S}
      height={S}
      className="block w-full max-w-full rounded-lg border"
      style={{ aspectRatio: "1 / 1", borderColor: BORDER, background: SURFACE }}
      role="img"
      aria-label="Sample distribution over the unit square with the inscribed disk used to estimate pi."
    />
  );
}

interface QmcPoint {
  N: number;
  mc: number;
  qmc: number;
}

interface QmcState {
  maxLog2: number;
  points: QmcPoint[];
  ms: number;
}

const SEEDS = [1, 5, 17, 44, 99];

function fmtN(N: number): string {
  if (N >= 1000) return `${N / 1000}k`;
  return `${N}`;
}

export default function Qmc() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inViewRef } = useInView<HTMLDivElement>();

  const [maxLog2, setMaxLog2] = useState(16);
  const [seedIdx, setSeedIdx] = useState(0);
  const [showScatter, setShowScatter] = useState(true);
  const [computing, setComputing] = useState(false);
  const [state, setState] = useState<QmcState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    const seed = SEEDS[seedIdx % SEEDS.length];
    setComputing(true);
    setError(null);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const t0 = performance.now();
          const out = await call<Float64Array>("qmc_vs_mc", maxLog2, seed);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          const steps = out.length / 3;
          const points: QmcPoint[] = [];
          for (let i = 0; i < steps; i++) {
            points.push({ N: out[3 * i], mc: out[3 * i + 1], qmc: out[3 * i + 2] });
          }
          setState({ maxLog2, points, ms });
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 90);
    return () => clearTimeout(timer);
  }, [ready, maxLog2, seedIdx, call]);

  /* ---- log-log geometry ---- */
  const VW = 720;
  const VH = 360;
  const L = 58;
  const R = 20;
  const T = 22;
  const B = 46;
  const pw = VW - L - R;
  const ph = VH - T - B;

  const geom = useMemo(() => {
    if (!state || state.points.length === 0) return null;
    const l2min = 6;
    const l2max = state.maxLog2;
    let hi = -Infinity;
    let lo = Infinity;
    for (const p of state.points) {
      for (const e of [p.mc, p.qmc]) {
        if (e > 0 && isFinite(e)) {
          hi = Math.max(hi, Math.log10(e));
          lo = Math.min(lo, Math.log10(e));
        }
      }
    }
    const topDec = Math.ceil(hi + 0.001);
    const botDec = Math.floor(lo - 0.001);
    const yspan = Math.max(1, topDec - botDec);
    const xOf = (N: number) => L + ((Math.log2(N) - l2min) / (l2max - l2min)) * pw;
    const yOf = (e: number) => T + (1 - (Math.log10(Math.max(e, Math.pow(10, botDec))) - botDec) / yspan) * ph;

    const buildLine = (key: "mc" | "qmc") =>
      state.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.N).toFixed(2)} ${yOf(p[key]).toFixed(2)}`).join(" ");

    // filled "advantage" band between the two curves (the widening gap)
    const pts = state.points.map((p) => ({ x: xOf(p.N), yMc: yOf(p.mc), yQmc: yOf(p.qmc) }));
    let band = "";
    if (pts.length > 0) {
      band = `M ${pts[0].x.toFixed(2)} ${pts[0].yMc.toFixed(2)} `;
      for (let i = 1; i < pts.length; i++) band += `L ${pts[i].x.toFixed(2)} ${pts[i].yMc.toFixed(2)} `;
      for (let i = pts.length - 1; i >= 0; i--) band += `L ${pts[i].x.toFixed(2)} ${pts[i].yQmc.toFixed(2)} `;
      band += "Z";
    }

    const decades: number[] = [];
    for (let d = topDec; d >= botDec; d--) decades.push(d);
    const xTicks: number[] = [];
    for (let e = l2min; e <= l2max; e += 2) xTicks.push(Math.pow(2, e));

    // reference slope guides (dashed): p = -1/2 anchored to MC[0], p = -1 anchored to QMC[1]
    const mc0 = state.points[0];
    const qmcAnchor = state.points[Math.min(1, state.points.length - 1)];
    const guide = (anchorN: number, anchorE: number, p: number) => {
      const x1n = Math.pow(2, l2min);
      const x2n = Math.pow(2, l2max);
      const yAt = (N: number) => yOf(anchorE * Math.pow(N / anchorN, p));
      return {
        d: `M ${xOf(x1n).toFixed(2)} ${yAt(x1n).toFixed(2)} L ${xOf(x2n).toFixed(2)} ${yAt(x2n).toFixed(2)}`,
        endY: yAt(x2n),
      };
    };
    const guideHalf = guide(mc0.N, mc0.mc, -0.5);
    const guideOne = guide(qmcAnchor.N, qmcAnchor.qmc, -1);

    // gap bracket at the last N
    const last = state.points[state.points.length - 1];
    const gap = {
      x: xOf(last.N),
      yMc: yOf(last.mc),
      yQmc: yOf(last.qmc),
      ratio: last.qmc > 0 ? last.mc / last.qmc : 0,
      N: last.N,
    };

    return { xOf, yOf, buildLine, band, decades, xTicks, guideHalf, guideOne, gap, l2min, l2max };
  }, [state, pw, ph]);

  const last = state ? state.points[state.points.length - 1] : null;
  const ratio = last && last.qmc > 0 ? last.mc / last.qmc : 0;
  const easedRatioRef = useEasedText<HTMLSpanElement>(ratio, reduced, (v) => `${v.toFixed(0)}×`, {
    duration: 750,
    enabled: ratio >= 1,
    inViewRef,
  });
  const runKey = `${maxLog2}-${seedIdx}`;

  /* ---- scatter reference sets ---- */
  const scatter = useMemo(() => {
    const N = 256;
    return { halton: haltonPoints(N), lcg: lcgPoints(N, SEEDS[seedIdx % SEEDS.length]), N };
  }, [seedIdx]);

  return (
    <SyncContainer withPulse accentColor="#06b6d4" className="p-4 md:p-6 bg-black/40">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Eyebrow>Demo 09 · fs-rand · scrambled Sobol QMC</Eyebrow>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${CYAN}33`, background: `${CYAN}12`, color: CYAN }}
            >
              <TrendingDown className="h-5 w-5" />
            </div>
            <h3 className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              Beating <span className="text-cyan-400">√N</span>.
            </h3>
          </div>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* convergence plot */}
      <div ref={viewRef} className="min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full max-w-full"
          role="img"
          aria-label="Log-log convergence of integration error versus sample count: Monte-Carlo in amber with slope near minus one-half, and quasi-Monte-Carlo in cyan falling faster, with the widening advantage gap shaded emerald."
        >
          <defs>
            <radialGradient id="qmc-vignette" cx="50%" cy="35%" r="80%">
              <stop offset="0%" stopColor="#0b1a24" />
              <stop offset="100%" stopColor={SURFACE} />
            </radialGradient>
            <linearGradient id="qmc-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EMERALD} stopOpacity="0.02" />
              <stop offset="100%" stopColor={EMERALD} stopOpacity="0.16" />
            </linearGradient>
            <filter id="qmc-glow" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x={L} y={T} width={pw} height={ph} fill="url(#qmc-vignette)" stroke={BORDER} rx={4} />

          {geom && (
            <>
              {geom.decades.map((d) => (
                <g key={`dec-${d}`}>
                  <line x1={L} y1={geom.yOf(Math.pow(10, d))} x2={L + pw} y2={geom.yOf(Math.pow(10, d))} stroke={`${SLATE}18`} />
                  <text x={L - 8} y={geom.yOf(Math.pow(10, d)) + 3} textAnchor="end" fontFamily="monospace" fontSize={9} fill={MUTED}>
                    1e{d}
                  </text>
                </g>
              ))}
              {geom.xTicks.map((N) => (
                <g key={`x-${N}`}>
                  <line x1={geom.xOf(N)} y1={T} x2={geom.xOf(N)} y2={T + ph} stroke={`${SLATE}14`} />
                  <text x={geom.xOf(N)} y={T + ph + 16} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={MUTED}>
                    {fmtN(N)}
                  </text>
                </g>
              ))}

              {/* widening advantage band */}
              {geom.band && (
                <motion.path
                  key={`band-${runKey}`}
                  d={geom.band}
                  fill="url(#qmc-band)"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.6, delay: 0.9 }}
                />
              )}

              {/* reference slope guides */}
              <path d={geom.guideHalf.d} fill="none" stroke={`${AMBER}66`} strokeWidth={1} strokeDasharray="5 5" />
              <path d={geom.guideOne.d} fill="none" stroke={`${CYAN}66`} strokeWidth={1} strokeDasharray="5 5" />
              <text x={L + pw - 2} y={geom.guideHalf.endY - 4} textAnchor="end" fontFamily="monospace" fontSize={8} fill={`${AMBER}aa`}>
                ∝ 1/√N
              </text>
              <text x={L + pw - 2} y={geom.guideOne.endY + 10} textAnchor="end" fontFamily="monospace" fontSize={8} fill={`${CYAN}aa`}>
                ∝ 1/N
              </text>

              {/* MC series (draws on) */}
              <motion.path
                key={`mc-${runKey}`}
                d={geom.buildLine("mc")}
                fill="none"
                stroke={AMBER}
                strokeWidth={2}
                strokeLinejoin="round"
                opacity={0.92}
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reduced ? { duration: 0 } : { duration: 0.9, ease: "easeInOut" }}
              />
              {state?.points.map((p, i) => (
                <circle key={`mc-${i}`} cx={geom.xOf(p.N)} cy={geom.yOf(p.mc)} r={2.6} fill={AMBER} />
              ))}

              {/* QMC series (draws on) */}
              <motion.path
                key={`qmc-${runKey}`}
                d={geom.buildLine("qmc")}
                fill="none"
                stroke={CYAN_GLOW}
                strokeWidth={2.4}
                strokeLinejoin="round"
                filter="url(#qmc-glow)"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reduced ? { duration: 0 } : { duration: 0.9, ease: "easeInOut", delay: 0.15 }}
              />
              {state?.points.map((p, i) => (
                <circle key={`qmc-${i}`} cx={geom.xOf(p.N)} cy={geom.yOf(p.qmc)} r={2.8} fill={CYAN_GLOW} />
              ))}

              {/* gap bracket at final N */}
              <line x1={geom.gap.x} y1={geom.gap.yMc} x2={geom.gap.x} y2={geom.gap.yQmc} stroke={`${EMERALD}cc`} strokeWidth={1.6} />
              <line x1={geom.gap.x - 4} y1={geom.gap.yMc} x2={geom.gap.x + 4} y2={geom.gap.yMc} stroke={`${EMERALD}cc`} strokeWidth={1.6} />
              <line x1={geom.gap.x - 4} y1={geom.gap.yQmc} x2={geom.gap.x + 4} y2={geom.gap.yQmc} stroke={`${EMERALD}cc`} strokeWidth={1.6} />
              <rect
                x={geom.gap.x - 82}
                y={(geom.gap.yMc + geom.gap.yQmc) / 2 - 11}
                width={76}
                height={22}
                rx={5}
                fill={`${BG}ee`}
                stroke={`${EMERALD}88`}
              />
              <text
                x={geom.gap.x - 44}
                y={(geom.gap.yMc + geom.gap.yQmc) / 2 + 4}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize={12}
                fontWeight={800}
                fill={EMERALD}
              >
                {geom.gap.ratio >= 1 ? `${geom.gap.ratio.toFixed(0)}× gap` : "—"}
              </text>

              {/* legend */}
              <g transform={`translate(${L + pw - 168}, ${T + 8})`}>
                <rect x={0} y={0} width={160} height={54} rx={6} fill={`${BG}cc`} stroke={BORDER} />
                <line x1={10} y1={14} x2={26} y2={14} stroke={AMBER} strokeWidth={2} />
                <text x={32} y={17} fontFamily="monospace" fontSize={9} fill={MUTED}>
                  Monte-Carlo · Philox
                </text>
                <line x1={10} y1={30} x2={26} y2={30} stroke={CYAN_GLOW} strokeWidth={2} />
                <text x={32} y={33} fontFamily="monospace" fontSize={9} fill={MUTED}>
                  QMC · scrambled Sobol
                </text>
                <line x1={10} y1={45} x2={26} y2={45} stroke={`${SLATE}aa`} strokeWidth={1} strokeDasharray="4 3" />
                <text x={32} y={48} fontFamily="monospace" fontSize={8} fill={SLATE}>
                  ideal 1/√N &amp; 1/N slopes
                </text>
              </g>
            </>
          )}

          <text x={L + pw / 2} y={VH - 4} textAnchor="middle" fontFamily="monospace" fontSize={10} fill={MUTED}>
            samples N (log₂)
          </text>
          <text
            x={15}
            y={T + ph / 2}
            textAnchor="middle"
            fontFamily="monospace"
            fontSize={10}
            fill={MUTED}
            transform={`rotate(-90 15 ${T + ph / 2})`}
          >
            |estimate − π| (log)
          </text>

          {!ready && (
            <text x={VW / 2} y={VH / 2} textAnchor="middle" fontFamily="monospace" fontSize={12} fill={`${AMBER}cc`}>
              REANIMATING KERNEL…
            </text>
          )}
        </svg>
      </div>

      {/* gap hero */}
      <div className="mt-4 flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: `${EMERALD}33`, background: `linear-gradient(135deg, ${EMERALD}12, ${BG})` }}>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            accuracy gap at N = {last ? fmtN(last.N) : "—"}
          </div>
          <div className="font-mono text-[9px]" style={{ color: SLATE }}>
            same sample budget, less error — QMC breaks the pseudorandom 1/√N wall
          </div>
        </div>
        <div className="font-mono text-3xl font-black leading-none tabular-nums md:text-4xl" style={{ color: EMERALD }}>
          {ratio >= 1 ? <span ref={easedRatioRef} /> : "—"}
        </div>
      </div>

      {/* scatter inset */}
      {showScatter && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { title: "QMC · low-discrepancy (Halton 2,3)", pts: scatter.halton, color: CYAN_GLOW },
            { title: "pseudorandom (LCG)", pts: scatter.lcg, color: AMBER },
          ].map((s) => (
            <div key={s.title} className="min-w-0 space-y-1">
              <span className="block font-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: s.color }}>
                {s.title}
              </span>
              <ScatterCanvas pts={s.pts} accent={s.color} reduced={reduced} animKey={`${runKey}-${s.title}`} panelInView={inViewRef} />
            </div>
          ))}
          <p className="font-mono text-[10px] leading-relaxed sm:col-span-2" style={{ color: SLATE }}>
            Both sets throw {scatter.N} points at the unit square; the fraction landing inside the disk estimates π. The
            low-discrepancy set covers the square evenly, so the estimate is sharp; the pseudorandom points clump and
            leave gaps — that uniformity is <span style={{ color: CYAN_GLOW }}>why QMC converges faster</span>.{" "}
            <span style={{ color: MUTED }}>(illustrative reference sequences; the curves above are the live kernel)</span>
          </p>
        </div>
      )}

      {error && <div className="mt-3">{<ErrorNote message={error} />}</div>}

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          max N = 2^
        </span>
        {[12, 14, 16, 18].map((g) => (
          <Pill key={g} onClick={() => setMaxLog2(g)} active={maxLog2 === g} ariaLabel={`Sweep sample count up to two to the ${g}`} disabled={!ready}>
            {g} <span className="opacity-60">({fmtN(Math.pow(2, g))})</span>
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill onClick={() => setSeedIdx((s) => s + 1)} color={CYAN} ariaLabel="Draw a fresh random stream" disabled={!ready}>
          Reseed
        </Pill>
        <Pill onClick={() => setShowScatter((v) => !v)} active={showScatter} color={VIOLET} ariaLabel="Toggle point-uniformity scatter">
          Point scatter
        </Pill>
      </div>

      {/* readout */}
      <div className="mt-4 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> estimating π via the unit disk · N = 64…{fmtN(Math.pow(2, maxLog2))}
        {last ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> at N={fmtN(last.N)}: MC ={" "}
            <span style={{ color: AMBER }}>{last.mc.toExponential(2)}</span> · QMC ={" "}
            <span style={{ color: CYAN_GLOW }}>{last.qmc.toExponential(2)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{ratio >= 1 ? `${ratio.toFixed(0)}× better` : "—"}</span>{" "}
            <span style={{ color: MUTED }}>│</span> {state?.ms.toFixed(1)} ms
          </>
        ) : (
          <span style={{ color: MUTED }}> · reanimating kernel…</span>
        )}
      </div>

      {/* caption */}
      <div className="mt-5 border-t pt-4 text-sm leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Real low-discrepancy sampling:{" "}
        <span className="font-mono text-cyan-300">fs-rand</span>&apos;s scrambled-Sobol quasi-Monte-Carlo, estimating π
        by throwing points at the unit disk. Ordinary Monte-Carlo (Philox counter-based RNG) is stuck at the
        1/√N pseudorandom rate; QMC&apos;s carefully-spread points converge closer to 1/N, opening a{" "}
        {ratio >= 1 ? `${ratio.toFixed(0)}×` : "large"} accuracy gap by N={fmtN(Math.pow(2, maxLog2))}. Both curves are
        live kernel runs, and it is the same variance-reduction that makes high-dimensional finance and rendering
        integrals tractable.
      </div>
    </SyncContainer>
  );
}
