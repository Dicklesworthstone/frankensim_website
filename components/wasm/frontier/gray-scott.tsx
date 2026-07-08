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

const N = 128;
const FRAMES = 140;

const PRESETS = [
  { name: "Fingerprint", feed: 0.037, kill: 0.06, blurb: "labyrinthine ridges" },
  { name: "Mitosis", feed: 0.0367, kill: 0.0649, blurb: "self-dividing cells" },
  { name: "Coral", feed: 0.0545, kill: 0.062, blurb: "branching growth" },
  { name: "Spots", feed: 0.03, kill: 0.062, blurb: "drifting solitons" },
] as const;

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
/*  Lush organic colormap: near-black → deep teal → cyan → white-hot   */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const STOPS: [number, RGB][] = [
  [0.0, [4, 10, 14]],
  [0.14, [6, 42, 54]],
  [0.3, [10, 94, 116]],
  [0.44, [22, 168, 190]],
  [0.58, [90, 226, 236]],
  [0.76, [198, 250, 255]],
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

/* Hillshade light direction (upper-left, from above). */
const LX = -0.46, LY = -0.62, LZ = 0.64;

function renderGS(
  canvas: HTMLCanvasElement,
  color: HTMLCanvasElement,
  bloom: HTMLCanvasElement,
  data: Float64Array,
  offset: number,
  n: number,
  norm: number,
) {
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
      const m = v < 0 ? 0 : v > 1 ? 1 : v;
      const base = sampleStops(Math.pow(m, 0.85));

      const dzdx = raw(x + 1, y) - raw(x - 1, y);
      const dzdy = raw(x, y + 1) - raw(x, y - 1);
      const nx = -dzdx * 3.0, ny = -dzdy * 3.0;
      const len = Math.hypot(nx, ny, 1) || 1;
      let shade = (nx * LX + ny * LY + LZ) / len;
      shade = shade < 0 ? 0 : shade;
      const lightMul = 0.76 + 0.42 * shade;
      const spec = Math.pow(shade, 22) * 60 * m;

      const r = base[0] * lightMul + spec;
      const g = base[1] * lightMul + spec;
      const b = base[2] * lightMul + spec;
      const o = p * 4;
      cimg.data[o] = r > 255 ? 255 : r;
      cimg.data[o + 1] = g > 255 ? 255 : g;
      cimg.data[o + 2] = b > 255 ? 255 : b;
      cimg.data[o + 3] = 255;

      const em = m <= 0.5 ? 0 : (m - 0.5) / 0.5;
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
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(color, 0, 0, n, n, 0, 0, W, H);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.8;
  ctx.filter = `blur(${Math.max(3, Math.round(W / 110))}px)`;
  ctx.drawImage(bloom, 0, 0, n, n, 0, 0, W, H);
  ctx.globalAlpha = 0.4;
  ctx.filter = `blur(${Math.max(7, Math.round(W / 48))}px)`;
  ctx.drawImage(bloom, 0, 0, n, n, 0, 0, W, H);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface GSState { data: Float64Array; norm: number; ms: number; presetIdx: number }

export default function GrayScott() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [presetIdx, setPresetIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [state, setState] = useState<GSState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GSState | null>(null);
  stateRef.current = state;
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const timingRef = useRef<HTMLSpanElement>(null);
  const frameLabelRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  if (colorRef.current === null && typeof document !== "undefined") {
    colorRef.current = document.createElement("canvas");
    colorRef.current.width = N;
    colorRef.current.height = N;
    bloomRef.current = document.createElement("canvas");
    bloomRef.current.width = N;
    bloomRef.current.height = N;
  }

  const draw = useCallback((idx: number) => {
    const canvas = canvasRef.current, color = colorRef.current, bloom = bloomRef.current, s = stateRef.current;
    if (!canvas || !color || !bloom || !s) return;
    const clamped = Math.max(0, Math.min(idx, FRAMES - 1));
    renderGS(canvas, color, bloom, s.data, clamped * N * N, N, s.norm);
    if (frameLabelRef.current) frameLabelRef.current.textContent = String(clamped + 1);
    if (progressRef.current) progressRef.current.style.width = `${Math.round((clamped / (FRAMES - 1)) * 100)}%`;
  }, []);

  useEffect(() => { drawRef.current = () => draw(frameRef.current); }, [draw]);

  /* -- compute a preset's frames -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const p = PRESETS[presetIdx];
        const t0 = performance.now();
        const raw = await call<Float64Array>("gray_scott_frames", N, FRAMES, p.feed, p.kill);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        let maxV = 1e-6;
        for (let i = 0; i < raw.length; i++) if (raw[i] > maxV) maxV = raw[i];
        frameRef.current = 0;
        setState({ data: raw, norm: maxV * 0.94, ms, presetIdx });
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, presetIdx, call]);

  /* -- DPR-aware backing store -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
      const cssW = canvas.clientWidth || 480;
      const size = Math.max(240, Math.min(1024, Math.round(cssW * dpr)));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
        drawRef.current();
      }
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
      const idx = reduced ? FRAMES - 1 : frameRef.current;
      frameRef.current = idx;
      draw(idx);
      return;
    }
    let last = performance.now();
    let acc = 0;
    const stepMs = 1000 / 22;
    const tick = (now: number) => {
      if (!inViewRef.current) { rafRef.current = null; return; }
      acc += now - last;
      last = now;
      while (acc >= stepMs) { acc -= stepMs; frameRef.current = (frameRef.current + 1) % FRAMES; }
      draw(frameRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, playing, inView, draw]);

  useEffect(() => { if (timingRef.current && state) timingRef.current.textContent = state.ms.toFixed(1); }, [state]);

  const restart = useCallback(() => {
    frameRef.current = 0;
    draw(0);
    if (!reduced) setPlaying(true);
  }, [draw, reduced]);

  const preset = PRESETS[presetIdx];

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">Frontier 03 · fs-sparse</span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Life from two <span className="text-cyan-400">chemicals</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          style={{ filter: "saturate(1.14) contrast(1.05)" }}
          role="img"
          aria-label={`Gray-Scott reaction-diffusion, ${preset.name} regime, rendered as a glowing organic teal-and-cyan pattern`}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${BG}dd` }}>
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-amber-300/90 animate-pulse">Reanimating kernel…</span>
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}>
            REAL fs-sparse Laplacian SpMV
          </span>
          {state && (
            <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>F / k</span>
                <span className="font-mono text-[12px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>
                  {preset.feed.toFixed(4)} / {preset.kill.toFixed(4)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>solve</span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD, textShadow: `0 0 8px ${EMERALD}66` }}>
                  <span ref={timingRef}>{state.ms.toFixed(1)}</span> ms
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
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>regime</span>
        {PRESETS.map((p, i) => (
          <Pill key={p.name} onClick={() => setPresetIdx(i)} active={presetIdx === i} ariaLabel={`${p.name} regime: ${p.blurb}`} disabled={!ready}>
            {p.name}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill onClick={() => setPlaying((p) => !p)} active={playing && !reduced} color={EMERALD} ariaLabel={playing ? "Pause" : "Play"} disabled={!ready || reduced}>
          {playing && !reduced ? "Pause" : "Play"}
        </Pill>
        <Pill onClick={restart} color={VIOLET} ariaLabel="Restart growth" disabled={!ready}>Restart</Pill>
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {PRESETS[presetIdx].name} · {N}×{N} cells · {FRAMES} frames × 14 diffusion–reaction steps
        {state ? (<>{" "}<span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{state.ms.toFixed(1)} ms in WASM</span></>) : null}
      </div>

      <motion.div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        <span className="text-slate-200">Gray–Scott reaction–diffusion</span>: two virtual chemicals feed, react and diffuse, with diffusion applied
        by a real <span className="text-cyan-300">fs-sparse</span> Laplacian SpMV (sparse matrix–vector product) every step. From a single seeded
        square, <span style={{ color: VIOLET }}>emergent Turing patterns</span> grow, divide and branch like coral or a fingerprint. Nudge two
        numbers, the feed F and the kill k, and the whole morphology shifts regime. These aren&apos;t textures; they&apos;re a living dynamical system.
      </motion.div>
    </SyncContainer>
  );
}
