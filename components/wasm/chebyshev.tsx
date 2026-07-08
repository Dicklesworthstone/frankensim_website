"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { cn } from "@/lib/utils";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";

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

const SAMPLES = 320;

const FUNCS: { kind: number; label: string; tex: string }[] = [
  { kind: 0, label: "Runge", tex: "1 / (1 + 25x²)" },
  { kind: 1, label: "sin(6x)", tex: "sin(6x)" },
  { kind: 2, label: "tanh(6x)", tex: "tanh(6x)" },
  { kind: 3, label: "gaussian", tex: "exp(−4x²)" },
];

function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted ? !!rm : false;
}

/** Cascade an integer mode index 0→deg over `totalMs`, restarting on key change. */
function useModeReveal(
  deg: number,
  restartKey: number,
  reduced: boolean,
  inViewRef?: { current: boolean },
  totalMs = 1500,
): number {
  const [m, setM] = useState(deg);
  useEffect(() => {
    if (deg <= 0 || reduced) {
      const id = requestAnimationFrame(() => setM(deg <= 0 ? 0 : deg));
      return () => cancelAnimationFrame(id);
    }
    // Off-screen: snap to the fully-revealed state, run no rAF cascade.
    if (inViewRef && !inViewRef.current) {
      setM(deg);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / totalMs);
      // ease-out so the first modes snap in fast, then it settles (first tick sets 0)
      const e = 1 - Math.pow(1 - t, 2.2);
      setM(Math.round(e * deg));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deg, restartKey, reduced, totalMs, inViewRef]);
  return m;
}

