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

const N = 64;
const FRAMES = 120;

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
/*  Cyan-plasma smoke colormap on density [0,1]                        */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const STOPS: [number, RGB][] = [
  [0.0, [2, 4, 9]],
  [0.08, [14, 16, 52]],
  [0.24, [56, 32, 138]],
  [0.44, [30, 138, 196]],
  [0.62, [40, 220, 240]],
  [0.82, [190, 250, 255]],
  [1.0, [255, 255, 255]],
];
function sampleStops(m: number): RGB {
  const x = m <= 0 ? 0 : m >= 1 ? 1 : m;
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1];
      const [b, cb] = STOPS[i];
      const t = b === a ? 0 : (x - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

function renderFluid(
  canvas: HTMLCanvasElement,
  color: HTMLCanvasElement,
  bloom: HTMLCanvasElement,
  cimg: ImageData,
  bimg: ImageData,
  data: Float64Array,
  offset: number,
  shimmer: number,
) {
  const cctx = color.getContext("2d");
  const bctx = bloom.getContext("2d");
  if (!cctx || !bctx) return;
  const cd = cimg.data, bd = bimg.data;

  for (let py = 0; py < N; py++) {
    // j=0 is the BOTTOM of the sim; screen row 0 is the top → flip.
    const j = N - 1 - py;
    for (let i = 0; i < N; i++) {
      const d = data[offset + j * N + i];
      const m = d < 0 ? 0 : d > 1 ? 1 : d;
      const c = sampleStops(Math.pow(m, 0.82));
      const o = (py * N + i) * 4;
      cd[o] = c[0]; cd[o + 1] = c[1]; cd[o + 2] = c[2]; cd[o + 3] = 255;
      const em = m <= 0.32 ? 0 : (m - 0.32) / 0.68;
      const emm = em * em;
      bd[o] = Math.min(255, c[0] * emm);
      bd[o + 1] = Math.min(255, c[1] * emm);
      bd[o + 2] = Math.min(255, c[2] * emm);
      bd[o + 3] = 255;
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
  ctx.drawImage(color, 0, 0, N, N, 0, 0, CW, CH);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.85 * shimmer;
  ctx.filter = `blur(${Math.max(3, Math.round(CW / 90))}px)`;
  ctx.drawImage(bloom, 0, 0, N, N, 0, 0, CW, CH);
  ctx.globalAlpha = 0.45 * shimmer;
  ctx.filter = `blur(${Math.max(8, Math.round(CW / 40))}px)`;
  ctx.drawImage(bloom, 0, 0, N, N, 0, 0, CW, CH);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const vg = ctx.createRadialGradient(CW / 2, CH * 0.6, CW * 0.25, CW / 2, CH * 0.6, CW * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CW, CH);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface FState { data: Float64Array; ms: number }

export default function Fluid() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [playing, setPlaying] = useState(true);
  const [state, setState] = useState<FState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const cimgRef = useRef<ImageData | null>(null);
  const bimgRef = useRef<ImageData | null>(null);
  const stateRef = useRef<FState | null>(null);
  stateRef.current = state;
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const timingRef = useRef<HTMLSpanElement>(null);
  const frameLabelRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  if (colorRef.current === null && typeof document !== "undefined") {
    colorRef.current = document.createElement("canvas");
    colorRef.current.width = N; colorRef.current.height = N;
    bloomRef.current = document.createElement("canvas");
    bloomRef.current.width = N; bloomRef.current.height = N;
    const cctx = colorRef.current.getContext("2d");
    const bctx = bloomRef.current.getContext("2d");
    if (cctx) cimgRef.current = cctx.createImageData(N, N);
    if (bctx) bimgRef.current = bctx.createImageData(N, N);
  }

  const draw = useCallback((idx: number) => {
    const canvas = canvasRef.current, color = colorRef.current, bloom = bloomRef.current;
    const cimg = cimgRef.current, bimg = bimgRef.current, s = stateRef.current;
    if (!canvas || !color || !bloom || !cimg || !bimg || !s) return;
    const clamped = Math.max(0, Math.min(idx, FRAMES - 1));
    const shimmer = reducedRef.current ? 1 : 0.9 + 0.1 * Math.sin(performance.now() * 0.004);
    renderFluid(canvas, color, bloom, cimg, bimg, s.data, clamped * N * N, shimmer);
    if (frameLabelRef.current) frameLabelRef.current.textContent = String(clamped + 1);
    if (progressRef.current) progressRef.current.style.width = `${Math.round((clamped / (FRAMES - 1)) * 100)}%`;
  }, []);
  useEffect(() => { drawRef.current = () => draw(frameRef.current); }, [draw]);

  /* -- compute the smoke frames once -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("fluid_frames", N, FRAMES);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        frameRef.current = 0;
        setState({ data: raw, ms });
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, call]);

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

  /* -- animation loop (paused off-screen / reduced-motion) -- */
  useEffect(() => {
    if (!state) return;
    if (reduced || !playing || !inView) {
      const idx = reduced ? Math.floor(FRAMES * 0.7) : frameRef.current;
      frameRef.current = idx;
      draw(idx);
      return;
    }
    let last = performance.now();
    let acc = 0;
    const stepMs = 1000 / 26;
    const tick = (now: number) => {
      if (!inViewRef.current) { rafRef.current = null; return; }
      acc += now - last; last = now;
      while (acc >= stepMs) { acc -= stepMs; frameRef.current = (frameRef.current + 1) % FRAMES; }
      draw(frameRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, playing, inView, draw]);

  useEffect(() => { if (timingRef.current && state) timingRef.current.textContent = state.ms.toFixed(0); }, [state]);

  const restart = useCallback(() => {
    frameRef.current = 0;
    draw(0);
    if (!reduced) setPlaying(true);
  }, [draw, reduced]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">Frontier 05 · fs-sparse CG</span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Solve the <span className="text-cyan-400">flow</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          style={{ filter: "saturate(1.15) contrast(1.06)" }}
          role="img"
          aria-label="Rising smoke from a 2D stable-fluids simulation, glowing cyan-plasma density lifting upward"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${BG}dd` }}>
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-amber-300/90 animate-pulse">Reanimating kernel…</span>
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}>
            REAL fs-sparse CG · ∇·u = 0
          </span>
          {state && (
            <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>grid</span>
                <span className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>{N}×{N}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>{FRAMES} projections</span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD, textShadow: `0 0 8px ${EMERALD}66` }}>
                  <span ref={timingRef}>{state.ms.toFixed(0)}</span> ms
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>
                frame <span ref={frameLabelRef}>1</span>/{FRAMES}
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div ref={progressRef} className="h-full transition-[width] duration-100" style={{ width: "0%", background: CYAN_GLOW, boxShadow: `0 0 8px ${CYAN_GLOW}` }} />
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill onClick={() => setPlaying((p) => !p)} active={playing && !reduced} color={EMERALD} ariaLabel={playing ? "Pause" : "Play"} disabled={!ready || reduced}>
          {playing && !reduced ? "Pause" : "Play"}
        </Pill>
        <Pill onClick={restart} color={VIOLET} ariaLabel="Restart the plume" disabled={!ready}>Restart</Pill>
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {N}×{N} velocity grid · {FRAMES} frames · one CG Poisson solve each
        {state ? (<>{" "}<span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{state.ms.toFixed(0)} ms in WASM</span></>) : null}
      </div>

      <motion.div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Real 2-D <span className="text-slate-200">stable fluids</span>: advect, add buoyancy, then make the velocity field incompressible. That
        incompressible <span style={{ color: VIOLET }}>projection step</span> is a genuine <span className="text-cyan-300">fs-sparse conjugate-gradient</span>
        {" "}Poisson solve, run every single frame, pulling out the pressure that cancels divergence. This is actual computational fluid dynamics, the same
        method used for film smoke, running in your browser. Watch the plume rise, curl and shear; it responds because it is being solved, not looped.
      </motion.div>
    </SyncContainer>
  );
}
