"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
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
const ROSE = "#f43f5e";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";

const AD_SAMPLES = 220;
const FD_STEPS = 40;
const AD_ERR = 1e-16; // forward-mode AD ≈ machine precision, independent of any step size

function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted ? !!rm : false;
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

function AnimatedPath({
  d,
  reduced,
  drawKey,
  stroke,
  strokeWidth,
  filter,
}: {
  d: string;
  reduced: boolean;
  drawKey: number;
  stroke: string;
  strokeWidth: number;
  filter?: string;
}) {
  if (reduced) {
    return <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" filter={filter} />;
  }
  return (
    <motion.path
      key={drawKey}
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      filter={filter}
      initial={{ pathLength: 0, opacity: 0.35 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    />
  );
}

interface DerivData {
  x: Float64Array;
  f: Float64Array;
  fp: Float64Array;
  fpp: Float64Array;
  ms: number;
}

interface FdData {
  hs: number[];
  errs: number[];
  bestH: number;
  bestErr: number;
  ms: number;
}

export default function Autodiff() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [x0, setX0] = useState(1.0);
  const [deriv, setDeriv] = useState<DerivData | null>(null);
  const [fd, setFd] = useState<FdData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const derivToken = useRef(0);
  const fdToken = useRef(0);

  /* -- derivatives (independent of x0) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++derivToken.current;
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("autodiff_derivatives", -5, 5, AD_SAMPLES);
        const ms = performance.now() - t0;
        if (derivToken.current !== token) return;
        const x = new Float64Array(AD_SAMPLES);
        const f = new Float64Array(AD_SAMPLES);
        const fp = new Float64Array(AD_SAMPLES);
        const fpp = new Float64Array(AD_SAMPLES);
        for (let i = 0; i < AD_SAMPLES; i++) {
          x[i] = raw[i * 4];
          f[i] = raw[i * 4 + 1];
          fp[i] = raw[i * 4 + 2];
          fpp[i] = raw[i * 4 + 3];
        }
        setDeriv({ x, f, fp, fpp, ms });
      } catch (e) {
        if (derivToken.current === token) setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [ready, call]);

  /* -- finite-difference error sweep (depends on x0) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++fdToken.current;
    setComputing(true);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const t0 = performance.now();
          const raw = await call<Float64Array>("finite_difference_error", x0, FD_STEPS);
          const ms = performance.now() - t0;
          if (fdToken.current !== token) return;
          const hs: number[] = [];
          const errs: number[] = [];
          let bestErr = Infinity;
          let bestH = 1;
          for (let i = 0; i < FD_STEPS; i++) {
            const h = raw[i * 2];
            const err = raw[i * 2 + 1];
            hs.push(h);
            errs.push(err);
            if (err < bestErr) {
              bestErr = err;
              bestH = h;
            }
          }
          setFd({ hs, errs, bestH, bestErr, ms });
        } catch (e) {
          if (fdToken.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (fdToken.current === token) setComputing(false);
        }
      })();
    }, 90);
    return () => clearTimeout(timer);
  }, [ready, x0, call]);

  /* -- (a) f, f', f'' over x -- */
  const FW = 380;
  const FH = 280;
  const fL = 44;
  const fR = 14;
  const fT = 16;
  const fB = 28;
  const fpw = FW - fL - fR;
  const fph = FH - fT - fB;

  const derivGeom = useMemo(() => {
    if (!deriv) return null;
    let ymax = 1e-9;
    for (let i = 0; i < AD_SAMPLES; i++) {
      ymax = Math.max(ymax, Math.abs(deriv.f[i]), Math.abs(deriv.fp[i]), Math.abs(deriv.fpp[i]));
    }
    ymax *= 1.08;
    const xOf = (x: number) => fL + ((x + 5) / 10) * fpw;
    const yOf = (v: number) => fT + (1 - (v + ymax) / (2 * ymax)) * fph;
    const path = (arr: Float64Array) =>
      Array.from(arr, (v, i) => `${i === 0 ? "M" : "L"} ${xOf(deriv.x[i]).toFixed(2)} ${yOf(v).toFixed(2)}`).join(" ");
    // sample the exact AD values at x0 for the HUD
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < AD_SAMPLES; i++) {
      const d = Math.abs(deriv.x[i] - x0);
      if (d < best) {
        best = d;
        idx = i;
      }
    }
    return {
      fPath: path(deriv.f),
      fpPath: path(deriv.fp),
      fppPath: path(deriv.fpp),
      y0: yOf(0),
      xOf,
      yOf,
      ymax,
      at: { f: deriv.f[idx], fp: deriv.fp[idx], fpp: deriv.fpp[idx], fy: yOf(deriv.f[idx]) },
    };
  }, [deriv, fpw, fph, x0]);

  /* -- (b) finite-difference error vs step size (log-log) -- */
  const SW = 380;
  const SH = 280;
  const sL = 46;
  const sR = 14;
  const sT = 16;
  const sB = 30;
  const spw = SW - sL - sR;
  const sph = SH - sT - sB;
  const H_LOG_MIN = -13;
  const H_LOG_MAX = -1;

  const fdGeom = useMemo(() => {
    if (!fd) return null;
    let top = -Infinity;
    for (const e of fd.errs) top = Math.max(top, Math.log10(Math.max(e, 1e-18)));
    top = Math.max(0, Math.ceil(top));
    const bottom = -17;
    const xOf = (logh: number) => sL + ((logh - H_LOG_MIN) / (H_LOG_MAX - H_LOG_MIN)) * spw;
    const yOf = (loge: number) => sT + (1 - (Math.max(loge, bottom) - bottom) / (top - bottom)) * sph;
    const pts = fd.hs.map((h, i) => ({
      x: xOf(Math.log10(h)),
      y: yOf(Math.log10(Math.max(fd.errs[i], 1e-18))),
    }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const yticks: number[] = [];
    for (let e = top; e >= bottom; e -= 4) yticks.push(e);
    const xticks = [-13, -10, -7, -4, -1];
    const adY = yOf(Math.log10(AD_ERR));
    const bestX = xOf(Math.log10(fd.bestH));
    const bestY = yOf(Math.log10(Math.max(fd.bestErr, 1e-18)));

    // sorted-by-x for the sweeping probe + the gap shading
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    const cxs = sorted.map((p) => p.x);
    const cys = sorted.map((p) => p.y);
    const gapPath =
      sorted.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
      ` L ${sorted[sorted.length - 1].x.toFixed(2)} ${adY.toFixed(2)} L ${sorted[0].x.toFixed(2)} ${adY.toFixed(2)} Z`;

    const ordersBetter = Math.log10(Math.max(fd.bestErr, 1e-18) / AD_ERR);
    return { pts, line, yticks, xticks, yOf, xOf, adY, top, bottom, bestX, bestY, cxs, cys, gapPath, ordersBetter };
  }, [fd, spw, sph]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Demo 05 · fs-ad · dual numbers
            </span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Exact <span className="text-cyan-400">derivatives</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid gap-4 md:grid-cols-2">
        {/* (a) f, f', f'' */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
              f · f′ · f″
            </span>
            <span className="font-mono text-[9px]" style={{ color: CYAN_GLOW }}>
              sin(3x)·e^(−x²/4)
            </span>
          </div>
          <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
            {/* exact values at x0 (from AD) */}
            {derivGeom && (
              <div
                className="pointer-events-none absolute right-2 top-2 z-10 rounded-md border px-2 py-1 font-mono backdrop-blur-sm"
                style={{ borderColor: `${ROSE}44`, background: "rgba(4,9,13,0.7)" }}
              >
                <div className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  exact @ x₀={x0.toFixed(1)}
                </div>
                <div className="text-[9px] tabular-nums" style={{ color: CYAN_GLOW }}>
                  f {derivGeom.at.f.toFixed(3)}
                </div>
                <div className="text-[9px] tabular-nums" style={{ color: VIOLET }}>
                  f′ {derivGeom.at.fp.toFixed(3)}
                </div>
                <div className="text-[9px] tabular-nums" style={{ color: AMBER }}>
                  f″ {derivGeom.at.fpp.toFixed(3)}
                </div>
              </div>
            )}
            <svg
              viewBox={`0 0 ${FW} ${FH}`}
              className="block w-full max-w-full"
              role="img"
              aria-label="A function and its first and second derivatives, all computed exactly by automatic differentiation."
            >
              <defs>
                <filter id="ad-glow" x="-20%" y="-40%" width="140%" height="180%">
                  <feGaussianBlur stdDeviation="2.4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect x={fL} y={fT} width={fpw} height={fph} fill={SURFACE} stroke={BORDER} />
              {derivGeom && (
                <>
                  <line x1={fL} y1={derivGeom.y0} x2={fL + fpw} y2={derivGeom.y0} stroke={`${SLATE}22`} />
                  {/* x0 marker (where the finite-difference sweep is taken) */}
                  {x0 >= -5 && x0 <= 5 && (
                    <>
                      <line
                        x1={derivGeom.xOf(x0)}
                        y1={fT}
                        x2={derivGeom.xOf(x0)}
                        y2={fT + fph}
                        stroke={`${ROSE}88`}
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                      {inView && !reduced && (
                        <motion.circle
                          cx={derivGeom.xOf(x0)}
                          cy={derivGeom.at.fy}
                          r={4}
                          fill="none"
                          stroke={ROSE}
                          strokeWidth={1.4}
                          initial={{ r: 4, opacity: 0.9 }}
                          animate={{ r: [4, 12], opacity: [0.9, 0] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                        />
                      )}
                      <circle cx={derivGeom.xOf(x0)} cy={derivGeom.at.fy} r={3} fill={ROSE} stroke={BG} strokeWidth={1} />
                    </>
                  )}
                  <AnimatedPath d={derivGeom.fppPath} reduced={reduced} drawKey={1} stroke={`${AMBER}cc`} strokeWidth={1.6} filter="url(#ad-glow)" />
                  <AnimatedPath d={derivGeom.fpPath} reduced={reduced} drawKey={1} stroke={VIOLET} strokeWidth={1.8} filter="url(#ad-glow)" />
                  <AnimatedPath d={derivGeom.fPath} reduced={reduced} drawKey={1} stroke={CYAN_GLOW} strokeWidth={2.6} filter="url(#ad-glow)" />
                  {/* legend */}
                  <g transform={`translate(${fL + 6}, ${fT + 8})`} fontFamily="monospace" fontSize={9} fontWeight={700}>
                    <text x={0} y={0} fill={CYAN_GLOW}>f</text>
                    <text x={16} y={0} fill={VIOLET}>f′</text>
                    <text x={34} y={0} fill={AMBER}>f″</text>
                  </g>
                </>
              )}
              {!ready && (
                <text x={FW / 2} y={FH / 2} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={800} letterSpacing="3" fill={`${AMBER}dd`}>
                  REANIMATING…
                </text>
              )}
              <text x={fL + fpw / 2} y={FH - 6} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={MUTED}>
                x ∈ [−5, 5]
              </text>
            </svg>
          </div>
        </div>

        {/* (b) FD error vs h */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
              derivative error vs step h
            </span>
            <span className="font-mono text-[9px]" style={{ color: VIOLET }}>
              log–log
            </span>
          </div>
          <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
            {/* AD vs FD verdict */}
            {fdGeom && (
              <div
                className="pointer-events-none absolute right-2 top-2 z-10 rounded-md border px-2 py-1 font-mono backdrop-blur-sm"
                style={{ borderColor: `${EMERALD}44`, background: "rgba(4,9,13,0.7)" }}
              >
                <div className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  AD beats best FD by
                </div>
                <div className="text-[13px] font-black tabular-nums" style={{ color: EMERALD, textShadow: `0 0 10px ${EMERALD}66` }}>
                  ~{Math.max(0, fdGeom.ordersBetter).toFixed(1)} orders
                </div>
              </div>
            )}
            <svg
              viewBox={`0 0 ${SW} ${SH}`}
              className="block w-full max-w-full"
              role="img"
              aria-label="Finite-difference derivative error versus step size on a log-log axis, forming a U-curve, with a flat line marking the constant machine-precision error of automatic differentiation five orders below."
            >
              <defs>
                <linearGradient id="ad-gap" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ROSE} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={AMBER} stopOpacity="0.04" />
                </linearGradient>
                <filter id="ad-uglow" x="-10%" y="-20%" width="120%" height="140%">
                  <feGaussianBlur stdDeviation="2.2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect x={sL} y={sT} width={spw} height={sph} fill={SURFACE} stroke={BORDER} />
              {fdGeom && (
                <>
                  {fdGeom.yticks.map((e) => (
                    <g key={`y-${e}`}>
                      <line x1={sL} y1={fdGeom.yOf(e)} x2={sL + spw} y2={fdGeom.yOf(e)} stroke={`${SLATE}18`} />
                      <text x={sL - 6} y={fdGeom.yOf(e) + 3} textAnchor="end" fontFamily="monospace" fontSize={8} fill={MUTED}>
                        1e{e}
                      </text>
                    </g>
                  ))}
                  {fdGeom.xticks.map((e) => (
                    <text key={`x-${e}`} x={fdGeom.xOf(e)} y={SH - 8} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={MUTED}>
                      1e{e}
                    </text>
                  ))}
                  {/* the chasm between FD and the AD floor */}
                  <path d={fdGeom.gapPath} fill="url(#ad-gap)" />
                  {/* deep-precision basement below the AD floor */}
                  <rect x={sL} y={fdGeom.adY} width={spw} height={Math.max(0, sT + sph - fdGeom.adY)} fill={`${EMERALD}0c`} />
                  {/* AD machine-precision floor (flat, glowing) */}
                  <line x1={sL} y1={fdGeom.adY} x2={sL + spw} y2={fdGeom.adY} stroke={EMERALD} strokeWidth={2} strokeDasharray="6 4" filter="url(#ad-uglow)" />
                  {inView && !reduced && (
                    <motion.line
                      x1={sL}
                      y1={fdGeom.adY}
                      x2={sL + spw}
                      y2={fdGeom.adY}
                      stroke={EMERALD}
                      strokeWidth={2}
                      animate={{ opacity: [0.25, 0.6, 0.25] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <text x={sL + spw - 4} y={fdGeom.adY - 5} textAnchor="end" fontFamily="monospace" fontSize={8.5} fontWeight={700} fill={EMERALD}>
                    automatic diff ≈ 1e-16 · no step size
                  </text>
                  {/* the U-curve */}
                  <AnimatedPath d={fdGeom.line} reduced={reduced} drawKey={2} stroke={ROSE} strokeWidth={2} filter="url(#ad-uglow)" />
                  {fdGeom.pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={1.7} fill={`${ROSE}dd`} />
                  ))}
                  {/* sweeping probe that walks down the U and blows back up */}
                  {inView && !reduced && fdGeom.cxs.length > 1 && (
                    <motion.g>
                      <motion.circle
                        r={6}
                        fill={ROSE}
                        opacity={0.3}
                        filter="url(#ad-uglow)"
                        initial={{ cx: fdGeom.cxs[0], cy: fdGeom.cys[0] }}
                        animate={{ cx: fdGeom.cxs, cy: fdGeom.cys }}
                        transition={{ duration: 3.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                      />
                      <motion.circle
                        r={3}
                        fill="#ffe4ea"
                        stroke={ROSE}
                        strokeWidth={1.2}
                        initial={{ cx: fdGeom.cxs[0], cy: fdGeom.cys[0] }}
                        animate={{ cx: fdGeom.cxs, cy: fdGeom.cys }}
                        transition={{ duration: 3.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                      />
                    </motion.g>
                  )}
                  {/* best-h marker (bottom of the U) + gap bracket to the AD floor */}
                  <line x1={fdGeom.bestX} y1={fdGeom.bestY} x2={fdGeom.bestX} y2={fdGeom.adY} stroke={`${AMBER}66`} strokeWidth={1} strokeDasharray="2 2" />
                  <circle cx={fdGeom.bestX} cy={fdGeom.bestY} r={3.4} fill={AMBER} stroke={BG} strokeWidth={1.4} />
                  <text x={fdGeom.bestX + 5} y={(fdGeom.bestY + fdGeom.adY) / 2} fontFamily="monospace" fontSize={8} fill={`${AMBER}dd`}>
                    ~{Math.max(0, fdGeom.ordersBetter).toFixed(0)} orders
                  </text>
                  <text x={fdGeom.bestX} y={fdGeom.bestY - 8} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={AMBER}>
                    best FD
                  </text>
                </>
              )}
              {!ready && (
                <text x={SW / 2} y={SH / 2} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={800} letterSpacing="3" fill={`${AMBER}dd`}>
                  REANIMATING…
                </text>
              )}
              <text x={sL + spw / 2} y={SH - 1} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={`${MUTED}aa`}>
                step size h
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
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
            x₀ = {x0.toFixed(2)}
          </span>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.1}
            value={x0}
            onChange={(e) => setX0(parseFloat(e.target.value))}
            disabled={!ready}
            aria-label="Evaluation point x0 for the finite-difference sweep"
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 disabled:opacity-40"
            style={{ accentColor: ROSE }}
          />
        </div>
      </div>

      {/* Readout */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span> AD: {AD_SAMPLES} exact evals
        {deriv ? <span style={{ color: EMERALD }}> · {deriv.ms.toFixed(1)} ms</span> : null}
        {fd ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> FD best at h ={" "}
            <span style={{ color: AMBER }}>{fd.bestH.toExponential(1)}</span> · min error{" "}
            <span style={{ color: ROSE }}>{fd.bestErr.toExponential(2)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> AD error{" "}
            <span style={{ color: EMERALD }}>≈ {AD_ERR.toExponential(0)}</span>
          </>
        ) : null}
      </div>

      {/* Caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Left: f, f′ and f″ of sin(3x)·e^(−x²/4), all computed by{" "}
        <span className="text-slate-200">forward-mode automatic differentiation</span>. fs-ad dual numbers carry
        the derivative through every operation, so f′ and f″ come out correct to machine precision with{" "}
        <span className="text-slate-200">no step size at all</span>. Right: the same derivative by finite
        differences traces the classic <span style={{ color: ROSE }}>U-curve</span>, where the probe walks down the
        truncation slope, bottoms out, then blows up on catastrophic round-off. AD&apos;s flat green floor
        sits a glowing five orders of magnitude below, across the whole chasm. Finite differences never reach it;
        dual numbers just do.
      </div>
    </SyncContainer>
  );
}