function LiveBadge({ computing }: { computing: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.2em]"
      style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d`, color: CYAN_GLOW }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full animate-pulse"
        style={{ background: computing ? AMBER : EMERALD, boxShadow: "0 0 6px currentColor" }}
      />
      Computed live in WASM
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

interface FitData {
  f: Float64Array;
  p: Float64Array;
  dp: Float64Array;
  spectrum: Float64Array;
  ms: number;
}

export default function Chebyshev() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inViewRef } = useInView<HTMLDivElement>();

  const [kind, setKind] = useState(0);
  const [data, setData] = useState<FitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const [fit, spectrum] = await Promise.all([
          call<Float64Array>("chebyshev_fit", kind, SAMPLES),
          call<Float64Array>("chebyshev_spectrum", kind),
        ]);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const f = new Float64Array(SAMPLES);
        const p = new Float64Array(SAMPLES);
        const dp = new Float64Array(SAMPLES);
        for (let i = 0; i < SAMPLES; i++) {
          f[i] = fit[i * 3];
          p[i] = fit[i * 3 + 1];
          dp[i] = fit[i * 3 + 2];
        }
        setData({ f, p, dp, spectrum, ms });
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, kind, call]);

  /* -- reconstruct partial Chebyshev sums from the REAL coefficients -- */
  const recon = useMemo(() => {
    if (!data) return null;
    const c = data.spectrum;
    const deg = c.length - 1;
    if (deg < 1) return { partials: [data.p.slice()], offset: 0, matched: true, deg: 0 };
    const xs = new Float64Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) xs[i] = -1 + (2 * i) / (SAMPLES - 1);
    const partials: Float64Array[] = [];
    const acc = new Float64Array(SAMPLES);
    const Tkm1 = new Float64Array(SAMPLES); // T_{k-1}
    const Tk = new Float64Array(SAMPLES); // T_k
    for (let i = 0; i < SAMPLES; i++) {
      acc[i] = c[0]; // convention A: full c0 (T0 = 1)
      Tkm1[i] = 1;
      Tk[i] = xs[i];
    }
    partials.push(acc.slice());
    for (let k = 1; k <= deg; k++) {
      for (let i = 0; i < SAMPLES; i++) acc[i] += c[k] * Tk[i];
      partials.push(acc.slice());
      for (let i = 0; i < SAMPLES; i++) {
        const tn = 2 * xs[i] * Tk[i] - Tkm1[i];
        Tkm1[i] = Tk[i];
        Tk[i] = tn;
      }
    }
    // Detect the c0 convention by matching the full sum to the kernel's p(x).
    let errA = 0;
    let errB = 0;
    let scale = 1e-9;
    const full = partials[deg];
    for (let i = 0; i < SAMPLES; i++) {
      scale = Math.max(scale, Math.abs(data.p[i]));
      errA = Math.max(errA, Math.abs(full[i] - data.p[i]));
      errB = Math.max(errB, Math.abs(full[i] - c[0] / 2 - data.p[i]));
    }
    const offset = errB < errA ? -c[0] / 2 : 0;
    const matched = Math.min(errA, errB) < 1e-3 * scale;
    return { partials, offset, matched, deg };
  }, [data]);

  const deg = recon?.deg ?? 0;
  const revealM = useModeReveal(deg, kind, reduced, inViewRef);
  const shownM = Math.min(deg, revealM);

  /* -- (a) approximation plot (dual y-axis) -- */
  const FW = 380;
  const FH = 280;
  const fL = 40;
  const fR = 38;
  const fT = 16;
  const fB = 26;
  const fpw = FW - fL - fR;
  const fph = FH - fT - fB;

  const fitGeom = useMemo(() => {
    if (!data) return null;
    let fMax = 1e-9;
    let ppMax = 1e-9;
    for (let i = 0; i < SAMPLES; i++) {
      fMax = Math.max(fMax, Math.abs(data.f[i]), Math.abs(data.p[i]));
      ppMax = Math.max(ppMax, Math.abs(data.dp[i]));
    }
    fMax *= 1.1;
    ppMax *= 1.1;
    const xOf = (i: number) => fL + (i / (SAMPLES - 1)) * fpw;
    const yPrim = (v: number) => fT + (1 - (v + fMax) / (2 * fMax)) * fph;
    const ySec = (v: number) => fT + (1 - (v + ppMax) / (2 * ppMax)) * fph;
    const path = (arr: Float64Array, map: (v: number) => number) =>
      Array.from(arr, (v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(2)} ${map(v).toFixed(2)}`).join(" ");
    return { fPath: path(data.f, yPrim), pPath: path(data.p, yPrim), dpPath: path(data.dp, ySec), xOf, yPrim, y0: yPrim(0), ppMax, fMax };
  }, [data, fpw, fph]);

  /* -- partial-sum "lock-on" path + residual at the current mode -- */
  const lockGeom = useMemo(() => {
    if (!data || !fitGeom || !recon || !recon.matched) return null;
    const arr = recon.partials[Math.min(shownM, recon.deg)];
    const off = recon.offset;
    let d = "";
    let maxRes = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const v = arr[i] + off;
      d += `${i === 0 ? "M" : "L"} ${fitGeom.xOf(i).toFixed(2)} ${fitGeom.yPrim(v).toFixed(2)} `;
      maxRes = Math.max(maxRes, Math.abs(data.f[i] - v));
    }
    return { path: d, maxRes };
  }, [data, fitGeom, recon, shownM]);

  const locked = recon?.matched && shownM >= deg;

  /* -- (b) spectrum staircase (log y) -- */
  const SW = 380;
  const SH = 280;
  const sL = 48;
  const sR = 14;
  const sT = 16;
  const sB = 26;
  const spw = SW - sL - sR;
  const sph = SH - sT - sB;
  const LOG_FLOOR = -16;

  const specGeom = useMemo(() => {
    if (!data) return null;
    const c = data.spectrum;
    const d = c.length - 1;
    const logs = Array.from(c, (v) => Math.log10(Math.max(Math.abs(v), 1e-17)));
    let top = -Infinity;
    for (const l of logs) top = Math.max(top, l);
    top = Math.max(0, Math.ceil(top));
    const bottom = LOG_FLOOR;
    const xOf = (k: number) => sL + (d <= 0 ? 0.5 : k / d) * spw;
    const yOf = (logv: number) => sT + (1 - (Math.max(logv, bottom) - bottom) / (top - bottom)) * sph;
    const y0 = yOf(bottom);
    const bars = logs.map((l, k) => ({ x: xOf(k), y: yOf(l), k, log: l }));
    const stepD = bars
      .map((b, i) => (i === 0 ? `M ${b.x.toFixed(2)} ${b.y.toFixed(2)}` : `L ${bars[i].x.toFixed(2)} ${bars[i - 1].y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`))
      .join(" ");
    const ticks: number[] = [];
    for (let e = top; e >= bottom; e -= 4) ticks.push(e);
    // whichever k first drops to the machine-precision floor
    let floorK: number | null = null;
    for (let k = 0; k < logs.length; k++) {
      if (logs[k] <= bottom + 1) {
        floorK = k;
        break;
      }
    }
    // least-squares spectral slope over the descending region
    const kEnd = floorK ?? d;
    let slopeLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
    let perDecade: number | null = null;
    if (kEnd >= 3) {
      let n = 0;
      let sk = 0;
      let sl = 0;
      let skk = 0;
      let skl = 0;
      for (let k = 1; k <= kEnd; k++) {
        if (logs[k] <= bottom + 0.5) break;
        n++;
        sk += k;
        sl += logs[k];
        skk += k * k;
        skl += k * logs[k];
      }
      if (n >= 3) {
        const denom = n * skk - sk * sk;
        if (denom !== 0) {
          const slope = (n * skl - sk * sl) / denom;
          const intercept = (sl - slope * sk) / n;
          if (slope < 0) {
            const k1 = 1;
            const k2 = kEnd;
            slopeLine = { x1: xOf(k1), y1: yOf(intercept + slope * k1), x2: xOf(k2), y2: yOf(intercept + slope * k2) };
            perDecade = -1 / slope; // modes per decade of accuracy
          }
        }
      }
    }
    return { bars, stepD, ticks, yOf, xOf, y0, deg: d, top, bottom, floorK, slopeLine, perDecade };
  }, [data, spw, sph]);

  const active = FUNCS[kind];

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Demo 03 · fs-cheb · collocation
            </span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Spectral <span className="text-violet-400">accuracy</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid gap-4 md:grid-cols-2">
        {/* (a) approximation */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
              f(x) · p(x) · p′(x)
            </span>
            <span className="font-mono text-[9px]" style={{ color: CYAN_GLOW }}>
              {active.tex}
            </span>
          </div>
          <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
            {/* mode / residual HUD */}
            {recon?.matched && (
              <div
                className="pointer-events-none absolute right-2 top-2 z-10 rounded-md border px-2 py-1 font-mono backdrop-blur-sm"
                style={{ borderColor: `${(locked ? EMERALD : VIOLET)}55`, background: "rgba(4,9,13,0.7)" }}
              >
                <div className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  modes
                </div>
                <div className="text-[13px] font-black tabular-nums" style={{ color: locked ? EMERALD : VIOLET }}>
                  {shownM}
                  <span className="text-[9px]" style={{ color: MUTED }}>
                    /{deg}
                  </span>
                </div>
                <div className="mt-0.5 text-[8px] tabular-nums" style={{ color: locked ? EMERALD : AMBER }}>
                  max|f−p| {lockGeom ? lockGeom.maxRes.toExponential(1) : "—"}
                </div>
              </div>
            )}
            <svg
              viewBox={`0 0 ${FW} ${FH}`}
              className="block w-full max-w-full"
              role="img"
              aria-label="The target function and its Chebyshev approximation locking on as modes accumulate, plus the exact derivative on a secondary axis."
            >
              <defs>
                <filter id="cb-glow" x="-30%" y="-60%" width="160%" height="220%">
                  <feGaussianBlur stdDeviation="2.6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect x={fL} y={fT} width={fpw} height={fph} fill={SURFACE} stroke={BORDER} />
              {fitGeom && (
                <>
                  <line x1={fL} y1={fitGeom.y0} x2={fL + fpw} y2={fitGeom.y0} stroke={`${SLATE}22`} />
                  {/* exact derivative on secondary axis (amber) */}
                  <path d={fitGeom.dpPath} fill="none" stroke={`${AMBER}bb`} strokeWidth={1.4} strokeLinejoin="round" />
                  {/* true function (cyan, glow) */}
                  <path d={fitGeom.fPath} fill="none" stroke={CYAN_GLOW} strokeWidth={3.6} strokeLinejoin="round" filter="url(#cb-glow)" />
                  {/* animated partial-sum "lock-on" (real reconstruction) OR the exact fit */}
                  {lockGeom ? (
                    <path
                      d={lockGeom.path}
                      fill="none"
                      stroke={locked ? "#f0abfc" : VIOLET}
                      strokeWidth={1.7}
                      strokeDasharray={locked ? undefined : "5 4"}
                      strokeLinejoin="round"
                      style={{ filter: locked ? `drop-shadow(0 0 4px ${VIOLET})` : undefined }}
                    />
                  ) : reduced ? (
                    <path d={fitGeom.pPath} fill="none" stroke={VIOLET} strokeWidth={1.6} strokeDasharray="4 4" strokeLinejoin="round" />
                  ) : (
                    <motion.path
                      key={kind}
                      d={fitGeom.pPath}
                      fill="none"
                      stroke={VIOLET}
                      strokeWidth={1.6}
                      strokeDasharray="4 4"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0, opacity: 0.35 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  )}
                  <text x={fL + 6} y={fT + 12} fontFamily="monospace" fontSize={9} fill={locked ? EMERALD : CYAN_GLOW}>
                    {locked ? "f = p — locked to machine ε" : "p locking onto f…"}
                  </text>
                  <text
                    x={fL + fpw + 6}
                    y={fT + 4}
                    fontFamily="monospace"
                    fontSize={8}
                    fill={AMBER}
                    transform={`rotate(90 ${fL + fpw + 6} ${fT + 4})`}
                  >
                    p′(x) · ±{fitGeom.ppMax.toFixed(1)}
                  </text>
                </>
              )}
              {!ready && (
                <text x={FW / 2} y={FH / 2} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={800} letterSpacing="3" fill={`${AMBER}dd`}>
                  REANIMATING…
                </text>
              )}
              <text x={fL + fpw / 2} y={FH - 6} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={MUTED}>
                x ∈ [−1, 1]
              </text>
            </svg>
          </div>
        </div>

        {/* (b) spectrum */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
              coefficient magnitude |cₖ|
            </span>
            <span className="font-mono text-[9px]" style={{ color: VIOLET }}>
              log scale
            </span>
          </div>
          <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
            <svg
              viewBox={`0 0 ${SW} ${SH}`}
              className="block w-full max-w-full"
              role="img"
              aria-label="Chebyshev coefficient magnitudes on a logarithmic axis, cascading down toward machine precision — the spectral-decay staircase."
            >
              <defs>
                <linearGradient id="cb-stair" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={CYAN_GLOW} />
                  <stop offset="100%" stopColor={VIOLET} />
                </linearGradient>
                <filter id="cb-dotglow" x="-200%" y="-200%" width="500%" height="500%">
                  <feGaussianBlur stdDeviation="2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect x={sL} y={sT} width={spw} height={sph} fill={SURFACE} stroke={BORDER} />
              {specGeom && (
                <>
                  {specGeom.ticks.map((e) => (
                    <g key={`e-${e}`}>
                      <line x1={sL} y1={specGeom.yOf(e)} x2={sL + spw} y2={specGeom.yOf(e)} stroke={`${SLATE}18`} />
                      <text x={sL - 6} y={specGeom.yOf(e) + 3} textAnchor="end" fontFamily="monospace" fontSize={8} fill={MUTED}>
                        1e{e}
                      </text>
                    </g>
                  ))}
                  {/* machine-precision floor */}
                  <line x1={sL} y1={specGeom.yOf(-16)} x2={sL + spw} y2={specGeom.yOf(-16)} stroke={`${EMERALD}88`} strokeWidth={1} strokeDasharray="4 3" />
                  <text x={sL + spw - 3} y={specGeom.yOf(-16) - 4} textAnchor="end" fontFamily="monospace" fontSize={8} fontWeight={700} fill={EMERALD}>
                    machine ε
                  </text>
                  {/* spectral-slope guide */}
                  {specGeom.slopeLine && (
                    <line
                      x1={specGeom.slopeLine.x1}
                      y1={specGeom.slopeLine.y1}
                      x2={specGeom.slopeLine.x2}
                      y2={specGeom.slopeLine.y2}
                      stroke={`${AMBER}88`}
                      strokeWidth={1}
                      strokeDasharray="2 4"
                    />
                  )}
                  {/* stepped connector */}
                  <path d={specGeom.stepD} fill="none" stroke={`${CYAN}44`} strokeWidth={1} />
                  {/* luminous stems + dots, cascading in */}
                  {specGeom.bars.map((b) => {
                    const on = b.k <= shownM;
                    return (
                      <g key={b.k} style={{ opacity: on ? 1 : 0.08, transition: reduced ? undefined : "opacity 120ms linear" }}>
                        <line x1={b.x} y1={specGeom.y0} x2={b.x} y2={b.y} stroke="url(#cb-stair)" strokeWidth={1.6} opacity={0.55} />
                        <circle cx={b.x} cy={b.y} r={2.4} fill={b.k <= (specGeom.floorK ?? specGeom.deg) ? CYAN_GLOW : `${VIOLET}cc`} filter="url(#cb-dotglow)" />
                      </g>
                    );
                  })}
                  {/* resolved-degree marker */}
                  {specGeom.floorK != null && (
                    <line
                      x1={specGeom.xOf(specGeom.floorK)}
                      y1={sT}
                      x2={specGeom.xOf(specGeom.floorK)}
                      y2={sT + sph}
                      stroke={`${EMERALD}55`}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  )}
                </>
              )}
              {!ready && (
                <text x={SW / 2} y={SH / 2} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={800} letterSpacing="3" fill={`${AMBER}dd`}>
                  REANIMATING…
                </text>
              )}
              <text x={sL + spw / 2} y={SH - 6} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={MUTED}>
                Chebyshev mode k
              </text>
            </svg>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="mt-3 rounded-md border px-3 py-2 font-mono text-[11px]"
          style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}
        >
          kernel error: {error}
        </div>
      )}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          function
        </span>
        {FUNCS.map((fn) => (
          <Pill
            key={fn.kind}
            onClick={() => setKind(fn.kind)}
            active={kind === fn.kind}
            color={fn.kind === 3 ? VIOLET : CYAN}
            ariaLabel={`Approximate ${fn.label}`}
            disabled={!ready}
          >
            {fn.label}
          </Pill>
        ))}
      </div>

      {/* Readout */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span> {SAMPLES} samples · f = {active.tex}
        {specGeom ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> resolved degree ={" "}
            <span style={{ color: VIOLET }}>{specGeom.deg}</span>
            {specGeom.perDecade != null ? (
              <>
                {" "}
                <span style={{ color: MUTED }}>│</span>{" "}
                <span style={{ color: AMBER }}>≈ {specGeom.perDecade.toFixed(1)} modes / decade</span>
              </>
            ) : null}
            {specGeom.floorK != null ? (
              <>
                {" "}
                <span style={{ color: MUTED }}>│</span>{" "}
                <span style={{ color: EMERALD }}>|cₖ| hits ε by k = {specGeom.floorK}</span>
              </>
            ) : null}
          </>
        ) : null}
        {data ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> {data.ms.toFixed(1)} ms
          </>
        ) : null}
      </div>

      {/* Caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Watch the violet Chebyshev interpolant <span className="text-slate-200">lock onto the cyan target</span> as
        modes accumulate, reconstructed live from the real coefficients, until the two curves sit exactly on top of
        each other. Spectral methods converge exponentially, so a modest number of modes pins a smooth function to
        machine precision. On the right, those same coefficient magnitudes cascade down the log staircase into the{" "}
        <span style={{ color: EMERALD }}>floating-point floor</span> along a straight spectral slope: the
        signature of exponential accuracy. Every value comes from a live fs-cheb solve.
      </div>
    </SyncContainer>
  );
}
