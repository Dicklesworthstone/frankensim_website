"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
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
const EMERALD = "#10b981";
const AMBER = "#fbbf24";
const ROSE = "#f43f5e";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";

const OS_N = 50;
const OS_RE_MIN = 2000;
const OS_RE_MAX = 8000;
const OS_STEPS = 60;

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

function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}
    >
      kernel error: {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Channel-flow inset — laminar streamlines destabilising past Re_c   */
/* ------------------------------------------------------------------ */

function ChannelInset({
  critX,
  reduced,
  hasCrossing,
}: {
  critX: number | null;
  reduced: boolean;
  hasCrossing: boolean;
}) {
  const IW = 720;
  const IH = 70;
  const L = 62;
  const R = 20;
  const pw = IW - L - R;
  const xc = critX ?? L + pw;
  const lanes = [0.22, 0.4, 0.58, 0.76];

  const streamline = (yFrac: number) => {
    const y = 8 + yFrac * (IH - 16);
    let d = `M ${L} ${y.toFixed(2)}`;
    for (let px = L + 4; px <= L + pw; px += 6) {
      let yy = y;
      if (hasCrossing && px > xc) {
        const prog = (px - xc) / Math.max(1, L + pw - xc);
        const amp = prog * prog * 9;
        yy = y + amp * Math.sin((px - xc) / 7 + yFrac * 6);
      }
      d += ` L ${px} ${yy.toFixed(2)}`;
    }
    return d;
  };

  return (
    <svg viewBox={`0 0 ${IW} ${IH}`} className="mt-2 block w-full max-w-full" aria-hidden="true">
      <defs>
        <linearGradient id="os-lane" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={EMERALD} />
          <stop offset={`${((xc - L) / pw) * 100}%`} stopColor={CYAN_GLOW} />
          <stop offset="100%" stopColor={ROSE} />
        </linearGradient>
        <linearGradient id="os-lane-bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={EMERALD} stopOpacity="0.06" />
          <stop offset={`${((xc - L) / pw) * 100}%`} stopColor={CYAN} stopOpacity="0.05" />
          <stop offset="100%" stopColor={ROSE} stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <rect x={L} y={4} width={pw} height={IH - 8} rx={6} fill="url(#os-lane-bg)" stroke={BORDER} />
      {/* channel walls */}
      <line x1={L} y1={5} x2={L + pw} y2={5} stroke={`${SLATE}55`} strokeWidth={1} />
      <line x1={L} y1={IH - 5} x2={L + pw} y2={IH - 5} stroke={`${SLATE}55`} strokeWidth={1} />
      {lanes.map((yf, i) =>
        reduced ? (
          <path key={i} d={streamline(yf)} fill="none" stroke="url(#os-lane)" strokeWidth={1.3} strokeLinecap="round" strokeDasharray="7 6" opacity={0.8} />
        ) : (
          <motion.path
            key={i}
            d={streamline(yf)}
            fill="none"
            stroke="url(#os-lane)"
            strokeWidth={1.3}
            strokeLinecap="round"
            strokeDasharray="7 6"
            opacity={0.85}
            animate={{ strokeDashoffset: [0, -26] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
        ),
      )}
      {hasCrossing && (
        <>
          <line x1={xc} y1={4} x2={xc} y2={IH - 4} stroke={`${ROSE}aa`} strokeWidth={1} strokeDasharray="3 3" />
          <text x={xc - 6} y={16} textAnchor="end" fontFamily="monospace" fontSize={8.5} fill={`${EMERALD}dd`}>
            laminar
          </text>
          <text x={xc + 6} y={16} textAnchor="start" fontFamily="monospace" fontSize={8.5} fill={ROSE}>
            turbulent →
          </text>
        </>
      )}
      <text x={L} y={IH - 1} fontFamily="monospace" fontSize={8} fill={`${MUTED}99`}>
        plane Poiseuille channel — same Re axis
      </text>
    </svg>
  );
}

export default function OrrSommerfeld() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [alpha, setAlpha] = useState(1.0);
  const [curve, setCurve] = useState<Float64Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [ms, setMs] = useState(0);
  const [sweepKey, setSweepKey] = useState(0);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const t0 = performance.now();
          const res = await call<Float64Array>(
            "orr_sommerfeld_curve",
            alpha,
            OS_N,
            OS_RE_MIN,
            OS_RE_MAX,
            OS_STEPS,
          );
          const elapsed = performance.now() - t0;
          if (tokenRef.current !== token) return;
          setCurve(res);
          setMs(elapsed);
          setSweepKey((k) => k + 1);
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 110);
    return () => clearTimeout(timer);
  }, [ready, alpha, call]);

  /* -- geometry -- */
  const VW = 720;
  const VH = 360;
  const L = 62;
  const R = 20;
  const T = 24;
  const B = 46;
  const pw = VW - L - R;
  const ph = VH - T - B;

  const reAt = (i: number) => OS_RE_MIN + ((OS_RE_MAX - OS_RE_MIN) * i) / (OS_STEPS - 1);
  const xOf = (re: number) => L + ((re - OS_RE_MIN) / (OS_RE_MAX - OS_RE_MIN)) * pw;

  const geom = useMemo(() => {
    if (!curve || curve.length === 0) return null;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let i = 0; i < curve.length; i++) {
      ymin = Math.min(ymin, curve[i]);
      ymax = Math.max(ymax, curve[i]);
    }
    ymin = Math.min(ymin, 0);
    ymax = Math.max(ymax, 0);
    const pad = (ymax - ymin) * 0.12 || 0.01;
    ymin -= pad;
    ymax += pad;
    const yOf = (g: number) => T + (1 - (g - ymin) / (ymax - ymin)) * ph;

    const pts = Array.from({ length: curve.length }, (_, i) => ({
      x: xOf(reAt(i)),
      y: yOf(curve[i]),
      g: curve[i],
    }));

    // zero crossing (stable → unstable)
    let critRe: number | null = null;
    let critIdx: number | null = null;
    for (let i = 1; i < curve.length; i++) {
      if (curve[i - 1] <= 0 && curve[i] > 0) {
        const t = (0 - curve[i - 1]) / (curve[i] - curve[i - 1]);
        critRe = reAt(i - 1) + t * (reAt(i) - reAt(i - 1));
        critIdx = i;
        break;
      }
    }

    const y0 = yOf(0);
    let unstable = "";
    const positive = pts.filter((p) => p.g > 0);
    if (positive.length > 0) {
      const startX = critRe !== null ? xOf(critRe) : positive[0].x;
      unstable = `M ${startX} ${y0} `;
      positive.forEach((p) => {
        unstable += `L ${p.x} ${p.y} `;
      });
      unstable += `L ${positive[positive.length - 1].x} ${y0} Z`;
    }

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

    // marker keyframes: sweep the filament, settling on the neutral crossing.
    let frames: { x: number; y: number }[];
    if (critRe != null && critIdx != null) {
      frames = pts.slice(0, critIdx).map((p) => ({ x: p.x, y: p.y }));
      frames.push({ x: xOf(critRe), y: y0 });
    } else {
      frames = pts.map((p) => ({ x: p.x, y: p.y }));
    }
    if (frames.length < 2) frames = [frames[0] ?? { x: L, y: y0 }, { x: L + pw, y: y0 }];
    const cxs = frames.map((f) => f.x);
    const cys = frames.map((f) => f.y);

    const crossFrac = critRe != null ? (xOf(critRe) - L) / pw : 1;
    const yticks = [ymin, ymin + (ymax - ymin) * 0.5, ymax, 0].filter((v, i, a) => a.indexOf(v) === i);
    return { pts, line, unstable, critRe, critIdx, y0, yOf, ymin, ymax, yticks, cxs, cys, crossFrac };
  }, [curve]);

  const critLabel = geom?.critRe != null ? Math.round(geom.critRe) : null;
  const easedReRef = useEasedText<HTMLDivElement>(critLabel ?? 0, reduced, (v) => Math.round(v).toLocaleString(), {
    duration: 1500,
    enabled: critLabel != null,
    inViewRef,
  });
  const reTicks = [2000, 3500, 5000, 6500, 8000];
  const critX = geom?.critRe != null ? xOf(geom.critRe) : null;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Demo 02 · fs-cheb · Orr–Sommerfeld
            </span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Hydrodynamic stability, <span className="text-cyan-400">for real</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        {/* Big animated critical-Re readout */}
        {critLabel != null && (
          <div
            className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg border px-3 py-1.5 backdrop-blur-sm"
            style={{ borderColor: `${ROSE}55`, background: "rgba(4,9,13,0.7)" }}
          >
            <div className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: `${ROSE}cc` }}>
              critical Reynolds
            </div>
            <div ref={easedReRef} className="font-mono text-[22px] font-black leading-none tabular-nums" style={{ color: ROSE, textShadow: `0 0 14px ${ROSE}88` }} />
          </div>
        )}

        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full max-w-full"
          role="img"
          aria-label="Maximum temporal growth rate versus Reynolds number for plane Poiseuille flow; the curve crosses zero at the critical Reynolds number, and the unstable region is shaded rose."
        >
          <defs>
            <linearGradient id="os-unstable" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ROSE} stopOpacity="0.5" />
              <stop offset="55%" stopColor={ROSE} stopOpacity="0.18" />
              <stop offset="100%" stopColor={ROSE} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="os-stable" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EMERALD} stopOpacity="0.02" />
              <stop offset="100%" stopColor={EMERALD} stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="os-filament" gradientUnits="userSpaceOnUse" x1={L} y1="0" x2={L + pw} y2="0">
              <stop offset="0%" stopColor={EMERALD} />
              <stop offset={`${Math.max(0, (geom?.crossFrac ?? 1) - 0.04) * 100}%`} stopColor={CYAN_GLOW} />
              <stop offset={`${(geom?.crossFrac ?? 1) * 100}%`} stopColor={AMBER} />
              <stop offset="100%" stopColor={ROSE} />
            </linearGradient>
            <filter id="os-glow" x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="3.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="os-softglow" x="-40%" y="-120%" width="180%" height="340%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>

          <rect x={L} y={T} width={pw} height={ph} fill={SURFACE} stroke={BORDER} />

          {reTicks.map((re) => (
            <g key={`x-${re}`}>
              <line x1={xOf(re)} y1={T} x2={xOf(re)} y2={T + ph} stroke={`${SLATE}1f`} />
              <text x={xOf(re)} y={T + ph + 16} textAnchor="middle" fontFamily="monospace" fontSize={10} fill={MUTED}>
                {re >= 1000 ? `${re / 1000}k` : re}
              </text>
            </g>
          ))}
          <text x={L + pw / 2} y={VH - 6} textAnchor="middle" fontFamily="monospace" fontSize={11} fill={MUTED}>
            Reynolds number — Re
          </text>

          {geom && (
            <>
              {/* stable-region tint (below the neutral line) */}
              <rect x={L} y={geom.y0} width={pw} height={Math.max(0, T + ph - geom.y0)} fill="url(#os-stable)" />

              {geom.yticks.map((v, i) => (
                <g key={`y-${i}`}>
                  <line x1={L} y1={geom.yOf(v)} x2={L + pw} y2={geom.yOf(v)} stroke={`${SLATE}14`} />
                  <text x={L - 8} y={geom.yOf(v) + 3} textAnchor="end" fontFamily="monospace" fontSize={9} fill={MUTED}>
                    {v.toFixed(3)}
                  </text>
                </g>
              ))}

              {/* charged unstable region */}
              {geom.unstable && (
                <>
                  <path d={geom.unstable} fill={ROSE} opacity={0.14} filter="url(#os-softglow)" />
                  <path d={geom.unstable} fill="url(#os-unstable)" />
                  {inView && !reduced && (
                    <motion.path
                      d={geom.unstable}
                      fill={ROSE}
                      animate={{ opacity: [0.05, 0.16, 0.05] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </>
              )}

              {/* zero / neutral line */}
              <line
                x1={L}
                y1={geom.y0}
                x2={L + pw}
                y2={geom.y0}
                stroke={`${MUTED}88`}
                strokeWidth={1}
                strokeDasharray="5 4"
              />
              <text x={L + pw - 4} y={geom.y0 - 5} textAnchor="end" fontFamily="monospace" fontSize={9} fill={`${MUTED}cc`}>
                growth = 0 (neutral)
              </text>

              {/* critical Re */}
              {geom.critRe != null && (
                <>
                  <line
                    x1={xOf(geom.critRe)}
                    y1={T}
                    x2={xOf(geom.critRe)}
                    y2={T + ph}
                    stroke={`${ROSE}aa`}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  {inView && !reduced && (
                    <motion.circle
                      cx={xOf(geom.critRe)}
                      cy={geom.y0}
                      r={5}
                      fill="none"
                      stroke={ROSE}
                      strokeWidth={1.5}
                      initial={{ r: 5, opacity: 0.9 }}
                      animate={{ r: [5, 16], opacity: [0.9, 0] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  <circle cx={xOf(geom.critRe)} cy={geom.y0} r={5} fill={ROSE} stroke={BG} strokeWidth={1.5} />
                  <text
                    x={xOf(geom.critRe)}
                    y={T - 8}
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontSize={11}
                    fontWeight={700}
                    fill={ROSE}
                  >
                    critical Re ≈ {critLabel}
                  </text>
                </>
              )}

              {/* the growth-rate filament (glow underlay + gradient core) */}
              <path d={geom.line} fill="none" stroke={CYAN_GLOW} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.18} filter="url(#os-softglow)" />
              {reduced ? (
                <path d={geom.line} fill="none" stroke="url(#os-filament)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" filter="url(#os-glow)" />
              ) : (
                <motion.path
                  d={geom.line}
                  fill="none"
                  stroke="url(#os-filament)"
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter="url(#os-glow)"
                  initial={{ pathLength: 0, opacity: 0.4 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              )}

              {/* sweeping marker that settles on the neutral crossing */}
              {!reduced ? (
                <motion.g key={sweepKey}>
                  <motion.circle
                    r={7}
                    fill={AMBER}
                    opacity={0.35}
                    filter="url(#os-softglow)"
                    initial={{ cx: geom.cxs[0], cy: geom.cys[0] }}
                    animate={{ cx: geom.cxs, cy: geom.cys }}
                    transition={{ duration: 1.7, ease: "easeInOut" }}
                  />
                  <motion.circle
                    r={3.4}
                    fill="#fff7e0"
                    stroke={AMBER}
                    strokeWidth={1.4}
                    initial={{ cx: geom.cxs[0], cy: geom.cys[0] }}
                    animate={{ cx: geom.cxs, cy: geom.cys }}
                    transition={{ duration: 1.7, ease: "easeInOut" }}
                  />
                </motion.g>
              ) : (
                <circle cx={geom.cxs[geom.cxs.length - 1]} cy={geom.cys[geom.cys.length - 1]} r={3.4} fill="#fff7e0" stroke={AMBER} strokeWidth={1.4} />
              )}

              <text x={L + 8} y={T + ph - 8} fontFamily="monospace" fontSize={9} fill={`${EMERALD}cc`}>
                stable — laminar
              </text>
              <text x={L + pw - 8} y={T + 14} textAnchor="end" fontFamily="monospace" fontSize={9} fill={ROSE}>
                unstable → turbulent
              </text>
            </>
          )}

          <text
            x={16}
            y={T + ph / 2}
            textAnchor="middle"
            fontFamily="monospace"
            fontSize={11}
            fill={MUTED}
            transform={`rotate(-90 16 ${T + ph / 2})`}
          >
            max growth rate — ωᵢ
          </text>

          {!ready && (
            <text
              x={VW / 2}
              y={VH / 2}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={13}
              fontWeight={800}
              letterSpacing="4"
              fill={`${AMBER}dd`}
            >
              REANIMATING KERNEL…
            </text>
          )}
        </svg>

        {/* channel-flow inset (shares the Re axis) */}
        {geom && <ChannelInset critX={critX} reduced={reduced || !inView} hasCrossing={geom.critRe != null} />}
      </div>

      {error && <ErrorNote message={error} />}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
            α = {alpha.toFixed(2)}
          </span>
          <input
            type="range"
            min={0.8}
            max={1.2}
            step={0.02}
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            disabled={!ready}
            aria-label="Streamwise wavenumber alpha"
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 disabled:opacity-40"
            style={{ accentColor: CYAN }}
          />
        </div>
      </div>

      {/* Readout */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span> {OS_N} Chebyshev modes · {OS_STEPS} eigensolves · {ms.toFixed(0)} ms
        {critLabel != null ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: ROSE }}>critical Re ≈ {critLabel}</span>
          </>
        ) : ready && curve ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>no crossing in range — fully stable</span>
          </>
        ) : null}
      </div>

      {/* Caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Each point is a real <span className="text-slate-200">Chebyshev-collocation Orr–Sommerfeld eigensolve</span>:{" "}
        the generalized eigenvalue problem for the stability of plane Poiseuille flow, discretized on {OS_N}{" "}
        collocation nodes and solved for its most-unstable temporal mode. Positive growth means laminar flow
        breaks down into turbulence, and the glowing filament crosses zero at the classical{" "}
        <span style={{ color: ROSE }}>critical Reynolds ≈ 5772</span> for α ≈ 1. Watch the channel below go turbulent
        exactly there. It is the same stability physics behind FrankenSim&apos;s laminar-pour vessel, computed as a
        live hydrodynamic eigenproblem right in the browser.
      </div>
    </SyncContainer>
  );
}
