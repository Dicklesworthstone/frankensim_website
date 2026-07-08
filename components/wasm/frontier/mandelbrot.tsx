"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { cn } from "@/lib/utils";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const AMBER = "#fbbf24";
const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

const W = 300;
const H = 300;

// Guided dive toward the famous seahorse-valley Misiurewicz point.
const TX = -0.743643887037;
const TY = 0.131825904205;
const WIDE_SCALE = 1.5;
const MIN_SCALE = 6e-4;
const ZOOM_FACTOR = 0.94;

/* ------------------------------------------------------------------ */
/*  Reduced-motion (hydration-safe)                                    */
/* ------------------------------------------------------------------ */

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
/*  Shared chrome                                                      */
/* ------------------------------------------------------------------ */

function LiveBadge({ computing }: { computing: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.2em]" style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d`, color: CYAN_GLOW }}>
      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: computing ? AMBER : EMERALD, boxShadow: "0 0 6px currentColor" }} />
      Computed live in WASM
    </span>
  );
}

function Pill({
  onClick, active, color = CYAN, children, ariaLabel, disabled,
}: {
  onClick: () => void; active?: boolean; color?: string; children: React.ReactNode; ariaLabel?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={active} disabled={disabled}
      className={cn("inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors", disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/5")}
      style={{ borderColor: active ? color : `${color}55`, color: active ? BG : color, background: active ? color : "transparent" }}
    >
      {children}
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]" style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}>
      kernel error: {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cyclic exterior palette (deep-blue → cyan → white → violet)        */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const CYC: RGB[] = [
  [4, 12, 30],
  [8, 78, 140],
  [34, 211, 238],
  [206, 250, 255],
  [168, 85, 247],
  [58, 20, 92],
  [4, 12, 30], // loop back
];
function cyclic(u: number): RGB {
  const x = u - Math.floor(u); // frac
  const seg = (CYC.length - 1);
  const f = x * seg;
  const i = Math.min(seg - 1, Math.floor(f));
  const t = f - i;
  const a = CYC[i], b = CYC[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const INTERIOR: RGB = [4, 24, 32];

/* ------------------------------------------------------------------ */
/*  Renderer                                                           */
/* ------------------------------------------------------------------ */

function renderMandel(
  canvas: HTMLCanvasElement,
  color: HTMLCanvasElement,
  bloom: HTMLCanvasElement,
  cimg: ImageData,
  bimg: ImageData,
  buf: Float64Array,
  offset: number,
  glowPulse: number,
) {
  const cctx = color.getContext("2d");
  const bctx = bloom.getContext("2d");
  if (!cctx || !bctx) return;
  const cd = cimg.data;
  const bd = bimg.data;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = py * W + px;
      const v = buf[idx];
      const o = idx * 4;
      if (v <= 0.0) {
        // Certified interior / boundary — the "proven ∈ M" region.
        cd[o] = INTERIOR[0]; cd[o + 1] = INTERIOR[1]; cd[o + 2] = INTERIOR[2]; cd[o + 3] = 255;
        // brighter glow along the certified boundary (interior pixel touching exterior)
        const up = py > 0 ? buf[idx - W] : 0;
        const dn = py < H - 1 ? buf[idx + W] : 0;
        const lf = px > 0 ? buf[idx - 1] : 0;
        const rt = px < W - 1 ? buf[idx + 1] : 0;
        const edge = up > 0 || dn > 0 || lf > 0 || rt > 0;
        if (edge) { bd[o] = 150; bd[o + 1] = 245; bd[o + 2] = 255; }
        else { bd[o] = 14; bd[o + 1] = 120; bd[o + 2] = 150; }
        bd[o + 3] = 255;
      } else {
        // Certified exterior — smooth-iteration cyclic banding.
        const t = Math.log(1.0 + v) * 0.42 - offset;
        const c = cyclic(t);
        cd[o] = c[0]; cd[o + 1] = c[1]; cd[o + 2] = c[2]; cd[o + 3] = 255;
        bd[o] = 0; bd[o + 1] = 0; bd[o + 2] = 0; bd[o + 3] = 255;
      }
    }
  }
  cctx.putImageData(cimg, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const CW = canvas.width, CH = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CW, CH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(color, 0, 0, W, H, 0, 0, CW, CH);

  // Additive glow around the proven-interior region.
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.9 * glowPulse;
  ctx.filter = `blur(${Math.max(2, Math.round(CW / 150))}px)`;
  ctx.drawImage(bloom, 0, 0, W, H, 0, 0, CW, CH);
  ctx.globalAlpha = 0.5 * glowPulse;
  ctx.filter = `blur(${Math.max(6, Math.round(CW / 55))}px)`;
  ctx.drawImage(bloom, 0, 0, W, H, 0, 0, CW, CH);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const vg = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.32, CW / 2, CH / 2, CW * 0.74);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CW, CH);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface View { cx: number; cy: number; scale: number; maxiter: number }
interface MState { buf: Float64Array; ms: number; scale: number; maxiter: number; interiorFrac: number }

const DETAILS = [
  { name: "fast", it: 150 },
  { name: "fine", it: 260 },
  { name: "deep", it: 420 },
] as const;

export default function Mandelbrot() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [detailIdx, setDetailIdx] = useState(1);
  const [zoomOn, setZoomOn] = useState(true);
  const [view, setView] = useState<View>({ cx: TX, cy: TY, scale: WIDE_SCALE, maxiter: DETAILS[1].it });
  const [state, setState] = useState<MState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const cimgRef = useRef<ImageData | null>(null);
  const bimgRef = useRef<ImageData | null>(null);
  const stateRef = useRef<MState | null>(null);
  stateRef.current = state;
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const computingRef = useRef(false);
  computingRef.current = computing;
  const zoomOnRef = useRef(zoomOn);
  zoomOnRef.current = zoomOn;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const drawRef = useRef<() => void>(() => {});
  const magRef = useRef<HTMLSpanElement>(null);
  const timingRef = useRef<HTMLSpanElement>(null);

  if (colorRef.current === null && typeof document !== "undefined") {
    colorRef.current = document.createElement("canvas");
    colorRef.current.width = W; colorRef.current.height = H;
    bloomRef.current = document.createElement("canvas");
    bloomRef.current.width = W; bloomRef.current.height = H;
    const cctx = colorRef.current.getContext("2d");
    const bctx = bloomRef.current.getContext("2d");
    if (cctx) cimgRef.current = cctx.createImageData(W, H);
    if (bctx) bimgRef.current = bctx.createImageData(W, H);
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current, color = colorRef.current, bloom = bloomRef.current;
    const cimg = cimgRef.current, bimg = bimgRef.current, s = stateRef.current;
    if (!canvas || !color || !bloom || !cimg || !bimg || !s) return;
    const pulse = reducedRef.current ? 1 : 0.82 + 0.18 * Math.sin(performance.now() * 0.0016);
    renderMandel(canvas, color, bloom, cimg, bimg, s.buf, offsetRef.current, pulse);
  }, []);
  useEffect(() => { drawRef.current = draw; }, [draw]);

  /* -- compute a view (certified, latest-wins) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const buf = await call<Float64Array>("mandelbrot_certified", W, H, view.cx, view.cy, view.scale, view.maxiter);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        let interior = 0;
        for (let i = 0; i < buf.length; i++) if (buf[i] <= 0) interior++;
        setState({ buf, ms, scale: view.scale, maxiter: view.maxiter, interiorFrac: interior / buf.length });
        stateRef.current = { buf, ms, scale: view.scale, maxiter: view.maxiter, interiorFrac: interior / buf.length };
        if (magRef.current) magRef.current.textContent = `${Math.round(WIDE_SCALE / view.scale).toLocaleString()}×`;
        drawRef.current();
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, view, call]);

  /* -- guided-zoom clock: advance scale when idle, reset at the bottom -- */
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      if (!zoomOnRef.current || reducedRef.current || !inViewRef.current) return;
      if (computingRef.current) return; // throttle to compute cadence
      setView((v) => {
        const next = v.scale * ZOOM_FACTOR;
        if (next < MIN_SCALE) return { ...v, scale: WIDE_SCALE }; // loop the dive
        return { ...v, scale: next };
      });
    }, 110);
    return () => clearInterval(id);
  }, [ready, inViewRef]);

  /* -- DPR-aware backing store -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
      const cssW = canvas.clientWidth || 480;
      const size = Math.max(240, Math.min(1024, Math.round(cssW * dpr)));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; drawRef.current(); }
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(canvas);
    window.addEventListener("resize", apply);
    return () => { ro?.disconnect(); window.removeEventListener("resize", apply); };
  }, []);

  /* -- palette-cycle loop (paused off-screen / reduced-motion) -- */
  useEffect(() => {
    if (!state) return;
    if (reduced || !inView) { draw(); return; }
    let last = performance.now();
    let acc = 0;
    const stepMs = 1000 / 30;
    const tick = (now: number) => {
      if (!inViewRef.current) { rafRef.current = null; return; }
      acc += now - last; last = now;
      if (acc >= stepMs) {
        offsetRef.current += 0.0016 * acc; // gentle band drift
        acc = 0;
        draw();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, inView, draw]);

  useEffect(() => { if (timingRef.current && state) timingRef.current.textContent = state.ms.toFixed(0); }, [state]);

  const setDetail = useCallback((i: number) => {
    setDetailIdx(i);
    setView((v) => ({ ...v, maxiter: DETAILS[i].it }));
  }, []);
  const resetView = useCallback(() => {
    setView((v) => ({ ...v, cx: TX, cy: TY, scale: WIDE_SCALE }));
  }, []);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">Frontier 04 · fs-ivl</span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            A proof, <span className="text-cyan-400">per pixel</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          style={{ filter: "saturate(1.1) contrast(1.05)" }}
          role="img"
          aria-label="Certified Mandelbrot set: proven-exterior pixels in a smooth cyan-violet palette, the certified interior glowing as the proven-in-set region"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${BG}dd` }}>
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-amber-300/90 animate-pulse">Reanimating kernel…</span>
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}>
            REAL fs-ivl interval arithmetic
          </span>
          {state && (
            <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>zoom</span>
                <span className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>
                  <span ref={magRef}>1×</span>
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>certify</span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD, textShadow: `0 0 8px ${EMERALD}66` }}>
                  <span ref={timingRef}>{state.ms.toFixed(0)}</span> ms
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>{state.maxiter} iterations</div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>proven ∈ M</span>
            <span className="h-3 w-3 rounded-sm" style={{ background: "radial-gradient(circle, #22d3ee, #04181f)", boxShadow: "0 0 8px rgba(34,211,238,0.7)", border: "1px solid rgba(34,211,238,0.5)" }} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>proven exterior</span>
            <span className="h-3 w-12 rounded-sm" style={{ background: "linear-gradient(90deg,#04121e,#0a4e8c,#22d3ee,#cefaff,#a855f7)" }} />
          </div>
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill onClick={() => setZoomOn((z) => !z)} active={zoomOn && !reduced} color={EMERALD} ariaLabel={zoomOn ? "Pause guided zoom" : "Start guided zoom"} disabled={!ready || reduced}>
          {zoomOn && !reduced ? "Diving" : "Dive"}
        </Pill>
        <Pill onClick={resetView} color={VIOLET} ariaLabel="Reset to the full set" disabled={!ready}>Reset view</Pill>
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>detail</span>
        {DETAILS.map((d, i) => (
          <Pill key={d.name} onClick={() => setDetail(i)} active={detailIdx === i} ariaLabel={`${d.it} iterations`} disabled={!ready}>
            {d.name}
          </Pill>
        ))}
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {W}×{H} certified pixels · {view.maxiter} interval iterations
        {state ? (<>{" "}<span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{state.ms.toFixed(0)} ms in WASM</span> · {(state.interiorFrac * 100).toFixed(1)}% proven interior</>) : null}
      </div>

      <motion.div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Every pixel here is classified with real <span className="text-cyan-300">fs-ivl</span> interval arithmetic (outward-rounded bounds), never a
        single floating-point sample. A pixel is painted as <span style={{ color: VIOLET }}>certified exterior</span> only when its entire square is
        *proven* to escape; the <span className="text-cyan-300">glowing region</span> is what remains, the pixels rigorously not shown to leave, the
        certified boundary of the set. The classification is a <span className="text-slate-200">proof, not a guess</span>, so no rounding artifact can
        sneak a pixel into the wrong class. Dive toward the seahorse valley and re-certify, live.
      </motion.div>
    </SyncContainer>
  );
}
