"use client";

/**
 * Deep Kernel 02 — "Real turbulence, exactly divergence-free."
 *
 * Drives the real `navier_stokes_cavity(cells, frames, re, stepsPerFrame)` kernel:
 * an incompressible lid-driven-cavity solve from fs-flux, FEEC-native with
 * H(div)-conforming velocities that are exactly divergence-free and pressure-robust.
 * The top lid drags fluid rightward; a primary recirculation vortex spins up and,
 * at higher Reynolds number, secondary corner eddies appear.
 *
 * We animate the returned frames on a high-DPI canvas — a diverging colormap for
 * vorticity (cyan negative → black → rose positive) with additive bloom, or a speed
 * heatmap. The Reynolds slider recomputes the whole unsteady solve on release.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";
import {
  BG,
  BORDER,
  CYAN,
  CYAN_GLOW,
  VIOLET,
  TEAL,
  EMERALD,
  ROSE,
  MUTED,
  BRIGHT,
  useReducedMotionSafe,
  useCanvasDpr,
  PanelHeader,
  Pill,
  Slider,
  ErrorNote,
  BootOverlay,
  Readout,
  Caption,
} from "./_chrome";

/* Fixed solve size — `cells` dominates cost (≈cells⁴); 4 keeps the full unsteady
   solve near ~1 s in WASM while the 20² output grid and 24 frames stay smooth. */
const CELLS = 4;
const FRAMES = 24;
const SPF = 3;
const G = 20;

type Mode = "vorticity" | "speed";
type RGB = [number, number, number];

/* ------------------------------------------------------------------ */
/*  Colormaps                                                          */
/* ------------------------------------------------------------------ */

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

const V_NEG: [number, RGB][] = [
  [0.0, [5, 9, 15]],
  [0.3, [8, 52, 70]],
  [0.56, [14, 130, 165]],
  [0.8, [34, 211, 238]],
  [1.0, [188, 244, 255]],
];
const V_POS: [number, RGB][] = [
  [0.0, [5, 9, 15]],
  [0.3, [70, 16, 34]],
  [0.56, [176, 42, 72]],
  [0.8, [244, 63, 94]],
  [1.0, [255, 198, 208]],
];
function vortColor(t: number): RGB {
  const m = Math.pow(Math.min(Math.abs(t), 1), 0.82);
  return sampleStops(t < 0 ? V_NEG : V_POS, m);
}

const SPD: [number, RGB][] = [
  [0.0, [2, 4, 9]],
  [0.1, [10, 20, 46]],
  [0.3, [24, 66, 122]],
  [0.52, [24, 150, 182]],
  [0.72, [40, 220, 240]],
  [0.9, [190, 250, 255]],
  [1.0, [255, 255, 255]],
];

/* ------------------------------------------------------------------ */
/*  Decode + normalization                                             */
/* ------------------------------------------------------------------ */

interface NSData {
  raw: Float64Array;
  frames: number;
  vScale: number; // symmetric vorticity scale (p98 of |ω|)
  sScale: number; // speed scale (p99)
  re: number;
  ms: number;
}

