"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "@/components/motion";
import { cn } from "@/lib/utils";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";

/* ------------------------------------------------------------------ */
/*  Palette (FrankenSim)                                               */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const TEAL = "#14b8a6";
const EMERALD = "#10b981";
const AMBER = "#fbbf24";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

const HEAT_FRAMES = 120;
const HEAT_STEPS = 3;
const HEAT_RES = 560; // initial backing-store fallback; replaced by DPR sizing

/* ------------------------------------------------------------------ */
/*  Perceptual diverging colormap (cold-violet → dark → hot-cyan)      */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

/* Multi-stop ramps sampled from |t|=0 (center) outward to the extreme. */
const NEG_STOPS: [number, RGB][] = [
  [0.0, [6, 10, 16]],
  [0.22, [44, 24, 74]],
  [0.5, [118, 48, 188]],
  [0.78, [168, 85, 247]],
  [1.0, [224, 154, 255]],
];
const POS_STOPS: [number, RGB][] = [
  [0.0, [6, 10, 16]],
  [0.22, [8, 54, 70]],
  [0.5, [14, 132, 162]],
  [0.78, [34, 211, 238]],
  [1.0, [202, 247, 255]],
];

function sampleStops(stops: [number, RGB][], m: number): RGB {
  const x = m <= 0 ? 0 : m >= 1 ? 1 : m;
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = b === a ? 0 : (x - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

/** Diverging map: t∈[-1,1]. Negative → violet, 0 → near-black, positive → cyan. */
function diverge2(t: number, gamma: number): RGB {
  const m = Math.pow(Math.min(Math.abs(t), 1), gamma);
  return sampleStops(t < 0 ? NEG_STOPS : POS_STOPS, m);
}

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

function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}
    >
      kernel error: {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field renderer — colormap + hillshade relief + bloom + isolines    */
/* ------------------------------------------------------------------ */

/* Light direction for the 3-D relief shading (upper-left, from above). */
const LX = -0.46;
const LY = -0.62;
const LZ = 0.64;
const CONTOUR_LEVELS = [-0.62, -0.28, 0.28, 0.62];

function renderField(
  canvas: HTMLCanvasElement,
  color: HTMLCanvasElement,
  bloom: HTMLCanvasElement,
  data: Float64Array,
  offset: number,
  n: number,
  norm: number,
  gamma: number,
  relief: number,
) {
  color.width = n;
  color.height = n;
  bloom.width = n;
  bloom.height = n;
  const cctx = color.getContext("2d");
  const bctx = bloom.getContext("2d");
  if (!cctx || !bctx) return;
  const cimg = cctx.createImageData(n, n);
  const bimg = bctx.createImageData(n, n);
  const inv = norm > 0 ? 1 / norm : 1;

  const raw = (x: number, y: number) => {
    const xx = x < 0 ? 0 : x >= n ? n - 1 : x;
    const yy = y < 0 ? 0 : y >= n ? n - 1 : y;
    return data[offset + yy * n + xx] * inv;
  };

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const p = y * n + x;
      const v = raw(x, y);
      const tv = v < -1 ? -1 : v > 1 ? 1 : v;
      const base = diverge2(tv, gamma);

      // Hillshade: treat the field as a height map and light it.
      const dzdx = raw(x + 1, y) - raw(x - 1, y);
      const dzdy = raw(x, y + 1) - raw(x, y - 1);
      const nx = -dzdx * relief;
      const ny = -dzdy * relief;
      const len = Math.hypot(nx, ny, 1) || 1;
      let shade = (nx * LX + ny * LY + 1 * LZ) / len;
      shade = shade < 0 ? 0 : shade;
      const lightMul = 0.72 + 0.5 * shade;
      const spec = Math.pow(shade, 18) * 70; // ridge glint

      const r = base[0] * lightMul + spec;
      const g = base[1] * lightMul + spec;
      const b = base[2] * lightMul + spec;
      const o = p * 4;
      cimg.data[o] = r > 255 ? 255 : r;
      cimg.data[o + 1] = g > 255 ? 255 : g;
      cimg.data[o + 2] = b > 255 ? 255 : b;
      cimg.data[o + 3] = 255;

      // Selective bloom mask — only strong field regions emit glow.
      const mag = Math.abs(tv);
      const em = mag <= 0.42 ? 0 : (mag - 0.42) / 0.58;
      const emm = em * em;
      bimg.data[o] = Math.min(255, r * emm);
      bimg.data[o + 1] = Math.min(255, g * emm);
      bimg.data[o + 2] = Math.min(255, b * emm);
      bimg.data[o + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.drawImage(color, 0, 0, n, n, 0, 0, W, H);

  // Additive selective bloom.
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.85;
  ctx.filter = `blur(${Math.max(4, Math.round(W / 90))}px)`;
  ctx.drawImage(bloom, 0, 0, n, n, 0, 0, W, H);
  ctx.globalAlpha = 0.45;
  ctx.filter = `blur(${Math.max(9, Math.round(W / 42))}px)`;
  ctx.drawImage(bloom, 0, 0, n, n, 0, 0, W, H);
  ctx.filter = "none";

  // Iso-contours via marching squares — the "deep math" flourish.
  const sx = W / (n - 1);
  const sy = H / (n - 1);
  const posPath = new Path2D();
  const negPath = new Path2D();
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const tl = raw(x, y);
      const tr = raw(x + 1, y);
      const bl = raw(x, y + 1);
      const br = raw(x + 1, y + 1);
      for (const lv of CONTOUR_LEVELS) {
        const pts: [number, number][] = [];
        if (tl < lv !== tr < lv) pts.push([x + (lv - tl) / (tr - tl), y]);
        if (tr < lv !== br < lv) pts.push([x + 1, y + (lv - tr) / (br - tr)]);
        if (bl < lv !== br < lv) pts.push([x + (lv - bl) / (br - bl), y + 1]);
        if (tl < lv !== bl < lv) pts.push([x, y + (lv - tl) / (bl - tl)]);
        const path = lv < 0 ? negPath : posPath;
        if (pts.length === 2) {
          path.moveTo(pts[0][0] * sx, pts[0][1] * sy);
          path.lineTo(pts[1][0] * sx, pts[1][1] * sy);
        } else if (pts.length === 4) {
          path.moveTo(pts[0][0] * sx, pts[0][1] * sy);
          path.lineTo(pts[1][0] * sx, pts[1][1] * sy);
          path.moveTo(pts[2][0] * sx, pts[2][1] * sy);
          path.lineTo(pts[3][0] * sx, pts[3][1] * sy);
        }
      }
    }
  }
  ctx.lineWidth = Math.max(0.8, W / 720);
  ctx.shadowBlur = Math.max(3, W / 200);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "rgba(190,240,255,0.85)";
  ctx.shadowColor = CYAN_GLOW;
  ctx.stroke(posPath);
  ctx.strokeStyle = "rgba(224,170,255,0.8)";
  ctx.shadowColor = VIOLET;
  ctx.stroke(negPath);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // Vignette for depth.
  const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface FieldState {
  data: Float64Array;
  n: number;
  frames: number;
  norm: number;
  gamma: number;
  relief: number;
  ms: number;
  kind: "heat" | "poisson";
  seq: number;
}

export default function HeatPde() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [n, setN] = useState(64);
  const [steady, setSteady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [state, setState] = useState<FieldState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const tokenRef = useRef(0);
  const seqRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  // HUD nodes written imperatively so the animation loop never triggers a React
  // re-render (the frame counter + progress bar update via ref, not setState).
  const frameLabelRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const writeHud = useCallback((idx: number, frames: number) => {
    if (frameLabelRef.current) frameLabelRef.current.textContent = String(idx + 1);
    if (progressRef.current) {
      progressRef.current.style.width = `${Math.round((idx / Math.max(1, frames - 1)) * 100)}%`;
    }
  }, []);

  if (colorRef.current === null && typeof document !== "undefined") {
    colorRef.current = document.createElement("canvas");
    bloomRef.current = document.createElement("canvas");
  }

  /* -- compute (heat frames or steady-state Poisson) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        if (steady) {
          const t0 = performance.now();
          const field = await call<Float64Array>("poisson2d", n);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          let maxAbs = 0;
          for (let i = 0; i < field.length; i++) maxAbs = Math.max(maxAbs, Math.abs(field[i]));
          setState({ data: field, n, frames: 1, norm: maxAbs, gamma: 0.82, relief: 2.4, ms, kind: "poisson", seq: ++seqRef.current });
        } else {
          const t0 = performance.now();
          const frames = await call<Float64Array>("heat_frames", n, HEAT_FRAMES, HEAT_STEPS);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          let maxAbs = 0;
          for (let i = 0; i < frames.length; i++) maxAbs = Math.max(maxAbs, Math.abs(frames[i]));
          setState({ data: frames, n, frames: HEAT_FRAMES, norm: maxAbs, gamma: 0.72, relief: 2.8, ms, kind: "heat", seq: ++seqRef.current });
          frameRef.current = 0;
        }
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, n, steady, call]);

  /* -- draw a specific frame -- */
  const draw = useCallback(
    (idx: number) => {
      const canvas = canvasRef.current;
      const color = colorRef.current;
      const bloom = bloomRef.current;
      if (!canvas || !color || !bloom || !state) return;
      const clamped = Math.max(0, Math.min(idx, state.frames - 1));
      renderField(canvas, color, bloom, state.data, clamped * state.n * state.n, state.n, state.norm, state.gamma, state.relief);
    },
    [state],
  );

  useEffect(() => {
    drawRef.current = () => draw(frameRef.current);
  }, [draw]);

  /* -- DPR-aware backing store; redraw current frame on resize -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
      const cssW = canvas.clientWidth || HEAT_RES;
      const size = Math.max(240, Math.min(1024, Math.round(cssW * dpr)));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
        drawRef.current();
      }
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      ro.observe(canvas);
    }
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  /* -- animation loop (paused while the panel is off-screen) -- */
  useEffect(() => {
    if (!state) return;
    if (state.kind === "poisson" || reduced || !playing) {
      const idx = state.kind === "heat" && reduced ? Math.floor(state.frames * 0.18) : frameRef.current;
      draw(idx);
      if (state.kind === "heat" && reduced) {
        frameRef.current = idx;
        writeHud(idx, state.frames);
      }
      return;
    }
    // Off-screen: hold the current frame, run no rAF. Resumes on re-enter.
    if (!inView) {
      draw(frameRef.current);
      return;
    }

    let last = performance.now();
    let acc = 0;
    const stepMs = 1000 / 24;
    const tick = (now: number) => {
      acc += now - last;
      last = now;
      while (acc >= stepMs) {
        acc -= stepMs;
        frameRef.current = (frameRef.current + 1) % state.frames;
      }
      draw(frameRef.current);
      writeHud(frameRef.current, state.frames);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [state, playing, reduced, inView, draw, writeHud]);

  const restart = useCallback(() => {
    frameRef.current = 0;
    draw(0);
    if (state) writeHud(0, state.frames);
    if (!reduced) setPlaying(true);
  }, [draw, reduced, state, writeHud]);

  const pct = state ? Math.round((frameRef.current / Math.max(1, state.frames - 1)) * 100) : 0;
  const dof = n * n;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Demo 01 · fs-sparse
            </span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            A PDE, solved <span className="text-cyan-400">live</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* Canvas */}
      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          width={HEAT_RES}
          height={HEAT_RES}
          className="block aspect-square w-full max-w-full"
          style={{ filter: "saturate(1.12) contrast(1.04)" }}
          role="img"
          aria-label={
            steady
              ? "Steady-state Poisson solution rendered as a shaded diverging cyan and violet heatmap with iso-contours"
              : "Animated 2D heat-diffusion field rendered as a shaded diverging cyan and violet heatmap with iso-contours"
          }
        />

        {/* subtle top light bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${BG}dd` }}>
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-amber-300/90 animate-pulse">
              Reanimating kernel…
            </span>
          </div>
        )}

        {/* Glassy instrument HUD (top-left) */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            {steady ? "REAL fs-sparse CG · −Δu = f" : "REAL fs-sparse SpMV · uₜ = Δu"}
          </span>
          {state && (
            <div
              className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm"
              style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  DOF
                </span>
                <span className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>
                  {dof.toLocaleString()}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  {state.kind === "heat" ? "SpMV" : "CG solve"}
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD, textShadow: `0 0 8px ${EMERALD}66` }}>
                  {state.ms.toFixed(1)} ms
                </span>
              </div>
              {state.kind === "heat" && (
                <div className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>
                  frame <span ref={frameLabelRef}>{frameRef.current + 1}</span>/{state.frames}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Colormap legend (bottom-right) */}
        {state && (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5">
            <div className="flex flex-col items-end font-mono text-[7px] leading-tight" style={{ color: MUTED }}>
              <span style={{ color: CYAN_GLOW }}>+hot</span>
              <span>0</span>
              <span style={{ color: "#e0aaff" }}>−cold</span>
            </div>
            <div
              className="h-14 w-2 rounded-full"
              style={{
                background: "linear-gradient(to bottom, #caf7ff, #22d3ee, #0e84a2, #06090f, #762fbc, #a855f7, #e09aff)",
                boxShadow: "0 0 10px rgba(34,211,238,0.35)",
              }}
            />
          </div>
        )}

        {/* Steady-state "snap to equilibrium" seal */}
        <AnimatePresence>
          {state?.kind === "poisson" && !reduced && (
            <motion.div
              key={`eq-${state.seq}`}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, times: [0, 0.12, 0.7, 1], ease: "easeOut" }}
            >
              <motion.div
                className="absolute rounded-full"
                initial={{ width: 40, height: 40, opacity: 0.7 }}
                animate={{ width: 620, height: 620, opacity: 0 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                style={{ border: `1px solid ${CYAN_GLOW}`, boxShadow: `0 0 40px ${CYAN}55` }}
              />
              <motion.span
                className="rounded-full border px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.3em] backdrop-blur-sm"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ borderColor: VIOLET, background: "rgba(4,9,13,0.7)", color: "#d8b4fe", textShadow: `0 0 10px ${VIOLET}` }}
              >
                Equilibrium
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {state?.kind === "heat" && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div
              ref={progressRef}
              className="h-full transition-[width] duration-100"
              style={{ width: `${pct}%`, background: CYAN_GLOW, boxShadow: `0 0 8px ${CYAN_GLOW}` }}
            />
          </div>
        )}
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          grid
        </span>
        {[48, 64, 80].map((g) => (
          <Pill
            key={g}
            onClick={() => setN(g)}
            active={n === g}
            ariaLabel={`Set grid size to ${g} by ${g}`}
            disabled={!ready}
          >
            {g}×{g}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill
          onClick={() => setPlaying((p) => !p)}
          active={playing && !steady && !reduced}
          color={EMERALD}
          ariaLabel={playing ? "Pause diffusion" : "Play diffusion"}
          disabled={!ready || steady || reduced}
        >
          {playing && !reduced ? "Pause" : "Play"}
        </Pill>
        <Pill onClick={restart} color={TEAL} ariaLabel="Restart diffusion" disabled={!ready || steady}>
          Restart
        </Pill>
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill
          onClick={() => setSteady((s) => !s)}
          active={steady}
          color={VIOLET}
          ariaLabel="Toggle steady-state Poisson solution"
          disabled={!ready}
        >
          Steady state
        </Pill>
      </div>

      {/* Readout */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {steady ? "Poisson −Δu = f" : `${HEAT_FRAMES} frames × ${HEAT_STEPS} diffusion steps`} · {n}×{n} unknowns ={" "}
        {dof.toLocaleString()} DOF
        {state ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>{state.ms.toFixed(1)} ms in WASM</span>
          </>
        ) : null}
      </div>

      {/* Caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A genuine PDE solve, not a shader trick. Each animated frame is one explicit heat-diffusion step: a hot blob
        and a cold blob smoothing out under <span className="text-slate-200">fs-sparse&apos;s matrix-free SpMV</span>{" "}
        (sparse mat-vec) on a real 5-point Laplacian, lit here as a height field with live iso-contours. Flip to{" "}
        <span style={{ color: VIOLET }}>steady state</span> and it assembles that Laplacian, then runs{" "}
        <span className="text-slate-200">matrix-free conjugate gradients</span> to solve −Δu = f; the field snaps
        into equilibrium. Every frame is compiled Rust running in a Web Worker, genuinely solving the linear system
        in your tab.
      </div>
    </SyncContainer>
  );
}
