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
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const AMBER = "#fbbf24";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";

const CENTER = 0;
const CURVE_SAMPLES = 220;

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

/** Circular certification seal. */
function ProvenSeal({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute bottom-2 right-2 z-10"
      initial={reduced ? false : { scale: 0, rotate: -25, opacity: 0 }}
      animate={{ scale: 1, rotate: -12, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }}
    >
      <div
        className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 text-center"
        style={{
          borderColor: EMERALD,
          background: "rgba(4,9,13,0.7)",
          boxShadow: `0 0 16px ${EMERALD}55, inset 0 0 8px ${EMERALD}22`,
        }}
      >
        <span className="font-mono text-[7px] font-black uppercase leading-tight tracking-widest" style={{ color: EMERALD }}>
          proven
        </span>
        <span className="text-[13px] leading-none" style={{ color: EMERALD }}>
          ✓
        </span>
        <span className="font-mono text-[7px] font-black uppercase leading-tight tracking-widest" style={{ color: EMERALD }}>
          bound
        </span>
      </div>
    </motion.div>
  );
}

/** true function under study: exp(sin x). */
function fx(x: number) {
  return Math.exp(Math.sin(x));
}

interface BoundData {
  widths: number[]; // remainder width for orders 1..=order
  lo: number;
  hi: number;
  order: number;
  radius: number;
  ms: number;
}