function decode(raw: Float64Array, re: number, ms: number): NSData {
  const F = raw[1] | 0;
  const gg = G * G;
  const vAbs: number[] = [];
  const spd: number[] = [];
  for (let f = 0; f < F; f++) {
    const base = 2 + f * 2 * gg;
    for (let i = 0; i < gg; i++) {
      spd.push(raw[base + i]);
      vAbs.push(Math.abs(raw[base + gg + i]));
    }
  }
  vAbs.sort((a, b) => a - b);
  spd.sort((a, b) => a - b);
  const vScale = Math.max(1e-6, vAbs[Math.floor(0.98 * (vAbs.length - 1))]);
  const sScale = Math.max(1e-6, spd[Math.floor(0.99 * (spd.length - 1))]);
  return { raw, frames: F, vScale, sScale, re, ms };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NavierStokesCavity() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [re, setRe] = useState(250);
  const [reCommitted, setReCommitted] = useState(250);
  const [mode, setMode] = useState<Mode>("vorticity");
  const [playing, setPlaying] = useState(true);
  const [state, setState] = useState<NSData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const cimgRef = useRef<ImageData | null>(null);
  const bimgRef = useRef<ImageData | null>(null);
  const stateRef = useRef<NSData | null>(null);
  stateRef.current = state;
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const frameLabelRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  if (colorRef.current === null && typeof document !== "undefined") {
    colorRef.current = document.createElement("canvas");
    colorRef.current.width = G;
    colorRef.current.height = G;
    bloomRef.current = document.createElement("canvas");
    bloomRef.current.width = G;
    bloomRef.current.height = G;
    const cctx = colorRef.current.getContext("2d");
    const bctx = bloomRef.current.getContext("2d");
    if (cctx) cimgRef.current = cctx.createImageData(G, G);
    if (bctx) bimgRef.current = bctx.createImageData(G, G);
  }

  const draw = useCallback((idx: number) => {
    const canvas = canvasRef.current;
    const color = colorRef.current;
    const bloom = bloomRef.current;
    const cimg = cimgRef.current;
    const bimg = bimgRef.current;
    const s = stateRef.current;
    if (!canvas || !color || !bloom || !cimg || !bimg || !s) return;
    const cctx = color.getContext("2d");
    const bctx = bloom.getContext("2d");
    const ctx = canvas.getContext("2d");
    if (!cctx || !bctx || !ctx) return;

    const clamped = Math.max(0, Math.min(idx, s.frames - 1));
    const gg = G * G;
    const base = 2 + clamped * 2 * gg;
    const m = modeRef.current;
    const cd = cimg.data;
    const bd = bimg.data;

    for (let py = 0; py < G; py++) {
      // lid is at high iy → put it at the top of the canvas (flip).
      const iy = G - 1 - py;
      for (let ix = 0; ix < G; ix++) {
        const o = (py * G + ix) * 4;
        let cr: number, cg: number, cb: number, emit: number;
        if (m === "vorticity") {
          const w = s.raw[base + gg + iy * G + ix] / s.vScale;
          const col = vortColor(w);
          cr = col[0];
          cg = col[1];
          cb = col[2];
          const mag = Math.min(1, Math.abs(w));
          emit = mag <= 0.42 ? 0 : (mag - 0.42) / 0.58;
        } else {
          const sp = Math.min(1, s.raw[base + iy * G + ix] / s.sScale);
          const col = sampleStops(SPD, Math.pow(sp, 0.85));
          cr = col[0];
          cg = col[1];
          cb = col[2];
          emit = sp <= 0.4 ? 0 : (sp - 0.4) / 0.6;
        }
        cd[o] = cr;
        cd[o + 1] = cg;
        cd[o + 2] = cb;
        cd[o + 3] = 255;
        const em = emit * emit;
        bd[o] = Math.min(255, cr * em);
        bd[o + 1] = Math.min(255, cg * em);
        bd[o + 2] = Math.min(255, cb * em);
        bd[o + 3] = 255;
      }
    }
    cctx.putImageData(cimg, 0, 0);
    bctx.putImageData(bimg, 0, 0);

    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(color, 0, 0, G, G, 0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.9;
    ctx.filter = `blur(${Math.max(3, Math.round(W / 88))}px)`;
    ctx.drawImage(bloom, 0, 0, G, G, 0, 0, W, H);
    ctx.globalAlpha = 0.5;
    ctx.filter = `blur(${Math.max(8, Math.round(W / 40))}px)`;
    ctx.drawImage(bloom, 0, 0, G, G, 0, 0, W, H);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // lid shear line (top)
    ctx.fillStyle = "rgba(226,240,255,0.5)";
    ctx.fillRect(0, 0, W, Math.max(1, H / 200));

    const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.26, W / 2, H / 2, W * 0.74);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.52)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (frameLabelRef.current) frameLabelRef.current.textContent = String(clamped + 1);
    if (progressRef.current) progressRef.current.style.width = `${Math.round((clamped / (s.frames - 1)) * 100)}%`;
  }, []);

  useEffect(() => {
    drawRef.current = () => draw(frameRef.current);
  }, [draw]);

  const stableRedraw = useCallback(() => drawRef.current(), []);
  useCanvasDpr(canvasRef, stableRedraw);

  /* -- compute the unsteady solve (on Reynolds commit) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("navier_stokes_cavity", CELLS, FRAMES, reCommitted, SPF);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        frameRef.current = 0;
        setState(decode(raw, reCommitted, ms));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, reCommitted, call]);

  // redraw on data / mode change
  useEffect(() => {
    draw(frameRef.current);
  }, [draw, state, mode]);

  /* -- animation loop -- */
  useEffect(() => {
    if (!state) return;
    if (reduced || !playing || !inView) {
      const idx = reduced ? state.frames - 1 : frameRef.current;
      frameRef.current = idx;
      draw(idx);
      return;
    }
    let last = performance.now();
    let acc = 0;
    const stepMs = 1000 / 22;
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      acc += now - last;
      last = now;
      while (acc >= stepMs) {
        acc -= stepMs;
        frameRef.current = (frameRef.current + 1) % state.frames;
      }
      draw(frameRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, playing, inView, draw]);

  const restart = useCallback(() => {
    frameRef.current = 0;
    draw(0);
    if (!reduced) setPlaying(true);
  }, [draw, reduced]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <PanelHeader
        eyebrow="Deep 02 · fs-flux"
        title={
          <>
            Real turbulence, <span className="text-cyan-400">exactly divergence-free</span>.
          </>
        }
        computing={computing}
      />

      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          style={{ filter: "saturate(1.15) contrast(1.06)" }}
          role="img"
          aria-label="Animated lid-driven cavity flow; vorticity shown as a diverging cyan-to-rose field with a recirculating central vortex"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && <BootOverlay />}

        {/* lid direction marker */}
        <div className="pointer-events-none absolute right-3 top-2 font-mono text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(226,240,255,0.75)" }}>
          lid →
        </div>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            REAL fs-flux · ∇·u = 0
          </span>
          {state && (
            <div
              className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm"
              style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  Re
                </span>
                <span className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>
                  {state.re}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  {FRAMES}×{SPF} steps
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD, textShadow: `0 0 8px ${EMERALD}66` }}>
                  {state.ms.toFixed(0)} ms
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>
                frame <span ref={frameLabelRef}>1</span>/{FRAMES}
              </div>
            </div>
          )}
        </div>

        {/* diverging legend (vorticity) */}
        {state && mode === "vorticity" && (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5">
            <div className="flex flex-col items-end font-mono text-[7px] leading-tight" style={{ color: MUTED }}>
              <span style={{ color: ROSE }}>+ω</span>
              <span>0</span>
              <span style={{ color: CYAN_GLOW }}>−ω</span>
            </div>
            <div
              className="h-14 w-2 rounded-full"
              style={{ background: "linear-gradient(to bottom, #ffc6d0, #f43f5e, #b02a48, #05090f, #0e82a5, #22d3ee, #bcf4ff)" }}
            />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div ref={progressRef} className="h-full transition-[width] duration-100" style={{ width: "0%", background: CYAN_GLOW, boxShadow: `0 0 8px ${CYAN_GLOW}` }} />
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill onClick={() => setMode("vorticity")} active={mode === "vorticity"} ariaLabel="Show vorticity" disabled={!ready}>
          Vorticity
        </Pill>
        <Pill onClick={() => setMode("speed")} active={mode === "speed"} color={TEAL} ariaLabel="Show speed" disabled={!ready}>
          Speed
        </Pill>
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill onClick={() => setPlaying((p) => !p)} active={playing && !reduced} color={EMERALD} ariaLabel={playing ? "Pause" : "Play"} disabled={!ready || reduced}>
          {playing && !reduced ? "Pause" : "Play"}
        </Pill>
        <Pill onClick={restart} color={VIOLET} ariaLabel="Restart from t=0" disabled={!ready}>
          Restart
        </Pill>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Slider
          label="Re"
          value={re}
          min={50}
          max={500}
          step={10}
          onChange={setRe}
          onCommit={(v) => setReCommitted(v)}
          format={(v) => String(v)}
          disabled={!ready}
        />
      </div>

      <Readout>
        {state ? (
          <>
            lid-driven cavity · {G}×{G} field · Re {state.re} · {FRAMES} frames × {SPF} substeps{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{state.ms.toFixed(0)} ms in WASM</span>
          </>
        ) : (
          "spinning up the recirculation vortex…"
        )}
      </Readout>

      <Caption>
        Genuine incompressible <span className="text-slate-200">Navier–Stokes</span>, solved by{" "}
        <span className="text-cyan-300">fs-flux</span>: the velocity field is built from H(div)-conforming elements, so it
        is <span className="text-slate-200">exactly divergence-free</span> and pressure-robust — the discrete flow conserves
        mass to machine precision rather than merely approximately. The top lid drags fluid right; a primary vortex spins up
        and, as you raise the <span style={{ color: CYAN }}>Reynolds number</span>, the core tightens and corner eddies
        emerge. This is real computational fluid dynamics — a full unsteady cavity benchmark — recomputed from scratch in
        your browser every time you move the slider.
      </Caption>
    </SyncContainer>
  );
}
