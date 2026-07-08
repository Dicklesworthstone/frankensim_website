"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { Layers, AlertTriangle } from "lucide-react";
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Viridis-style perceptual colormap (t ∈ [0,1]) — scientific field heat. */
const VIRIDIS: [number, number, number][] = [
  [68, 1, 84],
  [71, 44, 122],
  [59, 81, 139],
  [44, 113, 142],
  [33, 144, 141],
  [39, 173, 129],
  [92, 200, 99],
  [170, 220, 50],
  [253, 231, 37],
];
function viridis(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (VIRIDIS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = VIRIDIS[i];
  const b = VIRIDIS[Math.min(i + 1, VIRIDIS.length - 1)];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r},${g},${bl})`;
}

/** SSR-safe reduced-motion read (matches server render, then adopts pref). */
function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted ? !!rm : false;
}

/* ------------------------------------------------------------------ */
/*  Shared micro-UI                                                    */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="h-px w-8" style={{ background: `${CYAN}66` }} />
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
        {children}
      </span>
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
/*  Compute state                                                      */
/* ------------------------------------------------------------------ */

const SEEDS = [7, 13, 29, 42, 101];

interface RsvdState {
  n: number;
  rank: number;
  trueSv: number[];
  randSv: number[];
  reconErr: number;
  ms: number;
}

export default function Rsvd() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [n, setN] = useState(48);
  const [rank, setRank] = useState(10);
  const [seedIdx, setSeedIdx] = useState(0);
  const [computing, setComputing] = useState(false);
  const [state, setState] = useState<RsvdState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  const maxRank = Math.min(n, 16);
  const rk = Math.max(1, Math.min(rank, maxRank));

  // Keep the rank slider in range when n shrinks.
  useEffect(() => {
    if (rank > maxRank) setRank(maxRank);
  }, [maxRank, rank]);

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
          const out = await call<Float64Array>("randomized_svd", n, rk, seed);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          const trueSv = Array.from(out.slice(0, rk));
          const randSv = Array.from(out.slice(rk, 2 * rk));
          const reconErr = out[2 * rk];
          setState({ n, rank: rk, trueSv, randSv, reconErr, ms });
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 90);
    return () => clearTimeout(timer);
  }, [ready, n, rk, seedIdx, call]);

  /* ---- log-axis plot geometry ---- */
  const VW = 720;
  const VH = 320;
  const L = 60;
  const R = 52;
  const T = 26;
  const B = 46;
  const pw = VW - L - R;
  const ph = VH - T - B;

  const geom = useMemo(() => {
    if (!state) return null;
    const all = [...state.trueSv, ...state.randSv].filter((v) => v > 0 && isFinite(v));
    if (all.length === 0) return null;
    let hi = -Infinity;
    let lo = Infinity;
    for (const v of all) {
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
    }
    const topDec = Math.ceil(Math.log10(hi) + 0.001);
    const botDec = Math.floor(Math.log10(lo) - 0.001);
    const span = Math.max(1, topDec - botDec);
    const xOf = (i: number) =>
      state.rank === 1 ? L + pw / 2 : L + (i / (state.rank - 1)) * pw;
    const yOf = (v: number) => {
      const lg = Math.log10(Math.max(v, Math.pow(10, botDec)));
      return T + (1 - (lg - botDec) / span) * ph;
    };
    const truePts = state.trueSv.map((v, i) => ({ x: xOf(i), y: yOf(v), v, i }));
    const randPts = state.randSv.map((v, i) => ({ x: xOf(i), y: yOf(v), v, i }));
    const line = truePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const area =
      truePts.length > 0
        ? `${line} L ${truePts[truePts.length - 1].x.toFixed(2)} ${T + ph} L ${truePts[0].x.toFixed(2)} ${T + ph} Z`
        : "";
    const decades: number[] = [];
    for (let d = topDec; d >= botDec; d--) decades.push(d);

    // largest deviation between true and randomized (the accuracy story)
    let maxDev = 0;
    for (let i = 0; i < state.trueSv.length; i++) {
      const t = state.trueSv[i];
      const r = state.randSv[i];
      if (t > 0) maxDev = Math.max(maxDev, Math.abs(r - t) / t);
    }

    // captured Frobenius energy fraction = 1 - reconErr²  (optimal rank-k)
    const captured = Math.max(0, Math.min(1, 1 - state.reconErr * state.reconErr));
    // cumulative energy staircase from the real σ² (rises to `captured` at k)
    const sq = state.trueSv.map((v) => v * v);
    const sumK = sq.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    const yEnergy = (f: number) => T + (1 - f) * ph;
    const energyPts = sq.map((s, i) => {
      acc += s;
      const f = (acc / sumK) * captured;
      return { x: xOf(i), y: yEnergy(f), f, i };
    });
    const energyLine = energyPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

    // luminance normalization for the Σ heat tiles (log scale over the spectrum)
    const lgHi = Math.log10(hi);
    const lgLo = Math.log10(lo);
    const lgSpan = Math.max(1e-9, lgHi - lgLo);
    const heat = state.trueSv.map((v) => (Math.log10(Math.max(v, Math.pow(10, botDec))) - lgLo) / lgSpan);

    return {
      truePts,
      randPts,
      line,
      area,
      decades,
      yOf,
      yEnergy,
      energyLine,
      energyPts,
      topDec,
      botDec,
      maxDev,
      captured,
      heat,
    };
  }, [state, pw, ph, L, T]);

  const decadeSpan = state && geom ? geom.decades.length - 1 : 0;
  const runKey = `${n}-${rk}-${seedIdx}`;

  // eased hero readouts — written straight to their DOM nodes (no per-frame setState)
  const easedErrRef = useEasedText<HTMLSpanElement>(state ? state.reconErr * 100 : 0, reduced, (v) => `${v.toFixed(2)}%`, {
    duration: 750,
    enabled: !!state,
    inViewRef,
  });
  const easedCapturedRef = useEasedText<SVGTSpanElement>(geom ? geom.captured * 100 : 0, reduced, (v) => v.toFixed(1), {
    duration: 750,
    enabled: !!geom,
    inViewRef,
  });

  const gaugeR = 26;
  const gaugeC = 2 * Math.PI * gaugeR;

  return (
    <SyncContainer withPulse accentColor="#06b6d4" className="p-4 md:p-6 bg-black/40">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Eyebrow>Demo 06 · fs-la · randomized SVD</Eyebrow>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${CYAN}33`, background: `${CYAN}12`, color: CYAN }}
            >
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              Low-rank, found <span className="text-cyan-400">fast</span>.
            </h3>
          </div>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* hero: recon-error + energy gauge */}
      <div ref={viewRef} className="mb-4 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div
          className="relative flex items-center gap-4 overflow-hidden rounded-xl border px-4 py-3"
          style={{ borderColor: `${VIOLET}33`, background: `linear-gradient(135deg, ${VIOLET}14, ${BG})` }}
        >
          {/* radial captured-energy gauge */}
          <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0" aria-hidden="true">
            <circle cx={36} cy={36} r={gaugeR} fill="none" stroke={`${SLATE}33`} strokeWidth={6} />
            <motion.circle
              key={`gauge-${runKey}`}
              cx={36}
              cy={36}
              r={gaugeR}
              fill="none"
              stroke={EMERALD}
              strokeWidth={6}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
              strokeDasharray={gaugeC}
              initial={reduced ? false : { strokeDashoffset: gaugeC }}
              animate={{ strokeDashoffset: gaugeC * (1 - (geom ? geom.captured : 0)) }}
              transition={reduced ? { duration: 0 } : { duration: 1, ease: "easeOut" }}
              style={{ filter: `drop-shadow(0 0 4px ${EMERALD})` }}
            />
            <text x={36} y={33} textAnchor="middle" fontFamily="monospace" fontSize={13} fontWeight={800} fill={EMERALD}>
              {geom ? <tspan ref={easedCapturedRef} /> : "—"}
            </text>
            <text x={36} y={46} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={MUTED}>
              % energy
            </text>
          </svg>
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
              rank-{rk} reconstruction error
            </div>
            <div className="font-mono text-3xl font-black leading-none tabular-nums md:text-4xl" style={{ color: VIOLET }}>
              {state ? <span ref={easedErrRef} /> : "—"}
            </div>
            <div className="mt-1 font-mono text-[9px]" style={{ color: SLATE }}>
              ‖A − Aₖ‖_F / ‖A‖_F · captured {geom ? `${(geom.captured * 100).toFixed(1)}%` : "—"} of the operator
            </div>
          </div>
        </div>

        {/* Σ diagonal heat grid — the operator in its singular basis */}
        <div className="rounded-xl border px-3 py-2" style={{ borderColor: BORDER, background: BG }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: MUTED }}>
              Σ = diag(σ₁…σ_{rk})
            </span>
            <span className="font-mono text-[8px]" style={{ color: SLATE }}>
              A = UΣVᵀ
            </span>
          </div>
          <svg viewBox="0 0 100 100" className="block w-full max-w-full" role="img" aria-label="The operator diagonalized into its singular basis: a matrix whose glowing diagonal holds the singular values.">
            {geom &&
              state &&
              (() => {
                const k = state.rank;
                const cell = 100 / k;
                const tiles = [];
                for (let r = 0; r < k; r++) {
                  for (let c = 0; c < k; c++) {
                    const onDiag = r === c;
                    tiles.push(
                      <rect
                        key={`${r}-${c}`}
                        x={c * cell + 0.4}
                        y={r * cell + 0.4}
                        width={cell - 0.8}
                        height={cell - 0.8}
                        rx={Math.min(1.2, cell * 0.12)}
                        fill={onDiag ? viridis(geom.heat[r]) : "#0a1620"}
                        stroke={onDiag ? "none" : `${SLATE}14`}
                        strokeWidth={0.3}
                        opacity={onDiag ? 1 : 0.9}
                      >
                        {onDiag && !reduced && inView && (
                          <animate
                            attributeName="opacity"
                            values="0.85;1;0.85"
                            dur={`${2.4 + r * 0.12}s`}
                            repeatCount="indefinite"
                          />
                        )}
                      </rect>,
                    );
                  }
                }
                return <g style={{ filter: "drop-shadow(0 0 2px rgba(34,211,238,0.35))" }}>{tiles}</g>;
              })()}
          </svg>
        </div>
      </div>

      {/* spectrum plot */}
      <div className="min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full max-w-full"
          role="img"
          aria-label="Singular-value spectrum on a logarithmic axis: the true singular values as a cyan curve with the randomized-SVD estimates as violet rings landing on top of them, and the cumulative captured-energy climbing in emerald."
        >
          <defs>
            <linearGradient id="rsvd-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CYAN_GLOW} stopOpacity="0.34" />
              <stop offset="100%" stopColor={CYAN} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="rsvd-energy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EMERALD} stopOpacity="0.22" />
              <stop offset="100%" stopColor={EMERALD} stopOpacity="0" />
            </linearGradient>
            <radialGradient id="rsvd-vignette" cx="50%" cy="40%" r="75%">
              <stop offset="0%" stopColor="#0b1a24" />
              <stop offset="100%" stopColor={SURFACE} />
            </radialGradient>
            <filter id="rsvd-glow" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="rsvd-reveal">
              <motion.rect
                key={`rev-${runKey}`}
                x={L}
                y={T - 10}
                height={ph + 20}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: pw }}
                transition={reduced ? { duration: 0 } : { duration: 1.05, ease: "easeInOut" }}
              />
            </clipPath>
          </defs>

          <rect x={L} y={T} width={pw} height={ph} fill="url(#rsvd-vignette)" stroke={BORDER} rx={4} />

          {/* left log gridlines */}
          {geom &&
            geom.decades.map((d) => (
              <g key={`dec-${d}`}>
                <line x1={L} y1={geom.yOf(Math.pow(10, d))} x2={L + pw} y2={geom.yOf(Math.pow(10, d))} stroke={`${SLATE}1c`} />
                <text x={L - 8} y={geom.yOf(Math.pow(10, d)) + 3} textAnchor="end" fontFamily="monospace" fontSize={9} fill={MUTED}>
                  1e{d}
                </text>
              </g>
            ))}

          {/* right energy axis (0/50/100%) */}
          {geom &&
            [0, 0.5, 1].map((f) => (
              <text key={`e-${f}`} x={L + pw + 8} y={geom.yEnergy(f) + 3} textAnchor="start" fontFamily="monospace" fontSize={8} fill={`${EMERALD}bb`}>
                {Math.round(f * 100)}%
              </text>
            ))}

          {geom && (
            <g clipPath="url(#rsvd-reveal)">
              {/* cumulative captured-energy area + line */}
              {geom.energyPts.length > 0 && (
                <path
                  d={`${geom.energyLine} L ${geom.energyPts[geom.energyPts.length - 1].x.toFixed(2)} ${T + ph} L ${geom.energyPts[0].x.toFixed(2)} ${T + ph} Z`}
                  fill="url(#rsvd-energy)"
                />
              )}
              <path d={geom.energyLine} fill="none" stroke={`${EMERALD}cc`} strokeWidth={1.6} strokeDasharray="4 4" strokeLinejoin="round" />

              {/* true-spectrum area + curve */}
              {geom.area && <path d={geom.area} fill="url(#rsvd-fill)" />}
              {/* luminous stems */}
              {geom.truePts.map((p) => (
                <line key={`stem-${p.i}`} x1={p.x} y1={T + ph} x2={p.x} y2={p.y} stroke={`${CYAN}44`} strokeWidth={1} />
              ))}
              <path d={geom.line} fill="none" stroke={CYAN_GLOW} strokeWidth={2.4} strokeLinejoin="round" filter="url(#rsvd-glow)" />
              {geom.truePts.map((p) => (
                <circle key={`t-${p.i}`} cx={p.x} cy={p.y} r={2.6} fill={CYAN_GLOW} />
              ))}
            </g>
          )}

          {/* randomized rings snap onto the true spectrum (staggered land) */}
          {geom &&
            geom.randPts.map((p) => (
              <motion.g
                key={`r-${runKey}-${p.i}`}
                initial={reduced ? false : { opacity: 0, scale: 1.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduced ? { duration: 0 } : { duration: 0.4, delay: 0.35 + (p.i / Math.max(1, geom.randPts.length)) * 0.75, ease: "backOut" }}
                style={{ transformOrigin: "center", transformBox: "fill-box" } as React.CSSProperties}
              >
                <circle cx={p.x} cy={p.y} r={5} fill="none" stroke={VIOLET} strokeWidth={1.8} />
                <circle cx={p.x} cy={p.y} r={1.4} fill={VIOLET} />
              </motion.g>
            ))}

          {/* σ₁ callout */}
          {geom && geom.truePts[0] && (
            <text x={geom.truePts[0].x + 8} y={geom.truePts[0].y - 6} fontFamily="monospace" fontSize={9} fontWeight={700} fill={CYAN_GLOW}>
              σ₁
            </text>
          )}

          {/* legend */}
          {geom && (
            <g transform={`translate(${L + 10}, ${T + 6})`}>
              <line x1={0} y1={5} x2={16} y2={5} stroke={CYAN_GLOW} strokeWidth={2.2} />
              <text x={22} y={8} fontFamily="monospace" fontSize={9} fill={MUTED}>
                true σᵢ (dense SVD)
              </text>
              <circle cx={8} cy={19} r={4} fill="none" stroke={VIOLET} strokeWidth={1.8} />
              <text x={22} y={22} fontFamily="monospace" fontSize={9} fill={MUTED}>
                randomized σ̂ᵢ (sketch-and-solve)
              </text>
              <line x1={0} y1={32} x2={16} y2={32} stroke={`${EMERALD}cc`} strokeWidth={1.6} strokeDasharray="4 4" />
              <text x={22} y={35} fontFamily="monospace" fontSize={9} fill={MUTED}>
                cumulative energy captured
              </text>
            </g>
          )}

          <text x={L + pw / 2} y={VH - 4} textAnchor="middle" fontFamily="monospace" fontSize={10} fill={MUTED}>
            singular-value index i — descending
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
            σ (log)
          </text>

          {!ready && (
            <text x={VW / 2} y={VH / 2} textAnchor="middle" fontFamily="monospace" fontSize={12} fill={`${AMBER}cc`}>
              REANIMATING KERNEL…
            </text>
          )}
        </svg>
      </div>

      {/* stat cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${CYAN}33`, background: `${CYAN}0d` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            spectrum decay
          </div>
          <div className="font-mono text-2xl font-black tabular-nums" style={{ color: CYAN_GLOW }}>
            {geom ? `${decadeSpan}×` : "—"}
          </div>
          <div className="font-mono text-[9px]" style={{ color: SLATE }}>
            decades from σ₁ to σ_k
          </div>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${EMERALD}33`, background: `${EMERALD}0d` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            sketch accuracy
          </div>
          <div className="font-mono text-2xl font-black tabular-nums" style={{ color: EMERALD }}>
            {geom ? `${(geom.maxDev * 100).toFixed(2)}%` : "—"}
          </div>
          <div className="font-mono text-[9px]" style={{ color: SLATE }}>
            max |σ̂ᵢ − σᵢ| / σᵢ
          </div>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${VIOLET}33`, background: `${VIOLET}0d` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            σ₁ (leading)
          </div>
          <div className="font-mono text-2xl font-black tabular-nums" style={{ color: VIOLET }}>
            {state && state.trueSv[0] != null ? state.trueSv[0].toFixed(3) : "—"}
          </div>
          <div className="font-mono text-[9px]" style={{ color: SLATE }}>
            dominant singular value
          </div>
        </div>
      </div>

      {error && <div className="mt-3">{<ErrorNote message={error} />}</div>}

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          matrix n
        </span>
        {[16, 32, 48, 64].map((g) => (
          <Pill key={g} onClick={() => setN(g)} active={n === g} ariaLabel={`Set matrix size to ${g} by ${g}`} disabled={!ready}>
            {g}×{g}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
            rank k = {rk}
          </span>
          <input
            type="range"
            min={1}
            max={maxRank}
            step={1}
            value={rk}
            onChange={(e) => setRank(parseInt(e.target.value, 10))}
            disabled={!ready}
            aria-label="Target rank k"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 disabled:opacity-40"
            style={{ accentColor: VIOLET }}
          />
        </div>
        <Pill onClick={() => setSeedIdx((s) => s + 1)} color={CYAN} ariaLabel="Draw a fresh random sketch" disabled={!ready}>
          Resample sketch
        </Pill>
      </div>

      {/* readout */}
      <div className="mt-4 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {n}×{n} symmetric RBF kernel + noise · rank-{rk} sketch
        {state ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> σ₁ = <span style={{ color: CYAN_GLOW }}>{state.trueSv[0]?.toFixed(4)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> recon err ={" "}
            <span style={{ color: VIOLET }}>{state.reconErr.toExponential(3)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> {state.ms.toFixed(1)} ms
          </>
        ) : (
          <span style={{ color: MUTED }}> · reanimating kernel…</span>
        )}
      </div>

      {/* caption */}
      <div className="mt-5 border-t pt-4 text-sm leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Real randomized numerical linear algebra:{" "}
        <span className="font-mono text-cyan-300">fs-la</span>&apos;s <span className="font-mono text-cyan-300">rsvd</span>,{" "}
        or sketch-and-solve. A small Gaussian sketch projects the {n}×{n} operator onto a rank-{rk} subspace, then a
        tiny dense SVD recovers the leading singular values. The violet estimates land on the cyan true spectrum across
        many decades, the emerald curve tracks how quickly a low-rank slice captures the operator&apos;s whole energy, and
        the reconstruction error is measured against the full matrix. It is the algorithm behind modern large-scale
        SVD, PCA and recommender systems, running as a genuine eigensolve inside a Web Worker.
      </div>
    </SyncContainer>
  );
}