export default function TaylorBound() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inViewRef } = useInView<HTMLDivElement>();

  const [order, setOrder] = useState(6);
  const [logR, setLogR] = useState(0); // radius = 10^logR ; default r = 1
  const radius = Math.pow(10, logR);

  const [data, setData] = useState<BoundData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
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
          const res = await call<Float64Array>("taylor_bound", CENTER, radius, order);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          const widths: number[] = [];
          for (let k = 0; k < order; k++) widths.push(res[k]);
          const lo = res[order];
          const hi = res[order + 1];
          setData({ widths, lo, hi, order, radius, ms });
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 90);
    return () => clearTimeout(timer);
  }, [ready, order, radius, call]);

  /* -- true range of exp(sin x) over the domain (for the enclosure comparison) -- */
  const trueRange = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < CURVE_SAMPLES; i++) {
      const x = CENTER - radius + (2 * radius * i) / (CURVE_SAMPLES - 1);
      const y = fx(x);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    return { lo, hi };
  }, [radius]);

  /* -- (a) remainder width vs order (log y) -- */
  const FW = 380;
  const FH = 280;
  const fL = 50;
  const fR = 14;
  const fT = 18;
  const fB = 30;
  const fpw = FW - fL - fR;
  const fph = FH - fT - fB;

  const widthGeom = useMemo(() => {
    if (!data) return null;
    const logs = data.widths.map((w) => Math.log10(Math.max(w, 1e-18)));
    let top = -Infinity;
    let bottom = Infinity;
    for (const l of logs) {
      top = Math.max(top, l);
      bottom = Math.min(bottom, l);
    }
    top = Math.ceil(top + 0.001);
    bottom = Math.floor(bottom - 0.001);
    if (top - bottom < 4) bottom = top - 4;
    const orders = data.widths.map((_, i) => i + 1);
    const oMin = 1;
    const oMax = Math.max(2, data.order);
    const xOf = (o: number) => fL + ((o - oMin) / (oMax - oMin)) * fpw;
    const yOf = (logv: number) => fT + (1 - (Math.max(logv, bottom) - bottom) / (top - bottom)) * fph;
    const y0 = yOf(bottom);
    const pts = orders.map((o, i) => ({ x: xOf(o), y: yOf(logs[i]), o }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const area = pts.length
      ? `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${y0.toFixed(2)} L ${pts[0].x.toFixed(2)} ${y0.toFixed(2)} Z`
      : "";
    const ticks: number[] = [];
    const stepT = Math.max(1, Math.round((top - bottom) / 4));
    for (let e = top; e >= bottom; e -= stepT) ticks.push(e);
    const xticks = orders.filter((o) => o === 1 || o === oMax || o % Math.max(1, Math.round(oMax / 4)) === 0);
    const last = pts[pts.length - 1] ?? { x: fL, y: y0, o: oMin };
    return { pts, line, area, ticks, xticks, yOf, xOf, y0, top, bottom, oMin, oMax, last };
  }, [data, fpw, fph]);

  /* -- (b) certified enclosure band around the true range -- */
  const SW = 380;
  const SH = 280;
  const sL = 52;
  const sR = 14;
  const sT = 18;
  const sB = 30;
  const spw = SW - sL - sR;
  const sph = SH - sT - sB;

  const bandGeom = useMemo(() => {
    if (!data) return null;
    const lo = Math.min(data.lo, trueRange.lo);
    const hi = Math.max(data.hi, trueRange.hi);
    const pad = (hi - lo) * 0.1 || 0.1;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const xOf = (x: number) => sL + ((x - (CENTER - radius)) / (2 * radius)) * spw;
    const yOf = (y: number) => sT + (1 - (y - yMin) / (yMax - yMin)) * sph;
    const curve = Array.from({ length: CURVE_SAMPLES }, (_, i) => {
      const x = CENTER - radius + (2 * radius * i) / (CURVE_SAMPLES - 1);
      return `${i === 0 ? "M" : "L"} ${xOf(x).toFixed(2)} ${yOf(fx(x)).toFixed(2)}`;
    }).join(" ");
    return {
      curve,
      yOf,
      certLoY: yOf(data.lo),
      certHiY: yOf(data.hi),
      trueLoY: yOf(trueRange.lo),
      trueHiY: yOf(trueRange.hi),
    };
  }, [data, trueRange, radius, spw, sph]);

  const bandWidth = data ? data.hi - data.lo : 0;
  const trueWidth = trueRange.hi - trueRange.lo;
  const slack = bandWidth - trueWidth;

  // eased big readout of the remainder width (counts down through decades) —
  // written straight to the DOM node, never via per-frame setState.
  const targetLog = data && bandWidth > 0 ? Math.log10(bandWidth) : 0;
  const easedWidthRef = useEasedText<HTMLDivElement>(
    targetLog,
    reduced,
    (l) => `${Math.pow(10, l - Math.floor(l)).toFixed(1)}e${Math.floor(l)}`,
    { duration: 700, enabled: !!data && bandWidth > 0, inViewRef },
  );

  const spring = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 170, damping: 22 };

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Demo 04 · fs-ivl · Taylor models
            </span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            A bound you can <span className="text-emerald-400">trust</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid gap-4 md:grid-cols-2">
        {/* (a) remainder width vs order */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
              certified remainder width
            </span>
            <span className="font-mono text-[9px]" style={{ color: VIOLET }}>
              log scale
            </span>
          </div>
          <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
            {/* eased width readout */}
            {data && (
              <div
                className="pointer-events-none absolute right-2 top-2 z-10 rounded-md border px-2 py-1 font-mono backdrop-blur-sm"
                style={{ borderColor: `${CYAN}44`, background: "rgba(4,9,13,0.7)" }}
              >
                <div className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  remainder
                </div>
                <div ref={easedWidthRef} className="text-[13px] font-black tabular-nums" style={{ color: CYAN_GLOW, textShadow: `0 0 10px ${CYAN}66` }} />
              </div>
            )}
            <svg
              viewBox={`0 0 ${FW} ${FH}`}
              className="block w-full max-w-full"
              role="img"
              aria-label="The rigorous remainder width of the Taylor model as a function of expansion order, plunging on a logarithmic axis."
            >
              <defs>
                <linearGradient id="tb-plunge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AMBER} />
                  <stop offset="55%" stopColor={CYAN_GLOW} />
                  <stop offset="100%" stopColor={EMERALD} />
                </linearGradient>
                <linearGradient id="tb-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CYAN} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
                </linearGradient>
                <filter id="tb-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect x={fL} y={fT} width={fpw} height={fph} fill={SURFACE} stroke={BORDER} />
              {widthGeom && (
                <>
                  {widthGeom.ticks.map((e) => (
                    <g key={`e-${e}`}>
                      <line x1={fL} y1={widthGeom.yOf(e)} x2={fL + fpw} y2={widthGeom.yOf(e)} stroke={`${SLATE}18`} />
                      <text x={fL - 6} y={widthGeom.yOf(e) + 3} textAnchor="end" fontFamily="monospace" fontSize={8} fill={MUTED}>
                        1e{e}
                      </text>
                    </g>
                  ))}
                  {widthGeom.xticks.map((o) => (
                    <text key={`x-${o}`} x={widthGeom.xOf(o)} y={FH - 8} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={MUTED}>
                      {o}
                    </text>
                  ))}
                  {/* plummet fill */}
                  <path d={widthGeom.area} fill="url(#tb-fill)" />
                  {reduced ? (
                    <path d={widthGeom.line} fill="none" stroke="url(#tb-plunge)" strokeWidth={2.4} strokeLinejoin="round" filter="url(#tb-glow)" />
                  ) : (
                    <motion.path
                      key={`${order}-${logR.toFixed(2)}`}
                      d={widthGeom.line}
                      fill="none"
                      stroke="url(#tb-plunge)"
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                      filter="url(#tb-glow)"
                      initial={{ pathLength: 0, opacity: 0.4 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  )}
                  {widthGeom.pts.map((p) => (
                    <circle key={`c-${p.o}`} cx={p.x} cy={p.y} r={2.4} fill={CYAN_GLOW} />
                  ))}
                  {/* dropping marker at the current highest order */}
                  {!reduced ? (
                    <motion.g>
                      <motion.circle r={7} fill={EMERALD} opacity={0.3} filter="url(#tb-glow)" animate={{ cx: widthGeom.last.x, cy: widthGeom.last.y }} transition={spring} initial={false} />
                      <motion.circle r={3.6} fill="#eafff5" stroke={EMERALD} strokeWidth={1.5} animate={{ cx: widthGeom.last.x, cy: widthGeom.last.y }} transition={spring} initial={false} />
                    </motion.g>
                  ) : (
                    <circle cx={widthGeom.last.x} cy={widthGeom.last.y} r={3.6} fill="#eafff5" stroke={EMERALD} strokeWidth={1.5} />
                  )}
                </>
              )}
              {!ready && (
                <text x={FW / 2} y={FH / 2} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={800} letterSpacing="3" fill={`${AMBER}dd`}>
                  REANIMATING…
                </text>
              )}
              <text x={fL + fpw / 2} y={FH - 1} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={`${MUTED}aa`}>
                Taylor order
              </text>
            </svg>
          </div>
        </div>

        {/* (b) enclosure band */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
              certified enclosure [lo, hi]
            </span>
            <span className="font-mono text-[9px]" style={{ color: EMERALD }}>
              proven bound
            </span>
          </div>
          <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
            <svg
              viewBox={`0 0 ${SW} ${SH}`}
              className="block w-full max-w-full"
              role="img"
              aria-label="The function exp(sin x) over the domain with the rigorous certified range enclosure drawn as a shaded band that tightens as order rises."
            >
              <defs>
                <linearGradient id="tb-band" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD} stopOpacity="0.34" />
                  <stop offset="50%" stopColor={EMERALD} stopOpacity="0.1" />
                  <stop offset="100%" stopColor={EMERALD} stopOpacity="0.34" />
                </linearGradient>
                <filter id="tb-cglow" x="-20%" y="-40%" width="140%" height="180%">
                  <feGaussianBlur stdDeviation="2.4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect x={sL} y={sT} width={spw} height={sph} fill={SURFACE} stroke={BORDER} />
              {bandGeom && (
                <>
                  {/* slack regions (certified band beyond the true range) */}
                  <rect x={sL} y={bandGeom.certHiY} width={spw} height={Math.max(0, bandGeom.trueHiY - bandGeom.certHiY)} fill={`${AMBER}22`} />
                  <rect x={sL} y={bandGeom.trueLoY} width={spw} height={Math.max(0, bandGeom.certLoY - bandGeom.trueLoY)} fill={`${AMBER}22`} />
                  {/* certified band (animated tightening) */}
                  {reduced ? (
                    <rect
                      x={sL}
                      y={bandGeom.certHiY}
                      width={spw}
                      height={Math.max(1, bandGeom.certLoY - bandGeom.certHiY)}
                      fill="url(#tb-band)"
                      stroke={`${EMERALD}88`}
                      strokeDasharray="4 3"
                    />
                  ) : (
                    <motion.rect
                      x={sL}
                      width={spw}
                      fill="url(#tb-band)"
                      stroke={`${EMERALD}aa`}
                      strokeDasharray="5 4"
                      initial={false}
                      animate={{ y: bandGeom.certHiY, height: Math.max(1, bandGeom.certLoY - bandGeom.certHiY) }}
                      transition={spring}
                    />
                  )}
                  <text x={sL + 6} y={bandGeom.certHiY - 4} fontFamily="monospace" fontSize={8} fill={EMERALD}>
                    hi = {data ? data.hi.toFixed(4) : ""}
                  </text>
                  <text x={sL + 6} y={bandGeom.certLoY + 11} fontFamily="monospace" fontSize={8} fill={EMERALD}>
                    lo = {data ? data.lo.toFixed(4) : ""}
                  </text>
                  {/* true range guides */}
                  <line x1={sL} y1={bandGeom.trueHiY} x2={sL + spw} y2={bandGeom.trueHiY} stroke={`${VIOLET}aa`} strokeWidth={1} strokeDasharray="2 3" />
                  <line x1={sL} y1={bandGeom.trueLoY} x2={sL + spw} y2={bandGeom.trueLoY} stroke={`${VIOLET}aa`} strokeWidth={1} strokeDasharray="2 3" />
                  <text x={sL + spw - 4} y={bandGeom.trueHiY - 4} textAnchor="end" fontFamily="monospace" fontSize={8} fill={`${VIOLET}dd`}>
                    true range
                  </text>
                  {/* function */}
                  {reduced ? (
                    <path d={bandGeom.curve} fill="none" stroke={CYAN_GLOW} strokeWidth={2.4} strokeLinejoin="round" filter="url(#tb-cglow)" />
                  ) : (
                    <motion.path
                      key={`c-${logR.toFixed(2)}`}
                      d={bandGeom.curve}
                      fill="none"
                      stroke={CYAN_GLOW}
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                      filter="url(#tb-cglow)"
                      initial={{ pathLength: 0, opacity: 0.4 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
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
                x ∈ [−{radius.toFixed(3)}, {radius.toFixed(3)}] · f = exp(sin x)
              </text>
            </svg>
            {data && <ProvenSeal reduced={reduced} />}
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
            order = {order}
          </span>
          <input
            type="range"
            min={1}
            max={14}
            step={1}
            value={order}
            onChange={(e) => setOrder(parseInt(e.target.value, 10))}
            disabled={!ready}
            aria-label="Taylor expansion order"
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 disabled:opacity-40"
            style={{ accentColor: CYAN }}
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
            radius = {radius.toFixed(3)}
          </span>
          <input
            type="range"
            min={-3}
            max={Math.log10(2)}
            step={0.02}
            value={logR}
            onChange={(e) => setLogR(parseFloat(e.target.value))}
            disabled={!ready}
            aria-label="Domain radius (logarithmic)"
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 disabled:opacity-40"
            style={{ accentColor: VIOLET }}
          />
        </div>
      </div>

      {/* Readout */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span> order {order} · r = {radius.toExponential(2)}
        {data ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> enclosure ={" "}
            <span style={{ color: EMERALD }}>
              [{data.lo.toFixed(5)}, {data.hi.toFixed(5)}]
            </span>{" "}
            <span style={{ color: MUTED }}>│</span> width{" "}
            <span style={{ color: AMBER }}>{bandWidth.toExponential(2)}</span> · slack over true range{" "}
            <span style={{ color: VIOLET }}>{slack.toExponential(2)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> {data.ms.toFixed(2)} ms
          </>
        ) : null}
      </div>

      {/* Caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        This isn&apos;t a floating-point estimate; it is a{" "}
        <span className="text-slate-200">mathematically proven enclosure</span>. fs-ivl builds a certified{" "}
        <span className="text-slate-200">Taylor model</span> of exp(sin x): a polynomial plus a rigorous interval
        remainder that provably contains every value on the domain. Raise the order and the remainder width{" "}
        <span style={{ color: CYAN_GLOW }}>plummets</span> (left, log axis) while the green certified band{" "}
        <span className="text-slate-200">tightens down onto the function&apos;s true range</span> (right), the amber
        slack squeezing to nothing. Whatever the true answer is, the band is guaranteed to hold it, a guarantee
        ordinary floating-point numerics can never offer.
      </div>
    </SyncContainer>
  );
}
